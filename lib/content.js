// ---------------------------------------------------------------------
// Content schema
// ---------------------------------------------------------------------
// grammar: flat array of questions
// reading / listening: { sections: [ { title, instructions, passage|script, questions:[...] } ] }
//   (legacy flat { passage, questions } / { script, questions } is auto-wrapped
//    into a single section for backward compatibility with older data)
// writing: { prompt }
//
// Question types (field "type", default "mc" when omitted):
//   mc            -> { type:"mc", q, opts:[...], a: <index of correct opt> }
//   gap           -> { type:"gap", q, answers: [<accepted strings>] }
//   multi_select  -> { type:"multi_select", q, opts:[...], a: [<indices of correct opts>] }
// ---------------------------------------------------------------------

export const DEFAULT_CONTENT = {
  grammar: [
    { type: "mc", q: "She ___ to the gym every morning before work.", opts: ["go", "goes", "going", "gone"], a: 1 },
    { type: "mc", q: "If I ___ more time, I would learn French.", opts: ["have", "has", "had", "having"], a: 2 },
    { type: "mc", q: "By the time we arrived, the film ___ already started.", opts: ["has", "had", "have", "was"], a: 1 },
    { type: "mc", q: "This is the book ___ I told you about.", opts: ["who", "whom", "which", "whose"], a: 2 },
    { type: "mc", q: "Neither of the students ___ finished the assignment.", opts: ["has", "have", "having", "had"], a: 0 },
    { type: "mc", q: "I look forward to ___ from you soon.", opts: ["hear", "hearing", "heard", "hears"], a: 1 },
    { type: "mc", q: "The report ___ by the manager before it is published.", opts: ["review", "reviews", "is reviewed", "reviewed"], a: 2 },
    { type: "mc", q: "Despite ___ hard, he failed the exam.", opts: ["study", "studying", "studied", "to study"], a: 1 },
    { type: "mc", q: "She insisted ___ paying for the meal herself.", opts: ["on", "in", "at", "for"], a: 0 },
    { type: "mc", q: "Hardly ___ the meeting started when the fire alarm rang.", opts: ["had", "has", "did", "was"], a: 0 },
  ],
  reading: {
    sections: [
      {
        title: "",
        instructions: "",
        passage: `Urban Beekeeping
Over the past decade, keeping bees on city rooftops and in small urban gardens has grown from a niche hobby into a widespread movement across major cities worldwide. Enthusiasts argue that cities can actually be surprisingly good habitats for bees, since the wide variety of park flowers, garden plants and street trees offers a longer and more diverse flowering season than the single-crop farmland found in many rural areas. Green roofs, planted with a mix of flowering species, have become an increasingly popular addition to office buildings partly because they give urban bee colonies a reliable source of nectar and pollen close to their hives. However, the movement has not been without difficulties. Regulations vary enormously from one city to the next: some municipalities require hobbyist beekeepers to register every hive and pass an inspection, while many others have no formal rules at all. Pesticide use also remains a serious concern, and although several cities have restricted certain chemicals in public parks, most have stopped short of banning them outright, since private gardens and nearby farmland remain largely unregulated.`,
        questions: [
          { type: "mc", q: "Urban beekeeping has become more popular over the last ten years.", opts: ["True", "False", "Not Given"], a: 0 },
          { type: "mc", q: "According to the passage, city bees always produce more honey than rural bees.", opts: ["True", "False", "Not Given"], a: 2 },
          { type: "mc", q: "Every city currently requires beekeepers to register their hives.", opts: ["True", "False", "Not Given"], a: 1 },
          { type: "mc", q: "Green roofs can provide a source of food for urban bee colonies.", opts: ["True", "False", "Not Given"], a: 0 },
          { type: "mc", q: "Pesticide use in cities has been completely banned to protect bees.", opts: ["True", "False", "Not Given"], a: 1 },
        ],
      },
    ],
  },
  listening: {
    sections: [
      {
        title: "",
        instructions: "",
        script: `Good morning, everyone, and welcome to the city library. Before you start using the building, I'd like to run through a few key points. The library is open from eight thirty in the morning until nine in the evening, Monday to Friday, but on weekends it closes earlier, at five o'clock. Once you've registered today, you'll be given a membership card that lets you borrow up to six items at a time. Books can be kept for three weeks, but DVDs and other media must be returned within one week. If you return an item late, there's a small fine of twenty cents per day. Finally, the quiet study room on the second floor must be booked in advance through the front desk, especially during exam periods, when it tends to fill up quickly.`,
        questions: [
          { type: "mc", q: "What time does the library close on weekdays?", opts: ["Five o'clock", "Eight thirty", "Nine o'clock"], a: 2 },
          { type: "mc", q: "What time does the library close on weekends?", opts: ["Five o'clock", "Nine o'clock", "It stays open all day"], a: 0 },
          { type: "mc", q: "How many items can a member borrow at once?", opts: ["Three", "Six", "Twenty"], a: 1 },
          { type: "mc", q: "How long can books be kept?", opts: ["One week", "Two weeks", "Three weeks"], a: 2 },
          { type: "mc", q: "How should the study room be booked?", opts: ["Online only", "In advance at the front desk", "It cannot be booked"], a: 1 },
        ],
      },
    ],
  },
  writing: {
    prompt: `Some people believe that all teenagers should be required to do unpaid community service in their free time. Others feel this should be entirely up to the individual.

Discuss both views and give your own opinion. Write at least 200 words.`,
  },
};

