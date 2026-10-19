import { redirect } from "next/navigation";
import { requireSheetAccess, visibleSheets } from "@/lib/sheetAuth";
import { loadSheet, classmatesOf } from "@/lib/sheetData";
import ResultSheet from "./ResultSheet";

export const dynamic = "force-dynamic";

// Result sheet in the Astra template (A5, logo watermark). One sheet per
// student even when the test was taken in several sittings: the other
// submissions are merged in (and opening any of them leads here).
export default async function SheetPage({ params }) {
  const { s, data, initial, redirectTo } = await loadSheet(params.id);
  await requireSheetAccess(s);
  if (redirectTo) redirect(`/teacher/${redirectTo}/phieu`);
  const mine = new Set([data.id, ...(initial.mergeIds || [])]);
  const classmates = (await visibleSheets(await classmatesOf(s))).map((c) => ({
    id: c.id,
    name: c.student_name,
    needsGrading: Boolean(c.needs_grading),
    current: (c.ids || []).some((x) => mine.has(x)),
  }));
  return <ResultSheet data={data} initial={initial} classmates={classmates} />;
}
