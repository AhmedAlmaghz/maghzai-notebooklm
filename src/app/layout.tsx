import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/i18n/provider";
import { ToastProvider } from "@/components/ui/toast";
import { defaultLocale, getLocaleFromString, isRTL } from "@/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "بحّاثة — مساعدك البحثي والتعليمي الذكي",
    template: "%s | بحّاثة",
  },
  description:
    "منصة ذكية متكاملة لتنظيم مصادرك، والدردشة مع مستنداتك، وإنشاء الملخصات والخرائط الذهنية والبطاقات التعليمية، مستوحاة من NotebookLM.",
  keywords: ["بحّاثة", "NotebookLM", "مساعد بحثي", "ذكاء اصطناعي", "تلخيص مستندات", "خرائط ذهنية", "بطاقات تعليمية"],
  authors: [{ name: "Ahmed Almaghz" }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://maghzai-notebooklm.vercel.app"),
  openGraph: {
    title: "بحّاثة — مساعدك البحثي والتعليمي الذكي",
    description:
      "منصة ذكية متكاملة لتنظيم مصادرك، والدردشة مع مستنداتك، وإنشاء الملخصات والخرائط الذهنية والبطاقات التعليمية.",
    type: "website",
    locale: "ar",
    siteName: "بحّاثة",
  },
  twitter: {
    card: "summary_large_image",
    title: "بحّاثة — مساعدك البحثي والتعليمي الذكي",
    description:
      "منصة ذكية متكاملة لتنظيم مصادرك، والدردشة مع مستنداتك، وإنشاء المواد التعليمية.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#090d16" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const locale = defaultLocale;
  const dir = isRTL(locale) ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased transition-colors duration-200">
        <ThemeProvider>
          <I18nProvider>
            <ToastProvider>{children}</ToastProvider>
          </I18nProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}