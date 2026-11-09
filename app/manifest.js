// Lets Chrome / Edge / phones install the web as an app ("Cài đặt ứng
// dụng"): own icon and window, and push notifications for the admin even
// when the app is closed (public/sw.js).
export default function manifest() {
  return {
    name: "Astra – Thi & Chấm bài",
    short_name: "Astra Test",
    description: "Thi thử IELTS / Aptis và chấm bài — Trung tâm Ngoại ngữ & Tin học Astra",
    start_url: "/teacher",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1f2a5c",
    lang: "vi",
    icons: [
      { src: "/icons/astra-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/astra-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/astra-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
