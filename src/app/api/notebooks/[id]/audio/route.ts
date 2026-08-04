import { NextRequest } from "next/server";
import { db } from "@/db";
import { sources } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateSpeech, type TTSOptions } from "@/lib/services/tts-service";
import { requireNotebookAccess } from "@/lib/access";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // Extended timeout for audio generation

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: notebookId } = await ctx.params;

  const access = await requireNotebookAccess(notebookId, "write");
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

  const body = await req.json().catch(() => ({}));

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const language = typeof body.language === "string" ? body.language : "ar-SA";
  const speed = typeof body.speed === "number" ? body.speed : 1.0;
  const provider = body.provider as TTSOptions["provider"] | undefined;
  const sourceIds: string[] | undefined = Array.isArray(body.sourceIds) && body.sourceIds.length > 0
    ? body.sourceIds
    : undefined;

  if (!text) {
    return Response.json({ error: "النص مطلوب لتوليد الصوت" }, { status: 400 });
  }

  // Get notebook sources to generate a summary if no text provided
  let contentToSpeak = text;
  if (!text) {
    const notebookSources = await db
      .select({ id: sources.id, title: sources.title, content: sources.content })
      .from(sources)
      .where(eq(sources.notebookId, notebookId))
      .limit(5);

    // Use only the selected sources when provided; otherwise use all.
    const selectedSet = sourceIds && sourceIds.length > 0 ? new Set(sourceIds) : null;
    const filteredSources = selectedSet
      ? notebookSources.filter((s) => selectedSet.has(s.id))
      : notebookSources;

    if (filteredSources.length === 0) {
      return Response.json({ error: "لا توجد مصادر في هذا الدفتر" }, { status: 400 });
    }

    // Generate a summary from sources
    contentToSpeak = filteredSources
      .map((s) => `${s.title}. ${s.content.slice(0, 500)}`)
      .join(". ")
      .slice(0, 5000);
  }

  try {
    const result = await generateSpeech({
      text: contentToSpeak,
      language,
      speed,
      provider,
    });

    if (!result) {
      return Response.json(
        { error: "فشل توليد الصوت. تأكد من إعداد مفتاح API أو استخدم المتصفح." },
        { status: 400 }
      );
    }

    return Response.json({
      audioUrl: result.audioUrl,
      duration: result.duration,
      provider: result.provider,
    });
  } catch (error) {
    console.error("[Audio API] Error:", error);
    return Response.json({ error: "حدث خطأ أثناء توليد الصوت" }, { status: 500 });
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: notebookId } = await ctx.params;

  const access = await requireNotebookAccess(notebookId, "read");
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

  // Get notebook sources for audio summary
  const notebookSources = await db
    .select({ id: sources.id, title: sources.title, content: sources.content })
    .from(sources)
    .where(eq(sources.notebookId, notebookId))
    .limit(10);

  if (notebookSources.length === 0) {
    return Response.json({ error: "لا توجد مصادر" }, { status: 404 });
  }

  // Generate a podcast-style script
  const script = generatePodcastScript(notebookSources);

  return Response.json({
    script,
    sourceCount: notebookSources.length,
  });
}

/**
 * Generates a podcast-style script from sources
 */
function generatePodcastScript(sources: { title: string; content: string }[]): string {
  const intro = "مرحباً بكم في الحوار الصوتي التلخيصي. ";
  const outro = " شكراً لاستماعكم.";

  const summaries = sources
    .map((source) => {
      const summary = source.content
        .split(/[.!?؟]/)
        .slice(0, 3)
        .join(". ")
        .trim();
      return `${source.title}. ${summary}`;
    })
    .join(". ");

  return intro + summaries + outro;
}