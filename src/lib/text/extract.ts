import * as cheerio from "cheerio";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

// `require` is used to resolve the absolute path of the pdfjs-dist worker file so
// that pdfjs-dist's fake worker (used in Node) can import it directly instead of
// failing to resolve the default relative "./pdf.worker.mjs" path.
const require = createRequire(import.meta.url);

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

/** Minimum length of extracted text to consider a PDF "digital" (has a real text layer). */
const MIN_TEXT_LENGTH = 20;

/** OCR languages: Arabic + English. */
const OCR_LANGS = "ara+eng";

/** Render scale for page screenshots fed to OCR (higher = better accuracy, slower). */
const OCR_SCALE = 2.5;

/** Maximum number of pages to OCR to avoid runaway timeouts on huge scanned docs. */
const MAX_OCR_PAGES = 50;

/**
 * Extracts text content from a PDF file buffer using a smart multi-stage strategy:
 *
 * 1. **Digital text layer** — uses `pdf-parse` to pull the embedded text. If the
 *    result is non-empty and reasonably long, it is returned directly (works for
 *    both Arabic and English digital PDFs).
 * 2. **Automatic OCR fallback** — if the text layer is empty or too short (a
 *    scanned/image-only PDF), each page is rendered to a high-resolution image
 *    via `pdf-parse`'s `getScreenshot`, preprocessed with `sharp`, and passed to
 *    `tesseract.js` (Arabic + English). Text from all pages is concatenated.
 *
 * Errors are never swallowed with a generic message: the real cause is logged and
 * a detailed, user-facing message distinguishes between scanned/corrupt/encrypted/
 * unsupported files.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // ---- Stage 1: digital text layer -----------------------------------------
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      const text = (result.text || "").trim();
      if (text.length >= MIN_TEXT_LENGTH) {
        return text;
      }
      // Too little text → likely a scanned PDF. Fall through to OCR.
      console.warn(
        `[PDF] Text layer too short (${text.length} chars); falling back to OCR.`,
      );
    } finally {
      await parser.destroy();
    }
  } catch (error) {
    // Distinguish encrypted vs corrupt vs unsupported before falling back.
    const message = describePdfError(error);
    if (message) {
      // Encrypted/corrupt files cannot be recovered by OCR — surface immediately.
      throw new Error(message);
    }
    // Otherwise (e.g. transient parse failure) log and attempt OCR as a fallback.
    console.error("[PDF] Text-layer extraction failed; attempting OCR:", error);
  }

  // ---- Stage 2: automatic OCR fallback -------------------------------------
  return extractTextFromPdfViaOcr(buffer);
}

/**
 * Renders PDF pages to images and runs tesseract.js OCR (Arabic + English).
 *
 * Uses `pdfjs-dist` directly (instead of `pdf-parse`'s `getScreenshot`) so the
 * worker file can be resolved to an absolute path, avoiding the "fake worker"
 * import failure. Pages are rasterized with `@napi-rs/canvas` (node-canvas
 * compatible) and fed to tesseract.js.
 */
async function extractTextFromPdfViaOcr(buffer: Buffer): Promise<string> {
  let worker: Awaited<ReturnType<typeof createTesseractWorker>> | null = null;
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

    // In Node, pdfjs-dist runs a "fake worker" that does `await import(workerSrc)`.
    // The default workerSrc is the relative "./pdf.worker.mjs", which webpack cannot
    // resolve. Point it at the resolved worker file. On Windows the ESM loader
    // requires a file:// URL, so we convert the resolved absolute path to one.
    const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc =
      process.platform === "win32"
        ? pathToFileURL(workerPath).href
        : workerPath;

    const doc = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;

    const totalPages = doc.numPages;
    const pagesToOcr = Math.min(totalPages, MAX_OCR_PAGES);
    if (pagesToOcr === 0) {
      throw new Error("No pages could be rendered from this PDF.");
    }

    const { createCanvas } = await import("@napi-rs/canvas");
    worker = await createTesseractWorker();

    const chunks: string[] = [];
    for (let i = 1; i <= pagesToOcr; i++) {
      const page = await doc.getPage(i);
      try {
        const viewport = page.getViewport({ scale: OCR_SCALE });
        const canvas = createCanvas(viewport.width, viewport.height);
        // @napi-rs/canvas SKRSContext2D is structurally compatible with the
        // subset pdfjs uses; cast to satisfy pdfjs's RenderParameters type.
        const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
        await page.render({
          canvasContext: ctx,
          canvas: canvas as unknown as HTMLCanvasElement,
          viewport,
        }).promise;

        const image = canvas.toBuffer("image/png");
        const processed = await preprocessForOcr(image);
        const { data } = await worker.recognize(processed);
        const pageText = (data.text || "").trim();
        if (pageText) chunks.push(pageText);
      } finally {
        page.cleanup();
      }
    }

    await doc.destroy();

    const combined = chunks.join("\n\n").trim();
    if (combined.length < MIN_TEXT_LENGTH) {
      throw new Error("OCR produced no readable text.");
    }
    return combined;
  } catch (error) {
    console.error("[PDF] OCR extraction failed:", error);
    const message = describePdfError(error);
    if (message) throw new Error(message);
    throw new Error(
      "تعذر استخراج أي نص من هذا الملف. يبدو أنه ملف ممسوح ضوئياً أو تالف أو غير مدعوم.",
    );
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        /* ignore termination errors */
      }
    }
  }
}

/** Lazily creates a tesseract.js worker configured for Arabic + English. */
async function createTesseractWorker() {
  const tesseract = await import("tesseract.js");
  return tesseract.createWorker(OCR_LANGS, tesseract.OEM.LSTM_ONLY, {
    logger: () => {
      /* silence progress logs */
    },
  });
}

/** Preprocesses a page image with sharp to improve OCR accuracy. */
async function preprocessForOcr(image: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(image)
    .grayscale()
    .normalize()
    .resize({ width: 2200, withoutEnlargement: true })
    .png()
    .toBuffer();
}

/**
 * Maps a thrown error to a specific, user-facing message, or returns null when
 * the error is not a definitive "bad file" condition (so OCR can still be tried).
 */
function describePdfError(error: unknown): string | null {
  const name = error instanceof Error ? error.name : "";
  const msg = error instanceof Error ? error.message : String(error);

  if (name === "PasswordException" || /password|encrypted|encryption/i.test(msg)) {
    return "ملف PDF محمي بكلمة مرور أو مشفر. فك التشفير غير مدعوم.";
  }
  if (
    name === "InvalidPDFException" ||
    name === "FormatError" ||
    /invalid pdf|corrupt|not a pdf|malformed|format error/i.test(msg)
  ) {
    return "ملف PDF تالف أو غير صالح. تأكد من أن الملف سليم.";
  }
  return null;
}

export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
