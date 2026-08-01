import { db } from "@/db";
import { notebooks } from "@/db/schema";
import { ingestSource } from "@/lib/sources";
import { extractTextFromPdf } from "@/lib/text/extract";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: notebookId } = await ctx.params;

  const [notebook] = await db.select().from(notebooks).where(eq(notebooks.id, notebookId));
  if (!notebook) return Response.json({ error: "Notebook not found" }, { status: 404 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");

  if (!file || !(file instanceof File)) {
    return Response.json({ error: "لم يتم إرفاق ملف" }, { status: 400 });
  }

  const MAX_SIZE = 20 * 1024 * 1024; // 20MB
  if (file.size > MAX_SIZE) {
    return Response.json({ error: "حجم الملف يتجاوز 20 ميجابايت" }, { status: 400 });
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    let text: string;
    let type: "pdf" | "file";
    if (isPdf) {
      text = await extractTextFromPdf(buffer);
      type = "pdf";
    } else {
      text = buffer.toString("utf-8");
      type = "file";
    }

    if (!text.trim()) {
      return Response.json({ error: "تعذر استخراج أي نص من هذا الملف" }, { status: 400 });
    }

    const source = await ingestSource({
      notebookId,
      title: file.name,
      type,
      content: text,
    });
    await db.update(notebooks).set({ updatedAt: new Date() }).where(eq(notebooks.id, notebookId));

    return Response.json({ source }, { status: 201 });
  } catch (err) {
    console.error("Failed to process uploaded file", err);
    return Response.json({ error: "تعذر معالجة الملف" }, { status: 500 });
  }
}
