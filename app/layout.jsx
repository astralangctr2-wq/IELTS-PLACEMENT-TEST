import "./globals.css";

export const metadata = {
  title: "IELTS Placement Test",
  description: "Bài kiểm tra xếp lớp IELTS đầu vào",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
