import { cookies } from "next/headers";
import ExcelJS from "exceljs";
import { isValidSessionValue } from "@/lib/auth";
import { listForClass, NO_CLASS } from "@/lib/classes";
import { normalizeClassName } from "@/lib/classNames";
import { INTEGRITY_LABEL, integrityText } from "@/lib/integrity";
import {
  IELTS_CRITERIA, APTIS_WRITING_PARTS, aptisScaleFromRaw, aptisCefr,
} from "@/lib/grading";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Teacher only: Excel workbook of one class's results for one test type
// (IELTS or Aptis), one sheet per test (bank), one row per submission.

const skillsOf = (r) => (Array.isArray(r.skills_included) ? r.skills_included : ["grammar", "reading", "listening", "writing"]);
const dateVN = (v) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(v)).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
};
const num = (v) => (v === null || v === undefined || v === "" ? "" : Number(v));

const INTEGRITY_COL = {
  header: "Giám sát", width: 34, wrap: true,
  get: (r) => {
    const sm = r.integrity?.summary;
    return sm ? `${INTEGRITY_LABEL[sm.level]}${sm.level === "normal" ? "" : ` — ${integrityText(sm)}`}` : "";
  },
};

function ieltsColumns(rows) {
  const has = (s) => rows.some((r) => skillsOf(r).includes(s));
  const cols = [
    { header: "STT", width: 5, get: (_, i) => i + 1 },
    { header: "Học viên", width: 24, get: (r) => r.student_name },
    { header: "Mục tiêu", width: 9, get: (r) => r.target_band || "" },
    { header: "Ngày nộp", width: 19, get: (r) => dateVN(r.created_at) },
    { header: "Link thi", width: 22, get: (r) => r.session_name || "" },
  ];
  if (has("grammar")) cols.push({ header: "Ngữ pháp", width: 10, get: (r) => (skillsOf(r).includes("grammar") ? `${r.grammar_score}/${r.grammar_total}` : "") });
  if (has("reading")) cols.push({ header: "Reading", width: 10, get: (r) => (skillsOf(r).includes("reading") ? `${r.reading_score}/${r.reading_total}` : "") });
  if (has("listening")) cols.push({ header: "Listening", width: 10, get: (r) => (skillsOf(r).includes("listening") ? `${r.listening_score}/${r.listening_total}` : "") });
  cols.push({ header: "Band trắc nghiệm", width: 10, get: (r) => num(r.objective_band), fmt: "0.0" });
  if (has("writing")) {
    for (const c of IELTS_CRITERIA) cols.push({ header: c.short, width: 7, get: (r) => (r.grading?.type === "ielts" ? num(r.grading.criteria?.[c.key]?.score) : ""), fmt: "0.0" });
    cols.push({ header: "Band Writing", width: 10, get: (r) => (r.grading?.type === "ielts" ? num(r.grading.writingBand) : r.graded ? num(r.writing_band) : ""), fmt: "0.0" });
  }
  cols.push({ header: "Band cuối", width: 10, get: (r) => (r.graded ? num(r.final_band) : skillsOf(r).includes("writing") ? "" : num(r.objective_band)), fmt: "0.0", strong: true });
  cols.push({ header: "Trạng thái", width: 11, get: (r) => (!skillsOf(r).includes("writing") ? "Không có Writing" : r.graded ? "Đã chấm" : "Chưa chấm") });
  cols.push(INTEGRITY_COL);
  if (has("writing")) {
    for (const c of IELTS_CRITERIA) cols.push({ header: `Nhận xét ${c.short}`, width: 40, wrap: true, get: (r) => (r.grading?.type === "ielts" ? r.grading.criteria?.[c.key]?.feedback || "" : "") });
    cols.push({ header: "Ghi chú", width: 36, wrap: true, get: (r) => (r.grading?.type === "ielts" ? r.grading.note || "" : r.writing_feedback || "") });
  }
  return cols;
}

function aptisColumns(rows) {
  const has = (s) => rows.some((r) => skillsOf(r).includes(s));
  const cols = [
    { header: "STT", width: 5, get: (_, i) => i + 1 },
    { header: "Học viên", width: 24, get: (r) => r.student_name },
    { header: "Ngày nộp", width: 19, get: (r) => dateVN(r.created_at) },
    { header: "Link thi", width: 22, get: (r) => r.session_name || "" },
  ];
  const scale = (r, key) => (skillsOf(r).includes(key) ? aptisScaleFromRaw(r[`${key}_score`], r[`${key}_total`]) : null);
  for (const [key, label] of [["listening", "Listening"], ["reading", "Reading"]]) {
    if (!has(key)) continue;
    cols.push({ header: `${label} (câu đúng)`, width: 11, get: (r) => (skillsOf(r).includes(key) ? `${r[`${key}_score`]}/${r[`${key}_total`]}` : "") });
    cols.push({ header: `${label} (0–50)`, width: 10, get: (r) => num(scale(r, key)) });
    cols.push({ header: `CEFR ${label}`, width: 8, get: (r) => (scale(r, key) === null ? "" : aptisCefr(key, scale(r, key))) });
  }
  const g = (r) => (r.grading?.type === "aptis" ? r.grading : null);
  if (has("writing")) {
    APTIS_WRITING_PARTS.forEach((p, i) => cols.push({ header: `W P${i + 1} (/${p.max})`, width: 8, get: (r) => (g(r) ? num(g(r).parts?.[p.key]) : "") }));
    cols.push({ header: "Writing (0–50)", width: 10, get: (r) => (g(r) ? num(g(r).writingScore) : "") });
    cols.push({ header: "CEFR Writing", width: 8, get: (r) => (g(r) ? aptisCefr("writing", g(r).writingScore) : "") });
  }
  cols.push({
    header: "Tổng điểm", width: 10, strong: true,
    get: (r) => {
      const parts = [];
      for (const k of ["listening", "reading"]) if (skillsOf(r).includes(k)) parts.push(scale(r, k));
      if (skillsOf(r).includes("writing")) parts.push(g(r) ? g(r).writingScore : null);
      if (!parts.length || parts.some((v) => v === null)) return "";
      return `${parts.reduce((a, b) => a + b, 0)}/${parts.length * 50}`;
    },
  });
  cols.push({ header: "Trạng thái", width: 11, get: (r) => (!skillsOf(r).includes("writing") ? "Không có Writing" : r.graded ? "Đã chấm" : "Chưa chấm") });
  cols.push(INTEGRITY_COL);
  if (has("writing")) {
    cols.push({ header: "Điểm mạnh", width: 40, wrap: true, get: (r) => (g(r) ? g(r).strengths || "" : "") });
    cols.push({ header: "Cần cải thiện", width: 40, wrap: true, get: (r) => (g(r) ? g(r).improvements || "" : "") });
  }
  return cols;
}

