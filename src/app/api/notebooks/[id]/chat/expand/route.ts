import { db } from "@/db";
import { messages } from "@/db/schema";
import { searchWebAndExpand } from "@/lib/ai";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: notebookId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const previousAnswer = typeof body.previousAnswer === "string" ? body.previousAnswer : "";
  const messageId = typeof body.messageId === "string" ? body.messageId : "";

  if (!question || !previousAnswer) {
    return Response.json({ error: "معلومات غير كافية" }, { status: 400 });
  }

  const { expandedContent, usedWebSearch } = await searchWebAndExpand(question, previousAnswer);

  if (!expandedContent) {
    return Response.json({ 
      error: "تعذر البحث في الويب. تأكد من إعداد GEMINI_API_KEY." 
    }, { status: 400 });
  }

  // Update the existing message with expanded content
  if (messageId) {
    const [existingMessage] = await db
      .select()
      .from(messages)
      .where(eq(messages.id, messageId));

    if (existingMessage) {
      const updatedContent = existingMessage.content + "\n\n" + expandedContent;
      await db
        .update(messages)
        .set({ content: updatedContent })
        .where(eq(messages.id, messageId));
    }
  }

  return Response.json({ 
    expandedContent,
    usedWebSearch,
  });
}
