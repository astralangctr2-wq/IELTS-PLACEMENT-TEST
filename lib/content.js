// ---------------------------------------------------------------------
// Content schema
// ---------------------------------------------------------------------
// grammar: flat array of questions
// reading: { sections: [ { title, instructions, passage, imageUrl?, questions:[...] } ] }
// listening: { sections: [ { title, instructions, script?, audioUrl?, questions:[...] } ] }
//   Each listening section needs "script" (text for browser voice-synthesis
//   playback) and/or "audioUrl" (a real audio file link, e.g. Google Drive —
//   normal share links are auto-converted to a playable link). If audioUrl
//   is present it's used for playback instead of the synthesized voice, and
//   the transcript text is NOT sent to students (so it can't be read as an
//   answer key) — script is only exposed to the browser when there's no
//   audioUrl, as a TTS fallback.
//   (legacy flat { passage, questions } / { script, questions } is auto-wrapped
//    into a single section for backward compatibility with older data)
// writing: { tasks: [ { prompt, imageUrl? }, ... ] }
//   1 or 2 tasks, rendered as stacked split-screen blocks (image/prompt on
//   the left, answer box on the right) — matching the real IELTS layout of
//   a Task 1 (usually with a diagram/chart) and a Task 2 essay. Each task
//   has its own prompt and optional imageUrl.
//   Legacy shape { prompt, imageUrl? } (a single task, no "tasks" array) is
//   still accepted and auto-wrapped into a single-item tasks array for
//   backward compatibility with older content banks.
//   imageUrl (on a reading section or on a writing task) shows an image
//   above the text — e.g. a Writing Task 1 diagram/chart, or a figure
//   referenced by a reading passage. Same URL rules as audioUrl: local
//   /images/... paths are most reliable; Google Drive share links are
//   auto-converted.
//
// Question types (field "type", default "mc" when omitted):
//   mc            -> { type:"mc", q, opts:[...], a: <index of correct opt> }
//   gap           -> { type:"gap", q, answers: [<accepted strings>] }
//   multi_select  -> { type:"multi_select", q, opts:[...], a: [<indices of correct opts>] }
//
// Passage text can mark words for underlining (used e.g. for vocabulary-
// matching reading questions) by wrapping them in double underscores, e.g.
// "parents can __nurture__ their children." The double underscores are
// stripped and the word is rendered underlined in the test UI.
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
    tasks: [
      {
        prompt: `Task 1: You should spend about 20 minutes on this task.

The diagram below shows the process of making cheese. Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.`,
      },
      {
        prompt: `Task 2: You should spend about 40 minutes on this task.

Some people believe that all teenagers should be required to do unpaid community service in their free time. Others feel this should be entirely up to the individual.

Discuss both views and give your own opinion. Write at least 250 words.`,
      },
    ],
  },
};

// Converts common Google Drive "share" link formats into a direct,
// playable/downloadable URL. Leaves any other URL untouched.
export function toDriveDirectUrl(url) {
  if (typeof url !== "string" || !url.trim()) return url;
  const trimmed = url.trim();
  const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  const id = (fileMatch && fileMatch[1]) || (idParamMatch && idParamMatch[1]);
  if (id && trimmed.includes("drive.google.com")) {
    return `https://drive.google.com/uc?export=download&id=${id}`;
  }
  return trimmed;
}

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
    // imageUrl + pin (overlay coords) are optional per-question fields for
    // diagram-label questions (e.g. "label the elephant diagram").
    // pin: { x: number (%), y: number (%), width?: number (%) }
    const qImageUrl = typeof q.imageUrl === "string" && q.imageUrl.trim() ? toDriveDirectUrl(q.imageUrl) : undefined;
    const qPin = q.pin && typeof q.pin.x === "number" && typeof q.pin.y === "number" ? q.pin : undefined;
    const gapResult = { type: "gap", q: q.q, answers: q.answers };
    if (qImageUrl) gapResult.imageUrl = qImageUrl;
    if (qPin) gapResult.pin = { x: qPin.x, y: qPin.y, ...(qPin.width != null ? { width: qPin.width } : {}) };
    return gapResult;
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

function normalizeReadingSections(raw) {
  const sections = toSections(raw, "passage");
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new Error('Thiếu nội dung "Reading" (cần ít nhất 1 section có "passage" và "questions").');
  }
  return sections.map((sec, si) => {
    if (!sec || typeof sec.passage !== "string" || !sec.passage.trim()) {
      throw new Error(`Reading — section ${si + 1}: thiếu "passage".`);
    }
    return {
      title: typeof sec.title === "string" ? sec.title : "",
      instructions: typeof sec.instructions === "string" ? sec.instructions : "",
      passage: sec.passage,
      imageUrl: typeof sec.imageUrl === "string" && sec.imageUrl.trim() ? toDriveDirectUrl(sec.imageUrl) : "",
      questions: normalizeQuestions(sec.questions, `Reading — Section ${si + 1}`),
    };
  });
}

