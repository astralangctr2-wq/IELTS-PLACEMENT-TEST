"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Icon from "./icons";
import Bell from "./Bell";
import FontSizeToggle from "../components/FontSizeToggle";

// Navigation in the order of the work:
//   admin  : prepare (tests, links) → grade (submissions, Level + sheets) →
//            reports → manage teachers
//   teacher: my exam sittings → grading → stats of my students
const NAV = {
  admin: [
    { group: "Chuẩn bị kỳ thi", items: [
      { href: "/teacher/content", label: "Đề thi", icon: "book" },
      { href: "/teacher/sessions", label: "Link thi", icon: "link" },
    ] },
    { group: "Chấm & trả phiếu", items: [
      { href: "/teacher", label: "Bài nộp", icon: "inbox", badge: "inbox" },
      { href: "/teacher/nhap-nhanh", label: "Level & xuất phiếu", icon: "sheet" },
    ] },
    { group: "Báo cáo", items: [
      { href: "/teacher/stats", label: "Thống kê", icon: "chart" },
      { href: "/teacher/khao-sat", label: "Khảo sát học viên", icon: "chat" },
    ] },
    { group: "Quản lý", items: [
      { href: "/teacher/admin", label: "Giáo viên", icon: "users" },
    ] },
  ],
  teacher: [
    { group: "Ca thi của tôi", items: [
      { href: "/teacher/links", label: "Link được giao", icon: "link" },
    ] },
    { group: "Chấm bài", items: [
      { href: "/teacher", label: "Bài chấm", icon: "inbox", badge: "ungraded" },
    ] },
    { group: "Báo cáo", items: [
      { href: "/teacher/stats", label: "Thống kê lớp", icon: "chart" },
    ] },
  ],
};

const TITLES = [
  [/^\/teacher\/content/, "Đề thi", "Chuẩn bị kỳ thi"],
  [/^\/teacher\/sessions/, "Link thi", "Chuẩn bị kỳ thi"],
  [/^\/teacher\/nhap-nhanh/, "Level & xuất phiếu", "Chấm & trả phiếu"],
  [/^\/teacher\/stats/, "Thống kê", "Báo cáo"],
  [/^\/teacher\/khao-sat/, "Khảo sát học viên", "Báo cáo"],
  [/^\/teacher\/admin/, "Giáo viên", "Quản lý"],
  [/^\/teacher\/links/, "Link được giao", "Ca thi của tôi"],
  [/^\/teacher\/[^/]+$/, "Chấm bài", null],
  [/^\/teacher\/?$/, null, null],
];

const NAV_PATHS = [...NAV.admin, ...NAV.teacher].flatMap((g) => g.items.map((i) => i.href));
// The current menu entry: the longest matching address; anything else
// under /teacher (a submission being graded) belongs to the submissions.
const activeHref = (path) => NAV_PATHS.filter((h) => h !== "/teacher").sort((a, b) => b.length - a.length).find((h) => path.startsWith(h)) || "/teacher";

const THEME_COOKIE = "astra_gv_theme";

