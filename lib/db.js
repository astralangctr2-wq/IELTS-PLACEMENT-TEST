import { sql } from "@vercel/postgres";

let schemaReady = false;

// Idempotent — safe to call on every request. Creates tables the first
// time the app talks to a fresh database, no manual migration needed.
export async function ensureSchema() {
  if (schemaReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      student_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      answers JSONB NOT NULL,
      grammar_score INT NOT NULL,
      grammar_total INT NOT NULL,
      reading_score INT NOT NULL,
      reading_total INT NOT NULL,
      listening_score INT NOT NULL,
      listening_total INT NOT NULL,
      objective_band NUMERIC NOT NULL,
      writing_text TEXT NOT NULL,
      writing_word_count INT NOT NULL,
      writing_band NUMERIC,
      writing_feedback TEXT,
      final_band NUMERIC,
      graded BOOLEAN NOT NULL DEFAULT FALSE,
      graded_at TIMESTAMPTZ,
      content_snapshot JSONB
    );
  `;
  // Backfill for databases created before content_snapshot existed.
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS content_snapshot JSONB;`;
  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  schemaReady = true;
}

export { sql };
