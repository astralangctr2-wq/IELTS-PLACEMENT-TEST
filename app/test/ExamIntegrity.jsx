"use client";

// Exam-mode integrity monitoring (never used in practice mode).
//
//   - "Bắt đầu" puts the page in fullscreen.
//   - Leaving fullscreen, or leaving the page (switching tab / app,
//     minimising, phone screen off) is recorded. Each time the student is
//     out of fullscreen a bar offers "Quay lại toàn màn hình" (browsers only
//     allow re-entering fullscreen from a click).
//   - From the 3rd time the student leaves, a red warning tells them the
//     teacher will see it. Nothing is ever blocked or auto-submitted.
//   - Pasting into Writing is blocked; attempts and their length are kept.
//
// The log is sent with the submission and shown to the teacher only.

import { useCallback, useEffect, useRef, useState } from "react";

const WARN_FROM = 3;
const MAX_EVENTS = 150;

const fsElement = () => (typeof document === "undefined" ? null : document.fullscreenElement || document.webkitFullscreenElement || null);
const fsSupported = () => typeof document !== "undefined" && !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);

function requestFs() {
  const el = document.documentElement;
  try {
    const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: "hide" }) : el.webkitRequestFullscreen?.();
    if (p && p.catch) p.catch(() => {});
  } catch {}
}

export function useExamIntegrity({ enabled, active, section }) {
  // enabled: exam mode. active: the student is on a test screen.
  const log = useRef(null);
  const sectionRef = useRef(section);
  sectionRef.current = section;
  const lastIncident = useRef(0);
  const hiddenSince = useRef(null);
  const wasFs = useRef(false);
  const [incidents, setIncidents] = useState(0);
  const [outOfFs, setOutOfFs] = useState(false);
  const [warnOpen, setWarnOpen] = useState(false);
  const [pasteNotice, setPasteNotice] = useState(false);

  if (log.current === null) {
    log.current = { startedAt: null, fullscreenSupported: false, fullscreenExits: 0, tabLeaves: 0, hiddenMs: 0, pasteBlocked: 0, pastedChars: 0, incidents: 0, events: [] };
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
    log.current.startedAt = Date.now();
    log.current.fullscreenSupported = fsSupported();
    if (log.current.fullscreenSupported) requestFs();
  }, [enabled]);

  const reenter = () => { setWarnOpen(false); requestFs(); };

  useEffect(() => {
    if (!enabled || !active) return;
    const onFs = () => {
      const inFs = !!fsElement();
      setOutOfFs(!inFs && log.current.fullscreenSupported);
      if (inFs) { wasFs.current = true; return; }
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
    wasFs.current = !!fsElement();
    // The fullscreen request from "Bắt đầu" resolves a moment later —
    // only offer the "back to fullscreen" bar if it did not take effect.
    const check = setTimeout(() => { if (log.current.fullscreenSupported && !fsElement()) setOutOfFs(true); }, 1200);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("webkitfullscreenchange", onFs);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearTimeout(check);
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("webkitfullscreenchange", onFs);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, active]);

  // Leave fullscreen quietly once the test is over.
  useEffect(() => {
    if (!enabled || active || !log.current.startedAt) return;
    setOutOfFs(false);
    setWarnOpen(false);
    if (fsElement()) {
      try { (document.exitFullscreen || document.webkitExitFullscreen)?.call(document); } catch {}
    }
  }, [enabled, active]);

  // onPaste / onDrop handler for Writing boxes.
  const blockPaste = useCallback((e) => {
    if (!enabled) return;
    e.preventDefault();
    let len = 0;
    try { len = (e.clipboardData || e.dataTransfer)?.getData("text")?.length || 0; } catch {}
    log.current.pasteBlocked += 1;
    log.current.pastedChars += len;
    push("paste_blocked", { chars: len });
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

  const overlay = enabled && active ? (
    <>
      {outOfFs && !warnOpen && (
        <div className="integrity-bar" role="alert">
          <span>Bạn đang ở ngoài chế độ toàn màn hình.</span>
          <button type="button" className="btn btn-sm" onClick={reenter}>Quay lại toàn màn hình</button>
        </div>
      )}
      {pasteNotice && <div className="integrity-toast" role="status">Không được dán nội dung vào bài viết trong khi thi.</div>}
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

  return { start, blockPaste, report, overlay };
}
