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

/** Extracts text content from a PDF file buffer. */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // Configure pdfjs-dist worker before importing PDFParse
  try {
    // Dynamically import and configure pdfjs-dist
    const pdfjsLib = await import("pdfjs-dist");
    
    // Set worker source to CDN to avoid local file issues
    if (pdfjsLib.GlobalWorkerOptions) {
      const version = pdfjsLib.version || "4.0.379";
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;
    }
  } catch (error) {
    console.warn("[PDF] Worker setup warning (non-critical):", error);
    // Continue anyway - pdf-parse might handle this internally
  }

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
