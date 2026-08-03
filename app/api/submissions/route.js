import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { sql, ensureSchema } from "@/lib/db";
import { getActiveContentWithAnswers } from "@/lib/activeContent";
import { bandFromScore } from "@/lib/scoring";

function scoreSection(answers, questions) {
  let correct = 0;
  for (const q of questions) {
    if (answers && answers[q.id] === q.a) correct += 1;
  }
  return correct;
}

export async function POST(req) {
  await ensureSchema();
  const body = await req.json();
  const studentName = (body.studentName || "").toString().trim().slice(0, 120) || "Học viên ẩn danh";
  const writingText = (body.writingText || "").toString();
  const wordCount = writingText.trim().length === 0 ? 0 : writingText.trim().split(/\s+/).length;

  const content = await getActiveContentWithAnswers();

  const gScore = scoreSection(body.grammarAnswers, content.grammar);
  const rScore = scoreSection(body.readingAnswers, content.reading.questions);
  const lScore = scoreSection(body.listeningAnswers, content.listening.questions);

  const gTotal = content.grammar.length;
  const rTotal = content.reading.questions.length;
  const lTotal = content.listening.questions.length;

  const objectiveBand = bandFromScore(gScore + rScore + lScore, gTotal + rTotal + lTotal);
  const id = randomUUID();

  const contentSnapshot = {
    grammar: content.grammar,
    reading: content.reading.questions,
    listening: content.listening.questions,
  };

  await sql`
    INSERT INTO submissions (
      id, student_name, answers,
      grammar_score, grammar_total,
      reading_score, reading_total,
      listening_score, listening_total,
      objective_band, writing_text, writing_word_count, content_snapshot
    ) VALUES (
      ${id}, ${studentName}, ${JSON.stringify({
        grammar: body.grammarAnswers || {},
        reading: body.readingAnswers || {},
        listening: body.listeningAnswers || {},
      })}::jsonb,
      ${gScore}, ${gTotal},
      ${rScore}, ${rTotal},
      ${lScore}, ${lTotal},
      ${objectiveBand}, ${writingText}, ${wordCount}, ${JSON.stringify(contentSnapshot)}::jsonb
    )
  `;

  return NextResponse.json({
    id,
    gScore, gTotal, rScore, rTotal, lScore, lTotal,
    objectiveBand,
  });
}
