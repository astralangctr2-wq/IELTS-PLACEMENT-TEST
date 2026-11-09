// Who may fill in which part of a result sheet (client-safe).
//
// A sheet can hold sittings of several teachers (a 4-skills test taken in
// two sittings with two teachers). parts = the sittings of the sheet:
//   [{ id, skills: ["reading", …], teacherId, speaking: bool }]
// Rules (agreed with the centre):
//   - the teacher of a sitting writes the comment of each skill of it;
//     Speaking (mark + comment) belongs to the teacher whose link has
//     "Nói" ticked;
//   - every teacher of the sheet may write the class situation, the study
//     direction, the teacher line and the short ("Mock test") comment;
//   - Level, level note, TOTAL, test title, class, template and the CEFR
//     "raise" of Aptis are the admin's.
// The admin may change everything.

export const SKILL_OF_FIELD = { cListening: "listening", cReading: "reading", cWriting: "writing", cSpeaking: "speaking", speaking: "speaking" };
export const SHARED_FIELDS = ["teacher", "comment", "classSituation", "direction"];
export const ADMIN_FIELDS = ["level", "levelNote", "total", "template", "testTitle", "className", "cefrUp"];

export function sheetRights(staff, parts) {
  const admin = staff?.role === "admin";
  const tid = staff?.role === "teacher" ? staff.teacherId : null;
  const mineParts = admin ? parts : parts.filter((p) => p.teacherId && p.teacherId === tid);
  const skills = new Set(mineParts.flatMap((p) => p.skills || []));
  if (mineParts.some((p) => p.speaking)) skills.add("speaking");
  const mine = admin || mineParts.length > 0;
  const can = (field) => {
    if (admin) return true;
    if (!mine) return false;
    if (SKILL_OF_FIELD[field]) return skills.has(SKILL_OF_FIELD[field]);
    return SHARED_FIELDS.includes(field);
  };
  const fields = [...Object.keys(SKILL_OF_FIELD), ...SHARED_FIELDS, ...ADMIN_FIELDS].filter(can);
  return { admin, mine, fields, ownIds: mineParts.map((p) => p.id), skills: [...skills] };
}

// Teacher(s) in charge of each skill of the sheet: { listening: "Ms Lan", … }.
export function skillOwners(parts, names) {
  const out = {};
  for (const p of parts) {
    const n = (p.teacherId && names[p.teacherId]) || "";
    for (const k of [...(p.skills || []), ...(p.speaking ? ["speaking"] : [])]) {
      if (!n) continue;
      out[k] = out[k] && !out[k].split(" / ").includes(n) ? `${out[k]} / ${n}` : n;
    }
  }
  return out;
}
