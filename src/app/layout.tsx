import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FreeAPI Hub - AI Resource Control Center",
  description: "Gemini, Groq, Cerebras 등 무료 AI API를 통합 관리하고 모니터링하는 대시보드",
  keywords: ["AI", "API", "Gemini", "Groq", "Cerebras", "Dashboard", "Free API"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        {children}
      </body>
    </html>
  );
}
