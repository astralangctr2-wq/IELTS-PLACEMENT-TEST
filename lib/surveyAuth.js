import { requireTeacherOrRedirect, isTeacherLoggedIn } from "./auth";

// Which survey answers the logged-in teacher may see (one shared account:
// everything).
export async function surveyScopeOrRedirect() {
  requireTeacherOrRedirect();
  return { all: true };
}
export async function surveyScopeOrNull() {
  return isTeacherLoggedIn() ? { all: true } : null;
}
