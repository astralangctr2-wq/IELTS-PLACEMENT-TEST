"use client";

import { useState } from "react";
import { aptisScaleFromRaw, aptisCefr } from "@/lib/grading";

// Astra result sheet (A5). Left: what the teacher fills in (screen only).
// Right: the sheet exactly as it prints — header with logo and centre
// address, the ASTRA watermark, the yellow / navy bars at the bottom.
//   short: 1 page — results + teacher's comment (mock tests, placement…)
//   full : 3 pages — results, comments per skill, class attitude and
//          study direction (mid-term / final)

const fmt = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? "" : Number(v).toFixed(1));

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

export default function ResultSheet({ data, initial }) {
  const [r, setR] = useState(initial);
  const [state, setState] = useState("");
  const set = (k) => (e) => { setR((p) => ({ ...p, [k]: e.target.value })); setState("dirty"); };
  const full = r.template === "full";
  const has = (k) => data.skills.includes(k);

  // ----- score table columns
  let cols;
  if (data.aptis) {
    const sc = (k) => (has(k) ? aptisScaleFromRaw(data[k][0], data[k][1]) : null);
    cols = [
      has("listening") && { name: "Listening", max: 50, val: sc("listening"), sub: sc("listening") !== null ? aptisCefr("listening", sc("listening")) : "" },
      has("reading") && { name: "Reading", max: 50, val: sc("reading"), sub: sc("reading") !== null ? aptisCefr("reading", sc("reading")) : "" },
      has("writing") && { name: "Writing", max: 50, val: data.writingBand, sub: Number.isInteger(data.writingBand) ? aptisCefr("writing", data.writingBand) : "" },
      (r.speaking !== "" || full) && { name: "Speaking", max: 50, val: r.speaking, sub: "" },
    ].filter(Boolean);
  } else {
    const autoTotal = data.graded ? data.finalBand : !has("writing") ? data.objectiveBand : null;
    cols = [
      has("grammar") && { name: "Grammar", max: data.grammar[1], val: data.grammar[0] },
      has("reading") && { name: "Reading", max: data.reading[1], val: data.reading[0] },
      has("listening") && { name: "Listening", max: data.listening[1], val: data.listening[0] },
      has("writing") && { name: "Writing", max: 9, val: fmt(data.writingBand) },
      (full || r.speaking !== "") && { name: "Speaking", max: 9, val: fmt(r.speaking) },
      full && { name: "TOTAL", max: 9, val: r.total !== "" ? fmt(r.total) : fmt(autoTotal) },
    ].filter(Boolean);
  }

  const save = async () => {
    setState("saving");
    const res = await fetch(`/api/teacher/report/${data.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(r) });
    setState(res.ok ? "saved" : "error");
  };

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
        </div>
        <p className="mono muted" style={{ fontSize: 12, margin: 0 }}>Khi in: chọn khổ A5, bật "Đồ hoạ nền" (Background graphics), lề "Không" (None).</p>

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

        {!full && <Field label="Teacher’s comment" wide><textarea rows={6} value={r.comment} onChange={set("comment")} /></Field>}
        {full && (
          <>
            <Field label="Nhận xét — Nghe" wide><textarea rows={4} value={r.cListening} onChange={set("cListening")} /></Field>
            <Field label="Nhận xét — Nói" wide><textarea rows={4} value={r.cSpeaking} onChange={set("cSpeaking")} /></Field>
            <Field label="Nhận xét — Đọc" wide><textarea rows={4} value={r.cReading} onChange={set("cReading")} /></Field>
            <Field label="Nhận xét — Viết (lấy sẵn từ phần chấm)" wide><textarea rows={8} value={r.cWriting} onChange={set("cWriting")} /></Field>
            <Field label="Tình hình trên lớp" wide><textarea rows={4} value={r.classSituation} onChange={set("classSituation")} /></Field>
            <Field label="Phương hướng học tập" wide><textarea rows={5} value={r.direction} onChange={set("direction")} /></Field>
          </>
        )}
        <div className="row" style={{ gap: 10, width: "auto", justifyContent: "flex-start" }}>
          <button className="btn btn-sm" onClick={save} disabled={state === "saving"}>{state === "saving" ? "Đang lưu…" : "Lưu phiếu"}</button>
          <span className="mono" style={{ fontSize: 12 }}>
            {state === "saved" ? <span className="success">✓ Đã lưu</span> : state === "error" ? <span className="accent">Không lưu được</span> : state === "dirty" ? "Có thay đổi chưa lưu" : ""}
          </span>
        </div>
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
