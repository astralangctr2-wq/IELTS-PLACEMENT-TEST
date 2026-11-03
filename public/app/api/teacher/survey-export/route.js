import ExcelJS from "exceljs";
import { surveyScopeOrNull } from "@/lib/surveyAuth";
import { listSurveys, SURVEY } from "@/lib/survey";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const dateVN = (v) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(v)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
};

// Staff only: every survey answer (after the page's filters) as one sheet.
export async function GET(req) {
  const scope = await surveyScopeOrNull();
  if (!scope) return new Response("Chưa đăng nhập.", { status: 401 });
  const u = new URL(req.url);
  const cls = u.searchParams.get("class") || "";
  const link = u.searchParams.get("link") || "";
  const rows = (await listSurveys({ scope })).filter((r) => (!cls || (cls === "__none__" ? !r.class_name : r.class_name === cls)) && (!link || r.session_id === link));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Khảo sát");
  ws.columns = [
    { header: "Thời gian", key: "t", width: 17 },
    { header: "Học viên", key: "name", width: 24 },
    { header: "Lớp", key: "cls", width: 10 },
    { header: "Link thi", key: "link", width: 26 },
    ...SURVEY.map((q) => ({ header: q.label, key: q.key, width: q.type === "text" || q.type === "multi" ? 40 : 14 })),
  ];
  for (const r of rows) {
    const a = r.answers || {};
    ws.addRow({
      t: dateVN(r.created_at), name: r.anonymous ? "(ẩn danh)" : r.student_name, cls: r.class_name || "", link: r.session_name || r.bank_name || "",
      ...Object.fromEntries(SURVEY.map((q) => [q.key, Array.isArray(a[q.key]) ? a[q.key].join("; ") : a[q.key] ?? ""])),
    });
  }
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { wrapText: true, vertical: "top" };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.eachRow((row, i) => { if (i > 1) row.alignment = { wrapText: true, vertical: "top" }; });
  const buf = await wb.xlsx.writeBuffer();
  const name = `khao-sat${cls ? `-${cls}` : ""}.xlsx`;
  return new Response(buf, { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${name}"`,
  } });
}
