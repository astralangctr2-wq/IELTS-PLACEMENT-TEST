// Exam integrity log sent with a submission (see app/test/ExamIntegrity.jsx).
// Cleaned and summarised on the server; the summary drives the warning
// shown to teachers. Pure functions — safe in any environment.

const n = (v, max = 1e9) => {
  const x = Math.round(Number(v));
  return Number.isFinite(x) ? Math.min(max, Math.max(0, x)) : 0;
};
const EVENT_TYPES = new Set(["fullscreen_exit", "tab_leave", "tab_return", "paste_blocked"]);

export function sanitizeIntegrity(raw) {
  if (!raw || typeof raw !== "object") return null;
  const events = Array.isArray(raw.events)
    ? raw.events
        .filter((e) => e && EVENT_TYPES.has(e.type))
        .slice(0, 150)
        .map((e) => ({ t: n(e.t, 9e15), type: e.type, skill: e.skill ? String(e.skill).slice(0, 20) : null, ...(e.ms ? { ms: n(e.ms) } : {}), ...(e.chars ? { chars: n(e.chars) } : {}) }))
    : [];
  const summary = {
    fullscreenSupported: Boolean(raw.fullscreenSupported),
    incidents: n(raw.incidents, 10000),
    fullscreenExits: n(raw.fullscreenExits, 10000),
    tabLeaves: n(raw.tabLeaves, 10000),
    hiddenSec: Math.round(n(raw.hiddenMs) / 1000),
    pasteBlocked: n(raw.pasteBlocked, 10000),
    pastedChars: n(raw.pastedChars),
  };
  summary.level = integrityLevel(summary);
  return { summary, events, startedAt: n(raw.startedAt, 9e15) || null, finishedAt: n(raw.finishedAt, 9e15) || null };
}

// high: left the test 3+ times, or away 60s+ in total, or 3+ paste attempts.
// medium: any leave or paste attempt. normal: nothing recorded.
export function integrityLevel(s) {
  if (!s) return null;
  if (s.incidents >= 3 || s.hiddenSec >= 60 || s.pasteBlocked >= 3) return "high";
  if (s.incidents > 0 || s.pasteBlocked > 0) return "medium";
  return "normal";
}

export const INTEGRITY_LABEL = { normal: "Bình thường", medium: "Cần lưu ý", high: "Nghi vấn cao" };

export function integrityText(s) {
  if (!s) return "";
  const parts = [`rời bài ${s.incidents} lần`];
  if (s.fullscreenExits) parts.push(`thoát toàn màn hình ${s.fullscreenExits}`);
  if (s.tabLeaves) parts.push(`chuyển tab/app ${s.tabLeaves}`);
  if (s.hiddenSec) parts.push(`ngoài bài ${s.hiddenSec >= 60 ? `${Math.floor(s.hiddenSec / 60)} phút ${s.hiddenSec % 60} giây` : `${s.hiddenSec} giây`}`);
  if (s.pasteBlocked) parts.push(`thử dán ${s.pasteBlocked} lần (${s.pastedChars} ký tự)`);
  return parts.join(", ");
}