export default function StaffShell({ me, counts, theme: initialTheme = "light", children }) {
  const path = usePathname() || "/teacher";
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const admin = me.role === "admin";
  const role = admin ? "admin" : "teacher";
  // Colours: admin always light; a teacher picks light (default) or dark.
  const [theme, setTheme] = useState(initialTheme);
  const scheme = !admin && theme === "dark" ? "teacher" : "admin";
  const pickTheme = (t) => {
    setTheme(t);
    try { document.cookie = `${THEME_COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`; } catch {}
  };

  // The installed app + push notifications need the service worker.
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  useEffect(() => { setOpen(false); }, [path]);

  // The result-sheet workspace is a full-screen tool of its own: same
  // colours, no sidebar.
  const bare = /\/phieu$/.test(path) || path.startsWith("/teacher/login");
  if (bare) return <div className="shell shell-bare" data-shell={scheme}>{children}</div>;

  const hit = TITLES.find(([re]) => re.test(path));
  const home = admin ? "Bài nộp" : "Bài chấm";
  const crumbs = [hit?.[2], hit?.[1] || home].filter(Boolean);
  const badge = (k) => (k === "inbox" ? counts.inbox : k === "ungraded" ? counts.ungraded : 0);
  const copyRoom = async () => {
    const url = `${window.location.origin}/p/${me.room}`;
    try { await navigator.clipboard.writeText(url); } catch { window.prompt("Link phòng thi:", url); }
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };
  const initials = (me.name || "?").trim().split(/\s+/).slice(-2).map((w) => w[0]).join("").toUpperCase();

  return (
    <div className={`shell${open ? " nav-open" : ""}`} data-shell={scheme}>
      <a className="sh-skip" href="#sh-main">Bỏ qua menu</a>
      <aside className="sh-side" aria-label="Menu">
        <a className="sh-brand" href="/teacher">
          <img src="/icons/astra-192.png" alt="" width="30" height="30" />
          <span><b>Astra</b><small>{admin ? "Quản trị" : "Giáo viên"}</small></span>
        </a>
        <nav className="sh-nav">
          {NAV[role].map((g) => (
            <div key={g.group} className="sh-group">
              <p className="sh-group-h">{g.group}</p>
              {g.items.map((it) => {
                const on = activeHref(path) === it.href;
                const n = it.badge ? badge(it.badge) : 0;
                return (
                  <a key={it.href} href={it.href} className={`sh-item${on ? " on" : ""}`} aria-current={on ? "page" : undefined}>
                    <Icon name={it.icon} />
                    <span>{it.label}</span>
                    {n > 0 && <em className="sh-count" title={it.badge === "inbox" ? "Bài chưa có GV" : "Bài chưa chấm Writing"}>{n}</em>}
                  </a>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sh-foot">
          {!admin && me.room && (
            <button type="button" className="sh-room" onClick={copyRoom} title="Copy link phòng thi">
              <Icon name="door" size={16} />
              <span>/p/{me.room}</span>
              <span className="sh-room-act">{copied ? "Đã copy" : <Icon name="copy" size={14} />}</span>
            </button>
          )}
          <div className="sh-me">
            <span className="sh-ava">{initials}</span>
            <span className="sh-me-t"><b>{me.name}</b><small>{me.sub}</small></span>
            <button type="button" className="sh-out" title="Đăng xuất" aria-label="Đăng xuất" onClick={async () => { await fetch("/api/teacher/logout", { method: "POST" }); window.location.href = "/teacher/login"; }}>
              <Icon name="logout" size={17} />
            </button>
          </div>
        </div>
      </aside>
      <button type="button" className="sh-scrim" aria-label="Đóng menu" onClick={() => setOpen(false)} tabIndex={-1} />
      <div className="sh-body">
        <header className="sh-top">
          <button type="button" className="sh-menu" aria-label="Mở menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}><Icon name="menu" /></button>
          <nav className="sh-crumbs" aria-label="Vị trí">
            {crumbs.map((c, i) => <span key={i} className={i === crumbs.length - 1 ? "cur" : ""}>{c}</span>)}
          </nav>
          <div className="sh-top-r">
            {!admin && (
              <div className="sh-theme" role="group" aria-label="Màu giao diện">
                <button type="button" aria-pressed={theme !== "dark"} className={theme !== "dark" ? "on" : ""} onClick={() => pickTheme("light")} title="Nền sáng (giống trang admin)"><Icon name="sun" size={16} /><span>Sáng</span></button>
                <button type="button" aria-pressed={theme === "dark"} className={theme === "dark" ? "on" : ""} onClick={() => pickTheme("dark")} title="Nền tối"><Icon name="moon" size={16} /><span>Tối</span></button>
              </div>
            )}
            <FontSizeToggle />
            {admin && <Bell />}
          </div>
        </header>
        <main id="sh-main" className="sh-main">{children}</main>
      </div>
    </div>
  );
}
