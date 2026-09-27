"use client";

import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();
const FontSizeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(null);
  const [fontSize, setFontSize] = useState(null);
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on first mount
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("theme") || "dark";
      const savedFontSize = localStorage.getItem("fontSize") || "medium";
      setTheme(savedTheme);
      setFontSize(savedFontSize);
    } catch (e) {
      setTheme("dark");
      setFontSize("medium");
    }
    setMounted(true);
  }, []);

  // Listen for localStorage changes from other tabs
  useEffect(() => {
    if (!mounted) return;

    const handleStorageChange = (e) => {
      if (e.key === "theme" && e.newValue) {
        setTheme(e.newValue);
        document.documentElement.setAttribute("data-theme", e.newValue);
      }
      if (e.key === "fontSize" && e.newValue) {
        setFontSize(e.newValue);
        document.documentElement.setAttribute("data-font-size", e.newValue);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [mounted]);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch (e) {}
  };

  const cycleFontSize = () => {
    const sizes = ["small", "medium", "large"];
    const currentIdx = sizes.indexOf(fontSize);
    const next = sizes[(currentIdx + 1) % sizes.length];
    setFontSize(next);
    document.documentElement.setAttribute("data-font-size", next);
    try {
      localStorage.setItem("fontSize", next);
    } catch (e) {}
  };

  // Don't render controls until after hydration
  if (!mounted || theme === null || fontSize === null) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <FontSizeContext.Provider value={{ fontSize, setFontSize, cycleFontSize }}>
        {children}
      </FontSizeContext.Provider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  // Return safe default during SSR if provider not available yet
  if (!context) {
    return { theme: "dark", toggleTheme: () => {} };
  }
  return context;
}

export function useFontSize() {
  const context = useContext(FontSizeContext);
  // Return safe default during SSR if provider not available yet
  if (!context) {
    return { fontSize: "medium", setFontSize: () => {}, cycleFontSize: () => {} };
  }
  return context;
}
