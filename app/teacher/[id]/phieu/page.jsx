import { redirect } from "next/navigation";
import { requireSheetAccess, visibleSheets } from "@/lib/sheetAuth";
import { resolveSheet, classmatesOf, withSheetStatus } from "@/lib/sheetData";
import { sheetRights } from "@/lib/sheetRights";
import ResultSheet from "./ResultSheet";

export const dynamic = "force-dynamic";

// Result sheet in the Astra template (A5, logo watermark), filled in from
// the class workspace: class list | fields | live preview. One sheet per
// student even when the test was taken in several sittings: the other
// submissions are merged in (and opening any of them leads here).
// A teacher sees the students of their own links and writes only their
// part of each sheet (lib/sheetRights.js).
export default async function SheetPage({ params }) {
  const { s, data, initial } = await resolveSheet(params.id);
  const staff = await requireSheetAccess(s, data ? data.parts.map((p) => p.id) : null);
  if (s && s.id !== params.id) redirect(`/teacher/${s.id}/phieu`);
  const mine = new Set([data.id, ...(initial.mergeIds || [])]);
  const classmates = (await withSheetStatus(await visibleSheets(await classmatesOf(s, staff.role === "teacher" ? staff.teacherId : null)), initial.template)).map((c) => ({
    id: c.id,
    name: c.student_name,
    needsGrading: Boolean(c.needs_grading),
    current: (c.ids || []).some((x) => mine.has(x)),
    status: c.status,
    missing: c.missing,
    handedIn: Boolean(c.handed_in),
  }));
  const rights = sheetRights(staff, data.parts);
  const me = staff.role === "teacher" ? { role: "teacher", id: staff.teacherId, name: staff.name } : { role: "admin" };
  // key: a fresh editor per student (switching students keeps no state).
  return <ResultSheet key={data.id} data={data} initial={initial} classmates={classmates} rights={rights} me={me} />;
}
