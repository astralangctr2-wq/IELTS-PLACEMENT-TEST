import { notFound } from "next/navigation";
import { requireTeacherOrRedirect, isTeacherLoggedIn } from "./auth";

// Page: redirect to login / 404. API: true / false (one shared account).
export async function requireSheetAccess(row) {
  requireTeacherOrRedirect();
  if (!row) notFound();
}
export async function canEditSheet(row) {
  return Boolean(row) && isTeacherLoggedIn();
}
