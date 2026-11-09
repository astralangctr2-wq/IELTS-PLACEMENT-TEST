import { requireStaffPage, getStaff } from "./staff";

// Survey answers: admin only (teachers only grade their own links).
export async function surveyScopeOrRedirect() {
  await requireStaffPage({ admin: true });
  return { all: true };
}
export async function surveyScopeOrNull() {
  return (await getStaff())?.role === "admin" ? { all: true } : null;
}
