"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Autosave of a test in progress.
//   - on this computer (localStorage): ~1 second after every change, and
//     immediately when the page is hidden / closed;
//   - on the server: every 20 seconds while something changed, and when
//     the page is hidden — so the test can be continued on another
//     computer by typing the same name and class.
// After submitting, both copies are deleted.
//
// key: the test link (session / homework / bank). getSnapshot(): the
// runner's whole state as plain JSON. active: the student is on a test
// screen. deps: values whose change means "something to save".

const LOCAL_TTL = 3 * 24 * 3600 * 1000;
const SERVER_EVERY = 20000;

const storageKey = (key) => `astra-draft:${key}`;

export function readLocalDraft(key) {
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d !== "object" || !d.savedAt || Date.now() - d.savedAt > LOCAL_TTL) return null;
    return d;
  } catch {
    return null;
  }
}

export function useDraft({ key, active, getSnapshot, name, classKey, deps }) {
  const snapRef = useRef(getSnapshot);
  snapRef.current = getSnapshot;
  const who = useRef({ name, classKey });
  who.current = { name, classKey };
  const dirtyServer = useRef(false);
  const lastSaved = useRef(0);
  const [savedAt, setSavedAt] = useState(null); // shown as "Đã lưu tự động hh:mm"

  const saveLocal = useCallback(() => {
    try {
      const snap = { ...snapRef.current(), savedAt: Date.now() };
      localStorage.setItem(storageKey(key), JSON.stringify(snap));
      lastSaved.current = snap.savedAt;
      setSavedAt(snap.savedAt);
      return snap;
    } catch {
      return null;
    }
  }, [key]);

  const saveServer = useCallback((keepalive = false) => {
    const { name: n, classKey: c } = who.current;
    if (!n || !n.trim()) return;
    dirtyServer.current = false;
    let body;
    try { body = JSON.stringify({ key, name: n, cls: c || "", data: { ...snapRef.current(), savedAt: Date.now() } }); } catch { return; }
    fetch("/api/drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: keepalive && body.length < 60000 })
      .catch(() => { dirtyServer.current = true; });
  }, [key]);

  // Local save shortly after each change.
  useEffect(() => {
    if (!active) return;
    dirtyServer.current = true;
    const t = setTimeout(saveLocal, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ...deps]);

  // Server save on a timer + both saves when the page is hidden / closed.
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => { if (dirtyServer.current) saveServer(); }, SERVER_EVERY);
    const flush = () => { saveLocal(); saveServer(true); };
    const onVis = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flush);
    // First server copy right after starting.
    const first = setTimeout(() => saveServer(), 3000);
    return () => {
      clearInterval(t);
      clearTimeout(first);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", flush);
    };
  }, [active, saveLocal, saveServer]);

  const clear = useCallback(() => {
    try { localStorage.removeItem(storageKey(key)); } catch {}
    const { name: n, classKey: c } = who.current;
    if (n && n.trim()) {
      fetch("/api/drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, name: n, cls: c || "", remove: true }), keepalive: true }).catch(() => {});
    }
  }, [key]);

  return { savedAt, clear, saveLocal };
}

// Draft on the server for this link + name + class (another computer).
export async function fetchServerDraft(key, name, classKey) {
  if (!name || !name.trim()) return null;
  try {
    const u = `/api/drafts?key=${encodeURIComponent(key)}&name=${encodeURIComponent(name)}&cls=${encodeURIComponent(classKey || "")}`;
    const res = await fetch(u, { cache: "no-store" });
    const j = await res.json();
    return j.draft?.data ? { ...j.draft.data, savedAt: j.draft.data.savedAt || Date.parse(j.draft.updatedAt) } : null;
  } catch {
    return null;
  }
}

// Deadlines saved with the draft, re-based on the link's CURRENT time
// limits: a teacher who gives more time ("Sửa thời gian") also gives it to
// students resuming. Time spent while the computer was off still counts.
export function rebaseDeadlines(saved, oldLimits, newLimits) {
  const out = {};
  for (const [k, dl] of Object.entries(saved || {})) {
    if (!dl) continue;
    const oldM = Number(oldLimits?.[k]) || 0, newM = Number(newLimits?.[k]) || 0;
    out[k] = oldM && newM ? dl - oldM * 60000 + newM * 60000 : dl;
  }
  return out;
}

const STAGE_LABEL = { grammar: "Ngữ pháp", reading: "Reading", listening: "Listening", writing: "Writing", test: "đang làm" };
const ago = (t) => {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  return m < 1 ? "vừa xong" : m < 60 ? `${m} phút trước` : `${Math.floor(m / 60)} giờ ${m % 60} phút trước`;
};

// Card on the start screen: continue the saved test, or start over.
export function DraftPrompt({ draft, onResume, onDiscard, fromServer }) {
  if (!draft) return null;
  const at = new Date(draft.savedAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="draft-prompt" role="alert">
      <p className="draft-prompt-title">📝 Có bài làm dở {fromServer ? "(lưu trên hệ thống)" : "trên máy này"}</p>
      <p>
        <b>{draft.name || draft.studentName || "Học viên"}</b>
        {draft.studentClass ? ` · lớp ${draft.studentClass}` : ""}
        {draft.stage && STAGE_LABEL[draft.stage] ? ` · đang ở phần ${STAGE_LABEL[draft.stage]}` : ""}
        {draft.skill && STAGE_LABEL[draft.skill] ? ` · đang ở phần ${STAGE_LABEL[draft.skill]}` : ""}
        {` · lưu lúc ${at} (${ago(draft.savedAt)})`}
      </p>
      <p className="muted" style={{ fontSize: 13 }}>Bấm “Tiếp tục” để làm tiếp đúng chỗ đã dừng — các câu đã làm vẫn còn, đồng hồ tính tiếp (thời gian máy tắt vẫn bị tính).</p>
      <div className="draft-prompt-actions">
        <button type="button" className="btn" onClick={onResume}>Tiếp tục bài làm →</button>
        <button type="button" className="btn-ghost btn-sm" onClick={onDiscard}>Không phải tôi / làm bài mới</button>
      </div>
    </div>
  );
}
