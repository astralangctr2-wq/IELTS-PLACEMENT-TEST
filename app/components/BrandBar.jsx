import { CENTER_NAME, LOGO_URL } from "@/lib/branding";

export default function BrandBar({ size = "normal", style = {} }) {
  if (!CENTER_NAME && !LOGO_URL) return null;
  const imgSize = size === "small" ? 18 : size === "large" ? 40 : 28;
  const fontSize = size === "small" ? 11 : size === "large" ? 15 : 13;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, ...style }}>
      {LOGO_URL && <img src={LOGO_URL} alt={CENTER_NAME} style={{ height: imgSize, width: "auto" }} />}
      {CENTER_NAME && <span className="mono muted" style={{ fontSize }}>{CENTER_NAME}</span>}
    </div>
  );
}
