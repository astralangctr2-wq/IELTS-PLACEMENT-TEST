import { NextResponse } from "next/server";
import { getSubmissionFull } from "@/lib/classes";
import { getStaff, ownedIds } from "@/lib/staff";
import { saveReport, REPORT_FIELDS } from "@/lib/report";
import { loadSheet } from "@/lib/sheetData";
import { sheetRights } from "@/lib/sheetRights";
import { normalizeClassName } from "@/lib/classNames";

export const dynamic = "force-dynamic";

const same = (a, b) => (a ?? "").toString() === (b ?? "").toString();
const sameList = (a, b) => JSON.stringify([...(a || [])].sort()) === JSON.stringify([...(b || [])].sort());

// Saves the extra information printed on the result sheet.
//
// Several people can have one sheet open (two teachers of a split test,
// the admin entering Level / TOTAL): each save only changes the fields
// this person may write (lib/sheetRights.js) AND changed since they loaded
// the sheet (body.base = the values their screen started from / last
// saved). Everything else stays as it is on the server.
export async function POST(req, { params }) {
  const staff = await getStaff();
  if (!staff) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  const x = await loadSheet(params.id, { noRedirect: true });
  if (!x.s) return NextResponse.json({ error: "Không tìm thấy bài làm." }, { status: 404 });
  const rights = sheetRights(staff, x.data.parts);
  if (!rights.mine) return NextResponse.json({ error: "Bạn không có quyền với phiếu này." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const base = body.base && typeof body.base === "object" ? body.base : null;
  const changed = (k) => k in body && (!base || !(k in base) || !same(base[k], body[k]));
  const cur = x.initial;
  const next = { ...cur };
  for (const k of Object.keys(REPORT_FIELDS)) {
    if (k === "autoW") continue;
    if (rights.fields.includes(k) && changed(k)) next[k] = body[k];
  }
  next.autoW = cur.autoW;

  // Sittings merged in / left out: only sittings this person may open; a
  // teacher cannot take out a sitting of another teacher.
  const mergeChanged = Array.isArray(body.mergeIds) && (!base || !sameList(base.mergeIds, body.mergeIds) || !sameList(base.mergeOff, body.mergeOff));
  if (mergeChanged) {
    const wanted = [...new Set(body.mergeIds.map(String))].filter((m) => m !== params.id).slice(0, 20);
    const curIds = cur.mergeIds || [];
    const mine = await ownedIds(staff, [...wanted, ...curIds]);
    const keepOthers = curIds.filter((m) => !mine.has(m));
    const added = [];
    for (const m of wanted) {
      if (!mine.has(m) || keepOthers.includes(m)) continue;
      if (await getSubmissionFull(m)) added.push(m);
    }
    next.mergeIds = [...new Set([...keepOthers, ...added])];
    const off = Array.isArray(body.mergeOff) ? body.mergeOff.map(String) : [];
    next.mergeOff = [...new Set([...(cur.mergeOff || []).filter((m) => !mine.has(m)), ...off.filter((m) => mine.has(m) && !next.mergeIds.includes(m))])];
  }

  const data = await saveReport(params.id, normalizeClassName(next.className || x.s.effective_class) || null, next);
  return NextResponse.json({ ok: true, data });
}
