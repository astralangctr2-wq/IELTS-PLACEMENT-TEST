"use client";

import ThemeToggle from "./ThemeToggle";
import FontSizeToggle from "./FontSizeToggle";

export default function TopControls() {
  return (
    <div className="top-controls">
      <FontSizeToggle />
      <ThemeToggle />
    </div>
  );
}