function normalizeListeningSections(raw) {
  const sections = toSections(raw, "script");
  if (!Array.isArray(sections) || sections.length === 0) {
    throw new Error('Thiếu nội dung "Listening" (cần ít nhất 1 section có "script" hoặc "audioUrl", và "questions").');
  }
  return sections.map((sec, si) => {
    const hasScript = sec && typeof sec.script === "string" && sec.script.trim();
    const hasAudio = sec && typeof sec.audioUrl === "string" && sec.audioUrl.trim();
    if (!hasScript && !hasAudio) {
      throw new Error(`Listening — section ${si + 1}: cần có "script" (để đọc bằng giọng máy) hoặc "audioUrl" (file audio thật, vd link Google Drive).`);
    }
    return {
      title: typeof sec.title === "string" ? sec.title : "",
      instructions: typeof sec.instructions === "string" ? sec.instructions : "",
      script: hasScript ? sec.script : "",
      audioUrl: hasAudio ? toDriveDirectUrl(sec.audioUrl) : "",
      questions: normalizeQuestions(sec.questions, `Listening — Section ${si + 1}`),
    };
  });
}

// Accepts either the new { tasks: [...] } shape or the legacy flat
// { prompt, imageUrl? } shape and always returns an array of tasks.
function toWritingTasks(raw) {
  if (!raw) return [];
  if (Array.isArray(raw.tasks)) return raw.tasks;
  if (typeof raw.prompt === "string") return [{ prompt: raw.prompt, imageUrl: raw.imageUrl }];
  return [];
}

function normalizeWritingTasks(raw) {
  const tasks = toWritingTasks(raw);
  if (tasks.length === 0) {
    throw new Error('Thiếu "writing.tasks" (cần ít nhất 1 đề bài viết) — hoặc dùng "writing.prompt" cho 1 đề duy nhất.');
  }
  return tasks.map((t, i) => {
    if (!t || typeof t.prompt !== "string" || !t.prompt.trim()) {
      throw new Error(`Writing — Task ${i + 1}: thiếu "prompt" (đề bài viết).`);
    }
    const imageUrl = typeof t.imageUrl === "string" && t.imageUrl.trim() ? toDriveDirectUrl(t.imageUrl) : "";
    return { prompt: t.prompt, imageUrl };
  });
}

export function buildTemplate() {
  return normalizeContent(DEFAULT_CONTENT);
}

// Validates and returns a clean content object, or throws Error with a
// Vietnamese message describing exactly what's wrong. Each top-level
// part (grammar / reading / listening / writing) is optional — omit a
// key entirely (or set it to null) to make a single-skill practice
// bank, e.g. a grammar-only quiz. At least one part must be present.
export function normalizeContent(raw) {
  if (!raw || typeof raw !== "object") throw new Error("JSON không hợp lệ.");
  const hasGrammar = raw.grammar !== undefined && raw.grammar !== null;
  const hasReading = raw.reading !== undefined && raw.reading !== null;
  const hasListening = raw.listening !== undefined && raw.listening !== null;
  const hasWriting = raw.writing !== undefined && raw.writing !== null;

  if (!hasGrammar && !hasReading && !hasListening && !hasWriting) {
    throw new Error('Bộ đề trống — cần có ít nhất 1 trong 4 phần: "grammar", "reading", "listening", "writing".');
  }
  return {
    grammar: hasGrammar ? normalizeQuestions(raw.grammar, "Ngữ pháp") : null,
    reading: hasReading ? { sections: normalizeReadingSections(raw.reading) } : null,
    listening: hasListening ? { sections: normalizeListeningSections(raw.listening) } : null,
    writing: hasWriting ? { tasks: normalizeWritingTasks(raw.writing) } : null,
  };
}

// Adds a stable numeric id to every question so client answer-state and
// server-side scoring always line up. Ids are unique within each
// top-level section (grammar / reading / listening), counted across all
// sub-sections so reading section 2's first question doesn't collide
// with section 1's ids.
function idReadingSections(sections) {
  let counter = 0;
  return sections.map((sec) => ({
    title: sec.title || "",
    instructions: sec.instructions || "",
    passage: sec.passage,
    imageUrl: sec.imageUrl || "",
    questions: sec.questions.map((q) => ({ id: counter++, ...q })),
  }));
}

