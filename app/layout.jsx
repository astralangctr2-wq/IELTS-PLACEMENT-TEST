import "./globals.css";
import ThemeToggle from "./components/ThemeToggle";
import FontSizeToggle from "./components/FontSizeToggle";

export const metadata = {
  title: "IELTS Placement Test",
  description: "Bài kiểm tra xếp lớp IELTS đầu vào",
};

// Runs before React hydrates so the page never flashes the wrong theme
// on load — reads the saved preference (defaulting to dark) and sets
// it on <html> immediately.
const themeInitScript = `
(function () {
  try {
    var saved = localStorage.getItem('theme');
    var theme = saved === 'light' || saved === 'dark' ? saved : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <div className="top-controls">
          <FontSizeToggle />
          <ThemeToggle />
        </div>
        {children}
      </body>
    </html>
  );
}
