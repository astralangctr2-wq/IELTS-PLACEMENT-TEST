import {
  AlignmentType, BorderStyle, Document, Footer, Header, HorizontalPositionAlign, HorizontalPositionRelativeFrom,
  ImageRun, Packer, PageBreak, PageNumber, Paragraph, ShadingType, Table, TableCell, TableLayoutType, TableRow,
  TextRun, TextWrappingType, VerticalAlign, VerticalPositionAlign, VerticalPositionRelativeFrom, WidthType,
} from "docx";
import { loadSheet, classmatesOf } from "@/lib/sheetData";
import { canEditSheet, visibleSheets } from "@/lib/sheetAuth";
import { scoreColumns, show } from "@/lib/sheetCols";
import { LOGO_PNG, BARS_PNG, WATERMARK_JPG } from "@/lib/sheetAssets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The Astra result sheet as a Word file (A5, header with logo and centre
// address, ASTRA watermark, yellow / navy bars at the bottom) — the same
// content as the printable page, editable in Word.

const NAVY = "1F3A6E", FILL = "DCE3F1", RED = "E01B1B";
const MM = 56.7; // twips per millimetre
const PAGE_W = Math.round(148 * MM), PAGE_H = Math.round(210 * MM);
const SIDE = Math.round(12 * MM);
const CONTENT_W = PAGE_W - 2 * SIDE;
const EMU_MM = 36000;
const img = (b64) => Buffer.from(b64, "base64");

const line = { style: BorderStyle.SINGLE, size: 6, color: "222222" };
const borders = { top: line, bottom: line, left: line, right: line };
const noLine = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noLine, bottom: noLine, left: noLine, right: noLine, insideHorizontal: noLine, insideVertical: noLine };

const run = (text, o = {}) => new TextRun({ text, font: o.font || "Arial", size: Math.round((o.pt || 10) * 2), bold: o.bold, italics: o.italic, color: o.color, underline: o.underline ? {} : undefined });
const para = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [children], alignment: o.align, spacing: { before: o.before || 0, after: o.after ?? 0, line: o.line }, indent: o.indent });

function cell(children, o = {}) {
  return new TableCell({
    children,
    width: { size: o.w, type: WidthType.DXA },
    verticalAlign: o.valign || VerticalAlign.CENTER,
    shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined,
    margins: { top: 90, bottom: 90, left: 110, right: 110 },
    borders: o.borders || borders,
    columnSpan: o.span,
  });
}
const label = (text, w, pt = 11, align = AlignmentType.LEFT) =>
  cell(text.split("\n").map((t) => para(run(t, { bold: true, color: NAVY, pt }), { align })), { w, fill: FILL });

// Teacher text → paragraphs; "Task 1: 6.0" style heads in bold.
function prose(text) {
  const lines = (text || "").split("\n");
  if (!(text || "").trim()) return [para(run(" ", { pt: 9.6 }), { after: 400 })];
  return lines.map((l) => {
    const m = /^(Task \d+|Writing|Điểm mạnh|Cần cải thiện)(:)(.*)$/.exec(l);
    const kids = m
      ? [run(m[1] + m[2], { bold: true, italic: true, pt: 9.6 }), run(m[3], { italic: true, pt: 9.6 })]
      : [run(l || " ", { italic: true, pt: 9.6 })];
    return para(kids, { align: AlignmentType.JUSTIFIED, after: 40, line: 300 });
  });
}

function commentTable(rows, labelW = Math.round(22 * MM)) {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [labelW, CONTENT_W - labelW],
    layout: TableLayoutType.FIXED,
    rows: rows.map(([l, text]) => new TableRow({ children: [label(l, labelW, 10, AlignmentType.CENTER), cell(prose(text), { w: CONTENT_W - labelW })] })),
  });
}

