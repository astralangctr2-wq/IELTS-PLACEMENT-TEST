import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { getActiveContentWithAnswers } from "@/lib/activeContent";
import { flattenSectionQuestions } from "@/lib/content";
import { bandFromScore, scoreQuestions } from "@/lib/scoring";

const ALL_SKILLS = ["grammar", "reading", "listening", "writing"];

export async function POST(req) {
  await ensureSchema();
  const body = await req.json();
  const studentName = (body.studentName || "").toString().trim().slice(0, 120) || "Học viên ẩn danh";
  const targetBand = (body.targetBand || "").toString().trim().slice(0, 20) || null;
  const sessionId = (body.sessionId || "").toString().trim().slice(0, 20) || null;
  const skillsIncluded = ALL_SKILLS.filter((s) => Array.isArray(body.skills) ? body.skills.includes(s) : true);

  const writingText = (body.writingText || "").toString();
  const wordCount = writingText.trim().length === 0 ? 0 : writingText.trim().split(/\s+/).length;

  const content = await getActiveContentWithAnswers();

  const grammarQs = content.grammar;
  const readingQs = flattenSectionQuestions(content.reading.sections);
  const listeningQs = flattenSectionQuestions(content.listening.sections);

  const zero = { earned: 0, total: 0 };
  const g = skillsIncluded.includes("grammar") ? scoreQuestions(body.grammarAnswers, grammarQs) : zero;
  const r = skillsIncluded.includes("reading") ? scoreQuestions(body.readingAnswers, readingQs) : zero;
  const l = skillsIncluded.includes("listening") ? scoreQuestions(body.listeningAnswers, listeningQs) : zero;

  const objTotal = g.total + r.total + l.total;
  const objectiveBand = objTotal > 0 ? bandFromScore(g.earned + r.earned + l.earned, objTotal) : null;
  const id = randomUUID();

  const contentSnapshot = {
    grammar: grammarQs,
    reading: readingQs,
    listening: listeningQs,
  };

  await sql`
    INSERT INTO submissions (
      id, student_name, answers,
      grammar_score, grammar_total,
      reading_score, reading_total,
      listening_score, listening_total,
      objective_band, writing_text, writing_word_count, content_snapshot,
      target_band, session_id, skills_included
    ) VALUES (
      ${id}, ${studentName}, ${JSON.stringify({
        grammar: body.grammarAnswers || {},
        reading: body.readingAnswers || {},
        listening: body.listeningAnswers || {},
      })}::jsonb,
      ${g.earned}, ${g.total},
      ${r.earned}, ${r.total},
      ${l.earned}, ${l.total},
      ${objectiveBand}, ${writingText}, ${wordCount}, ${JSON.stringify(contentSnapshot)}::jsonb,
      ${targetBand}, ${sessionId}, ${JSON.stringify(skillsIncluded)}::jsonb
    )
  `;

  return NextResponse.json({
    id,
    gScore: g.earned, gTotal: g.total,
    rScore: r.earned, rTotal: r.total,
    lScore: l.earned, lTotal: l.total,
    objectiveBand,
  });
}
