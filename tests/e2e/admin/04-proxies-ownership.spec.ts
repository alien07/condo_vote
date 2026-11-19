import { expect, test } from "@playwright/test";
import { confirmInApp } from "../confirm-dialog";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  demoAdminEmail,
  demoAdminName,
  appUrl,
  supabaseUrl,
  serviceKey,
  findUserByEmail,
  chooseSearchOption,
} from "./admin-helpers";

test.describe("@test:e2e @test:auth @test:admin admin demo: proxies and ownership", () => {
  test.skip(
    !supabaseUrl || !serviceKey,
    "Local Supabase service key is required for admin demo integration.",
  );

  test("proxy CRUD rollout validates and focuses reviewed rows", async ({
    page,
  }) => {
    test.setTimeout(120_000);

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
        user_metadata: { full_name: demoAdminName },
      });

      expect(error).toBeNull();
      user = data.user;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          auth_user_id: user!.id,
          email: demoAdminEmail,
          full_name: demoAdminName,
          approval_status: "approved",
          default_status: "owner",
          preferred_language: "en",
        },
        { onConflict: "auth_user_id" },
      )
      .select("id")
      .single();

    expect(profileError).toBeNull();
    const { error: roleError } = await supabase.from("app_roles").upsert(
      [
        { profile_id: profile!.id, role: "admin" },
        { profile_id: profile!.id, role: "system_admin" },
      ],
      { onConflict: "profile_id,role" },
    );

    expect(roleError).toBeNull();

    const stamp = Date.now();
    const meetingTitle = `Proxy rollout ${stamp}`;
    const roomNumber = `PROXY-${stamp}`;
    const ownerName = `Proxy Owner ${stamp}`;
    const startsAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const endsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    let proxyId: string | null = null;

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert({ ownership_percent: 1, room_number: roomNumber })
      .select("id")
      .single();

    expect(roomError).toBeNull();
    const { data: owner, error: ownerError } = await supabase
      .from("owners")
      .insert({
        active: true,
        email: `proxy-owner-${stamp}@example.com`,
        full_name: ownerName,
      })
      .select("id")
      .single();

    expect(ownerError).toBeNull();
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
    // The proxy holder is someone from outside the condo; the demo admin is
    // office staff and cannot hold a proxy (section 47, 0043).
    const outsiderEmail = `proxy-outsider-${stamp}@example.test`;
    const { data: outsiderUser, error: outsiderUserError } =
      await supabase.auth.admin.createUser({ email: outsiderEmail, email_confirm: true });

    expect(outsiderUserError).toBeNull();
    const { data: outsider, error: outsiderError } = await supabase
      .from("profiles")
      .insert({
        auth_user_id: outsiderUser.user!.id,
        email: outsiderEmail,
        full_name: `Proxy Outsider ${stamp}`,
        approval_status: "approved",
        default_status: "proxy",
        preferred_language: "en",
      })
      .select("id")
      .single();

    expect(outsiderError).toBeNull();
    const { data: link, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: demoAdminEmail,
        options: { redirectTo: `${appUrl}/auth/callback` },
      });

    expect(linkError).toBeNull();
    await page.goto(
      `${appUrl}/auth/callback?token_hash=${encodeURIComponent(
        link.properties!.hashed_token,
      )}&type=${link.properties!.verification_type}`,
    );

    try {
      // The meeting filter takes the meeting id (2026-11-19).
      await page.goto(
        `${appUrl}/admin/proxies?meeting=${meeting!.id}&sort=meeting&dir=asc&perPage=25`,
      );
      await page.getByRole("link", { name: "Add proxy authorization" }).click();
      const addDrawer = page.getByRole("dialog", {
        name: "Add proxy authorization",
      });

      await addDrawer.getByRole("button", { name: "Add proxy authorization" }).click();
      await expect(addDrawer.getByText("Meeting is required.")).toBeVisible();
      await expect(
        addDrawer.getByText("Confirm that the proxy holder is not barred by section 47."),
      ).toBeVisible();
      await expect(addDrawer.locator('[data-focus-for="meeting_id"]')).toBeFocused();

      // Only meetings that take a new proxy are offered (2026-11-19).
      await chooseSearchOption(addDrawer, "meeting_id", meetingTitle);
      await chooseSearchOption(addDrawer, "room_id", roomNumber);
      await chooseSearchOption(addDrawer, "owner_id", ownerName);
      // Office staff are shown but cannot be picked (section 47).
      const proxyBox = addDrawer.locator('[data-focus-for="proxy_profile_id"]');

      await proxyBox.click();
      await proxyBox.fill(demoAdminEmail);
      await expect(
        addDrawer.locator('[role="option"][aria-disabled="true"]').first(),
      ).toContainText("cannot hold a proxy");
      await proxyBox.fill("");
      await chooseSearchOption(addDrawer, "proxy_profile_id", outsiderEmail);
      await addDrawer.getByLabel(/not a committee member, the manager/).check();
      await addDrawer.getByRole("button", { name: "Add proxy authorization" }).click();
      await page.waitForURL((url) => Boolean(url.searchParams.get("focusProxyId")));

      proxyId = new URL(page.url()).searchParams.get("focusProxyId");
      expect(proxyId).toBeTruthy();
      await expect(page).toHaveURL(/sort=meeting/);
      await expect(page).toHaveURL(/dir=asc/);
      await expect(page).toHaveURL(/perPage=25/);

      const proxyRow = page.locator(`tr[data-proxy-id="${proxyId}"]:visible`);

      await expect(proxyRow).toBeVisible();
      await expect(proxyRow).toContainText(meetingTitle);
      await expect(proxyRow).toContainText("pending");

      await proxyRow.getByRole("link", { name: "Review" }).click();
      const reviewDrawer = page.getByRole("dialog", {
        name: "Review proxy authorization",
      });

      await reviewDrawer.locator('select[name="status"]').selectOption("approved");
      await reviewDrawer.getByRole("button", { name: "Save review" }).click();
      await confirmInApp(page);
      await page.waitForURL((url) => url.searchParams.get("focusProxyId") === proxyId);
      await expect(proxyRow).toContainText("approved", { timeout: 15_000 });
      await page.waitForFunction(
        (id) => document.activeElement?.getAttribute("data-proxy-id") === id,
        proxyId,
      );

      // Meeting and room filters: type to search, pick, search. The URL
      // carries the ids, not the title or room number (2026-11-19).
      await page.goto(`${appUrl}/admin/proxies`);
      const proxyFilter = page.locator("form:visible").filter({ has: page.locator('[data-focus-for="meeting"]') });
      await chooseSearchOption(proxyFilter, "meeting", meetingTitle);
      await chooseSearchOption(proxyFilter, "room", roomNumber);
      await proxyFilter.getByRole("button", { name: "Search", exact: true }).click();
      await page.waitForURL(
        (url) =>
          url.searchParams.get("meeting") === meeting!.id && url.searchParams.get("room") === room!.id,
      );
      await expect(page.locator("tr[data-proxy-id]:visible")).toHaveCount(1);
      await expect(page.locator(`tr[data-proxy-id="${proxyId}"]:visible`)).toBeVisible();
    } finally {
      if (proxyId) {
        await supabase.from("audit_logs").delete().eq("entity_id", proxyId);
        await supabase.from("proxy_authorizations").delete().eq("id", proxyId);
      }

      if (meeting?.id) {
        await supabase.from("meetings").delete().eq("id", meeting.id);
      }

      if (owner?.id) {
        await supabase.from("owners").delete().eq("id", owner.id);
      }

      if (room?.id) {
        await supabase.from("rooms").delete().eq("id", room.id);
      }

      if (outsider?.id) {
        await supabase.from("eligible_voters_snapshot").delete().eq("profile_id", outsider.id);
        await supabase.from("profiles").delete().eq("id", outsider.id);
      }

      if (outsiderUser.user) {
        await supabase.auth.admin.deleteUser(outsiderUser.user.id);
      }
    }
  });

  test("ownership CRUD rollout validates and focuses saved rows", async ({
    page,
  }) => {
    test.setTimeout(120_000);

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
        user_metadata: { full_name: demoAdminName },
      });

      expect(error).toBeNull();
      user = data.user;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          auth_user_id: user!.id,
          email: demoAdminEmail,
          full_name: demoAdminName,
          approval_status: "approved",
          default_status: "owner",
          preferred_language: "en",
        },
        { onConflict: "auth_user_id" },
      )
      .select("id")
      .single();

    expect(profileError).toBeNull();
    const { error: roleError } = await supabase.from("app_roles").upsert(
      [
        { profile_id: profile!.id, role: "admin" },
        { profile_id: profile!.id, role: "system_admin" },
      ],
      { onConflict: "profile_id,role" },
    );

    expect(roleError).toBeNull();

    const stamp = Date.now();
    const roomNumber = `OWN-${stamp}`;
    const ownerName = `Ownership Owner ${stamp}`;
    let ownershipId: string | null = null;
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert({ ownership_percent: 1, room_number: roomNumber })
      .select("id")
      .single();

    expect(roomError).toBeNull();
    const { data: owner, error: ownerError } = await supabase
      .from("owners")
      .insert({
        active: true,
        email: `ownership-owner-${stamp}@example.com`,
        full_name: ownerName,
      })
      .select("id")
      .single();

    expect(ownerError).toBeNull();
    const { data: link, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: demoAdminEmail,
        options: { redirectTo: `${appUrl}/auth/callback` },
      });

    expect(linkError).toBeNull();
    await page.goto(
      `${appUrl}/auth/callback?token_hash=${encodeURIComponent(
        link.properties!.hashed_token,
      )}&type=${link.properties!.verification_type}`,
    );

    try {
      // The room filter takes the room id (2026-11-19).
      await page.goto(
        `${appUrl}/admin/ownership?room=${room!.id}&status=all&sort=room&dir=asc&perPage=25`,
      );
      await page.getByRole("link", { name: "Create ownership link" }).click();
      const createDrawer = page.getByRole("dialog", {
        name: "Create ownership link",
      });

      await createDrawer.getByRole("button", { name: "Create ownership link" }).click();
      await expect(createDrawer.getByText("Room is required.")).toBeVisible();
      await expect(createDrawer.getByText("Owner is required.")).toBeVisible();
      await expect(createDrawer.locator('[data-focus-for="room_id"]')).toBeFocused();

      await chooseSearchOption(createDrawer, "room_id", roomNumber);
      await chooseSearchOption(createDrawer, "owner_id", ownerName);
      await createDrawer.getByRole("button", { name: "Create ownership link" }).click();
      await page.waitForURL((url) =>
        Boolean(url.searchParams.get("focusOwnershipId")),
      );

      ownershipId = new URL(page.url()).searchParams.get("focusOwnershipId");
      expect(ownershipId).toBeTruthy();
      await expect(page).toHaveURL(/status=all/);
      await expect(page).toHaveURL(/sort=room/);
      await expect(page).toHaveURL(/perPage=25/);

      const ownershipRow = page.locator(
        `tr[data-ownership-id="${ownershipId}"]:visible`,
      );

      await expect(ownershipRow).toBeVisible();
      await expect(ownershipRow).toContainText(roomNumber);
      await expect(ownershipRow).toContainText(ownerName);
      await expect(ownershipRow).toHaveClass(/border-l-\[var\(--primary\)\]/);

      await ownershipRow.getByRole("link", { name: "Edit dates" }).click();
      const editDrawer = page.getByRole("dialog", {
        name: "Edit ownership dates",
      });

      await editDrawer.locator('input[name="starts_at"]').fill(yesterday);
      await editDrawer.getByRole("button", { name: "Save dates" }).click();
      await expect(ownershipRow).toContainText(yesterday, { timeout: 15_000 });

      await ownershipRow.getByRole("link", { name: "End Link" }).click();
      const endDrawer = page.getByRole("dialog", {
        name: "End ownership link",
      });

      await endDrawer.locator('input[name="ends_at"]').fill(yesterday);
      await endDrawer.getByRole("button", { name: "End Link" }).click();
      await confirmInApp(page);
      await expect(ownershipRow).toContainText("Ended", { timeout: 15_000 });

      // Room filter: type to search, pick, search; the URL carries the room
      // id, not the number (2026-11-19).
      await page.goto(`${appUrl}/admin/ownership?status=all`);
      const ownershipFilter = page.locator("form:visible").filter({ has: page.locator('[data-focus-for="room"]') });
      await chooseSearchOption(ownershipFilter, "room", roomNumber);
      await ownershipFilter.getByRole("button", { name: "Search", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`[?&]room=${room!.id}`));
      await expect(page.locator("tr[data-ownership-id]:visible")).toHaveCount(1);
      await expect(ownershipRow).toBeVisible();

      // Owner filter (req_0006): pick the owner by name; the URL carries the
      // owner id and only that owner's rows show. It survives paging, and
      // Clear removes it.
      await page.goto(`${appUrl}/admin/ownership?status=all`);
      await chooseSearchOption(ownershipFilter, "owner", ownerName);
      await ownershipFilter.getByRole("button", { name: "Search", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`[?&]owner=${owner!.id}`));
      await expect(page).not.toHaveURL(/[?&]owner=[^&]*Ownership/);
      await expect(page.locator("tr[data-ownership-id]:visible")).toHaveCount(1);
      await expect(ownershipRow).toContainText(ownerName);
      await page.locator('select[aria-label="Per page"]:visible').first().selectOption("10");
      await expect(page).toHaveURL(/[?&]perPage=10/);
      await expect(page).toHaveURL(new RegExp(`[?&]owner=${owner!.id}`));
      await ownershipFilter.getByRole("button", { name: "Clear", exact: true }).click();
      await expect(page).not.toHaveURL(/[?&]owner=/);
      await expect(ownershipFilter.locator('input[type="hidden"][name="owner"]')).toHaveValue("");
    } finally {
      if (ownershipId) {
        await supabase.from("audit_logs").delete().eq("entity_id", ownershipId);
        await supabase.from("room_owners").delete().eq("id", ownershipId);
      }

      if (owner?.id) {
        await supabase.from("owners").delete().eq("id", owner.id);
      }

      if (room?.id) {
        await supabase.from("rooms").delete().eq("id", room.id);
      }
    }
  });
});
