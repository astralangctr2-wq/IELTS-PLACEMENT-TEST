import { sql, ensureSchema } from "./db";

// Server copy of a test the student is still doing (autosave). One row per
// test link + student (name and class as typed on the start screen), so a
// student whose computer died can continue on another computer by typing
// the same name and class. Deleted when the test is submitted; rows older
// than 7 days are cleaned up on the way.

const MAX_BYTES = 400_000;
export const studentKeyOf = (name) => (name || "").toString().normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase().slice(0, 120);
const cleanKey = (k) => (k || "").toString().replace(/[^A-Za-z0-9_:-]/g, "").slice(0, 80);
const cleanClass = (c) => (c || "").toString().toUpperCase().replace(/[\s_.-]+/g, "").slice(0, 40);

let ready = null;
function ensureDraftSchema() {
  if (!ready) {
    ready = (async () => {
      await ensureSchema();
      await sql`
        CREATE TABLE IF NOT EXISTS test_drafts (
          draft_key TEXT NOT NULL,
          student_key TEXT NOT NULL,
          class_key TEXT NOT NULL DEFAULT '',
          student_name TEXT NOT NULL,
          stage TEXT,
          data JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (draft_key, student_key, class_key)
        )`;
      await sql`CREATE INDEX IF NOT EXISTS test_drafts_updated_idx ON test_drafts (updated_at)`;
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

export async function saveDraft({ key, name, cls, data }) {
  const k = cleanKey(key), sk = studentKeyOf(name);
  if (!k || !sk || !data || typeof data !== "object") return { error: "Thiếu thông tin." };
  const json = JSON.stringify(data);
  if (json.length > MAX_BYTES) return { error: "Bài làm quá lớn để lưu tạm." };
  await ensureDraftSchema();
  await sql`
    INSERT INTO test_drafts (draft_key, student_key, class_key, student_name, stage, data, updated_at)
    VALUES (${k}, ${sk}, ${cleanClass(cls)}, ${(name || "").toString().trim().slice(0, 120)}, ${(data.stage || "").toString().slice(0, 20)}, ${json}::jsonb, now())
    ON CONFLICT (draft_key, student_key, class_key)
    DO UPDATE SET data = EXCLUDED.data, stage = EXCLUDED.stage, student_name = EXCLUDED.student_name, updated_at = now()`;
  if (Math.random() < 0.02) await sql`DELETE FROM test_drafts WHERE updated_at < now() - interval '7 days'`;
  return { ok: true };
}

export async function findDraft({ key, name, cls }) {
  const k = cleanKey(key), sk = studentKeyOf(name);
  if (!k || !sk) return null;
  await ensureDraftSchema();
  const { rows } = await sql`
    SELECT data, updated_at FROM test_drafts
    WHERE draft_key = ${k} AND student_key = ${sk} AND class_key = ${cleanClass(cls)}
      AND updated_at > now() - interval '3 days'
    LIMIT 1`;
  return rows[0] ? { data: rows[0].data, updatedAt: new Date(rows[0].updated_at).toISOString() } : null;
}

export async function deleteDraft({ key, name, cls }) {
  const k = cleanKey(key), sk = studentKeyOf(name);
  if (!k || !sk) return;
  await ensureDraftSchema();
  await sql`DELETE FROM test_drafts WHERE draft_key = ${k} AND student_key = ${sk} AND class_key = ${cleanClass(cls)}`;
}

// Teacher view: tests in progress on one link (or all links).
export async function listDrafts(key) {
  await ensureDraftSchema();
  const k = cleanKey(key);
  const { rows } = k
    ? await sql`SELECT draft_key, student_name, class_key, stage, updated_at FROM test_drafts WHERE draft_key = ${k} AND updated_at > now() - interval '3 days' ORDER BY updated_at DESC LIMIT 200`
    : await sql`SELECT draft_key, student_name, class_key, stage, updated_at FROM test_drafts WHERE updated_at > now() - interval '3 days' ORDER BY updated_at DESC LIMIT 500`;
  return rows;
}
