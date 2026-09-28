"use client";

import { useTheme } from "@/app/contexts/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme, mounted } = useTheme();

  // Until the saved preference has loaded, show an empty button of the
  // same size instead of a possibly-wrong icon — avoids the icon
  // flashing from ☀️ to 🌙 (or back) right after page load.
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label={theme === "light" ? "Chuyển sang giao diện tối" : "Chuyển sang giao diện sáng"}
      title={theme === "light" ? "Giao diện tối" : "Giao diện sáng"}
    >
      {mounted ? (theme === "light" ? "🌙" : "☀️") : ""}
    </button>
  );
}
