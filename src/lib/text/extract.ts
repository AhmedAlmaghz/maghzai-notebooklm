import * as cheerio from "cheerio";

/** Extracts readable plain text from an HTML page, stripping scripts/styles/nav noise. */
export function extractTextFromHtml(html: string): { title: string; text: string } {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe, nav, footer, header, form").remove();

  const title = $("title").first().text().trim() || $("h1").first().text().trim() || "";

  const blocks: string[] = [];
  $("h1, h2, h3, h4, h5, h6, p, li, blockquote, td, th").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t && t.length > 1) blocks.push(t);
  });

  let text = blocks.join("\n\n");
  if (!text) {
    text = $("body").text().replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }

  return { title, text: text.trim() };
}

/** Extracts raw text content from a DOCX file buffer using mammoth. */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    const text = (result.value || "").trim();
    if (!text) {
      throw new Error("Empty DOCX content");
    }
    return text;
  } catch (error) {
    console.error("[DOCX] Failed to extract text:", error);
    throw new Error(
      "تعذر قراءة ملف DOCX. تأكد من أن الملف غير تالف أو مشفر (حماية بكلمة مرور غير مدعومة).",
    );
  }
}

/** Extracts text content from a PDF file buffer. */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // Note: pdf-parse v2 bundles its own pdfjs-dist worker internally
  // (pdfjs-dist/legacy/build/pdf.mjs). Setting GlobalWorkerOptions.workerSrc
  // here would target a *different* module instance (pdfjs-dist main entry)
  // and is therefore ineffective — and a CDN worker in serverless Node is
  // fragile. We rely on pdf-parse's Node defaults instead.
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return (result.text || "").trim();
    } finally {
      await parser.destroy();
    }
  } catch (error) {
    console.error("[PDF] Failed to parse PDF:", error);
    throw new Error("تعذر قراءة ملف PDF. تأكد من أن الملف غير تالف.");
  }
}

export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
