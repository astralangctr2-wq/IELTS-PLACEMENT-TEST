"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { scoreColumns } from "@/lib/sheetCols";

// Astra result sheet (A5). Left: what the teacher fills in (screen only).
// Right: the sheet exactly as it prints — header with logo and centre
// address, the ASTRA watermark, the yellow / navy bars at the bottom.
//   short: 1 page — results + teacher's comment (mock tests, placement…)
//   full : 3 pages — results, comments per skill, class attitude and
//          study direction (mid-term / final)


function Page({ n, children }) {
  return (
    <section className="ps-page">
      <img className="ps-wm" src="/images/phieu/astra-watermark.jpg" alt="" />
      <header className="ps-head">
        <img className="ps-logo" src="/images/phieu/astra-header-logo.png" alt="ASTRA Language & IT Center" />
        <div className="ps-addr">
          <b>Trung tâm Ngoại ngữ và Tin học ASTRA</b>
          <span>📌 Lô BN2 - LK28, đường N1, KP Vinh Thạnh</span>
          <span className="ps-indent">P. Trấn Biên, thành phố Đồng Nai, Việt Nam</span>
          <span className="ps-contact"><span>☎ 0909.911.922</span><span>✉ <u>info@astra.edu.vn</u></span><span>🌐 <u>www.astra.edu.vn</u></span></span>
        </div>
      </header>
      <div className="ps-body">{children}</div>
      <footer className="ps-foot">
        <span>{n}</span>
        <img src="/images/phieu/astra-footer-bars.png" alt="" />
      </footer>
    </section>
  );
}

// Multi-line teacher text; lines starting with "Task" / "-" keep their shape.
function Prose({ text }) {
  const lines = (text || "").split("\n");
  if (!(text || "").trim()) return <p className="ps-prose ps-empty">&nbsp;</p>;
  return (
    <div className="ps-prose">
      {lines.map((l, i) => {
        const m = /^(Task \d+|Writing|Điểm mạnh|Cần cải thiện)(:)(.*)$/.exec(l);
        return <p key={i}>{m ? <><b>{m[1]}{m[2]}</b>{m[3]}</> : l || " "}</p>;
      })}
    </div>
  );
}

function Field({ label, children, wide }) {
  return <label className={`ps-field ${wide ? "wide" : ""}`}><span>{label}</span>{children}</label>;
}

