import { randomBytes } from "crypto";
import { sql, ensureSchema } from "./db";
import { DEFAULT_CONTENT, normalizeContent } from "./content";

export const CATEGORIES = ["placement", "midterm", "mock", "final", "other"];
export const CATEGORY_LABELS = {
  placement: "Placement Test",
  midterm: "Mid-term Test",
  mock: "Mock Test",
  final: "Final Test",
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
    const { rows } = await sql`SELECT id, name, is_default, category, created_at, content FROM content_banks WHERE category = ${category} ORDER BY created_at DESC`;
    return rows;
  }
  const { rows } = await sql`SELECT id, name, is_default, category, created_at, content FROM content_banks ORDER BY created_at DESC`;
  return rows;
}

export async function getContentBank(id) {
  await ensureSchema();
  await seedIfEmpty();
  const { rows } = await sql`SELECT id, name, content, is_default, category FROM content_banks WHERE id = ${id} LIMIT 1`;
  return rows[0] || null;
}

// Kept for backward compatibility with sessions created before the
// category system existed (their content_bank_id may be null, meaning
// "use whatever was the default bank at the time").
export async function getDefaultContentBank() {
  await ensureSchema();
  await seedIfEmpty();
  const { rows } = await sql`SELECT id, name, content FROM content_banks WHERE is_default = TRUE LIMIT 1`;
  if (rows[0]) return rows[0];
  const { rows: any } = await sql`SELECT id, name, content FROM content_banks ORDER BY created_at ASC LIMIT 1`;
  return any[0] || null;
}

// Validates rawContent (throws a Vietnamese error message if invalid)
// and stores it as a new bank. Returns the new bank's id.
export async function createContentBank(name, rawContent, category) {
  const normalized = normalizeContent(rawContent);
  await ensureSchema();
  await seedIfEmpty();
  const id = genId();
  await sql`
    INSERT INTO content_banks (id, name, content, is_default, category)
    VALUES (${id}, ${name || "Bộ đề mới"}, ${JSON.stringify(normalized)}::jsonb, FALSE, ${cleanCategory(category)})
  `;
  return id;
}

export async function updateContentBank(id, rawContent, name, category) {
  const normalized = normalizeContent(rawContent);
  await ensureSchema();
  const finalName = name || null;
  const finalCategory = category ? cleanCategory(category) : null;
  if (finalName && finalCategory) {
    await sql`UPDATE content_banks SET content = ${JSON.stringify(normalized)}::jsonb, name = ${finalName}, category = ${finalCategory} WHERE id = ${id}`;
  } else if (finalName) {
    await sql`UPDATE content_banks SET content = ${JSON.stringify(normalized)}::jsonb, name = ${finalName} WHERE id = ${id}`;
  } else if (finalCategory) {
    await sql`UPDATE content_banks SET content = ${JSON.stringify(normalized)}::jsonb, category = ${finalCategory} WHERE id = ${id}`;
  } else {
    await sql`UPDATE content_banks SET content = ${JSON.stringify(normalized)}::jsonb WHERE id = ${id}`;
  }
}

export async function deleteContentBank(id) {
  await ensureSchema();
  await sql`DELETE FROM content_banks WHERE id = ${id}`;
}
