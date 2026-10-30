import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "스킬투머니 | 배운 기술이 돈이 되는 원데이 클래스",
  description: "배운 기술이 돈이 되는 원데이 클래스, 스킬투머니. 실전 기술을 단 하루 만에 수익 모델로 완성하세요.",
  keywords: ["스킬투머니", "원데이 클래스", "수익화", "부업", "지식창업", "스킬 수익화"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#070e1e] text-slate-100">
        {children}
      </body>
    </html>
  );
}
