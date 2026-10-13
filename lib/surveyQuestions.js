// Questions of the post-test feedback survey (shared by the student form,
// the API and the teacher summary). No server code here.

export const SURVEY = [
  { key: "overall", type: "rating", section: "Trải nghiệm làm bài", label: "Nhìn chung, bạn hài lòng với việc làm bài trên web ở mức nào?" },
  { key: "ease", type: "rating", section: "Trải nghiệm làm bài", label: "Giao diện dễ nhìn, dễ thao tác" },
  { key: "realistic", type: "rating", section: "Trải nghiệm làm bài", label: "Giống cảm giác thi thật trên máy" },
  { key: "audio", type: "rating", section: "Trải nghiệm làm bài", label: "Âm thanh phần Listening rõ, dễ nghe", onlyIf: "listening" },
  { key: "time", type: "choice", section: "Trải nghiệm làm bài", label: "Thời gian làm bài", options: ["Quá ngắn", "Vừa đủ", "Dư nhiều"] },
  { key: "difficulty", type: "choice", section: "Trải nghiệm làm bài", label: "Độ khó của đề so với trình độ của bạn", options: ["Dễ", "Vừa sức", "Khó", "Rất khó"] },
  { key: "device", type: "choice", section: "Trải nghiệm làm bài", label: "Bạn làm bài trên thiết bị nào?", options: ["Máy tính / laptop", "Máy tính bảng", "Điện thoại"] },
  {
    key: "issues", type: "multi", section: "Sự cố", label: "Bạn có gặp sự cố nào không? (chọn nhiều)",
    options: ["Không gặp sự cố", "Audio không phát / bị ngắt", "Trang tải chậm, giật lag", "Bị thoát toàn màn hình ngoài ý muốn", "Khó kéo thả / chọn đáp án", "Chữ nhỏ, khó đọc", "Lỗi khác"],
  },
  { key: "liked", type: "text", section: "Góp ý", label: "Điều bạn thích nhất khi làm bài trên web?" },
  { key: "improve", type: "text", section: "Góp ý", label: "Điều bạn muốn web cải thiện?" },
  {
    key: "wishes", type: "multi", max: 3, section: "Nguyện vọng", label: "Ngoài thi thử, bạn muốn web có thêm chức năng nào? (chọn tối đa 3)",
    options: [
      "Xem đáp án và giải thích chi tiết sau khi thi",
      "Luyện theo từng dạng câu hỏi (matching, điền từ…)",
      "Luyện Speaking: ghi âm, được chấm và nhận xét",
      "Sổ từ vựng / flashcard theo từng bài đọc, bài nghe",
      "Nhận điểm Writing nhanh hơn, có gợi ý sửa bài",
      "Biểu đồ theo dõi tiến bộ qua các lần thi",
      "Bài luyện ngắn 10–15 phút làm trên điện thoại",
      "Thử thách hằng ngày, bảng xếp hạng, huy hiệu",
      "Nhắc lịch học, hạn nộp bài qua Zalo / email",
      "Video chữa đề",
    ],
  },
  { key: "wishOther", type: "text", section: "Nguyện vọng", label: "Chức năng khác bạn mong muốn (nếu có)" },
];
export const SURVEY_TEXT_MAX = 1000;

// Keeps only known keys with valid values.
export function cleanAnswers(raw) {
  const out = {};
  const a = raw && typeof raw === "object" ? raw : {};
  for (const q of SURVEY) {
    const v = a[q.key];
    if (q.type === "rating") {
      const n = Number(v);
      if (Number.isInteger(n) && n >= 1 && n <= 5) out[q.key] = n;
    } else if (q.type === "choice") {
      if (q.options.includes(v)) out[q.key] = v;
    } else if (q.type === "multi") {
      const arr = Array.isArray(v) ? [...new Set(v.filter((x) => q.options.includes(x)))] : [];
      if (arr.length) out[q.key] = q.max ? arr.slice(0, q.max) : arr;
    } else if (q.type === "text") {
      const t = (v ?? "").toString().trim().slice(0, SURVEY_TEXT_MAX);
      if (t) out[q.key] = t;
    }
  }
  return out;
}
