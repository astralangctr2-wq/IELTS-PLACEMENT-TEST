import { requireStaffPage } from "@/lib/staff";
import { classSummary } from "@/lib/classes";
import { sheetsForClass } from "@/lib/sheetData";
import { aptisSkills, ieltsAutoTotal, fmt } from "@/lib/sheetCols";
import StaffNav from "../StaffNav";
import QuickTable from "./QuickTable";

export const dynamic = "force-dynamic";

// Admin: after the teachers hand their sheets in, Level + TOTAL for a whole
// class on one screen, then the Word file of the class.
export default async function QuickEntryPage({ searchParams }) {
  const staff = await requireStaffPage({ admin: true });
  const summary = (await classSummary()).filter((r) => r.class_name);
  const classes = [...new Set(summary.map((r) => r.class_name))].sort((a, b) => a.localeCompare(b, "vi"));
  const cls = classes.includes(searchParams?.class) ? searchParams.class : "";
  const tests = summary.filter((r) => r.class_name === cls).sort((a, b) => (a.bank_name || "").localeCompare(b.bank_name || "", "vi"));
  const bank = tests.some((t) => (t.bank_id || "") === (searchParams?.bank || "")) ? searchParams?.bank || "" : tests[0]?.bank_id || "";
  const sheets = cls ? await sheetsForClass(cls, bank) : [];

  const rows = sheets.map(({ data, initial }) => {
    const r = initial;
    const assigned = data.parts.filter((p) => p.teacherId);
    const doneParts = assigned.filter((p) => p.doneAt);
    const lastDone = doneParts.map((p) => p.doneAt).sort().pop() || null;
    const handIn = !assigned.length ? "none" : doneParts.length === assigned.length ? "all" : doneParts.length ? "some" : "no";
    let skills, suggest, overall = null;
    if (data.aptis) {
      const a = aptisSkills(data, r);
      skills = ["listening", "reading", "writing", "speaking"].map((k) => ({ k, v: a[k].score, sub: a[k].cefr, near: a[k].near }));
      suggest = a.total !== null ? String(a.total) : "";
      overall = a.overall;
    } else {
      const band = (k) => (data.skills.includes(k) ? `${data[k][0]}/${data[k][1]}` : null);
      skills = [
        { k: "listening", v: band("listening") },
        { k: "reading", v: band("reading") },
        { k: "writing", v: data.hasWriting ? (data.graded ? fmt(data.writingBand) : "chưa chấm") : null },
        { k: "speaking", v: (r.speaking || "").toString().trim() ? fmt(r.speaking) : null },
      ];
      const t = ieltsAutoTotal(data, { ...r, total: "" });
      suggest = t !== null && t !== undefined ? fmt(t) : "";
    }
    return {
      id: data.id, name: data.name, aptis: data.aptis, skills, suggest, overall,
      level: r.level || "", total: r.total || "", teachers: Object.values(data.teacherNames || {}).join(" & "),
      handIn, lastDone, parts: assigned.length, doneParts: doneParts.length,
    };
  });

  return (
    <div className="wrap-wide">
      <StaffNav staff={staff} title="Bảng nhập nhanh" subtitle="Level + TOTAL cho cả lớp sau khi GV nộp phiếu, rồi xuất Word" />
      <form className="card quick-pick" method="get">
        <label>Lớp
          <select name="class" defaultValue={cls}>
            <option value="">— Chọn lớp —</option>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        {cls && (
          <label>Bài thi
            <select name="bank" defaultValue={bank}>
              {tests.map((t) => <option key={t.bank_id || "none"} value={t.bank_id || ""}>{t.bank_name || "(không rõ đề)"} · {t.exam_type === "aptis" ? "Aptis" : "IELTS"} · {t.n} bài</option>)}
            </select>
          </label>
        )}
        <button className="btn btn-sm" type="submit">Mở</button>
      </form>
      {cls && <QuickTable key={`${cls}|${bank}`} rows={rows} cls={cls} />}
      {!cls && <div className="card"><p className="muted" style={{ margin: 0 }}>Chọn lớp để bắt đầu. Bấm vào thông báo “GV đã nộp phiếu” cũng mở thẳng đúng lớp và bài thi.</p></div>}
    </div>
  );
}
