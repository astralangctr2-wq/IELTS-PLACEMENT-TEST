"use client";

import { useEffect, useState } from "react";

// Test screens are scaled with CSS zoom (text-size setting A- / A / A+).
// Big monitors (≥ 1500 CSS px wide, e.g. the 20–22" screens at the centre)
// get one step larger on top of that. Viewport units (vh) are scaled by
// CSS zoom too, so the panes that must fit the screen get their height in
// px computed here instead (--pane-h, --panel-h).
export const TEXT_ZOOM = { small: 0.9, medium: 1, large: 1.25 };
const BIG_SCREEN = 1500;
const BIG_BOOST = 1.15;

export function useScreenZoom(fontSize) {
  const [vp, setVp] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    on();
    window.addEventListener("resize", on);
    document.addEventListener("fullscreenchange", on);
    return () => { window.removeEventListener("resize", on); document.removeEventListener("fullscreenchange", on); };
  }, []);
  const zoom = Math.round((TEXT_ZOOM[fontSize] || 1) * (vp.w >= BIG_SCREEN ? BIG_BOOST : 1) * 1000) / 1000;
  const style = { zoom };
  if (vp.h) {
    style["--pane-h"] = `${Math.max(240, Math.floor(vp.h / zoom - 44))}px`;
    style["--panel-h"] = `${Math.max(200, Math.floor((vp.h * 0.7) / zoom))}px`;
  }
  return { zoom, style };
}
