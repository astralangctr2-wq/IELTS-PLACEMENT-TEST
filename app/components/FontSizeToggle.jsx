"use client";

import { useFontSize } from "@/app/contexts/ThemeContext";

const SIZES = [
  { key: "small", label: "A", fontSize: 12 },
  { key: "medium", label: "A", fontSize: 15 },
  { key: "large", label: "A", fontSize: 18 },
];

export default function FontSizeToggle() {
  const { fontSize, setFontSize } = useFontSize();

  const handleClick = (key) => {
    document.documentElement.setAttribute("data-font-size", key);
    try {
      localStorage.setItem("fontSize", key);
    } catch (e) {}
    setFontSize(key);
  };

  return (
    <div className="font-size-group" role="group" aria-label="Cỡ chữ">
      {SIZES.map((s) => (
        <button
          key={s.key}
          type="button"
          className={`font-size-btn ${fontSize === s.key ? "active" : ""}`}
          style={{ fontSize: s.fontSize }}
          onClick={() => handleClick(s.key)}
          title={`Cỡ chữ ${s.key === "small" ? "nhỏ" : s.key === "large" ? "lớn" : "vừa"}`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
