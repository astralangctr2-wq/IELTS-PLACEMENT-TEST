"use client";

import { useEffect, useState } from "react";

const SIZES = [
  { key: "small", label: "A", fontSize: 12 },
  { key: "medium", label: "A", fontSize: 15 },
  { key: "large", label: "A", fontSize: 18 },
];

export default function FontSizeToggle() {
  const [size, setSize] = useState(null);

  useEffect(() => {
    let saved = "medium";
    try {
      saved = localStorage.getItem("fontSize") || "medium";
    } catch (e) {}
    setSize(saved);
  }, []);

  const choose = (key) => {
    setSize(key);
    try {
      localStorage.setItem("fontSize", key);
      // notify any already-mounted test page in this same tab
      window.dispatchEvent(new StorageEvent("storage", { key: "fontSize", newValue: key }));
    } catch (e) {}
  };

  if (size === null) return null;

  return (
    <div className="font-size-group" role="group" aria-label="Cỡ chữ">
      {SIZES.map((s) => (
        <button
          key={s.key}
          type="button"
          className={`font-size-btn ${size === s.key ? "active" : ""}`}
          style={{ fontSize: s.fontSize }}
          onClick={() => choose(s.key)}
          title={`Cỡ chữ ${s.key === "small" ? "nhỏ" : s.key === "large" ? "lớn" : "vừa"}`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
