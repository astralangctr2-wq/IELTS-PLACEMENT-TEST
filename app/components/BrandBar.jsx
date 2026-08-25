import { CENTER_NAME, LOGO_URL } from "@/lib/branding";

export default function BrandBar({ size = "normal", style = {} }) {
  if (!CENTER_NAME && !LOGO_URL) return null;
  const isHero = size === "hero";
  const imgSize = size === "small" ? 18 : size === "large" ? 40 : isHero ? 84 : 28;
  const fontSize = size === "small" ? 11 : size === "large" ? 15 : isHero ? 18 : 13;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: isHero ? "column" : "row",
        alignItems: "center",
        gap: isHero ? 16 : 8,
        ...style,
      }}
    >
      {LOGO_URL && <img src={LOGO_URL} alt={CENTER_NAME} style={{ height: imgSize, width: "auto" }} />}
      {CENTER_NAME && (
        <span
          className={isHero ? "mono" : "mono muted"}
          style={{ fontSize, letterSpacing: isHero ? "0.06em" : undefined, textAlign: "center" }}
        >
          {CENTER_NAME}
        </span>
      )}
    </div>
  );
}
