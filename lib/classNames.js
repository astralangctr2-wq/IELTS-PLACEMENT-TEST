// Class codes are compared ignoring case, spaces, dashes, dots and
// underscores: "FL1", "fl1", "Fl 1", "fl-1" are all class "FL1".
// Pure function — used by the student start screen, the API and the
// teacher pages. The SQL twin lives in lib/overview.js (CLASS_NORM).
export function normalizeClassName(v) {
  return (v ?? "")
    .toString()
    .normalize("NFC")
    .replace(/[\s_.\-]+/g, "")
    .toUpperCase()
    .slice(0, 40);
}

// Same student across attempts inside one class: name compared ignoring
// case and extra spaces.
export function studentKey(name) {
  return (name ?? "").toString().normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}