function buildSection(data, r) {
  const full = r.template === "full";
  const has = (k) => data.skills.includes(k);
  const cols = scoreColumns(data, r);

  // ---- header (logo + address) and watermark, repeated on every page
  const addr = [
    [run("Trung tâm Ngoại ngữ và Tin học ASTRA", { font: "Times New Roman", pt: 7.8, bold: true })],
    [run("📌 Lô BN2 - LK28, đường N1, KP Vinh Thạnh", { font: "Times New Roman", pt: 7.4 })],
    [run("     P. Trấn Biên, thành phố Đồng Nai, Việt Nam", { font: "Times New Roman", pt: 7.4 })],
    [run("☎ 0909.911.922     ✉ ", { font: "Times New Roman", pt: 7.4 }), run("info@astra.edu.vn", { font: "Times New Roman", pt: 7.4, underline: true }), run("     🌐 ", { font: "Times New Roman", pt: 7.4 }), run("www.astra.edu.vn", { font: "Times New Roman", pt: 7.4, underline: true })],
  ];
  const logoW = Math.round(43 * MM);
  const header = new Header({
    children: [
      new Paragraph({
        children: [new ImageRun({
          type: "jpg", data: img(WATERMARK_JPG), transformation: { width: 423, height: 427 },
          floating: {
            horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, align: HorizontalPositionAlign.CENTER },
            verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, align: VerticalPositionAlign.CENTER },
            behindDocument: true, wrap: { type: TextWrappingType.NONE },
          },
        })],
      }),
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [logoW, CONTENT_W - logoW],
        layout: TableLayoutType.FIXED,
        borders: noBorders,
        rows: [new TableRow({ children: [
          cell([para(new ImageRun({ type: "png", data: img(LOGO_PNG), transformation: { width: 147, height: 51 } }))], { w: logoW, borders: noBorders }),
          cell(addr.map((k) => para(k, { after: 10 })), { w: CONTENT_W - logoW, borders: noBorders }),
        ] })],
      }),
    ],
  });

  // ---- footer: page number + coloured bars along the bottom edge
  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ children: [PageNumber.CURRENT], font: "Times New Roman", bold: true, size: 18 }),
          new ImageRun({
            type: "png", data: img(BARS_PNG), transformation: { width: 559, height: 20 },
            floating: {
              horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
              verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: Math.round((210 - 5.4) * EMU_MM) },
              behindDocument: true, wrap: { type: TextWrappingType.NONE },
            },
          }),
        ],
      }),
    ],
  });

  // ---- page 1
  const infoL = Math.round(32 * MM);
  const info = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [infoL, CONTENT_W - infoL],
    layout: TableLayoutType.FIXED,
    rows: [
      ["Name:", [para(run((data.name || "").toLocaleUpperCase("vi"), { bold: true, pt: 13 }), { align: AlignmentType.CENTER })]],
      ["Teacher:", [para(run(r.teacher || " ", { pt: 12 }), { align: AlignmentType.CENTER })]],
      ["Level:", [para(run(r.level || " ", { bold: true, pt: 12 }), { align: AlignmentType.CENTER }), ...(r.levelNote ? [para(run(`(${r.levelNote})`, { italic: true, pt: 10 }), { align: AlignmentType.CENTER })] : [])]],
      ["Class:", [para(run(r.className || " ", { bold: true, pt: 12 }), { align: AlignmentType.CENTER })]],
    ].map(([l, v]) => new TableRow({ children: [label(l, infoL), cell(v, { w: CONTENT_W - infoL })] })),
  });

  const firstW = Math.round(24 * MM);
  const restW = Math.floor((CONTENT_W - firstW) / Math.max(1, cols.length));
  const widths = [firstW, ...cols.map((_, i) => (i === cols.length - 1 ? CONTENT_W - firstW - restW * (cols.length - 1) : restW))];
  const scoreRows = [
    new TableRow({ children: [label("Skills", widths[0], 10, AlignmentType.CENTER), ...cols.map((c, i) => cell([
      para(run(c.name, { bold: true, color: NAVY, pt: 9.5 }), { align: AlignmentType.CENTER }),
      para(run(`(${c.max})`, { bold: true, color: NAVY, pt: 9.5 }), { align: AlignmentType.CENTER }),
    ], { w: widths[i + 1], fill: FILL }))] }),
    new TableRow({ children: [label(data.aptis ? "Score" : "Band score", widths[0], 10, AlignmentType.CENTER), ...cols.map((c, i) => cell([para(run(show(c.val), { bold: true, color: RED, pt: 11 }), { align: AlignmentType.CENTER })], { w: widths[i + 1] }))] }),
    ...(data.aptis ? [new TableRow({ children: [label("CEFR", widths[0], 10, AlignmentType.CENTER), ...cols.map((c, i) => cell([para(run(show(c.sub), { bold: true, color: NAVY, pt: 10 }), { align: AlignmentType.CENTER })], { w: widths[i + 1] }))] })] : []),
  ];
  const scores = new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED, rows: scoreRows });

  const h = (t) => para(run(t, { bold: true, pt: 10.5 }), { before: 160, after: 100 });
  const body = [
    para(run("TEST RESULT", { bold: true, pt: 19 }), { align: AlignmentType.CENTER, before: 60 }),
    para(run(r.testTitle || "", { bold: true, pt: 10.5 }), { align: AlignmentType.CENTER, after: 100 }),
    h("Student’s information:"),
    info,
    h("Test results:"),
    scores,
  ];
  if (!full) {
    body.push(para(run(" "), { after: 200 }), commentTable([["Teacher’s\ncomment", r.comment]]));
  } else {
    body.push(para(run(" "), { after: 160 }));
    for (const t of ["Trung tâm Ngoại ngữ và Tin học Astra xin thông báo điểm và nhận xét lớp học của Học viên.", "Kính chúc Quý Phụ huynh và các em sức khỏe, hạnh phúc,", "Trân trọng cảm ơn Quý Phụ huynh và Học viên."]) {
      body.push(new Paragraph({ children: [run(t, { italic: true, pt: 10 })], indent: { firstLine: Math.round(9 * MM) }, spacing: { after: 80, line: 340 } }));
    }
    // page 2 — comments per skill
    body.push(new Paragraph({ children: [new PageBreak()] }), h("Nhận xét của giáo viên:"));
    body.push(commentTable([
      ...(has("listening") ? [["Nghe", r.cListening]] : []),
      ["Nói", r.cSpeaking],
      ...(has("reading") ? [["Đọc", r.cReading]] : []),
      ...(has("writing") ? [["Viết", r.cWriting]] : []),
    ]));
    // page 3 — class attitude, study direction
    body.push(new Paragraph({ children: [new PageBreak()] }), h("Nhận xét của giáo viên:"));
    body.push(commentTable([["Tình hình\ntrên lớp", r.classSituation], ["Phương\nhướng\nhọc tập", r.direction]]));
  }

  return {
    properties: {
      page: {
        size: { width: PAGE_W, height: PAGE_H },
        margin: { top: Math.round(33 * MM), bottom: Math.round(20 * MM), left: SIDE, right: SIDE, header: Math.round(6 * MM), footer: Math.round(8 * MM) },
        pageNumbers: { start: 1 },
      },
    },
    headers: { default: header },
    footers: { default: footer },
    children: body,
  };
}

