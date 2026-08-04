import { ingestSource } from "@/lib/services/source-service";
import { extractTextFromDocx, extractTextFromPdf } from "@/lib/text/extract";
import { requireNotebookAccess } from "@/lib/access";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_SIZE = 20 * 1024 * 1024; // 20MB

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOCX_EXT = ".docx";

/** Server-side extension whitelist (used when the MIME type is missing/spoofed). */
const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md", DOCX_EXT];

function getExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: notebookId } = await ctx.params;

  const access = await requireNotebookAccess(notebookId, "write");
  if (!access.ok) return Response.json({ error: access.error }, { status: access.status });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");

  if (!file || !(file instanceof File)) {
    return Response.json({ error: "لم يتم إرفاق ملف" }, { status: 400 });
  }

  if (file.size === 0) {
    return Response.json({ error: "الملف فارغ" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return Response.json({ error: "حجم الملف يتجاوز 20 ميجابايت" }, { status: 400 });
  }

  const extension = getExtension(file.name);
  const isPdf = file.type === "application/pdf" || extension === ".pdf";
  const isDocx = file.type === DOCX_MIME || extension === DOCX_EXT;

  // Non-PDF/DOCX uploads must be plain-text-like and carry an allowed extension.
  if (!isPdf && !isDocx) {
    const looksTextual = file.type.startsWith("text/") || extension === ".txt" || extension === ".md";
    if (!looksTextual) {
      return Response.json(
        { error: "نوع الملف غير مدعوم. الملفات المدعومة: PDF و DOCX و TXT و MD" },
        { status: 400 },
      );
    }
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let text: string;
    let type: "pdf" | "file";
    if (isPdf) {
      text = await extractTextFromPdf(buffer);
      type = "pdf";
    } else if (isDocx) {
      text = await extractTextFromDocx(buffer);
      type = "file";
    } else {
      // Decode as UTF-8 only for plain-text files (guarded by the whitelist above).
      text = buffer.toString("utf-8");
      type = "file";
    }

    if (!text.trim()) {
      return Response.json({ error: "تعذر استخراج أي نص من هذا الملف" }, { status: 400 });
    }

    // ingestSource also touches the notebook's updatedAt, so no manual update needed.
    const source = await ingestSource({
      notebookId,
      title: file.name,
      type,
      content: text,
    });

    return Response.json({ source }, { status: 201 });
  } catch (err) {
    console.error("Failed to process uploaded file", err);
    return Response.json({ error: "تعذر معالجة الملف" }, { status: 500 });
  }
}
