"use client";

// Exam-mode integrity monitoring (never used in practice mode).
//
//   - "Bắt đầu" puts the page in fullscreen and, where the browser allows
//     it (Chrome / Edge on computers), locks the keyboard: a single Esc,
//     F11, Alt+Tab or the Windows key no longer throws the student out —
//     only holding Esc for ~2 seconds leaves fullscreen.
//   - Out of fullscreen (on a browser where fullscreen worked) the test is
//     covered by a screen with one button back into fullscreen, so the
//     test is never done in a small window next to something else.
//   - Leaving fullscreen or the page (switching tab / app, minimising,
//     phone screen off) is recorded. From the 3rd time a red warning tells
//     the student the teacher will see it. Nothing is auto-submitted.
//   - Closing / reloading the tab asks for confirmation first.
//   - Writing: copy / cut / paste work for text copied INSIDE the test
//     (moving sentences around, quoting the task). Pasting text from
//     outside the test is blocked and logged with its length.
//
// The log is sent with the submission and shown to the teacher only.

import { useCallback, useEffect, useRef, useState } from "react";

const WARN_FROM = 3;
const MAX_EVENTS = 150;
const MAX_CLIPS = 60;

const fsElement = () => (typeof document === "undefined" ? null : document.fullscreenElement || document.webkitFullscreenElement || null);
const fsSupported = () => typeof document !== "undefined" && !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
const normClip = (t) => (t || "").replace(/\r\n?/g, "\n").replace(/[ \t ]+/g, " ").trim();

function lockKeys() {
  try {
    const p = navigator.keyboard?.lock?.();
    if (p && p.catch) p.catch(() => {});
  } catch {}
}
function unlockKeys() {
  try { navigator.keyboard?.unlock?.(); } catch {}
}

function requestFs() {
  const el = document.documentElement;
  try {
    const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: "hide" }) : el.webkitRequestFullscreen?.();
    if (p && p.then) p.then(lockKeys, () => {});
    else lockKeys();
  } catch {}
}

// Text currently selected (inside a textarea / input, or on the page).
function selectedText() {
  const el = document.activeElement;
  if (el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT") && typeof el.selectionStart === "number") {
    return el.value.slice(el.selectionStart, el.selectionEnd);
  }
  return window.getSelection ? String(window.getSelection()) : "";
}

