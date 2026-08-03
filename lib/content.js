export const DEFAULT_CONTENT = {
  grammar: [
    { q: "She ___ to the gym every morning before work.", opts: ["go", "goes", "going", "gone"], a: 1 },
    { q: "If I ___ more time, I would learn French.", opts: ["have", "has", "had", "having"], a: 2 },
    { q: "By the time we arrived, the film ___ already started.", opts: ["has", "had", "have", "was"], a: 1 },
    { q: "This is the book ___ I told you about.", opts: ["who", "whom", "which", "whose"], a: 2 },
    { q: "Neither of the students ___ finished the assignment.", opts: ["has", "have", "having", "had"], a: 0 },
    { q: "I look forward to ___ from you soon.", opts: ["hear", "hearing", "heard", "hears"], a: 1 },
    { q: "The report ___ by the manager before it is published.", opts: ["review", "reviews", "is reviewed", "reviewed"], a: 2 },
    { q: "Despite ___ hard, he failed the exam.", opts: ["study", "studying", "studied", "to study"], a: 1 },
    { q: "She insisted ___ paying for the meal herself.", opts: ["on", "in", "at", "for"], a: 0 },
    { q: "Hardly ___ the meeting started when the fire alarm rang.", opts: ["had", "has", "did", "was"], a: 0 },
  ],
  reading: {
    passage: `Urban Beekeeping
Over the past decade, keeping bees on city rooftops and in small urban gardens has grown from a niche hobby into a widespread movement across major cities worldwide. Enthusiasts argue that cities can actually be surprisingly good habitats for bees, since the wide variety of park flowers, garden plants and street trees offers a longer and more diverse flowering season than the single-crop farmland found in many rural areas. Green roofs, planted with a mix of flowering species, have become an increasingly popular addition to office buildings partly because they give urban bee colonies a reliable source of nectar and pollen close to their hives. However, the movement has not been without difficulties. Regulations vary enormously from one city to the next: some municipalities require hobbyist beekeepers to register every hive and pass an inspection, while many others have no formal rules at all. Pesticide use also remains a serious concern, and although several cities have restricted certain chemicals in public parks, most have stopped short of banning them outright, since private gardens and nearby farmland remain largely unregulated.`,
    questions: [
      { q: "Urban beekeeping has become more popular over the last ten years.", opts: ["True", "False", "Not Given"], a: 0 },
      { q: "According to the passage, city bees always produce more honey than rural bees.", opts: ["True", "False", "Not Given"], a: 2 },
      { q: "Every city currently requires beekeepers to register their hives.", opts: ["True", "False", "Not Given"], a: 1 },
      { q: "Green roofs can provide a source of food for urban bee colonies.", opts: ["True", "False", "Not Given"], a: 0 },
      { q: "Pesticide use in cities has been completely banned to protect bees.", opts: ["True", "False", "Not Given"], a: 1 },
    ],
  },
  listening: {
    script: `Good morning, everyone, and welcome to the city library. Before you start using the building, I'd like to run through a few key points. The library is open from eight thirty in the morning until nine in the evening, Monday to Friday, but on weekends it closes earlier, at five o'clock. Once you've registered today, you'll be given a membership card that lets you borrow up to six items at a time. Books can be kept for three weeks, but DVDs and other media must be returned within one week. If you return an item late, there's a small fine of twenty cents per day. Finally, the quiet study room on the second floor must be booked in advance through the front desk, especially during exam periods, when it tends to fill up quickly.`,
    questions: [
      { q: "What time does the library close on weekdays?", opts: ["Five o'clock", "Eight thirty", "Nine o'clock"], a: 2 },
      { q: "What time does the library close on weekends?", opts: ["Five o'clock", "Nine o'clock", "It stays open all day"], a: 0 },
      { q: "How many items can a member borrow at once?", opts: ["Three", "Six", "Twenty"], a: 1 },
      { q: "How long can books be kept?", opts: ["One week", "Two weeks", "Three weeks"], a: 2 },
      { q: "How should the study room be booked?", opts: ["Online only", "In advance at the front desk", "It cannot be booked"], a: 1 },
    ],
  },
  writing: {
    prompt: `Some people believe that all teenagers should be required to do unpaid community service in their free time. Others feel this should be entirely up to the individual.

Discuss both views and give your own opinion. Write at least 200 words.`,
  },
};

