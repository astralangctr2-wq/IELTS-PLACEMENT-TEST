import { CENTER_NAME, LOGO_URL } from "@/lib/branding";

export default function BrandBar({ size = "normal", style = {} }) {
  if (!CENTER_NAME && !LOGO_URL) return null;
  const imgSize = size === "small" ? 18 : size === "large" ? 40 : size === "hero" ? 72 : 28;
  const fontSize = size === "small" ? 11 : size === "large" ? 15 : size === "hero" ? 17 : 13;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size === "hero" ? 14 : 8, ...style }}>
      {LOGO_URL && <img src={LOGO_URL} alt={CENTER_NAME} style={{ height: imgSize, width: "auto" }} />}
      {CENTER_NAME && <span className={size === "hero" ? "mono" : "mono muted"} style={{ fontSize, letterSpacing: size === "hero" ? "0.04em" : undefined }}>{CENTER_NAME}</span>}
    </div>
  );
}
