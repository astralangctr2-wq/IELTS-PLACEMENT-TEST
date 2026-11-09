"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Admin bell: "a teacher handed sheets in". Checks every minute and when
// the window comes back into focus; the installed app also shows the
// number on its icon. From here the admin switches on push notifications
// for this browser (pop-ups even when the app is closed).

const when = (iso) => new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

function urlB64ToUint8Array(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function linkOf(e) {
  const d = e.data || {};
  const qs = new URLSearchParams({ ...(d.cls ? { class: d.cls } : {}), ...(d.bank ? { bank: d.bank } : {}) }).toString();
  return `/teacher/nhap-nhanh${qs ? `?${qs}` : ""}`;
}

export default function Bell() {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [unseen, setUnseen] = useState(0);
  const [push, setPush] = useState("unknown"); // unknown | unsupported | off | on | nokey | denied | busy
  const [msg, setMsg] = useState("");
  const ref = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/teacher/events", { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      setEvents(j.events || []);
      setUnseen(j.unseen || 0);
      try { if ("setAppBadge" in navigator) j.unseen ? navigator.setAppBadge(j.unseen) : navigator.clearAppBadge(); } catch {}
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [load]);

  // Push state of this browser.
  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) { setPush("unsupported"); return; }
      if (Notification.permission === "denied") { setPush("denied"); return; }
      try {
        const reg = await navigator.serviceWorker.getRegistration("/");
        const sub = reg && (await reg.pushManager.getSubscription());
        setPush(sub ? "on" : "off");
      } catch { setPush("off"); }
    })();
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (e.type === "keydown" ? e.key === "Escape" : ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && unseen) {
      await fetch("/api/teacher/events", { method: "POST" }).catch(() => {});
      setUnseen(0);
      try { navigator.clearAppBadge?.(); } catch {}
    }
  };

  const enablePush = async () => {
    setPush("busy"); setMsg("");
    try {
      const { publicKey } = await (await fetch("/api/teacher/push", { cache: "no-store" })).json();
      if (!publicKey) { setPush("nokey"); return; }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setPush(perm === "denied" ? "denied" : "off"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(publicKey) }));
      const res = await fetch("/api/teacher/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON(), test: true }) });
      if (!res.ok) throw new Error((await res.json()).error || "Lỗi.");
      setPush("on"); setMsg("Đã bật. Máy này vừa nhận 1 thông báo thử.");
    } catch (e) {
      setPush("off"); setMsg(e.message || "Không bật được thông báo.");
    }
  };

  const disablePush = async () => {
    setPush("busy");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = reg && (await reg.pushManager.getSubscription());
      if (sub) {
        await fetch("/api/teacher/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
    } catch {}
    setPush("off"); setMsg("");
  };

  return (
    <div className="bell" ref={ref}>
      <button type="button" className="btn-ghost btn-sm bell-btn" onClick={toggle} aria-haspopup="true" aria-expanded={open} title="Thông báo">
        🔔{unseen > 0 && <span className="bell-n">{unseen}</span>}
      </button>
      {open && (
        <div className="bell-pop">
          <div className="bell-h"><b>Thông báo</b><a href="/teacher/nhap-nhanh">Bảng nhập nhanh →</a></div>
          <div className="bell-list">
            {!events.length && <p className="muted" style={{ margin: 0, fontSize: 13 }}>Chưa có thông báo. Khi giáo viên bấm “Nộp phiếu”, thông báo hiện ở đây.</p>}
            {events.map((e) => (
              <a key={e.id} href={linkOf(e)} className={`bell-item${e.seen ? "" : " new"}`}>
                <b>{e.teacher || "Giáo viên"}</b> đã nộp {e.data?.count || 0} phiếu
                <span>{[e.data?.bankName, e.data?.cls && `Lớp ${e.data.cls}`, when(e.createdAt)].filter(Boolean).join(" · ")}</span>
              </a>
            ))}
          </div>
          <div className="bell-push">
            {push === "on" && <p>🔔 Máy này đang nhận thông báo. <button type="button" className="sb-link" onClick={disablePush}>Tắt</button></p>}
            {(push === "off" || push === "unknown") && <button type="button" className="btn btn-sm" onClick={enablePush}>Bật thông báo trên máy này</button>}
            {push === "busy" && <p className="muted">Đang xử lý…</p>}
            {push === "nokey" && <p className="muted">Máy chủ chưa cài khoá thông báo (VAPID) — xem hướng dẫn cài đặt. Chuông vẫn hoạt động.</p>}
            {push === "denied" && <p className="muted">Trình duyệt đang chặn thông báo của trang này. Bấm biểu tượng ổ khoá cạnh địa chỉ web → Thông báo → Cho phép, rồi tải lại trang.</p>}
            {push === "unsupported" && <p className="muted">Trình duyệt này không hỗ trợ thông báo. Dùng Chrome hoặc Edge; trên iPhone cần “Thêm vào MH chính” trước.</p>}
            {msg && <p className="muted">{msg}</p>}
            <p className="muted bell-tip">Muốn nhận thông báo cả khi không mở web: cài web thành app (Chrome / Edge: biểu tượng “Cài đặt” ở cuối thanh địa chỉ).</p>
          </div>
        </div>
      )}
    </div>
  );
}