function idListeningSections(sections) {
  let counter = 0;
  return sections.map((sec) => ({
    title: sec.title || "",
    instructions: sec.instructions || "",
    script: sec.script || "",
    audioUrl: sec.audioUrl || "",
    questions: sec.questions.map((q) => ({ id: counter++, ...q })),
  }));
}

export function withIds(content) {
  return {
    grammar: content.grammar ? content.grammar.map((q, i) => ({ id: i, ...q })) : null,
    reading: content.reading ? { sections: idReadingSections(toSections(content.reading, "passage")) } : null,
    listening: content.listening ? { sections: idListeningSections(toSections(content.listening, "script")) } : null,
    writing: content.writing ? { tasks: toWritingTasks(content.writing).map((t) => ({ prompt: t.prompt, imageUrl: t.imageUrl || "" })) } : null,
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
  if (type === "gap") {
    // Preserve imageUrl + pin so the front-end can render diagram overlays
    if (q.imageUrl) base.imageUrl = q.imageUrl;
    if (q.pin) base.pin = q.pin;
    return base;
  }
  return base;
}

export function withoutAnswers(content) {
  const stripReading = (sections) =>
    sections.map((sec) => ({
      title: sec.title || "",
      instructions: sec.instructions || "",
      passage: sec.passage,
      imageUrl: sec.imageUrl || "",
      questions: sec.questions.map(stripQuestion),
    }));
  const stripListening = (sections) =>
    sections.map((sec) => ({
      title: sec.title || "",
      instructions: sec.instructions || "",
      // Only send the transcript to the browser when there's no real audio
      // file — once a real audioUrl exists, the script text (which reveals
      // every answer verbatim) is kept server-side only.
      script: sec.audioUrl ? "" : sec.script || "",
      audioUrl: sec.audioUrl || "",
      questions: sec.questions.map(stripQuestion),
    }));
  return {
    grammar: content.grammar ? content.grammar.map(stripQuestion) : null,
    reading: content.reading ? { sections: stripReading(content.reading.sections) } : null,
    listening: content.listening ? { sections: stripListening(content.listening.sections) } : null,
    writing: content.writing ? { tasks: toWritingTasks(content.writing).map((t) => ({ prompt: t.prompt, imageUrl: t.imageUrl || "" })) } : null,
  };
}

// Flattens a reading/listening section list into one array of questions,
// tagging each with its section's title so review UIs can group them.
export function flattenSectionQuestions(sections) {
  const out = [];
  if (!sections) return out;
  for (const sec of sections) {
    for (const q of sec.questions) out.push({ ...q, sectionTitle: sec.title || "" });
  }
  return out;
}

// Renders passage text into React nodes, turning __word__ markers into
// underlined <u> spans (used for vocabulary-matching reading questions).
// Plain strings/newlines are preserved as-is (parent element should set
// white-space: pre-line).
export function renderMarkedText(text) {
  if (typeof text !== "string") return text;
  const parts = text.split(/(__.+?__)/g);
  return parts.map((part, i) => {
    if (part.startsWith("__") && part.endsWith("__") && part.length > 4) {
      return { __underline: true, key: i, text: part.slice(2, -2) };
    }
    return part;
  });
}

// Splits passage text into blocks so the UI can visually separate a
// title / sub-headings from body paragraphs, e.g. for a passage listing
// several labelled course descriptions:
//   # INTERNATIONAL HOTEL MANAGEMENT DIPLOMA
//
//   ## 1
//   This certificate is designed for...
//
//   ## 2
//   This certificate is designed for...
// A line starting with "# " becomes a bold passage title; "## " becomes
// a bold sub-heading (e.g. a course/section label); anything else is
// accumulated into a normal body paragraph (which still supports
// __word__ underline markers).
export function parsePassageBlocks(text) {
  if (typeof text !== "string") return [];
  const lines = text.split("\n");
  const blocks = [];
  let currentPara = [];
  const flushPara = () => {
    const joined = currentPara.join("\n").replace(/^\n+|\n+$/g, "");
    if (joined.trim()) blocks.push({ type: "para", text: joined });
    currentPara = [];
  };
  for (const line of lines) {
    if (line.startsWith("# ")) {
      flushPara();
      blocks.push({ type: "title", text: line.slice(2).trim() });
    } else if (line.startsWith("## ")) {
      flushPara();
      blocks.push({ type: "heading", text: line.slice(3).trim() });
    } else {
      currentPara.push(line);
    }
  }
  flushPara();
  return blocks;
}