function sheetName(name, used) {
  let base = (name || "Bài thi").replace(/[\[\]:*?/\\]/g, "-").replace(/^'+|'+$/g, "").trim().slice(0, 28) || "Bài thi";
  let n = base, i = 2;
  while (used.has(n.toLowerCase())) n = `${base.slice(0, 26)} ${i++}`;
  used.add(n.toLowerCase());
  return n;
}

const ascii = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");

export async function GET(req) {
  if (!isValidSessionValue(cookies().get("teacher_session")?.value)) {
    return new Response("Chưa đăng nhập.", { status: 401 });
  }
  const url = new URL(req.url);
  const cls = url.searchParams.get("class") || NO_CLASS;
  const type = url.searchParams.get("type") === "aptis" ? "aptis" : "ielts";
  const bank = url.searchParams.get("bank") || "";

  const rows = await listForClass(cls, type, bank);
  if (rows.length === 0) return new Response("Không có bài nộp nào phù hợp.", { status: 404 });

  const byBank = new Map();
  for (const r of rows) {
    const key = r.content_bank_id || "__none__";
    if (!byBank.has(key)) byBank.set(key, { name: r.bank_name || "Bộ đề đã xoá", rows: [] });
    byBank.get(key).rows.push(r);
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Astra Language & IT Center";
  wb.created = new Date();
  const used = new Set();
  const classLabel = cls === NO_CLASS ? "Chưa phân lớp" : normalizeClassName(cls);

  for (const { name, rows: list } of [...byBank.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"))) {
    list.sort((a, b) => a.student_name.localeCompare(b.student_name, "vi") || new Date(a.created_at) - new Date(b.created_at));
    const cols = type === "aptis" ? aptisColumns(list) : ieltsColumns(list);
    const ws = wb.addWorksheet(sheetName(name, used), { views: [{ state: "frozen", ySplit: 3, xSplit: 2 }] });

    ws.mergeCells(1, 1, 1, cols.length);
    const title = ws.getCell(1, 1);
    title.value = `Lớp ${classLabel} — ${name} (${type === "aptis" ? "Aptis" : "IELTS"}) — ${list.length} bài`;
    title.font = { bold: true, size: 13, color: { argb: "FF1F3A8A" } };
    ws.getRow(1).height = 22;
    ws.getCell(2, 1).value = type === "aptis"
      ? "Điểm 0–50 Listening/Reading ước tính theo tỷ lệ câu đúng; CEFR theo mốc Aptis General (British Council)."
      : "Band Writing = trung bình 4 tiêu chí (làm tròn 0.5); Band cuối = TB band trắc nghiệm và band Writing.";
    ws.getCell(2, 1).font = { italic: true, size: 9, color: { argb: "FF5F667F" } };

    const header = ws.getRow(3);
    cols.forEach((c, i) => {
      const cell = header.getCell(i + 1);
      cell.value = c.header;
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3A8A" } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      ws.getColumn(i + 1).width = c.width;
    });
    header.height = 30;

    list.forEach((r, ri) => {
      const row = ws.getRow(4 + ri);
      cols.forEach((c, ci) => {
        const cell = row.getCell(ci + 1);
        cell.value = c.get(r, ri);
        if (c.fmt && typeof cell.value === "number") cell.numFmt = c.fmt;
        if (c.strong) cell.font = { bold: true };
        cell.alignment = c.wrap ? { vertical: "top", wrapText: true } : { vertical: "top" };
        cell.border = { bottom: { style: "hair", color: { argb: "FFD9DCEA" } } };
      });
      if (ri % 2 === 1) cols.forEach((_, ci) => { row.getCell(ci + 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F5FC" } }; });
    });
    ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + list.length, column: cols.length } };
  }

  const buf = await wb.xlsx.writeBuffer();
  const fileName = `Ket-qua_${ascii(classLabel) || "lop"}_${type === "aptis" ? "Aptis" : "IELTS"}.xlsx`;
  const niceName = `Kết quả - ${classLabel} - ${type === "aptis" ? "Aptis" : "IELTS"}.xlsx`;
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(niceName)}`,
      "Cache-Control": "no-store",
    },
  });
}