export function useExamIntegrity({ enabled, active, section }) {
  // enabled: exam mode. active: the student is on a test screen.
  const log = useRef(null);
  const sectionRef = useRef(section);
  sectionRef.current = section;
  const lastIncident = useRef(0);
  const hiddenSince = useRef(null);
  const wasFs = useRef(false);
  const fsWorked = useRef(false); // fullscreen took effect at least once
  const clips = useRef([]); // texts copied / cut / dragged inside the test
  const [incidents, setIncidents] = useState(0);
  const [outOfFs, setOutOfFs] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [warnOpen, setWarnOpen] = useState(false);
  const [pasteNotice, setPasteNotice] = useState(false);

  if (log.current === null) {
    log.current = { startedAt: null, fullscreenSupported: false, keyboardLock: false, fullscreenExits: 0, tabLeaves: 0, hiddenMs: 0, pasteBlocked: 0, pastedChars: 0, pasteInternal: 0, incidents: 0, events: [] };
  }

  const push = (type, extra) => {
    const L = log.current;
    if (L.events.length < MAX_EVENTS) L.events.push({ t: Date.now(), type, skill: sectionRef.current || null, ...extra });
  };

  // One "time the student left the test", whichever signal fired first
  // (leaving the tab usually also drops fullscreen).
  const incident = () => {
    const now = Date.now();
    if (now - lastIncident.current < 1500) return;
    lastIncident.current = now;
    log.current.incidents += 1;
    setIncidents(log.current.incidents);
    if (log.current.incidents >= WARN_FROM) setWarnOpen(true);
  };

  const start = useCallback(() => {
    if (!enabled) return;
    log.current.startedAt = log.current.startedAt || Date.now();
    log.current.fullscreenSupported = fsSupported();
    log.current.keyboardLock = typeof navigator !== "undefined" && !!navigator.keyboard?.lock;
    if (log.current.fullscreenSupported) requestFs();
  }, [enabled]);

  const reenter = () => { setWarnOpen(false); requestFs(); };

  useEffect(() => {
    if (!enabled || !active) return;
    const onFs = () => {
      const inFs = !!fsElement();
      setOutOfFs(!inFs && log.current.fullscreenSupported);
      setBlocking(!inFs && fsWorked.current);
      if (inFs) { wasFs.current = true; fsWorked.current = true; lockKeys(); return; }
      unlockKeys();
      if (wasFs.current) {
        wasFs.current = false;
        log.current.fullscreenExits += 1;
        push("fullscreen_exit");
        incident();
      }
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        hiddenSince.current = Date.now();
        log.current.tabLeaves += 1;
        push("tab_leave");
        incident();
      } else if (hiddenSince.current) {
        const ms = Date.now() - hiddenSince.current;
        log.current.hiddenMs += ms;
        push("tab_return", { ms });
        hiddenSince.current = null;
      }
    };
    // With the keyboard locked these reach the page instead of the
    // browser / system: swallow the ones that would leave the test.
    const onKey = (e) => {
      if (!fsElement()) return;
      const k = e.key;
      if (k === "F11" || k === "Meta" || k === "OS" || (e.altKey && (k === "Tab" || k === "F4")) || k === "Escape") {
        e.preventDefault();
      }
    };
    // Accidental close / reload / back button.
    const onUnload = (e) => { e.preventDefault(); e.returnValue = ""; return ""; };
    const onPop = () => { try { history.pushState({ exam: 1 }, ""); } catch {} };
    try { history.pushState({ exam: 1 }, ""); } catch {}
    // Remember what the student copies inside the test (allowed to paste).
    const remember = () => {
      const t = normClip(selectedText());
      if (!t) return;
      const list = clips.current.filter((x) => x !== t);
      list.push(t);
      clips.current = list.slice(-MAX_CLIPS);
    };

    wasFs.current = !!fsElement();
    if (wasFs.current) { fsWorked.current = true; lockKeys(); }
    // The fullscreen request from "Bắt đầu" resolves a moment later —
    // only offer the "back to fullscreen" bar if it did not take effect.
    const check = setTimeout(() => { if (log.current.fullscreenSupported && !fsElement()) setOutOfFs(true); }, 1200);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("copy", remember, true);
    document.addEventListener("cut", remember, true);
    document.addEventListener("dragstart", remember, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("popstate", onPop);
    return () => {
      clearTimeout(check);
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("copy", remember, true);
      document.removeEventListener("cut", remember, true);
      document.removeEventListener("dragstart", remember, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("popstate", onPop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, active]);

  // Leave fullscreen quietly once the test is over.
  useEffect(() => {
    if (!enabled || active || !log.current.startedAt) return;
    setOutOfFs(false);
    setBlocking(false);
    setWarnOpen(false);
    unlockKeys();
    if (fsElement()) {
      try { (document.exitFullscreen || document.webkitExitFullscreen)?.call(document); } catch {}
    }
  }, [enabled, active]);

  // onPaste / onDrop handler for Writing boxes: text copied inside the test
  // goes through; anything else is blocked and logged.
  const blockPaste = useCallback((e) => {
    if (!enabled) return;
    let text = "";
    try { text = (e.clipboardData || e.dataTransfer)?.getData("text") || ""; } catch {}
    const t = normClip(text);
    if (t && clips.current.includes(t)) {
      log.current.pasteInternal += 1;
      return;
    }
    e.preventDefault();
    log.current.pasteBlocked += 1;
    log.current.pastedChars += text.length;
    push("paste_blocked", { chars: text.length });
    setPasteNotice(true);
    setTimeout(() => setPasteNotice(false), 3500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const report = useCallback(() => {
    if (!enabled || !log.current.startedAt) return null;
    const L = log.current;
    if (hiddenSince.current) L.hiddenMs += Date.now() - hiddenSince.current;
    return { ...L, events: L.events.slice(0, MAX_EVENTS), finishedAt: Date.now() };
  }, [enabled]);

  // Integrity state kept across a reload (autosave restores it).
  const snapshot = useCallback(() => (enabled && log.current.startedAt ? { ...log.current, events: log.current.events.slice(0, MAX_EVENTS) } : null), [enabled]);
  const restore = useCallback((saved) => {
    if (!enabled || !saved || typeof saved !== "object") return;
    log.current = { ...log.current, ...saved, events: Array.isArray(saved.events) ? saved.events.slice(0, MAX_EVENTS) : [] };
    push("resume");
    setIncidents(log.current.incidents || 0);
  }, [enabled]);

  const overlay = enabled && active ? (
    <>
      {blocking && !warnOpen && (
        <div className="integrity-modal integrity-lock" role="alertdialog" aria-modal="true">
          <div className="integrity-modal-card neutral">
            <p className="integrity-modal-title" style={{ color: "var(--primary)" }}>Bài thi đang tạm ẩn</p>
            <p>Bài thi chỉ làm được ở chế độ <b>toàn màn hình</b>. Bấm nút dưới để quay lại — bài làm và thời gian vẫn giữ nguyên.</p>
            <button type="button" className="btn" onClick={reenter} autoFocus>Quay lại bài thi (toàn màn hình)</button>
          </div>
        </div>
      )}
      {outOfFs && !blocking && !warnOpen && (
        <div className="integrity-bar" role="alert">
          <span>Bạn đang ở ngoài chế độ toàn màn hình.</span>
          <button type="button" className="btn btn-sm" onClick={reenter}>Quay lại toàn màn hình</button>
        </div>
      )}
      {pasteNotice && <div className="integrity-toast" role="status">Chỉ dán được nội dung sao chép trong bài thi — không dán từ bên ngoài.</div>}
      {warnOpen && (
        <div className="integrity-modal" role="alertdialog" aria-modal="true">
          <div className="integrity-modal-card">
            <p className="integrity-modal-title">⚠ Bạn đã rời khỏi bài thi {incidents} lần</p>
            <p>Mỗi lần thoát toàn màn hình hoặc chuyển sang trang/ứng dụng khác đều được ghi lại. <b>Giáo viên sẽ thấy điều này</b> khi chấm bài.</p>
            <button type="button" className="btn" onClick={reenter}>Tôi hiểu — quay lại bài thi</button>
          </div>
        </div>
      )}
    </>
  ) : null;

  return { start, blockPaste, report, overlay, snapshot, restore };
}
