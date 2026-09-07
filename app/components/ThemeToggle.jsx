"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState(null); // null until mounted, avoids SSR mismatch flash

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    setTheme(current);
  }, []);

  const toggle = () => {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch (e) {}
    setTheme(next);
  };

  if (theme === null) return null; // avoid rendering wrong icon before hydration reads real theme

  return (
    <button
      type="button"
      onClick={toggle}
      className="theme-toggle"
      aria-label={theme === "light" ? "Chuyển sang giao diện tối" : "Chuyển sang giao diện sáng"}
      title={theme === "light" ? "Giao diện tối" : "Giao diện sáng"}
    >
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );
}