// Accepts either the new { sections: [...] } shape or the legacy flat
// { passage|script, questions } shape and always returns an array of sections.
function toSections(obj, textKey) {
  if (!obj) return [];
  if (Array.isArray(obj.sections)) return obj.sections;
  if (typeof obj[textKey] === "string") {
    return [{ title: "", instructions: "", [textKey]: obj[textKey], questions: obj.questions || [] }];
  }
  return [];
}

function normalizeQuestion(q, label, i) {
  const where = `${label} — câu ${i + 1}`;
  if (!q || typeof q !== "object") throw new Error(`${where}: câu hỏi không hợp lệ.`);
  if (typeof q.q !== "string" || !q.q.trim()) throw new Error(`${where}: thiếu nội dung "q".`);
  const type = q.type || "mc";

  if (type === "mc") {
    if (!Array.isArray(q.opts) || q.opts.length < 2) throw new Error(`${where}: "opts" phải là mảng có ít nhất 2 lựa chọn.`);
    if (typeof q.a !== "number" || q.a < 0 || q.a >= q.opts.length) throw new Error(`${where}: "a" phải là số chỉ vị trí đáp án đúng trong "opts" (bắt đầu từ 0).`);
    return { type: "mc", q: q.q, opts: q.opts, a: q.a };
  }

  if (type === "gap") {
    if (!Array.isArray(q.answers) || q.answers.length === 0 || !q.answers.every((a) => typeof a === "string" && a.trim())) {
      throw new Error(`${where}: câu dạng "gap" cần "answers" là mảng chuỗi đáp án chấp nhận được (ít nhất 1 phần tử).`);
    }
    return { type: "gap", q: q.q, answers: q.answers };
  }

  if (type === "multi_select") {
    if (!Array.isArray(q.opts) || q.opts.length < 2) throw new Error(`${where}: "opts" phải là mảng có ít nhất 2 lựa chọn.`);
    if (!Array.isArray(q.a) || q.a.length === 0 || !q.a.every((n) => typeof n === "number" && n >= 0 && n < q.opts.length)) {
      throw new Error(`${where}: câu dạng "multi_select" cần "a" là mảng các vị trí đáp án đúng trong "opts".`);
    }
    return { type: "multi_select", q: q.q, opts: q.opts, a: [...new Set(q.a)] };
  }

  throw new Error(`${where}: "type" không hợp lệ ("${type}"). Chỉ hỗ trợ "mc", "gap", "multi_select".`);
}