const SK = { grammar: "Ngữ pháp", reading: "Reading", listening: "Listening", writing: "Writing" };
const when = (iso) => new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function ResultSheet({ data, initial, classmates = [] }) {
  const router = useRouter();
  const [r, setR] = useState(initial);
  const [merging, setMerging] = useState(false);
  // After a reload (merge ticked, Writing graded meanwhile…) take over the
  // fresh server values for the auto-filled parts: the merge list and the
  // Writing feedback where the teacher has not written their own text.
  useEffect(() => {
    setR((p) => {
      const keep = (k) => (p[k] || "").trim() && (p[k] || "").trim() !== (p.autoW || "").trim();
      return {
        ...p,
        autoW: initial.autoW,
        mergeIds: initial.mergeIds,
        mergeOff: initial.mergeOff,
        comment: keep("comment") ? p.comment : initial.comment,
        cWriting: keep("cWriting") ? p.cWriting : initial.cWriting,
      };
    });
  }, [initial.autoW, initial.comment, initial.cWriting, (initial.mergeIds || []).join(",")]);
  // Include / leave out another submission of this student, then reload
  // so the scores are combined on the server.
  const toggleMerge = async (id, on) => {
    setMerging(true);
    const mergeIds = on ? [...new Set([...(r.mergeIds || []), id])] : (r.mergeIds || []).filter((x) => x !== id);
    const mergeOff = on ? (r.mergeOff || []).filter((x) => x !== id) : [...new Set([...(r.mergeOff || []), id])];
    const next = { ...r, mergeIds, mergeOff };
    setR(next);
    await fetch(`/api/teacher/report/${data.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    router.refresh();
    setMerging(false);
  };
  const refill = (k) => { setR((p) => ({ ...p, [k]: data.autoW })); setState("dirty"); };
  const [state, setState] = useState("");
  const set = (k) => (e) => { setR((p) => ({ ...p, [k]: e.target.value })); setState("dirty"); };
  const full = r.template === "full";
  const has = (k) => data.skills.includes(k);

  const cols = scoreColumns(data, r);

  const save = async () => {
    setState("saving");
    const res = await fetch(`/api/teacher/report/${data.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(r) });
    setState(res.ok ? "saved" : "error");
    return res.ok;
  };
  // Word file: save first so the file has exactly what is on screen.
  const downloadWord = async () => {
    if (await save()) window.location.href = `/api/teacher/report/${data.id}/docx`;
  };
  // All students of this class who took this test, one Word file (one
  // sheet per student, each starting on a new page).
  const downloadClass = async () => {
    if (await save()) window.location.href = `/api/teacher/report/${data.id}/docx?all=1`;
  };
  const idx = classmates.findIndex((c) => c.current);
  const nextMate = idx >= 0 ? classmates[idx + 1] : null;
  const missing = classmates.filter((c) => c.needsGrading).length;

  const info = (
    <>
      <h1 className="ps-title">TEST RESULT</h1>
      <p className="ps-subtitle">{r.testTitle}</p>
      <p className="ps-h">Student’s information:</p>
      <table className="ps-table ps-info">
        <tbody>
          <tr><th>Name:</th><td className="ps-name">{(data.name || "").toLocaleUpperCase("vi")}</td></tr>
          <tr><th>Teacher:</th><td className="ps-teacher">{r.teacher || " "}</td></tr>
          <tr><th>Level:</th><td className="ps-level"><b>{r.level || " "}</b>{r.levelNote && <i>({r.levelNote})</i>}</td></tr>
          <tr><th>Class:</th><td className="ps-class">{r.className || " "}</td></tr>
        </tbody>
      </table>
      <p className="ps-h">Test results:</p>
      <table className="ps-table ps-scores">
        <thead>
          <tr><th>Skills</th>{cols.map((c) => <th key={c.name}>{c.name}<br /><span>({c.max})</span></th>)}</tr>
        </thead>
        <tbody>
          <tr><th>{data.aptis ? "Score" : "Band score"}</th>{cols.map((c) => <td key={c.name}>{c.val === null || c.val === undefined || c.val === "" ? "" : c.val}</td>)}</tr>
          {data.aptis && <tr><th>CEFR</th>{cols.map((c) => <td key={c.name} className="ps-cefr">{c.sub}</td>)}</tr>}
        </tbody>
      </table>
    </>
  );

  return (
    <div className="ps-layout">
      <aside className="ps-editor">
        <div className="row" style={{ gap: 8, width: "auto", flexWrap: "wrap", justifyContent: "flex-start" }}>
          <a href={`/teacher/${data.id}`}><button className="btn-ghost btn-sm">← Bài chấm</button></a>
          <button className="btn btn-sm" onClick={() => window.print()}>🖨 In / Lưu PDF</button>
          <button className="btn-ghost btn-sm" onClick={downloadWord} disabled={state === "saving"}>⬇ Tải Word (.docx)</button>
          {classmates.length > 1 && <button className="btn-ghost btn-sm" onClick={downloadClass} disabled={state === "saving"}>⬇ Word cả lớp ({classmates.length})</button>}
        </div>
        {data.hasWriting && !data.graded && (
          <p className="ps-warn">⚠ Writing của học viên này <b>chưa chấm</b> — nhận xét Viết sẽ tự điền vào phiếu khi chấm xong. <a href={`/teacher/${data.writerId}`}>Chấm ngay →</a></p>
        )}
        <p className="mono muted" style={{ fontSize: 12, margin: 0 }}>Khi in: chọn khổ A5, bật "Đồ hoạ nền" (Background graphics), lề "Không" (None).</p>

        {data.siblings.length > 0 && (
          <div className="ps-merge">
            <p className="ps-merge-title">Bài thi gộp vào phiếu này</p>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>Thi nhiều buổi (vd buổi 1 Reading + Listening, buổi 2 Writing)? Tick các bài của cùng học viên để ra 1 phiếu chung.</p>
            <label className="ps-merge-row on">
              <input type="checkbox" checked disabled />
              <span><b>Bài này</b> · {data.primary.skills.map((k) => SK[k]).join(", ")}<br /><span className="muted">{when(data.primary.created_at)} · {data.primary.bank_name}</span></span>
            </label>
            {data.siblings.map((x) => (
              <label key={x.id} className={`ps-merge-row ${(r.mergeIds || []).includes(x.id) ? "on" : ""}`}>
                <input type="checkbox" checked={(r.mergeIds || []).includes(x.id)} disabled={merging} onChange={(e) => toggleMerge(x.id, e.target.checked)} />
                <span>{x.skills.map((k) => SK[k]).join(", ")}{x.skills.includes("writing") ? (x.graded ? " · đã chấm" : " · chưa chấm") : ""}<br /><span className="muted">{when(x.created_at)} · {x.session_name || x.bank_name}</span></span>
              </label>
            ))}
          </div>
        )}

        <Field label="Mẫu phiếu">
          <select value={r.template} onChange={set("template")}>
            <option value="short">Ngắn — 1 trang (Mock test, Placement…)</option>
            <option value="full">Đầy đủ — 3 trang (Mid-term, Final)</option>
          </select>
        </Field>
        <Field label="Tên bài thi (dòng dưới TEST RESULT)"><input type="text" value={r.testTitle} onChange={set("testTitle")} /></Field>
        <Field label="Giáo viên"><input type="text" value={r.teacher} onChange={set("teacher")} placeholder="Ms Ngọc Ngân & Ms Yến Nhi" /></Field>
        <div className="ps-row">
          <Field label="Level"><input type="text" value={r.level} onChange={set("level")} placeholder="FLY UP 6" /></Field>
          <Field label="Ghi chú level"><input type="text" value={r.levelNote} onChange={set("levelNote")} placeholder="Lộ trình đạt 6.0+" /></Field>
        </div>
        <Field label="Lớp"><input type="text" value={r.className} onChange={set("className")} /></Field>
        <div className="ps-row">
          <Field label={data.aptis ? "Speaking (0–50)" : "Speaking (band)"}><input type="text" inputMode="decimal" value={r.speaking} onChange={set("speaking")} placeholder="bỏ trống nếu không thi" /></Field>
          {full && !data.aptis && <Field label="TOTAL (bỏ trống = tự tính)"><input type="text" inputMode="decimal" value={r.total} onChange={set("total")} /></Field>}
        </div>

        {!full && <Field label="Teacher’s comment (lấy sẵn nhận xét Writing từ phần chấm)" wide><textarea rows={8} value={r.comment} onChange={set("comment")} /></Field>}
        {!full && data.autoW && r.comment !== data.autoW && <button type="button" className="btn-ghost btn-sm ps-refill" onClick={() => refill("comment")}>↻ Lấy lại nhận xét từ phần chấm Writing</button>}
        {full && (
          <>
            <Field label="Nhận xét — Nghe" wide><textarea rows={4} value={r.cListening} onChange={set("cListening")} /></Field>
            <Field label="Nhận xét — Nói" wide><textarea rows={4} value={r.cSpeaking} onChange={set("cSpeaking")} /></Field>
            <Field label="Nhận xét — Đọc" wide><textarea rows={4} value={r.cReading} onChange={set("cReading")} /></Field>
            <Field label="Nhận xét — Viết (lấy sẵn từ phần chấm)" wide><textarea rows={8} value={r.cWriting} onChange={set("cWriting")} /></Field>
            {data.autoW && r.cWriting !== data.autoW && <button type="button" className="btn-ghost btn-sm ps-refill" onClick={() => refill("cWriting")}>↻ Lấy lại nhận xét từ phần chấm Writing</button>}
            <Field label="Tình hình trên lớp" wide><textarea rows={4} value={r.classSituation} onChange={set("classSituation")} /></Field>
            <Field label="Phương hướng học tập" wide><textarea rows={5} value={r.direction} onChange={set("direction")} /></Field>
          </>
        )}
        <div className="row" style={{ gap: 10, width: "auto", justifyContent: "flex-start" }}>
          <button className="btn btn-sm" onClick={save} disabled={state === "saving"}>{state === "saving" ? "Đang lưu…" : "Lưu phiếu"}</button>
          <span className="mono" style={{ fontSize: 12 }}>
            {state === "saved" ? <span className="success">✓ Đã lưu</span> : state === "error" ? <span className="accent">Không lưu được</span> : state === "dirty" ? "Có thay đổi chưa lưu" : ""}
          </span>
          {nextMate && <button className="btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={async () => { if (state !== "dirty" || (await save())) window.location.href = `/teacher/${nextMate.id}/phieu`; }}>Lưu &amp; HV tiếp theo →</button>}
        </div>

        {classmates.length > 1 && (
          <div className="ps-mates">
            <p className="ps-merge-title">Cả lớp {r.className || ""} — {classmates.length} học viên{missing ? <span className="ps-mates-miss"> · {missing} bài Writing chưa chấm</span> : ""}</p>
            <div className="ps-mates-list">
              {classmates.map((c) => (
                <a key={c.id} href={`/teacher/${c.id}/phieu`} className={`ps-mate ${c.current ? "on" : ""}`}>
                  <span>{c.name}</span>
                  <span className={c.needsGrading ? "ps-mate-st warn" : "ps-mate-st"}>{c.needsGrading ? "✍ chưa chấm" : "✓"}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </aside>

      <div className="ps-sheets">
        <Page n={1}>
          {info}
          {!full && (
            <table className="ps-table ps-comment">
              <tbody><tr><th>Teacher’s<br />comment</th><td><Prose text={r.comment} /></td></tr></tbody>
            </table>
          )}
          {full && (
            <div className="ps-letter">
              <p>Trung tâm Ngoại ngữ và Tin học Astra xin thông báo điểm và nhận xét lớp học của Học viên.</p>
              <p>Kính chúc Quý Phụ huynh và các em sức khỏe, hạnh phúc,</p>
              <p>Trân trọng cảm ơn Quý Phụ huynh và Học viên.</p>
            </div>
          )}
        </Page>
        {full && (
          <Page n={2}>
            <p className="ps-h">Nhận xét của giáo viên:</p>
            <table className="ps-table ps-comment">
              <tbody>
                {has("listening") && <tr><th>Nghe</th><td><Prose text={r.cListening} /></td></tr>}
                <tr><th>Nói</th><td><Prose text={r.cSpeaking} /></td></tr>
                {has("reading") && <tr><th>Đọc</th><td><Prose text={r.cReading} /></td></tr>}
                {has("writing") && <tr><th>Viết</th><td><Prose text={r.cWriting} /></td></tr>}
              </tbody>
            </table>
          </Page>
        )}
        {full && (
          <Page n={3}>
            <p className="ps-h">Nhận xét của giáo viên:</p>
            <table className="ps-table ps-comment">
              <tbody>
                <tr><th>Tình hình<br />trên lớp</th><td><Prose text={r.classSituation} /></td></tr>
                <tr><th>Phương<br />hướng<br />học tập</th><td><Prose text={r.direction} /></td></tr>
              </tbody>
            </table>
          </Page>
        )}
      </div>
    </div>
  );
}
