import { randomBytes } from "crypto";
import { sql, ensureSchema } from "./db";
import { withIds } from "./content";
import { reviewQuestion } from "./review";
import { ensureTeacherSchema } from "./overview";
import { normalizeClassName } from "./classNames";

// Detailed answer review ("chữa bài") of one test bank, published on ONE
// link per bank: every class that took the test (same level = same test)
// gets the same link. Nothing is visible until the teacher publishes it.
//
// Stored apart from the bank content (editing explanations never touches
// the test itself), keyed by question id (withIds order):
//   data = {
//     reading:   { intro: { "<section #>": text }, tips: { "<note id>": text },
//                  items: { "<question id>": { parts: [ { where, quote, para, explain, trap } ] } } },
//     listening: { …same…, transcripts: { "<section #>": [ { t: seconds, sp, text } ] } }
//   }
// A question with several blanks / items has one part per blank / item;
// mc, gap and multi-select questions have one part.

export const REVIEW_SKILLS = ["reading", "listening"];
const SKILL_LABEL = { reading: "Reading", listening: "Listening" };
const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");

let ready = null;
function ensureReviewTable() {
  if (!ready) {
    ready = (async () => {
      await ensureSchema();
      await sql`
        CREATE TABLE IF NOT EXISTS bank_reviews (
          bank_id TEXT PRIMARY KEY,
          slug TEXT UNIQUE NOT NULL,
          published BOOLEAN NOT NULL DEFAULT FALSE,
          published_at TIMESTAMPTZ,
          data JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`;
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

// Keep only known fields, with size limits.
export function cleanReviewData(raw) {
  const out = {};
  const r = raw && typeof raw === "object" ? raw : {};
  for (const skill of REVIEW_SKILLS) {
    const s = r[skill];
    if (!s || typeof s !== "object") continue;
    const o = { intro: {}, tips: {}, items: {} };
    for (const [k, v] of Object.entries(s.intro || {})) if (str(v, 2000).trim()) o.intro[String(k).slice(0, 10)] = str(v, 2000);
    for (const [k, v] of Object.entries(s.tips || {})) if (str(v, 2000).trim()) o.tips[String(k).slice(0, 10)] = str(v, 2000);
    for (const [k, v] of Object.entries(s.items || {})) {
      const parts = (Array.isArray(v?.parts) ? v.parts : []).slice(0, 30).map((p) => ({
        where: str(p?.where, 200), quote: str(p?.quote, 2000), para: str(p?.para, 1000),
        explain: str(p?.explain, 3000), trap: str(p?.trap, 2000),
        ...(Number.isFinite(Number(p?.time)) && p?.time !== null && p?.time !== "" ? { time: Math.max(0, Math.round(Number(p.time))) } : {}),
      }));
      if (parts.length) o.items[String(k).slice(0, 10)] = { parts };
    }
    if (skill === "listening" && s.transcripts && typeof s.transcripts === "object") {
      o.transcripts = {};
      for (const [k, lines] of Object.entries(s.transcripts)) {
        if (!Array.isArray(lines)) continue;
        o.transcripts[String(k).slice(0, 10)] = lines.slice(0, 600).map((l) => ({
          t: Math.max(0, Number(l?.t) || 0), sp: str(l?.sp, 40), text: str(l?.text, 2000),
        })).filter((l) => l.text.trim());
      }
    }
    out[skill] = o;
  }
  return out;
}

export async function getBankReview(bankId) {
  await ensureReviewTable();
  const { rows } = await sql`SELECT * FROM bank_reviews WHERE bank_id = ${bankId} LIMIT 1`;
  return rows[0] || null;
}

export async function getReviewBySlug(slug) {
  await ensureReviewTable();
  const { rows } = await sql`SELECT * FROM bank_reviews WHERE slug = ${String(slug || "").slice(0, 40)} LIMIT 1`;
  return rows[0] || null;
}

// Creates the link the first time; data / published are optional.
export async function saveBankReview(bankId, { data, published } = {}) {
  await ensureReviewTable();
  const existing = await getBankReview(bankId);
  if (!existing) {
    const slug = randomBytes(6).toString("base64url");
    await sql`
      INSERT INTO bank_reviews (bank_id, slug, published, published_at, data)
      VALUES (${bankId}, ${slug}, ${Boolean(published)}, ${published ? new Date().toISOString() : null}, ${JSON.stringify(cleanReviewData(data || {}))}::jsonb)`;
    return getBankReview(bankId);
  }
  if (data !== undefined) {
    await sql`UPDATE bank_reviews SET data = ${JSON.stringify(cleanReviewData(data))}::jsonb, updated_at = now() WHERE bank_id = ${bankId}`;
  }
  if (published !== undefined) {
    await sql`
      UPDATE bank_reviews SET published = ${Boolean(published)},
        published_at = CASE WHEN ${Boolean(published)} THEN now() ELSE published_at END, updated_at = now()
      WHERE bank_id = ${bankId}`;
  }
  return getBankReview(bankId);
}

// How much of the bank has explanations (for the teacher panel).
export function reviewCoverage(content, data) {
  const c = withIds(content);
  const out = {};
  for (const skill of REVIEW_SKILLS) {
    const qs = (c[skill]?.sections || []).flatMap((s) => s.questions).filter((q) => (q.type || "mc") !== "note");
    if (!qs.length) continue;
    const items = data?.[skill]?.items || {};
    out[skill] = { questions: qs.length, explained: qs.filter((q) => items[q.id]?.parts?.some((p) => p.explain || p.quote)).length, transcripts: Object.keys(data?.[skill]?.transcripts || {}).length };
  }
  return out;
}

// Everything the public review page shows: per skill, per section, the
// numbered questions with the key and the explanations.
export function buildReviewModel(content, data) {
  const c = withIds(content);
  const skills = [];
  for (const skill of REVIEW_SKILLS) {
    const sections = c[skill]?.sections;
    if (!sections?.length) continue;
    const d = data?.[skill] || {};
    let num = 0;
    const outSections = sections.map((sec, si) => {
      const entries = [];
      for (const q of sec.questions) {
        const type = q.type || "mc";
        if (type === "note") {
          entries.push({ kind: "note", id: q.id, text: q.q || "", tip: d.tips?.[q.id] || "" });
          continue;
        }
        const it = reviewQuestion(q, undefined);
        if (!it) continue;
        const start = num + 1;
        num += Math.max(1, it.total);
        const exp = d.items?.[q.id]?.parts || [];
        entries.push({
          kind: "q", id: q.id, type, start, end: num, q: it.q,
          opts: type === "mc" || type === "multi_select" ? q.opts : undefined,
          parts: it.parts.map((p, pi) => ({
            label: p.label || "",
            num: it.parts.length > 1 ? start + pi : null,
            correct: p.correct ?? "",
            ...(exp[pi] || {}),
          })),
        });
      }
      return {
        index: si,
        title: sec.title || `${SKILL_LABEL[skill]} ${si + 1}`,
        instructions: sec.instructions || "",
        intro: d.intro?.[si] || "",
        ...(skill === "reading" ? { passage: sec.passage, imageUrl: sec.imageUrl || "" } : { audioUrl: sec.audioUrl || "", transcript: d.transcripts?.[si] || [] }),
        entries,
      };
    });
    skills.push({ skill, label: SKILL_LABEL[skill], total: num, sections: outSections });
  }
  return skills;
}

// One student's own answers (latest submission of this bank, same name and
// class), marked with the teacher's confirmed ✓/✗ where there is one.
export async function studentAnswersFor(bankId, name, cls) {
  const key = (name || "").toString().normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
  const klass = normalizeClassName(cls || "");
  if (!key || !klass) return null;
  await ensureTeacherSchema();
  const { rows } = await sql`
    SELECT s.id, s.student_name, s.created_at, s.answers, s.content_snapshot, s.skills_included,
           s.reading_score, s.reading_total, s.listening_score, s.listening_total,
           to_jsonb(s) -> 'answer_review' AS answer_review
    FROM submission_overview_v1 o JOIN submissions s ON s.id = o.id
    WHERE o.content_bank_id = ${bankId}
      AND lower(regexp_replace(btrim(normalize(o.student_name, NFC)), '[[:space:]]+', ' ', 'g')) = ${key}
      AND o.class_name = ${klass}
    ORDER BY s.created_at DESC LIMIT 10`;
  if (!rows.length) return null;
  const out = { name: rows[0].student_name, skills: {} };
  for (const skill of REVIEW_SKILLS) {
    const s = rows.find((r) => (Array.isArray(r.skills_included) ? r.skills_included : [skill]).includes(skill) && Array.isArray(r.content_snapshot?.[skill]));
    if (!s) continue;
    const marks = s.answer_review?.marks || {};
    const items = {};
    for (const q of s.content_snapshot[skill]) {
      const it = reviewQuestion(q, s.answers?.[skill]?.[q.id]);
      if (!it) continue;
      items[q.id] = it.parts.map((p, pi) => {
        const mk = `${skill}:${q.id}:${pi}`;
        const ok = mk in marks ? marks[mk] : it.parts.length === 1 ? it.earned === it.total : p.ok;
        return { given: p.given, ok };
      });
    }
    out.skills[skill] = { takenAt: new Date(s.created_at).toISOString(), score: [s[`${skill}_score`], s[`${skill}_total`]], items };
  }
  return Object.keys(out.skills).length ? out : null;
}
