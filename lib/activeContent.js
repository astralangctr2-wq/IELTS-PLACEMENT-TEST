import { sql, ensureSchema } from "./db";
import { DEFAULT_CONTENT, withIds } from "./content";

// Returns the active content WITH correct-answer keys (id-tagged).
// Server-only — never send the return value of this straight to the browser.
export async function getActiveContentWithAnswers() {
  await ensureSchema();
  const { rows } = await sql`SELECT value FROM settings WHERE key = 'active_content' LIMIT 1`;
  const raw = rows[0]?.value || DEFAULT_CONTENT;
  return withIds(raw);
}

export async function setActiveContent(rawContent) {
  await ensureSchema();
  await sql`
    INSERT INTO settings (key, value, updated_at)
    VALUES ('active_content', ${JSON.stringify(rawContent)}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
}
