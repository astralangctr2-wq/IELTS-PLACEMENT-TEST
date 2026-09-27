"use client";

import { useTheme } from "@/app/contexts/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label={theme === "light" ? "Chuyển sang giao diện tối" : "Chuyển sang giao diện sáng"}
      title={theme === "light" ? "Giao diện tối" : "Giao diện sáng"}
    >
      {theme === "light" ? "🌙" : "☀️"}
    </button>
  );
}
