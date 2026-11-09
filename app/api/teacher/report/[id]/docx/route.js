import {
  AlignmentType, BorderStyle, Document, Footer, Header, HorizontalPositionAlign, HorizontalPositionRelativeFrom,
  HeightRule, ImageRun, Packer, PageBreak, PageNumber, Paragraph, ShadingType, SymbolRun, Tab, Table, TableCell, TableLayoutType, TableRow,
  TextRun, TextWrappingType, VerticalAlign, VerticalPositionAlign, VerticalPositionRelativeFrom, WidthType,
} from "docx";
import { resolveSheet, classmatesOf } from "@/lib/sheetData";
import { canOpenSheet, visibleSheets } from "@/lib/sheetAuth";
import { scoreColumns, show } from "@/lib/sheetCols";
import { LOGO_PNG, BARS_PNG, WATERMARK_JPG } from "@/lib/sheetAssets";
import { splitLabel, cleanText } from "@/lib/sheetText";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// The Astra result sheet as a Word file (A5, header with logo and centre
// address, ASTRA watermark, yellow / navy bars at the bottom) — the same
// content as the printable page, editable in Word.

// Layout, sizes and colours follow the centre's templates (MOCK_TEST.docx,
// MIDTERM - FINAL.docx): A5, Arial, navy labels on light-blue cells, red
// scores. Full sheet: one comment table whose first row ("Nhận xét của
// giáo viên:") repeats at the top of every page it runs onto.
const LABEL_C = "244061", DARK = "0F243E", FILL = "DBE5F1", RED = "EE0000";
const PAGE_W = 8392, PAGE_H = 11907; // A5, as in the templates
const EMU_MM = 36000;
const img = (b64) => Buffer.from(b64, "base64");

const line = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const borders = { top: line, bottom: line, left: line, right: line };
const nil = { style: BorderStyle.NIL, size: 0, color: "auto" };
const CELL_MAR = { top: 0, bottom: 0, left: 108, right: 108 };

// sz = half-points, as in the template XML
// A tab typed in a comment stays a tab in Word.
const withTabs = (text) => {
  const parts = cleanText(text).replace(/\n/g, " ").split("\t");
  return parts.length === 1 ? { text: parts[0] } : { children: parts.flatMap((x, i) => (i ? [new Tab(), x] : [x])) };
};
const run = (text, o = {}) => {
  const t = new TextRun({ ...withTabs(text), font: o.font || "Arial", size: o.sz || 20, bold: o.bold, italics: o.italic, color: o.color || (o.font === "Times New Roman" ? undefined : "000000"), underline: o.underline ? {} : undefined });
  t.mark = { size: o.sz || 20, font: o.font || "Arial" }; // the paragraph mark takes the text's size, so line heights match Word's
  return t;
};
const para = (children, o = {}) => {
  const kids = Array.isArray(children) ? children : [children];
  return new Paragraph({
    children: kids, alignment: o.align, run: o.mark || kids.find((k) => k.mark)?.mark,
    spacing: { before: o.before ?? 0, after: o.after ?? 0, line: o.line ?? 240 }, indent: o.indent,
  });
};
// The templates' "Normal" paragraph: 3pt before / after, 1.3 line.
const normal = (children, o = {}) => para(children, { before: 60, after: 60, line: 312, ...o });

function cell(children, o = {}) {
  return new TableCell({
    children,
    width: { size: o.w, type: WidthType.DXA },
    verticalAlign: o.valign || VerticalAlign.CENTER,
    shading: o.fill ? { type: ShadingType.CLEAR, color: "auto", fill: o.fill } : undefined,
    margins: o.margins || CELL_MAR,
    borders: o.borders || borders,
    columnSpan: o.span,
  });
}
const row = (children, height, extra = {}) => new TableRow({ children, height: height ? { value: height, rule: HeightRule.ATLEAST } : undefined, ...extra });
const table = (widths, rows) => new Table({
  width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
  columnWidths: widths, layout: TableLayoutType.FIXED, margins: CELL_MAR, rows,
});

// Teacher text → paragraphs; a leading criterion label in bold.
function prose(text, sz = 20, lineH = 240) {
  const clean = cleanText(text);
  if (!clean.trim()) return [para(run("", { sz, italic: true }), { before: 60, after: 60, align: AlignmentType.JUSTIFIED })];
  return clean.split("\n").map((l) => {
    const { bold, rest } = splitLabel(l);
    const kids = [...(bold ? [run(bold, { sz, bold: true, italic: true })] : []), run(rest, { sz, italic: true })];
    return para(kids, { align: AlignmentType.JUSTIFIED, before: 60, after: 60, line: lineH });
  });
}

