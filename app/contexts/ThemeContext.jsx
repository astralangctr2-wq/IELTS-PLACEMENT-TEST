"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);

const THEMES = ["dark", "light"];
const FONT_SIZES = ["small", "medium", "large"];

function readSaved(key, allowed, fallback) {
  try {
    const v = localStorage.getItem(key);
    return allowed.includes(v) ? v : fallback;
  } catch (e) {
    return fallback;
  }
}

// Single source of truth for theme + font size.
//
// The <html data-theme> attribute is DERIVED from this state by an
// effect that re-runs after every mount — it is not set once and then
// trusted. That matters because if React ever has to discard the server
// HTML and re-render the page from scratch (a "hydration mismatch"),
// it wipes attributes it doesn't own, including data-theme. Since this
// effect runs again after that re-render, the saved theme is re-applied
// immediately instead of the page staying stuck on the dark default.
//
// The provider ALWAYS renders the same tree (no early return before
// mount), so children are never torn down and remounted just because
// the theme finished loading.
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("dark");
  const [fontSize, setFontSizeState] = useState("medium");
  const [mounted, setMounted] = useState(false);

  // Load saved preferences once, on the client.
  useEffect(() => {
    setThemeState(readSaved("theme", THEMES, "dark"));
    setFontSizeState(readSaved("fontSize", FONT_SIZES, "medium"));
    setMounted(true);
  }, []);

  // Keep <html> attributes in sync with state (re-applies after any
  // React re-render that wiped them).
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-font-size", fontSize);
  }, [theme, fontSize, mounted]);

  // Follow changes made in another browser tab.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "theme" && THEMES.includes(e.newValue)) setThemeState(e.newValue);
      if (e.key === "fontSize" && FONT_SIZES.includes(e.newValue)) setFontSizeState(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    try { localStorage.setItem("theme", next); } catch (e) {}
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "light" ? "dark" : "light";
      try { localStorage.setItem("theme", next); } catch (e) {}
      return next;
    });
  }, []);

  const setFontSize = useCallback((next) => {
    setFontSizeState(next);
    try { localStorage.setItem("fontSize", next); } catch (e) {}
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, fontSize, setFontSize, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}

const SAFE_DEFAULT = {
  theme: "dark", toggleTheme: () => {}, setTheme: () => {},
  fontSize: "medium", setFontSize: () => {}, mounted: false,
};

export function useTheme() {
  return useContext(ThemeContext) || SAFE_DEFAULT;
}

export function useFontSize() {
  return useContext(ThemeContext) || SAFE_DEFAULT;
}
