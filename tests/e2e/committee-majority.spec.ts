import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { appUrl, localEnv, serviceKey, supabaseUrl } from "./admin/admin-helpers";
import { confirmInApp } from "./confirm-dialog";

const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Committee majority and the chair's casting vote (req_0011 A, D027): four
// active members, so a decision needs 3. One member does not approve with a
// reason on the page, the votes end 2 to 2, and the chair decides.
test.describe("@test:e2e @test:committee committee majority", () => {
  test.skip(!supabaseUrl || !serviceKey || !anonKey, "Local Supabase keys are required.");

  test("a tie waits for the chair, whose deciding vote publishes the result", async ({ page }) => {
    test.setTimeout(180_000);

    const admin = createClient<Database>(supabaseUrl!, serviceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const stamp = Date.now();
    const password = `pw-${stamp}-Aa1!`;
    const people = [
      { key: "chair", position: "chair" },
      { key: "m2", position: "member" },
      { key: "m3", position: "member" },
      { key: "m4", position: "member" },
    ] as const;
    const ids: Record<string, { authId: string; profileId: string; email: string }> = {};
    const memberIds: string[] = [];

    for (const person of people) {
      const email = `committee-${person.key}-${stamp}@example.test`;
      const { data: user, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });

      expect(error).toBeNull();
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .insert({
          approval_status: "approved",
          auth_user_id: user.user!.id,
          default_status: "resident",
          email,
          full_name: `Member ${person.key} ${stamp}`,
          preferred_language: "en",
        })
        .select("id")
        .single();

      expect(profileError).toBeNull();
      ids[person.key] = { authId: user.user!.id, profileId: profile!.id, email };
    }

    const meetingTitle = `Majority meeting ${stamp}`;
    const past = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
    const { data: meeting } = await admin
      .from("meetings")
      .insert({ ends_at: past(1), published_at: past(3), starts_at: past(2), status: "closed", title: meetingTitle, required_approvals: 1 })
      .select("id")
      .single();
    const { data: snapshot } = await admin
      .from("result_snapshots")
      .insert({ meeting_id: meeting!.id, payload_json: { questions: [], totals: { eligible_voters: 1, submitted_ballots: 1 } } })
      .select("id")
      .single();

    async function answerAs(key: string, call: "approve" | "object", reason?: string) {
      const client = createClient<Database>(supabaseUrl!, anonKey!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      expect((await client.auth.signInWithPassword({ email: ids[key].email, password })).error).toBeNull();
      const { error } =
        call === "approve"
          ? await client.rpc("approve_result_snapshot", { p_result_snapshot_id: snapshot!.id, p_notes: "" })
          : await client.rpc("object_result_snapshot", { p_result_snapshot_id: snapshot!.id, p_reason: reason! });

      expect(error).toBeNull();
    }

    async function signIn(target: Page, key: string) {
      const { data: link, error } = await admin.auth.admin.generateLink({
        email: ids[key].email,
        options: { redirectTo: `${appUrl}/auth/callback` },
        type: "magiclink",
      });

      expect(error).toBeNull();
      await target.context().clearCookies();
      await target.goto(
        `${appUrl}/auth/callback?token_hash=${encodeURIComponent(link.properties!.hashed_token)}&type=${
          link.properties!.verification_type
        }`,
      );
    }

    try {
      for (const person of people) {
        const { profileId } = ids[person.key];

        expect((await admin.from("app_roles").insert({ profile_id: profileId, role: "committee" })).error).toBeNull();
        const { data: member, error } = await admin
          .from("committee_members")
          .insert({ profile_id: profileId, full_name: `Member ${person.key} ${stamp}`, position_code: person.position })
          .select("id")
          .single();

        expect(error).toBeNull();
        memberIds.push(member!.id);
      }

      await answerAs("m2", "approve");
      await answerAs("m3", "object", "The paper ballot of room A-101 is missing");

      // A member does not approve, with a reason, on the page.
      await signIn(page, "m4");
      await page.goto(`${appUrl}/committee`);
      await expect(page.locator("[data-committee-members]")).toContainText("4 active committee members");
      await expect(page.locator("[data-committee-members]")).toContainText("majority of 3");
      const card = page.locator(`[data-result-snapshot-id="${snapshot!.id}"]`);

      await expect(card.locator("[data-tally-line]")).toHaveText("Approved 1 · Not approved 1 · Needs 3 of 4");
      await expect(card.locator("[data-objections]")).toContainText("The paper ballot of room A-101 is missing");
      await card.getByRole("button", { name: "Do not approve" }).click();
      await card.locator("[data-result-object-form] textarea[name='reason']").fill("Agree: room A-101 is missing");
      await card.locator("[data-result-object-form]").getByRole("button", { name: "Send" }).click();
      await confirmInApp(page, "Your answer cannot change");
      await page.waitForURL(/\/committee\?[\s\S]*feedback=success/);
      await expect(page.getByText("Recorded: you did not approve this result")).toBeVisible();
      await expect(card.locator("[data-you-objected]")).toBeVisible();
      // Answers are final: no buttons left for this member.
      await expect(card.getByRole("button", { name: "Approve result" })).toHaveCount(0);

      // 2 to 2: a tie. Everyone but the chair sees who decides.
      await answerAs("chair", "approve");
      await page.reload();
      await expect(card.locator("[data-tally]")).toHaveAttribute("data-tally-status", "tie");
      await expect(card.locator("[data-tie-waiting]")).toContainText(`Member chair ${stamp}`);

      // The chair casts the deciding vote and the result is published.
      await signIn(page, "chair");
      await page.goto(`${appUrl}/committee`);
      const chairCard = page.locator(`[data-result-snapshot-id="${snapshot!.id}"]`);

      await expect(chairCard.locator("[data-casting-form]")).toBeVisible();
      await chairCard.getByRole("button", { name: "Decide: approve" }).click();
      await confirmInApp(page, "Cast the deciding vote?");
      await page.waitForURL(/\/committee\?[\s\S]*feedback=success/);
      await expect(page.getByText("Result approved and published")).toBeVisible();

      const { data: publication } = await admin
        .from("result_publications")
        .select("approvals_count, committee_members, required_approvals, objections_count, decided_by_casting_vote")
        .eq("meeting_id", meeting!.id)
        .single();

      expect(publication).toEqual({
        approvals_count: 2,
        committee_members: 4,
        required_approvals: 3,
        objections_count: 2,
        decided_by_casting_vote: true,
      });

      // No horizontal scroll on a phone.
      await page.setViewportSize({ width: 375, height: 800 });
      await page.goto(`${appUrl}/committee`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    } finally {
      // The majority counts every active member: leave none behind.
      await admin.from("committee_members").delete().in("id", memberIds);
      await admin
        .from("app_roles")
        .delete()
        .in("profile_id", Object.values(ids).map((entry) => entry.profileId))
        .eq("role", "committee");
    }
  });
});
