import "./globals.css";
import { ThemeProvider } from "./contexts/ThemeContext";
import TopControls from "./components/TopControls";

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
    var savedTheme = localStorage.getItem('theme');
    var theme = savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    
    var savedFontSize = localStorage.getItem('fontSize');
    var fontSize = (savedFontSize === 'small' || savedFontSize === 'medium' || savedFontSize === 'large') ? savedFontSize : 'medium';
    document.documentElement.setAttribute('data-font-size', fontSize);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.setAttribute('data-font-size', 'medium');
  }
})();
`;

export default function RootLayout({ children }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ThemeProvider>
          <TopControls />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
