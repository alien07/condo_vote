import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  appUrl,
  demoAdminEmail,
  demoAdminName,
  findUserByEmail,
  serviceKey,
  supabaseUrl,
} from "./admin-helpers";

// Admin overview (req_0008): waiting work first, then the meeting open for
// voting with turnout and quorum only (no votes per choice before approval).
test.describe("@test:e2e @test:auth @test:admin admin overview", () => {
  test.skip(!supabaseUrl || !serviceKey, "Local Supabase service key is required for admin demo integration.");

  test("waiting work first, then the open meeting's turnout and quorum without results", async ({ page }) => {
    test.setTimeout(120_000);

    const supabase = createClient<Database>(supabaseUrl!, serviceKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    let user = await findUserByEmail(supabase, demoAdminEmail);

    if (!user) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: demoAdminEmail,
        email_confirm: true,
        user_metadata: { full_name: demoAdminName },
      });

      expect(error).toBeNull();
      user = data.user;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          approval_status: "approved",
          auth_user_id: user!.id,
          default_status: "owner",
          email: demoAdminEmail,
          full_name: demoAdminName,
          preferred_language: "en",
        },
        { onConflict: "auth_user_id" },
      )
      .select("id")
      .single();

    expect(profileError).toBeNull();
    expect(
      (await supabase.from("app_roles").upsert([{ profile_id: profile!.id, role: "admin" }], { onConflict: "profile_id,role" }))
        .error,
    ).toBeNull();

    const stamp = Date.now();
    const meetingTitle = `Overview live meeting ${stamp}`;
    const secretChoice = `Overview secret choice ${stamp}`;
    const hour = 3_600_000;
    const { data: rooms, error: roomError } = await supabase
      .from("rooms")
      .insert([
        { ownership_percent: 40, room_number: `OV-A-${stamp}` },
        { ownership_percent: 60, room_number: `OV-B-${stamp}` },
      ])
      .select("id, room_number");

    expect(roomError).toBeNull();
    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .insert({
        ends_at: new Date(Date.now() + 2 * hour).toISOString(),
        published_at: new Date(Date.now() - 2 * hour).toISOString(),
        quorum_rule: "one_fourth_total_ownership",
        starts_at: new Date(Date.now() - hour).toISOString(),
        status: "published",
        title: meetingTitle,
      })
      .select("id")
      .single();

    expect(meetingError).toBeNull();
    // A waiting account, so "Waiting for you" has work in it.
    const { data: pending, error: pendingError } = await supabase
      .from("profiles")
      .insert({
        approval_status: "pending",
        default_status: "resident",
        email: `overview-pending-${stamp}@example.test`,
        full_name: `Overview pending ${stamp}`,
      })
      .select("id")
      .single();

    expect(pendingError).toBeNull();
    let ballotId: string | null = null;

    try {
      const { data: question, error: questionError } = await supabase
        .from("meeting_questions")
        .insert({ display_order: 1, meeting_id: meeting!.id, question_text: `Overview item ${stamp}?`, question_type: "single_choice" })
        .select("id")
        .single();

      expect(questionError).toBeNull();
      const { data: choice, error: choiceError } = await supabase
        .from("meeting_choices")
        .insert({ choice_text: secretChoice, display_order: 1, question_id: question!.id })
        .select("id")
        .single();

      expect(choiceError).toBeNull();
      expect(
        (
          await supabase.from("eligible_voters_snapshot").insert(
            rooms!.map((room, index) => ({
              meeting_id: meeting!.id,
              ownership_percent: index === 0 ? 40 : 60,
              profile_id: profile!.id,
              room_id: room.id,
              source: "owner_master",
              voter_type: "owner",
            })),
          )
        ).error,
      ).toBeNull();
      // Room A (40%) voted online: 1 of 2 rooms, 40% of 100%, quorum 1/4 met.
      const { data: ballot, error: ballotError } = await supabase
        .from("ballots")
        .insert({
          meeting_id: meeting!.id,
          room_id: rooms![0].id,
          status: "submitted",
          submitted_at: new Date().toISOString(),
          voter_profile_id: profile!.id,
        })
        .select("id")
        .single();

      expect(ballotError).toBeNull();
      ballotId = ballot!.id;
      expect(
        (await supabase.from("ballot_answers").insert({ ballot_id: ballotId, choice_id: choice!.id, question_id: question!.id }))
          .error,
      ).toBeNull();

      const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
        email: demoAdminEmail,
        options: { redirectTo: `${appUrl}/auth/callback` },
        type: "magiclink",
      });

      expect(linkError).toBeNull();
      await page.goto(
        `${appUrl}/auth/callback?token_hash=${encodeURIComponent(link.properties!.hashed_token)}&type=${
          link.properties!.verification_type
        }`,
      );

      for (const width of [1440, 768, 375]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${appUrl}/admin`);
        await expect(page.getByRole("heading", { level: 1, name: "Overview", exact: true })).toBeVisible();

        // Order: waiting work, meetings now, readiness, master data.
        expect(
          await page.locator("[data-overview-group]").evaluateAll((groups) =>
            groups.map((group) => group.getAttribute("data-overview-group")),
          ),
        ).toEqual(["attention", "live", "readiness", "master"]);
        // The waiting account card is amber and is the link to the list.
        const accounts = page.getByRole("link", { name: /Accounts waiting for approval/ });

        await expect(accounts).toHaveAttribute("data-tone", "waiting");
        await expect(accounts).toHaveAttribute("href", "/admin/people?tab=profiles&approval=pending");

        // The open meeting: turnout and quorum, no votes per choice.
        const spotlight = page.locator(`[data-spotlight-meeting="${meeting!.id}"]`);

        await expect(spotlight).toBeVisible();
        await expect(spotlight).toHaveAttribute("data-spotlight-state", "open");
        await expect(spotlight.locator("[data-turnout-rooms]")).toContainText("1 of 2");
        await expect(spotlight.locator("[data-turnout-ownership]")).toContainText("40% of 100%");
        await expect(spotlight.locator("[data-quorum]")).toHaveAttribute("data-quorum", "met");
        await expect(spotlight).toContainText(/Closes in/);
        await expect(page.locator("main")).not.toContainText(secretChoice);

        // No links grid any more; amber only means waiting work.
        await expect(page.getByRole("heading", { name: "Admin Functions" })).toHaveCount(0);
        expect(
          await page
            .locator("[data-tone]")
            .evaluateAll((cards) =>
              cards.filter(
                (card) => card.className.includes("amber") && card.getAttribute("data-tone") !== "waiting",
              ).length,
            ),
        ).toBe(0);

        // Every card link is at least 44 px high; no sideways scroll.
        for (const height of await page.locator("main a[data-metric]").evaluateAll((links) =>
          links.map((link) => link.getBoundingClientRect().height),
        )) {
          expect(height).toBeGreaterThanOrEqual(44);
        }

        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${width}px`).toBeLessThanOrEqual(0);
      }
    } finally {
      if (ballotId) {
        await supabase.from("ballot_answers").delete().eq("ballot_id", ballotId);
        await supabase.from("ballots").delete().eq("id", ballotId);
      }

      await supabase.from("eligible_voters_snapshot").delete().eq("meeting_id", meeting!.id);
      await supabase.from("meeting_questions").delete().eq("meeting_id", meeting!.id);
      await supabase.from("meetings").delete().eq("id", meeting!.id);
      await supabase.from("rooms").delete().in("id", rooms!.map((room) => room.id));
      await supabase.from("profiles").delete().eq("id", pending!.id);
    }
  });
});
