import { requireSheetAccess } from "@/lib/sheetAuth";
import { loadSheet } from "@/lib/sheetData";
import ResultSheet from "./ResultSheet";

export const dynamic = "force-dynamic";

// Result sheet in the Astra template (A5, logo watermark). The teacher
// fills in what the test does not know (teacher, level, Speaking,
// comments), then prints / saves as PDF or downloads it as Word.
export default async function SheetPage({ params }) {
  const { s, data, initial } = await loadSheet(params.id);
  await requireSheetAccess(s);
  return <ResultSheet data={data} initial={initial} />;
}
