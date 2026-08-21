import { randomBytes } from "crypto";
import { sql, ensureSchema } from "./db";
import { DEFAULT_CONTENT, normalizeContent } from "./content";

function genId() {
  return randomBytes(5).toString("base64url").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
}

// First time this runs on a fresh/older database, migrate whatever was
// in the old single "active_content" setting (or the built-in default)
// into the first content bank, marked as the default one — so the
// existing /test link keeps working exactly as before, with zero
// manual steps required.
async function seedIfEmpty() {
  const { rows } = await sql`SELECT count(*)::int AS n FROM content_banks`;
  if (rows[0].n > 0) return;
  const { rows: settingsRows } = await sql`SELECT value FROM settings WHERE key = 'active_content' LIMIT 1`;
  const legacy = settingsRows[0]?.value || DEFAULT_CONTENT;
  const id = genId();
  await sql`
    INSERT INTO content_banks (id, name, content, is_default)
    VALUES (${id}, 'Đề đầy đủ (mặc định)', ${JSON.stringify(legacy)}::jsonb, TRUE)
  `;
}

export async function listContentBanks() {
  await ensureSchema();
  await seedIfEmpty();
  const { rows } = await sql`SELECT id, name, is_default, created_at, content FROM content_banks ORDER BY created_at DESC`;
  return rows;
}

export async function getContentBank(id) {
  await ensureSchema();
  await seedIfEmpty();
  const { rows } = await sql`SELECT id, name, content, is_default FROM content_banks WHERE id = ${id} LIMIT 1`;
  return rows[0] || null;
}

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
export async function createContentBank(name, rawContent) {
  const normalized = normalizeContent(rawContent);
  await ensureSchema();
  await seedIfEmpty();
  const id = genId();
  await sql`
    INSERT INTO content_banks (id, name, content, is_default)
    VALUES (${id}, ${name || "Bộ đề mới"}, ${JSON.stringify(normalized)}::jsonb, FALSE)
  `;
  return id;
}

export async function updateContentBank(id, rawContent, name) {
  const normalized = normalizeContent(rawContent);
  await ensureSchema();
  if (name) {
    await sql`UPDATE content_banks SET content = ${JSON.stringify(normalized)}::jsonb, name = ${name} WHERE id = ${id}`;
  } else {
    await sql`UPDATE content_banks SET content = ${JSON.stringify(normalized)}::jsonb WHERE id = ${id}`;
  }
}

export async function setDefaultContentBank(id) {
  await ensureSchema();
  await sql`UPDATE content_banks SET is_default = FALSE WHERE is_default = TRUE`;
  await sql`UPDATE content_banks SET is_default = TRUE WHERE id = ${id}`;
}

export async function deleteContentBank(id) {
  await ensureSchema();
  const bank = await getContentBank(id);
  if (!bank) return;
  if (bank.is_default) throw new Error("Không thể xoá bộ đề đang là mặc định. Hãy đặt bộ đề khác làm mặc định trước.");
  await sql`DELETE FROM content_banks WHERE id = ${id}`;
}
