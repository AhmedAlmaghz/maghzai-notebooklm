import type { Metadata } from "next";
import { db } from "@/db";
import { notebooks, sources } from "@/db/schema";
import { desc, eq, isNull, sql } from "drizzle-orm";
import NotebooksGrid from "@/components/notebooks-grid";
import LandingPage from "@/components/landing/landing-page";
import LandingJsonLd from "@/components/landing/landing-json-ld";
import { getCurrentUser } from "@/lib/auth";
import { defaultLocale, getLocaleFromString, isRTL } from "@/i18n";
import ar from "@/i18n/dictionaries/ar";
import en from "@/i18n/dictionaries/en";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const lang = defaultLocale;
  const isAr = isRTL(lang);
  const dict = isAr ? ar : en;
  const meta = dict.landing.meta;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://maghzai-notebooklm.vercel.app";

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: appUrl,
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      type: "website",
      locale: isAr ? "ar" : "en_US",
      siteName: dict.common.appName,
      url: appUrl,
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
    },
  };
}

export default async function HomePage() {
  const user = await getCurrentUser();

  // Anonymous visitors see the marketing landing page (with SEO structured data).
  if (!user) {
    return (
      <>
        <LandingJsonLd />
        <LandingPage />
      </>
    );
  }

  // Authenticated users see the dashboard (hero banner + notebooks grid).
  // Select notebooks (excluding soft-deleted ones that are in the trash)
  const rows = await db
    .select({
      id: notebooks.id,
      userId: notebooks.userId,
      title: notebooks.title,
      emoji: notebooks.emoji,
      description: notebooks.description,
      createdAt: notebooks.createdAt,
      updatedAt: notebooks.updatedAt,
      sourceCount: sql<number>`count(distinct ${sources.id})`.mapWith(Number),
    })
    .from(notebooks)
    .leftJoin(sources, eq(sources.notebookId, notebooks.id))
    .where(isNull(notebooks.deletedAt))
    .groupBy(notebooks.id)
    .orderBy(desc(notebooks.updatedAt));

  const initialNotebooks = rows
    .filter((r) => !user || !r.userId || r.userId === user.id)
    .map((r) => ({
      ...r,
      createdAt: typeof r.createdAt === "string" ? r.createdAt : (r.createdAt as Date).toISOString(),
      updatedAt: typeof r.updatedAt === "string" ? r.updatedAt : (r.updatedAt as Date).toISOString(),
    }));

  return <NotebooksGrid initialNotebooks={initialNotebooks} currentUser={user} />;
}
