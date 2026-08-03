# IELTS Placement Test — Web app cho Học viên & Giáo viên

Học viên vào `/test` để làm bài (Ngữ pháp, Reading, Listening được chấm tự động).
Giáo viên đăng nhập ở `/teacher/login` để xem danh sách bài nộp và chấm điểm Writing.

## 1. Chuẩn bị tài khoản

- Một tài khoản **GitHub** (miễn phí) — để chứa code.
- Một tài khoản **Vercel** (miễn phí) — để deploy web, đăng ký bằng GitHub tại vercel.com.

## 2. Đưa code lên GitHub

1. Vào github.com → **New repository** → đặt tên (ví dụ `ielts-placement-test`) → Create.
2. Giải nén file `ielts-test-app.zip` bạn vừa tải ra một thư mục trên máy.
3. Trong thư mục đó, chạy các lệnh sau (cần cài Git):
   ```bash
   git init
   git add .
   git commit -m "Init"
   git branch -M main
   git remote add origin https://github.com/<username>/ielts-placement-test.git
   git push -u origin main
   ```
   (Không rành dòng lệnh? Có thể dùng nút **"Add file → Upload files"** trên trang GitHub để kéo-thả toàn bộ thư mục đã giải nén.)

## 3. Deploy lên Vercel

1. Vào vercel.com → **Add New → Project** → chọn repo `ielts-placement-test` vừa tạo → **Import**.
2. Ở bước cấu hình, **chưa bấm Deploy vội** — cần thêm database trước (bước 4), hoặc deploy trước rồi quay lại thêm cũng được, Vercel sẽ tự deploy lại.
3. Bấm **Deploy**. Lần đầu sẽ báo lỗi thiếu database/env — không sao, ta cấu hình tiếp bên dưới rồi Redeploy.

## 4. Thêm Database (Vercel Postgres)

1. Vào project vừa tạo trên Vercel → tab **Storage** → **Create Database** → chọn **Postgres** (Neon) → Create.
2. Sau khi tạo xong, bấm **Connect Project** để gắn database vào đúng project — Vercel sẽ tự thêm các biến môi trường `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, v.v. Bạn **không cần** tự nhập tay.
3. App sẽ tự tạo bảng dữ liệu (submissions, settings) trong lần chạy đầu tiên — không cần chạy lệnh SQL nào thủ công.

## 5. Thêm biến môi trường bắt buộc

Vào project → tab **Settings → Environment Variables**, thêm:

| Tên biến | Giá trị | Ghi chú |
|---|---|---|
| `TEACHER_PASSWORD` | mật khẩu bạn tự chọn | Dùng để đăng nhập trang giáo viên |
| `SESSION_SECRET` | một chuỗi ngẫu nhiên dài (≥ 32 ký tự) | Dùng để ký session, có thể tạo nhanh bằng `openssl rand -hex 32` |

Sau khi thêm, vào tab **Deployments** → bấm **⋯ → Redeploy** ở bản deploy mới nhất để áp dụng.

## 6. Xong — lấy link cho học viên & giáo viên

- Vercel cấp cho bạn một link dạng `https://ielts-placement-test.vercel.app`.
- Gửi link kèm `/test` cho học viên: `https://ielts-placement-test.vercel.app/test`
- Bạn (giáo viên) vào: `https://ielts-placement-test.vercel.app/teacher/login`, đăng nhập bằng `TEACHER_PASSWORD` đã đặt ở bước 5.

## 7. Đổi bộ đề thi

Đăng nhập giáo viên → **Quản lý đề thi** → tải file mẫu JSON, chỉnh nội dung, rồi tải lên lại hoặc dán trực tiếp. Đề mới áp dụng ngay cho học viên làm bài tiếp theo, không cần deploy lại.

## 8. Chạy thử trên máy cá nhân (tuỳ chọn, dành cho dev)

```bash
npm install
npm run dev
```
Cần có biến `POSTGRES_URL` trỏ tới một Postgres (ví dụ dùng `vercel env pull` sau khi đã link project với Vercel CLI) và `TEACHER_PASSWORD`, `SESSION_SECRET` trong file `.env.local`.

## Giới hạn hiện tại (có thể mở rộng thêm)

- Đăng nhập giáo viên dùng **một mật khẩu chung**, chưa có nhiều tài khoản giáo viên riêng biệt.
- Listening dùng giọng đọc tổng hợp của trình duyệt (Web Speech API) — chất lượng phụ thuộc trình duyệt học viên, không phải file audio thu sẵn.
- Chưa có giới hạn thời gian làm bài hay chống làm lại nhiều lần.
