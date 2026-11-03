import { redirect } from "next/navigation";
import { requireSheetAccess, visibleSheets } from "@/lib/sheetAuth";
import { resolveSheet, classmatesOf, withSheetStatus } from "@/lib/sheetData";
import ResultSheet from "./ResultSheet";

export const dynamic = "force-dynamic";

// Result sheet in the Astra template (A5, logo watermark), filled in from
// the class workspace: class list | fields | live preview. One sheet per
// student even when the test was taken in several sittings: the other
// submissions are merged in (and opening any of them leads here).
export default async function SheetPage({ params }) {
  const { s, data, initial } = await resolveSheet(params.id);
  await requireSheetAccess(s);
  if (s && s.id !== params.id) redirect(`/teacher/${s.id}/phieu`);
  const mine = new Set([data.id, ...(initial.mergeIds || [])]);
  const classmates = (await withSheetStatus(await visibleSheets(await classmatesOf(s)), initial.template)).map((c) => ({
    id: c.id,
    name: c.student_name,
    needsGrading: Boolean(c.needs_grading),
    current: (c.ids || []).some((x) => mine.has(x)),
    status: c.status,
    missing: c.missing,
  }));
  // key: a fresh editor per student (switching students keeps no state).
  return <ResultSheet key={data.id} data={data} initial={initial} classmates={classmates} />;
}
