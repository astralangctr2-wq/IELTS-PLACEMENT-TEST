// Teacher comment lines on the result sheet: a leading criterion label
// ("1. Fluency & coherence:", "Task 1:", "Điểm mạnh:", "- Pronunciation:")
// is printed in bold, as in the centre's Word templates. Plain sentences
// that merely contain a colon ("+ Viết: …", "… sau để cải thiện band điểm:")
// stay as they are.
const NAMED = [
  "Task \\d+", "Writing", "Speaking", "Reading", "Listening",
  "Điểm mạnh", "Điểm yếu", "Điểm cần cải thiện", "Điểm cần khắc phục", "Cần cải thiện", "Ưu điểm", "Nhược điểm", "Hạn chế", "Lưu ý", "Gợi ý",
  "Fluency (?:and|&) Coherence", "Lexical Resource", "Grammatical Range (?:and|&) Accuracy", "Pronunciation",
  "Task Achievement", "Task Response", "Coherence (?:and|&) Cohesion",
].join("|");
const LABEL = new RegExp(`^(\\s*[-–•]?\\s*)((?:\\d+[.)]\\s*[^:\\n]{1,60}?|(?:${NAMED})(?:\\s*\\([^)\\n]{0,12}\\))?)\\s*:)(.*)$`, "i");

// → { bold, rest }: bold is "" when the line has no leading label.
export function splitLabel(line) {
  const m = LABEL.exec(line || "");
  if (!m) return { bold: "", rest: line || "" };
  return { bold: m[1] + m[2], rest: m[3] };
}

// Fields of the sheet still empty — the checklist under the editor and the
// status dot of each student in the class list. r = sheet fields, skills =
// the skills the student took, writingReady = Writing graded (its comment
// is filled in from the grading).
export function missingFields(r, skills, { writingReady = true } = {}) {
  const has = (k) => skills.includes(k);
  const empty = (k) => !(r?.[k] ?? "").toString().trim();
  const out = [];
  if ((r?.template || "short") === "full") {
    if (empty("speaking")) out.push({ key: "scores", label: "Điểm Speaking" });
    if (has("listening") && empty("cListening")) out.push({ key: "nghe", label: "Nghe" });
    if (empty("cSpeaking")) out.push({ key: "noi", label: "Nói" });
    if (has("reading") && empty("cReading")) out.push({ key: "doc", label: "Đọc" });
    if (has("writing") && empty("cWriting") && !writingReady) out.push({ key: "viet", label: "Viết" });
    if (empty("classSituation")) out.push({ key: "lop", label: "Tình hình trên lớp" });
    if (empty("direction")) out.push({ key: "huong", label: "Phương hướng học tập" });
  } else if (empty("comment") && !(has("writing") && writingReady)) {
    out.push({ key: "mock", label: "Teacher’s comment" });
  }
  return out;
}

// Text as typed or pasted (from Word, Google Docs, Zalo…) → plain lines:
// every kind of line break (Windows "\r\n", Word's soft break "\v", …)
// becomes "\n", and invisible control characters are dropped — Word
// refuses to open a .docx that contains them.
export function cleanText(v) {
  return (v ?? "").toString()
    .replace(/\r\n?/g, "\n")
    .replace(/[\u000b\u000c\u0085\u2028\u2029]/g, "\n")
    .replace(/[\u0000-\u0008\u000e-\u001f\u007f\ufffe\uffff]/g, "")
    .replace(/([\ud800-\udbff][\udc00-\udfff])|[\ud800-\udfff]/g, (m, pair) => pair || "");
}