// One or several sheets (whole class): each sheet is its own section, so
// it starts on a new page and its page numbers restart at 1.
function buildDoc(sheets, title) {
  return new Document({
    creator: "Astra Language & IT Center",
    title,
    styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
    sections: sheets.map(({ data, initial }) => buildSection(data, initial)),
  });
}

const slug = (t, fb) => (t || fb).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || fb;

export async function GET(req, { params }) {
  let { s, data, initial, redirectTo } = await loadSheet(params.id);
  if (redirectTo) ({ s, data, initial } = await loadSheet(redirectTo));
  if (!s) return new Response("Không tìm thấy bài làm.", { status: 404 });
  if (!(await canEditSheet(s))) return new Response("Bạn không có quyền với bài này.", { status: 403 });

  let sheets = [{ data, initial }];
  let fileName = `Phieu-diem-${slug(data.name, "hoc-vien")}-${slug(initial.testTitle, "phieu")}.docx`;
  if (new URL(req.url).searchParams.get("all")) {
    // Whole class, same test: one sheet per student (merged sittings and
    // sheet owners resolved exactly as when each sheet is opened).
    const mates = await visibleSheets(await classmatesOf(s));
    const seen = new Set();
    sheets = [];
    for (const c of mates) {
      let x = await loadSheet(c.id);
      if (x.redirectTo) x = await loadSheet(x.redirectTo);
      if (!x.s || seen.has(x.data.id)) continue;
      seen.add(x.data.id);
      sheets.push({ data: x.data, initial: x.initial });
    }
    if (!sheets.length) sheets = [{ data, initial }];
    sheets.sort((a, b) => (a.data.name || "").localeCompare(b.data.name || "", "vi"));
    fileName = `Phieu-diem-lop-${slug(initial.className, "lop")}-${slug(initial.testTitle, "phieu")}.docx`;
  }
  const buf = await Packer.toBuffer(buildDoc(sheets, sheets.length > 1 ? `Test results — ${initial.className}` : `Test result — ${data.name}`));
  return new Response(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