function buildSection(data, r) {
  const full = r.template === "full";
  const has = (k) => data.skills.includes(k);
  const cols = scoreColumns(data, r);
  const SIDE = full ? 624 : 737; // template margins differ: mid-term 1.1 cm, mock 1.3 cm
  const CW = PAGE_W - 2 * SIDE;
  const pct = (p) => Math.round((CW * p) / 5000); // template widths are in fiftieths of a percent

  // ---- header, as in the template: floating logo top-left, the centre's
  // address indented 5 cm (7pt navy), the ASTRA watermark behind the page.
  const hr = (t, o = {}) => new TextRun({ text: t, font: o.font || "Times New Roman", size: 14, bold: o.bold, color: o.color || "002060", underline: o.underline ? {} : undefined });
  const sym = (ch) => new SymbolRun({ char: ch, symbolfont: "Wingdings", size: 14, color: "002060" });
  const hp = (kids) => new Paragraph({ children: kids, run: { size: 14, font: "Times New Roman" }, spacing: { before: 0, after: 0, line: 240 }, indent: { left: 2835, right: -800 } });
  const header = new Header({
    children: [
      hp([
        new ImageRun({
          type: "png", data: img(LOGO_PNG), transformation: { width: 150, height: 52 },
          floating: {
            horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 640237 },
            verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 144302 },
            wrap: { type: TextWrappingType.NONE }, allowOverlap: true,
          },
        }),
        new ImageRun({
          type: "jpg", data: img(WATERMARK_JPG), transformation: { width: 446, height: 450 },
          floating: {
            horizontalPosition: { relative: HorizontalPositionRelativeFrom.MARGIN, align: HorizontalPositionAlign.CENTER },
            verticalPosition: { relative: VerticalPositionRelativeFrom.MARGIN, align: VerticalPositionAlign.CENTER },
            behindDocument: true, wrap: { type: TextWrappingType.NONE }, allowOverlap: true,
          },
        }),
        hr("Trung tâm Ngoại ngữ và Tin học ASTRA", { bold: true, color: "203167" }),
      ]),
      hp([hr("📌", { font: "Segoe UI Symbol" }), hr("   Lô BN2 - LK28, đường N1, KP Vinh Thạnh")]),
      hp([hr("       P. Trấn Biên, thành phố Đồng Nai, Việt Nam")]),
      hp([sym("F028"), hr(" 0909.911.922       "), sym("F02A"), hr(" "), hr("info@astra.edu.vn", { underline: true }), hr("      "), hr("🌐", { font: "Segoe UI Symbol", bold: true }), hr(" "), hr("www.astra.edu.vn", { underline: true })]),
    ],
  });

  // ---- footer: page number + coloured bars along the bottom edge
  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER, run: { size: 20, font: "Times New Roman", bold: true },
        children: [
          new TextRun({ children: [PageNumber.CURRENT], font: "Times New Roman", bold: true, size: 20 }),
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

  // ---- page 1: student's information
  const infoL = pct(1179);
  const infoLabel = (t) => cell([para(run(t, { sz: 24, bold: true, color: LABEL_C }))], { w: infoL, fill: FILL });
  const infoVal = (kids) => cell(kids, { w: CW - infoL });
  const big = (t, o = {}) => para(run(t || " ", { sz: 28, ...o }), { align: AlignmentType.CENTER, before: 120, after: 120 });
  const info = table([infoL, CW - infoL], [
    row([infoLabel("Name:"), infoVal([big((data.name || "").toLocaleUpperCase("vi"), { bold: true })])], 567), // 454 in the template, but its 14pt + 6pt spacing makes 1 cm
    row([infoLabel("Teacher:"), infoVal([big(r.teacher)])], 567),
    row([infoLabel("Level:"), infoVal([
      para(run(r.level || " ", { sz: 28, bold: true }), { align: AlignmentType.CENTER }),
      ...(r.levelNote ? [para(run(`(${r.levelNote})`, { sz: 24, italic: true }), { align: AlignmentType.CENTER })] : []),
    ])], 850),
    row([infoLabel("Class:"), infoVal([big(r.className, { bold: true })])], 567),
  ]);

  // ---- test results
  const firstW = pct(cols.length >= 5 ? 718 : cols.length === 4 ? 880 : 1055);
  const restW = Math.floor((CW - firstW) / Math.max(1, cols.length));
  const widths = [firstW, ...cols.map((_, i) => (i === cols.length - 1 ? CW - firstW - restW * (cols.length - 1) : restW))];
  const hd = (t, sz = 20) => normal(run(t, { sz, bold: true, color: LABEL_C }), { align: AlignmentType.CENTER });
  const scores = table(widths, [
    row([cell([hd("Skills", 22)], { w: widths[0], fill: FILL }), ...cols.map((c, i) => cell([hd(c.name), hd(`(${c.max})`)], { w: widths[i + 1], fill: FILL }))], 842),
    row([
      cell([hd(data.aptis ? "Score" : "Band score", 22)], { w: widths[0], fill: FILL }),
      ...cols.map((c, i) => cell([para(run(show(c.val), { font: "Century Gothic", sz: 22, bold: true, color: RED }), { align: AlignmentType.CENTER })], { w: widths[i + 1] })),
    ], 624),
    ...(data.aptis ? [row([
      cell([hd("CEFR", 22)], { w: widths[0], fill: FILL }),
      ...cols.map((c, i) => cell([para(run(show(c.sub), { font: "Century Gothic", sz: 20, bold: true, color: LABEL_C }), { align: AlignmentType.CENTER })], { w: widths[i + 1] })),
    ], 454)] : []),
  ]);

  const h = (t) => normal(run(t, { sz: 22, bold: true }));
  const blank = () => new Paragraph({ children: [], spacing: { before: 60, after: 60, line: 312 } }); // template: an empty "Normal" line (Times 13pt)
  const body = [
    para(run("TEST RESULT", { sz: 36, bold: true }), { align: AlignmentType.CENTER, before: 170 }), // clear of the header, where the template's taller header puts it
    normal(run(r.testTitle || "", { sz: 22, bold: true }), { align: AlignmentType.CENTER }),
    h("Student’s information:"),
    info,
    blank(),
    h("Test results:"),
    scores,
    blank(),
  ];

  if (!full) {
    // Mock test: one "Teacher's comment" box under the scores.
    const lw = pct(1050);
    body.push(table([lw, CW - lw], [row([
      cell([normal(run("Teacher’s comment", { font: "Century Gothic", sz: 22, bold: true, color: LABEL_C }))], { w: lw, fill: FILL }),
      cell(prose(r.comment, 22, 312), { w: CW - lw }),
    ], 842)]));
  } else {
    for (const t of ["Trung tâm Ngoại ngữ và Tin học Astra xin thông báo điểm và nhận xét lớp học của Học viên.", "Kính chúc Quý Phụ huynh và các em sức khỏe, hạnh phúc,", "Trân trọng cảm ơn Quý Phụ huynh và Học viên."]) {
      body.push(para(run(t, { sz: 20, italic: true }), { align: AlignmentType.JUSTIFIED, before: 60, after: 0, line: 360, indent: { firstLine: 720 } }));
    }
    // Page 2 on: ONE table. Its first row is a repeating header, so
    // "Nhận xét của giáo viên:" heads every page the comments run onto.
    const lw = pct(737);
    const skillRow = (label, text, height) => row([
      cell([para(run(label, { sz: 20, bold: true, color: DARK }), { align: AlignmentType.CENTER, before: 60, line: 360 })], { w: lw, fill: FILL }),
      cell(prose(text), { w: CW - lw }),
    ], height);
    body.push(new Paragraph({ children: [new PageBreak()], spacing: { before: 0, after: 200, line: 276 } }));
    body.push(table([lw, CW - lw], [
      row([cell([para(run("Nhận xét của giáo viên:", { font: "Calibri", sz: 22, bold: true, color: DARK }), { align: AlignmentType.JUSTIFIED, before: 60, after: 60 })], {
        w: CW, span: 2, fill: "FFFFFF", borders: { top: nil, left: nil, right: nil, bottom: line },
      })], 283, { tableHeader: true }),
      ...(has("listening") ? [skillRow("Nghe", r.cListening, 680)] : []),
      skillRow("Nói", r.cSpeaking, 680),
      ...(has("reading") ? [skillRow("Đọc", r.cReading, 680)] : []),
      ...(has("writing") ? [skillRow("Viết", r.cWriting, 680)] : []),
      skillRow("Tình hình trên lớp", r.classSituation, 1191),
      skillRow("Phương hướng học tập", r.direction, 1191),
    ]));
  }

  return {
    properties: {
      page: {
        size: { width: PAGE_W, height: PAGE_H },
        margin: { top: 1247, bottom: 851, left: SIDE, right: SIDE, header: 284, footer: 510 },
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
    styles: { default: { document: { run: { font: "Times New Roman", size: 26 } } } }, // = the templates' Normal style
    sections: sheets.map(({ data, initial }) => buildSection(data, initial)),
  });
}

const slug = (t, fb) => (t || fb).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || fb;

export async function GET(req, { params }) {
  const { s, data, initial } = await resolveSheet(params.id);
  if (!s) return new Response("Không tìm thấy bài làm.", { status: 404 });
  if (!(await canOpenSheet(s, data.parts.map((p) => p.id)))) return new Response("Bạn không có quyền với bài này.", { status: 403 });

  let sheets = [{ data, initial }];
  let fileName = `Phieu-diem-${slug(data.name, "hoc-vien")}-${slug(initial.testTitle, "phieu")}.docx`;
  if (new URL(req.url).searchParams.get("all")) {
    // Whole class, same test: one sheet per student (merged sittings and
    // sheet owners resolved exactly as when each sheet is opened).
    const mates = await visibleSheets(await classmatesOf(s));
    const seen = new Set();
    sheets = [];
    for (const c of mates) {
      const x = await resolveSheet(c.id);
      if (!x.s || !x.data || seen.has(x.data.id)) continue;
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
