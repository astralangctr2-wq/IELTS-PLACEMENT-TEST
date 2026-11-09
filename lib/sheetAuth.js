import { notFound } from "next/navigation";
import { getStaff, requireStaffPage, staffOwns, ownedIds } from "./staff";

// Admin: every submission. Teacher: the submissions of the links the admin
// gave them (or moved to them one by one).

// Page: login screen / 404 unless this staff member may open the
// submission — or, for a result sheet, any sitting merged into it
// (memberIds), since one sheet can hold sittings of two teachers.
export async function requireSheetAccess(row, memberIds = null) {
  const staff = await requireStaffPage();
  if (!row) notFound();
  if (staffOwns(staff, row)) return staff;
  if (memberIds && (await ownedIds(staff, memberIds)).size) return staff;
  notFound();
}

// API: may this staff member change this submission?
export async function canEditSheet(row) {
  const staff = await getStaff();
  return staffOwns(staff, row);
}

// Rows (each with id, and ids when grouped) this staff member may see.
export async function visibleSheets(rows) {
  const staff = await getStaff();
  if (!staff) return [];
  if (staff.role === "admin") return rows;
  const mine = await ownedIds(staff, rows.flatMap((r) => r.ids || [r.id]));
  return rows.filter((r) => (r.ids || [r.id]).some((x) => mine.has(x)));
}

// Any signed-in staff member (teacher or admin).
export async function staffSignedIn() {
  return Boolean(await getStaff());
}

// API: may this staff member open the result sheet `row` that holds these
// sittings (memberIds)? Any sitting of theirs is enough.
export async function canOpenSheet(row, memberIds = []) {
  const staff = await getStaff();
  if (!staff || !row) return false;
  if (staffOwns(staff, row)) return true;
  return (await ownedIds(staff, memberIds)).size > 0;
}
