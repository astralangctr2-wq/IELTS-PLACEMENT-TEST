import { redirect } from "next/navigation";
import { requireSheetAccess } from "@/lib/sheetAuth";
import { loadSheet } from "@/lib/sheetData";
import ResultSheet from "./ResultSheet";

export const dynamic = "force-dynamic";

// Result sheet in the Astra template (A5, logo watermark). One sheet per
// student even when the test was taken in several sittings: the other
// submissions are merged in (and opening any of them leads here).
export default async function SheetPage({ params }) {
  const { s, data, initial, redirectTo } = await loadSheet(params.id);
  await requireSheetAccess(s);
  if (redirectTo) redirect(`/teacher/${redirectTo}/phieu`);
  return <ResultSheet data={data} initial={initial} />;
}
