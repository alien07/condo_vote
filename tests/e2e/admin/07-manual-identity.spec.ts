import { expect, test } from "@playwright/test";
import { confirmInApp } from "../confirm-dialog";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  chooseSearchOption,
  demoAdminEmail,
  demoAdminName,
  appUrl,
  supabaseUrl,
  serviceKey,
  findUserByEmail,
} from "./admin-helpers";

test.describe("@test:e2e @test:auth @test:admin admin demo: manual vote identity", () => {
  test.skip(
    !supabaseUrl || !serviceKey,
    "Local Supabase service key is required for admin demo integration.",
  );

  test("pending manual vote identity blocks results until linked", async ({
    page,
  }) => {
    test.setTimeout(160_000);

    const supabase = createClient<Database>(supabaseUrl!, serviceKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    let user = await findUserByEmail(supabase, demoAdminEmail);

    if (!user) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: demoAdminEmail,
        email_confirm: true,
        user_metadata: {
          full_name: demoAdminName,
        },
      });

      expect(error).toBeNull();
      user = data.user;
    }

    expect(user).toBeTruthy();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          approval_status: "approved",
          auth_user_id: user!.id,
          default_status: "owner",
          preferred_language: "en",
          email: demoAdminEmail,
          full_name: demoAdminName,
        },
        { onConflict: "auth_user_id" },
      )
      .select("id")
      .single();

    expect(profileError).toBeNull();

    const { error: roleError } = await supabase.from("app_roles").upsert(
      [
        { profile_id: profile!.id, role: "admin" },
        // Storage settings need the system admin role (D016).
        { profile_id: profile!.id, role: "system_admin" },
      ],
      { onConflict: "profile_id,role" },
    );

    expect(roleError).toBeNull();

    const runId = Date.now();
    const meetingTitle = `Pending Identity Meeting ${runId}`;
    const roomNumber = `PENDING-${runId}`;
    const questionText = `Pending identity item ${runId}?`;
    const choiceText = `Approve pending ${runId}`;
    const pendingIdentity = `Paper voter ${runId}`;
    const startsAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const endsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert({ ownership_percent: 1, room_number: roomNumber })
      .select("id")
      .single();

    expect(roomError).toBeNull();

    const { data: meeting, error: meetingError } = await supabase
      .from("meetings")
      .insert({
        ends_at: endsAt,
        published_at: new Date().toISOString(),
        starts_at: startsAt,
        status: "published",
        title: meetingTitle,
      })
      .select("id")
      .single();

    expect(meetingError).toBeNull();

    const { data: question, error: questionError } = await supabase
      .from("meeting_questions")
      .insert({
        meeting_id: meeting!.id,
        question_text: questionText,
      })
      .select("id")
      .single();

    expect(questionError).toBeNull();

    const { data: choice, error: choiceError } = await supabase
      .from("meeting_choices")
      .insert({
        choice_text: choiceText,
        question_id: question!.id,
      })
      .select("id")
      .single();

    expect(choiceError).toBeNull();

    const { error: eligibleError } = await supabase
      .from("eligible_voters_snapshot")
      .insert({
        meeting_id: meeting!.id,
        ownership_percent: 1,
        profile_id: profile!.id,
        room_id: room!.id,
        source: "owner_master",
        voter_type: "owner",
      });

    expect(eligibleError).toBeNull();

    const { data: pendingManualBallot, error: pendingManualBallotError } =
      await supabase
        .from("manual_ballots")
        .insert({
          identity_status: "pending",
          imported_by: profile!.id,
          meeting_id: meeting!.id,
          room_id: room!.id,
          source_label: "manual_pending_identity",
          status: "draft",
          voter_identity_text: pendingIdentity,
        })
        .select("id")
        .single();

    expect(pendingManualBallotError).toBeNull();

    const { error: answerError } = await supabase
      .from("manual_ballot_answers")
      .insert({
        choice_id: choice!.id,
        manual_ballot_id: pendingManualBallot!.id,
        question_id: question!.id,
      });

    expect(answerError).toBeNull();

    const { data: link, error: linkError } =
      await supabase.auth.admin.generateLink({
        email: demoAdminEmail,
        options: {
          redirectTo: `${appUrl}/auth/callback`,
        },
        type: "magiclink",
      });

    expect(linkError).toBeNull();
    await page.goto(
      `${appUrl}/auth/callback?token_hash=${encodeURIComponent(
        link.properties!.hashed_token,
      )}&type=${link.properties!.verification_type}`,
    );

    await page.goto(
      `${appUrl}/admin/meetings?tab=meetings&title=${encodeURIComponent(
        meetingTitle,
      )}`,
      { waitUntil: "domcontentloaded" },
    );
    const meetingRow = page.getByRole("row").filter({ hasText: meetingTitle });
    await expect(
      meetingRow.getByRole("link", { name: /Resolve 1 pending manual vote/ }),
    ).toBeVisible();
    await expect(
      meetingRow.getByRole("button", { name: "Generate result" }),
    ).toHaveCount(0);

    await page.goto(`${appUrl}/admin/voting`);
    const pendingPanel = page
      .getByRole("heading", { name: "Pending manual vote identities" })
      .locator("xpath=ancestor::section[1]");
    const pendingRow = pendingPanel
      .locator("[data-pending-ballot-id]")
      .filter({ hasText: meetingTitle })
      .filter({ hasText: pendingIdentity });

    await expect(pendingRow).toBeVisible();
    await pendingRow.getByRole("link", { name: "Link profile" }).click();
    const resolveDrawer = page.getByLabel("Resolve manual vote identity");
    await chooseSearchOption(resolveDrawer, "voter_profile_id", demoAdminEmail);
    await resolveDrawer.getByRole("button", { name: "Link profile" }).click();
    await confirmInApp(page);

    await expect(page).toHaveURL(/focusManualBallotId=/);
    await expect(pendingRow).toHaveCount(0);

    const { data: resolvedManualBallot, error: resolvedManualBallotError } =
      await supabase
        .from("manual_ballots")
        .select("identity_status, status, voter_profile_id")
        .eq("id", pendingManualBallot!.id)
        .single();

    expect(resolvedManualBallotError).toBeNull();
    expect(resolvedManualBallot).toMatchObject({
      identity_status: "linked",
      status: "submitted",
      voter_profile_id: profile!.id,
    });

    const { data: identityAuditLogs, error: identityAuditError } = await supabase
      .from("audit_logs")
      .select("action")
      .eq("entity_id", pendingManualBallot!.id)
      .eq("action", "manual_ballot.identity_resolved");

    expect(identityAuditError).toBeNull();
    expect(identityAuditLogs).toHaveLength(1);

    // Results wait until voting closes (D014).
    const { error: closeError } = await supabase
      .from("meetings")
      .update({ status: "closed" })
      .eq("id", meeting!.id);

    expect(closeError).toBeNull();

    await page.goto(
      `${appUrl}/admin/meetings?tab=meetings&title=${encodeURIComponent(
        meetingTitle,
      )}`,
    );
    const resolvedMeetingRow = page
      .getByRole("row")
      .filter({ hasText: meetingTitle });
    await resolvedMeetingRow
      .getByRole("button", { name: "Generate result" })
      .click();
    await expect(
      resolvedMeetingRow.getByRole("cell", { name: "closed", exact: true }),
    ).toBeVisible();

    // The meeting was already closed, so wait for the snapshot itself.
    await expect
      .poll(
        async () => {
          const { data } = await supabase
            .from("result_snapshots")
            .select("id")
            .eq("meeting_id", meeting!.id);

          return data?.length ?? 0;
        },
        { timeout: 15_000 },
      )
      .toBe(1);

    const approvalBlockTitle = `Approval Block Meeting ${runId}`;
    const approvalBlockRoomNumber = `APPROVAL-BLOCK-${runId}`;
    const approvalBlockIdentity = `Approval blocker ${runId}`;
    const [{ data: approvalBlockRoom }, { data: approvalBlockMeeting }] =
      await Promise.all([
        supabase
          .from("rooms")
          .insert({ ownership_percent: 1, room_number: approvalBlockRoomNumber })
          .select("id")
          .single(),
        supabase
          .from("meetings")
          .insert({
            ends_at: endsAt,
            published_at: new Date().toISOString(),
            starts_at: startsAt,
            status: "closed",
            title: approvalBlockTitle,
          })
          .select("id")
          .single(),
      ]);

    expect(approvalBlockRoom).toBeTruthy();
    expect(approvalBlockMeeting).toBeTruthy();

    const { data: approvalBlockSnapshot, error: approvalBlockSnapshotError } =
      await supabase
        .from("result_snapshots")
        .insert({
          // Generated by someone else, so the demo admin may approve (14a).
          generated_by: null,
          meeting_id: approvalBlockMeeting!.id,
          payload_json: {
            generated_at: new Date().toISOString(),
            meeting: { title: approvalBlockTitle },
            questions: [],
            totals: {
              eligible_voters: 1,
              manual_ballots: 0,
              online_ballots: 0,
              source_conflicts: 0,
              submitted_ballots: 0,
            },
          },
        })
        .select("id")
        .single();

    expect(approvalBlockSnapshotError).toBeNull();

    const { data: approvalBlockManualBallot, error: approvalBlockManualError } =
      await supabase
        .from("manual_ballots")
        .insert({
          identity_status: "pending",
          imported_by: profile!.id,
          meeting_id: approvalBlockMeeting!.id,
          room_id: approvalBlockRoom!.id,
          source_label: "manual_pending_identity",
          status: "draft",
          voter_identity_text: approvalBlockIdentity,
        })
        .select("id")
        .single();

    expect(approvalBlockManualError).toBeNull();

    await page.goto(
      `${appUrl}/admin/results?meeting=${encodeURIComponent(
        approvalBlockTitle,
      )}&mode=edit&type=result_approval&id=${approvalBlockSnapshot!.id}`,
    );
    const approvalDrawer = page.getByLabel("Approve result");

    await expect(approvalDrawer.getByText(/pending manual vote identity/)).toBeVisible();
    await expect(
      approvalDrawer.getByRole("button", { name: "Approval blocked" }),
    ).toBeDisabled();
    await expect(
      page
        .getByRole("row")
        .filter({ hasText: approvalBlockTitle })
        .getByRole("link", { name: /Resolve 1 pending manual vote/ }),
    ).toBeVisible();

    const { data: approvalRows, error: approvalRowsError } = await supabase
      .from("committee_approvals")
      .select("id")
      .eq("meeting_id", approvalBlockMeeting!.id);

    expect(approvalRowsError).toBeNull();
    expect(approvalRows).toHaveLength(0);

    const { data: approvedEmailRows, error: approvedEmailRowsError } =
      await supabase
        .from("email_logs")
        .select("id")
        .eq("template_key", `result_approved:${approvalBlockMeeting!.id}`);

    expect(approvedEmailRowsError).toBeNull();
    expect(approvedEmailRows).toHaveLength(0);
    expect(approvalBlockManualBallot).toBeTruthy();
  });
});