function normalizeQuestions(arr, label) {
  if (!Array.isArray(arr) || arr.length === 0) throw new Error(`Thiếu danh sách câu hỏi cho phần "${label}".`);
  return arr.map((q, i) => normalizeQuestion(q, label, i));
}

function normalizeSections(raw, textKey, label) {
  const sections = toSections(raw, textKey);
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new Error(`Thiếu nội dung "${label}" (cần ít nhất 1 section có "${textKey}" và "questions").`);
  }
  return sections.map((sec, si) => {
    if (!sec || typeof sec[textKey] !== "string" || !sec[textKey].trim()) {
      throw new Error(`${label} — section ${si + 1}: thiếu "${textKey}".`);
    }
    return {
      title: typeof sec.title === "string" ? sec.title : "",
      instructions: typeof sec.instructions === "string" ? sec.instructions : "",
      [textKey]: sec[textKey],
      questions: normalizeQuestions(sec.questions, `${label} — Section ${si + 1}`),
    };
  });
}

export function buildTemplate() {
  return normalizeContent(DEFAULT_CONTENT);
}

// Validates and returns a clean content object, or throws Error with a
// Vietnamese message describing exactly what's wrong.
export function normalizeContent(raw) {
  if (!raw || typeof raw !== "object") throw new Error("JSON không hợp lệ.");
  if (!raw.writing || typeof raw.writing.prompt !== "string" || !raw.writing.prompt.trim()) {
    throw new Error('Thiếu "writing.prompt" (đề bài viết).');
  }
  return {
    grammar: normalizeQuestions(raw.grammar, "Ngữ pháp"),
    reading: { sections: normalizeSections(raw.reading, "passage", "Reading") },
    listening: { sections: normalizeSections(raw.listening, "script", "Listening") },
    writing: { prompt: raw.writing.prompt },
  };
}

// Adds a stable numeric id to every question so client answer-state and
// server-side scoring always line up. Ids are unique within each
// top-level section (grammar / reading / listening), counted across all
// sub-sections so reading section 2's first question doesn't collide
// with section 1's ids.
function idSections(sections, textKey) {
  let counter = 0;
  return sections.map((sec) => ({
    title: sec.title || "",
    instructions: sec.instructions || "",
    [textKey]: sec[textKey],
    questions: sec.questions.map((q) => ({ id: counter++, ...q })),
  }));
}

export function withIds(content) {
  return {
    grammar: content.grammar.map((q, i) => ({ id: i, ...q })),
    reading: { sections: idSections(toSections(content.reading, "passage"), "passage") },
    listening: { sections: idSections(toSections(content.listening, "script"), "script") },
    writing: { prompt: content.writing.prompt },
  };
}

// Strips the correct-answer key before sending content to the browser,
// so students can't read answers from the network tab. For multi_select
// we still tell the client how many options should be selected
// (selectCount) without revealing which ones are correct.
function stripQuestion(q) {
  const type = q.type || "mc";
  const base = { id: q.id, q: q.q, type };
  if (type === "mc") return { ...base, opts: q.opts };
  if (type === "multi_select") return { ...base, opts: q.opts, selectCount: q.a.length };
  if (type === "gap") return base;
  return base;
}

export function withoutAnswers(content) {
  const stripSections = (sections, textKey) =>
    sections.map((sec) => ({
      title: sec.title || "",
      instructions: sec.instructions || "",
      [textKey]: sec[textKey],
      questions: sec.questions.map(stripQuestion),
    }));
  return {
    grammar: content.grammar.map(stripQuestion),
    reading: { sections: stripSections(content.reading.sections, "passage") },
    listening: { sections: stripSections(content.listening.sections, "script") },
    writing: { prompt: content.writing.prompt },
  };
}

// Flattens a reading/listening section list into one array of questions,
// tagging each with its section's title so review UIs can group them.
export function flattenSectionQuestions(sections) {
  const out = [];
  for (const sec of sections) {
    for (const q of sec.questions) out.push({ ...q, sectionTitle: sec.title || "" });
  }
  return out;
}
