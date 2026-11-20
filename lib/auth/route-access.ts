// Which /admin pages a set of roles may open (req_0009). The pages enforce
// this themselves (requireAdmin / requireOfficeStaff, D022); this map only
// decides whether the UI shows a link, so office staff never follow a link
// to "no access". Keep it in step with the page guards.

/** Pages office staff may open (requireOfficeStaff); the rest of /admin is
 * for the Manager (`admin`, requireAdmin). Longest prefix wins. */
const STAFF_PAGES = ["/admin", "/admin/people", "/admin/ownership", "/admin/voting"];
const MANAGER_ONLY = ["/admin/voting/conflicts"];

function pathOf(href: string) {
  const path = href.split(/[?#]/)[0].replace(/\/+$/, "");

  return path === "" ? "/" : path;
}

function under(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** Whether these roles may open this /admin link. Other paths: true (not
 * covered here). */
export function canOpen(href: string, roles: readonly string[]) {
  const path = pathOf(href);

  if (!under(path, "/admin")) {
    return true;
  }

  // The Manager, and a System Admin's temporary read-only access (D027).
  if (roles.includes("admin") || roles.includes("system_read")) {
    return true;
  }

  if (!roles.includes("staff")) {
    return false;
  }

  if (MANAGER_ONLY.some((prefix) => under(path, prefix))) {
    return false;
  }

  return path === "/admin" || STAFF_PAGES.slice(1).some((prefix) => under(path, prefix));
}

/** `href` when these roles may open it, else undefined (show without a link). */
export function linkIfAllowed(href: string, roles: readonly string[]) {
  return canOpen(href, roles) ? href : undefined;
}
