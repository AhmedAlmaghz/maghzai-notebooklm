import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "بحّاثة — مساعدك البحثي والتعليمي الذكي",
  description: "منصة ذكية متكاملة لتنظيم مصادرك، والدردشة مع مستنداتك، وإنشاء الملخصات والخرائط الذهنية والبطاقات التعليمية، مستوحاة من NotebookLM.",
  keywords: ["بحّاثة", "NotebookLM", "مساعد بحثي", "ذكاء اصطناعي", "تلخيص مستندات", "خرائط ذهنية", "بطاقات تعليمية"],
  authors: [{ name: "Ahmed Almaghz" }],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased selection:bg-indigo-500 selection:text-white transition-colors duration-200">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