export function buildTemplate() {
  return {
    grammar: DEFAULT_CONTENT.grammar.map((q) => ({ ...q })),
    reading: { passage: DEFAULT_CONTENT.reading.passage, questions: DEFAULT_CONTENT.reading.questions.map((q) => ({ ...q })) },
    listening: { script: DEFAULT_CONTENT.listening.script, questions: DEFAULT_CONTENT.listening.questions.map((q) => ({ ...q })) },
    writing: { prompt: DEFAULT_CONTENT.writing.prompt },
  };
}

function normalizeQuestions(arr, label) {
  if (!Array.isArray(arr) || arr.length === 0) throw new Error(`Thiếu danh sách câu hỏi cho phần "${label}".`);
  return arr.map((q, i) => {
    if (typeof q.q !== "string" || !q.q.trim()) throw new Error(`${label} — câu ${i + 1}: thiếu nội dung "q".`);
    if (!Array.isArray(q.opts) || q.opts.length < 2) throw new Error(`${label} — câu ${i + 1}: "opts" phải là mảng có ít nhất 2 lựa chọn.`);
    if (typeof q.a !== "number" || q.a < 0 || q.a >= q.opts.length) throw new Error(`${label} — câu ${i + 1}: "a" phải là số chỉ vị trí đáp án đúng trong "opts" (bắt đầu từ 0).`);
    return { q: q.q, opts: q.opts, a: q.a };
  });
}

// Validates and returns a clean content object, or throws Error with a
// Vietnamese message describing exactly what's wrong.
export function normalizeContent(raw) {
  if (!raw || typeof raw !== "object") throw new Error("JSON không hợp lệ.");
  if (!raw.reading || typeof raw.reading.passage !== "string" || !raw.reading.passage.trim()) {
    throw new Error('Thiếu "reading.passage" (đoạn văn đọc hiểu).');
  }
  if (!raw.listening || typeof raw.listening.script !== "string" || !raw.listening.script.trim()) {
    throw new Error('Thiếu "listening.script" (kịch bản nghe).');
  }
  if (!raw.writing || typeof raw.writing.prompt !== "string" || !raw.writing.prompt.trim()) {
    throw new Error('Thiếu "writing.prompt" (đề bài viết).');
  }
  return {
    grammar: normalizeQuestions(raw.grammar, "Ngữ pháp"),
    reading: { passage: raw.reading.passage, questions: normalizeQuestions(raw.reading.questions, "Reading") },
    listening: { script: raw.listening.script, questions: normalizeQuestions(raw.listening.questions, "Listening") },
    writing: { prompt: raw.writing.prompt },
  };
}

// Adds a stable numeric id to every question so client answer-state and
// server-side scoring always line up by index within each section.
export function withIds(content) {
  return {
    grammar: content.grammar.map((q, i) => ({ id: i, ...q })),
    reading: { passage: content.reading.passage, questions: content.reading.questions.map((q, i) => ({ id: i, ...q })) },
    listening: { script: content.listening.script, questions: content.listening.questions.map((q, i) => ({ id: i, ...q })) },
    writing: { prompt: content.writing.prompt },
  };
}

// Strips the correct-answer key before sending content to the browser,
// so students can't read answers from the network tab.
export function withoutAnswers(content) {
  const strip = (q) => ({ id: q.id, q: q.q, opts: q.opts });
  return {
    grammar: content.grammar.map(strip),
    reading: { passage: content.reading.passage, questions: content.reading.questions.map(strip) },
    listening: { script: content.listening.script, questions: content.listening.questions.map(strip) },
    writing: { prompt: content.writing.prompt },
  };
}
