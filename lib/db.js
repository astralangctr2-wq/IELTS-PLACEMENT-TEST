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
      objective_band NUMERIC,
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
  // Backfill for databases created before these columns existed.
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS content_snapshot JSONB;`;
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS target_band TEXT;`;
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS session_id TEXT;`;
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS skills_included JSONB;`;
  await sql`ALTER TABLE submissions ALTER COLUMN objective_band DROP NOT NULL;`;

  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS test_sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      skills JSONB NOT NULL,
      time_limits JSONB NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`ALTER TABLE test_sessions ADD COLUMN IF NOT EXISTS content_bank_id TEXT;`;

  await sql`
    CREATE TABLE IF NOT EXISTS content_banks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      content JSONB NOT NULL,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`ALTER TABLE content_banks ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other';`;
  await sql`ALTER TABLE content_banks ADD COLUMN IF NOT EXISTS class_name TEXT NOT NULL DEFAULT '';`;
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS content_bank_id TEXT;`;
  // Teacher-side only: detailed Writing grade (criteria / parts, comments,
  // highlights) and the class a submission is filed under. NULL class_name
  // = follow the class of the session link; '' = explicitly "no class".
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS grading JSONB;`;
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS class_name TEXT;`;
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS exam_type TEXT;`;
  await sql`ALTER TABLE test_sessions ADD COLUMN IF NOT EXISTS class_name TEXT;`;
  // Class typed by the student on the start screen (normalized: upper case,
  // no spaces / dashes), anti-cheat log of an exam attempt, and the
  // optional open / close window of a session link.
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS student_class TEXT;`;
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS integrity JSONB;`;
  await sql`ALTER TABLE test_sessions ADD COLUMN IF NOT EXISTS opens_at TIMESTAMPTZ;`;
  await sql`ALTER TABLE test_sessions ADD COLUMN IF NOT EXISTS closes_at TIMESTAMPTZ;`;

  schemaReady = true;
}

export { sql };
