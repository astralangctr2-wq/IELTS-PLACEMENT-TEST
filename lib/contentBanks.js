import { randomBytes } from "crypto";
import { sql, ensureSchema } from "./db";
import { DEFAULT_CONTENT, normalizeContent } from "./content";

export const CATEGORIES = ["placement", "midterm", "mock", "final", "aptis", "other"];
export const CATEGORY_LABELS = {
  placement: "Placement Test",
  midterm: "Mid-term Test",
  mock: "Mock Test",
  final: "Final Test",
  aptis: "Aptis ESOL",
  other: "Khác",
};

function cleanCategory(category) {
  return CATEGORIES.includes(category) ? category : "other";
}

function genId() {
  return randomBytes(5).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
}

// First time this runs on a fresh/older database, migrate whatever was
// in the old single "active_content" setting (or the built-in default)
// into the first content bank — so pre-existing data isn't lost even
// though there's no more "default bank" concept driving a fixed link.
async function seedIfEmpty() {
  const { rows } = await sql`SELECT count(*)::int AS n FROM content_banks`;
  if (rows[0].n > 0) return;
  const { rows: settingsRows } = await sql`SELECT value FROM settings WHERE key = 'active_content' LIMIT 1`;
  const legacy = settingsRows[0]?.value || DEFAULT_CONTENT;
  const id = genId();
  await sql`
    INSERT INTO content_banks (id, name, content, is_default, category)
    VALUES (${id}, 'Placement Test (mẫu)', ${JSON.stringify(legacy)}::jsonb, TRUE, 'placement')
  `;
}

export async function listContentBanks(category) {
  await ensureSchema();
  await seedIfEmpty();
  if (category) {
    const { rows } = await sql`SELECT id, name, is_default, category, class_name, created_at, content FROM content_banks WHERE category = ${category} ORDER BY class_name ASC, created_at DESC`;
    return rows;
  }
  const { rows } = await sql`SELECT id, name, is_default, category, class_name, created_at, content FROM content_banks ORDER BY class_name ASC, created_at DESC`;
  return rows;
}

export async function getContentBank(id) {
  await ensureSchema();
  await seedIfEmpty();
  const { rows } = await sql`SELECT id, name, content, is_default, category, class_name FROM content_banks WHERE id = ${id} LIMIT 1`;
  return rows[0] || null;
}

// Kept for backward compatibility with sessions created before the
// category system existed (their content_bank_id may be null, meaning
// "use whatever was the default bank at the time").
export async function getDefaultContentBank() {
  await ensureSchema();
  await seedIfEmpty();
  const { rows } = await sql`SELECT id, name, content, category, class_name, is_default FROM content_banks WHERE is_default = TRUE LIMIT 1`;
  if (rows[0]) return rows[0];
  const { rows: any } = await sql`SELECT id, name, content, category, class_name, is_default FROM content_banks ORDER BY created_at ASC LIMIT 1`;
  return any[0] || null;
}

// Validates rawContent (throws a Vietnamese error message if invalid)
// and stores it as a new bank. Returns the new bank's id.
export async function createContentBank(name, rawContent, category, className) {
  const normalized = normalizeContent(rawContent, { strict: true });
  await ensureSchema();
  await seedIfEmpty();
  const id = genId();
  await sql`
    INSERT INTO content_banks (id, name, content, is_default, category, class_name)
    VALUES (${id}, ${name || "Bộ đề mới"}, ${JSON.stringify(normalized)}::jsonb, FALSE, ${cleanCategory(category)}, ${(className || "").trim()})
  `;
  return id;
}

export async function updateContentBank(id, rawContent, name, category, className) {
  const normalized = normalizeContent(rawContent, { strict: true });
  await ensureSchema();
  await sql`UPDATE content_banks SET content = ${JSON.stringify(normalized)}::jsonb WHERE id = ${id}`;
  if (name) await sql`UPDATE content_banks SET name = ${name} WHERE id = ${id}`;
  if (category) await sql`UPDATE content_banks SET category = ${cleanCategory(category)} WHERE id = ${id}`;
  if (className !== undefined) await sql`UPDATE content_banks SET class_name = ${(className || "").trim()} WHERE id = ${id}`;
}

// What still uses a bank: submissions, exam links, a published answer
// review. Deleting it cuts those off (the students' "xem bài làm" stops
// finding their test), so the admin is warned first.
export async function bankUsage(id) {
  await ensureSchema();
  const sub = await sql`SELECT count(*)::int AS n FROM submissions WHERE content_bank_id = ${id}`;
  const ses = await sql`SELECT count(*)::int AS n FROM test_sessions WHERE content_bank_id = ${id}`;
  let review = false;
  try { review = (await sql`SELECT published FROM bank_reviews WHERE bank_id = ${id} LIMIT 1`).rows[0]?.published === true; } catch {}
  return { submissions: sub.rows[0]?.n || 0, sessions: ses.rows[0]?.n || 0, review };
}

// A bank with the same name and class (upload of a corrected file).
const sameName = (v) => (v || "").toString().normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
const sameClass = (v) => (v || "").toString().toUpperCase().replace(/[\s_.-]+/g, "");
export async function findSameBank(name, className) {
  await ensureSchema();
  const { rows } = await sql`SELECT id, name, class_name, created_at FROM content_banks ORDER BY created_at DESC`;
  return rows.find((b) => sameName(b.name) === sameName(name) && sameClass(b.class_name) === sameClass(className)) || null;
}

export async function deleteContentBank(id) {
  await ensureSchema();
  await sql`DELETE FROM content_banks WHERE id = ${id}`;
}
