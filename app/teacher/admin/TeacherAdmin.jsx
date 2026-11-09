"use client";

import { useEffect, useState } from "react";

const when = (iso) => (iso ? new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "chưa đăng nhập");

export default function TeacherAdmin({ initial }) {
  const [list, setList] = useState(initial);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(null); // { id, name, roomSlug }
  // Set after mounting: the server does not know the address (avoids a
  // hydration mismatch).
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const post = async (body) => {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/admin/teachers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Lỗi.");
      setList(j.teachers);
      return true;
    } catch (e) { setErr(e.message); return false; } finally { setBusy(false); }
  };
  const add = async (e) => {
    e.preventDefault();
    if (await post({ email, name })) { setEmail(""); setName(""); }
  };

  return (
    <div className="stack">
      <form className="card stack" onSubmit={add}>
        <p className="mono muted" style={{ fontSize: 12, margin: 0 }}>CẤP QUYỀN GIÁO VIÊN</p>
        <div className="row" style={{ gap: 8, flexWrap: "wrap", justifyContent: "flex-start" }}>
          <input type="email" required placeholder="gmail của GV, vd lan.nguyen@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: "2 1 260px" }} />
          <input type="text" placeholder="Tên hiện trên phiếu, vd Ms Lan" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: "1 1 180px" }} />
          <button className="btn" disabled={busy || !email.trim()}>Thêm GV</button>
        </div>
        <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>GV vào trang Giáo viên → “Đăng nhập bằng Google” bằng đúng Gmail này. Tên ở đây được in vào dòng “Teacher” của phiếu.</p>
        {err && <p className="accent" style={{ margin: 0 }}>{err}</p>}
      </form>

      {!list.length && <div className="card"><p className="muted" style={{ margin: 0 }}>Chưa có giáo viên nào.</p></div>}
      {list.map((t) => (
        <div key={t.id} className={`card gv-card ${t.active ? "" : "off"}`}>
          {edit?.id === t.id ? (
            <div className="stack" style={{ gap: 8 }}>
              <label className="sched-field">Tên<input type="text" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
              <label className="sched-field">Link phòng thi: {origin}/p/<input type="text" value={edit.roomSlug} onChange={(e) => setEdit({ ...edit, roomSlug: e.target.value })} style={{ width: 160 }} /></label>
              <div className="row" style={{ gap: 6, width: "auto" }}>
                <button className="btn btn-sm" disabled={busy} onClick={async () => { if (await post({ id: t.id, name: edit.name, roomSlug: edit.roomSlug })) setEdit(null); }}>Lưu</button>
                <button className="btn-ghost btn-sm" onClick={() => setEdit(null)}>Huỷ</button>
              </div>
            </div>
          ) : (
            <div className="gv-row">
              <div>
                <b>{t.name || "(chưa đặt tên)"}</b> <span className="muted">· {t.email}</span>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  {t.active ? "Đang hoạt động" : "Đã tắt quyền"} · {t.link_count} link · lần đăng nhập gần nhất: {when(t.last_login_at)}
                </div>
                {t.room_slug && <div className="mono" style={{ fontSize: 12.5 }}>🚪 {origin}/p/{t.room_slug}</div>}
              </div>
              <div className="row" style={{ gap: 6, width: "auto" }}>
                <button className="btn-ghost btn-sm" onClick={() => setEdit({ id: t.id, name: t.name || "", roomSlug: t.room_slug || "" })}>Sửa</button>
                <button className="btn-ghost btn-sm" disabled={busy} onClick={() => post({ id: t.id, active: !t.active })}>{t.active ? "Tắt quyền" : "Bật lại"}</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
