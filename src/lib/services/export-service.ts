/**
 * Export Service
 * Supports multiple export formats: PDF, Word, PowerPoint, Anki decks
 */

export type ExportFormat = "pdf" | "word" | "powerpoint" | "anki" | "markdown";

export interface ExportOptions {
  format: ExportFormat;
  title: string;
  content: string;
  kind?: string;
  metadata?: Record<string, unknown>;
}

export interface ExportResult {
  url: string;
  filename: string;
  size: number;
}

/**
 * Export content to various formats
 */
export async function exportContent(options: ExportOptions): Promise<ExportResult | null> {
  switch (options.format) {
    case "pdf":
      return exportToPDF(options);
    case "word":
      return exportToWord(options);
    case "powerpoint":
      return exportToPowerPoint(options);
    case "anki":
      return exportToAnki(options);
    case "markdown":
    default:
      return exportToMarkdown(options);
  }
}

/**
 * Export to Markdown (default)
 */
function exportToMarkdown(options: ExportOptions): ExportResult {
  const blob = new Blob([`# ${options.title}\n\n${options.content}`], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const filename = `${options.title.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "_")}.md`;
  
  return {
    url,
    filename,
    size: blob.size,
  };
}

/**
 * Export to PDF (using browser print)
 */
function exportToPDF(options: ExportOptions): ExportResult | null {
  if (typeof window === "undefined") return null;

  // Create a new window for printing
  const printWindow = window.open("", "_blank");
  if (!printWindow) return null;

  const htmlContent = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>${options.title}</title>
      <style>
        body {
          font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
          direction: rtl;
          padding: 40px;
          line-height: 1.8;
          color: #333;
        }
        h1 { color: #4f46e5; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; }
        h2 { color: #6366f1; margin-top: 30px; }
        h3 { color: #818cf8; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: right; }
        th { background-color: #4f46e5; color: white; }
        blockquote { border-right: 4px solid #4f46e5; padding-right: 20px; color: #666; }
        code { background: #f4f4f4; padding: 2px 8px; border-radius: 4px; }
        pre { background: #f4f4f4; padding: 15px; border-radius: 8px; overflow-x: auto; }
      </style>
    </head>
    <body>
      ${convertMarkdownToHTML(options.content)}
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();

  // Trigger print dialog
  setTimeout(() => {
    printWindow.print();
  }, 500);

  // Return a placeholder URL
  return {
    url: "",
    filename: `${options.title.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "_")}.pdf`,
    size: 0,
  };
}

/**
 * Export to Word (HTML-based)
 */
function exportToWord(options: ExportOptions): ExportResult {
  const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="UTF-8">
      <title>${options.title}</title>
      <style>
        body { font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; direction: rtl; padding: 40px; line-height: 1.8; }
        h1 { color: #4f46e5; }
        h2 { color: #6366f1; margin-top: 30px; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: right; }
        th { background-color: #4f46e5; color: white; }
      </style>
    </head>
    <body>
      ${convertMarkdownToHTML(options.content)}
    </body>
    </html>
  `;

  const blob = new Blob([htmlContent], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const filename = `${options.title.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "_")}.doc`;

  return {
    url,
    filename,
    size: blob.size,
  };
}

/**
 * Export to PowerPoint (simplified HTML-based)
 */
function exportToPowerPoint(options: ExportOptions): ExportResult | null {
  if (typeof window === "undefined") return null;

  // Parse slides from content
  const slides = parseSlides(options.content);
  
  const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:x='urn:schemas-microsoft-com:office:powerpoint' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="UTF-8">
      <title>${options.title}</title>
      <style>
        .slide { page-break-after: always; padding: 40px; font-family: 'Cairo', sans-serif; }
        .slide:last-child { page-break-after: auto; }
        h1 { color: #4f46e5; font-size: 32px; }
        h2 { color: #6366f1; font-size: 24px; margin-top: 20px; }
        ul { line-height: 1.8; }
      </style>
    </head>
    <body>
      ${slides.map(slide => `
        <div class="slide">
          <h1>${slide.title}</h1>
          <div>${convertMarkdownToHTML(slide.content)}</div>
        </div>
      `).join("")}
    </body>
    </html>
  `;

  const blob = new Blob([htmlContent], { 
    type: "application/vnd.ms-powerpoint" 
  });
  const url = URL.createObjectURL(blob);
  const filename = `${options.title.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "_")}.ppt`;

  return {
    url,
    filename,
    size: blob.size,
  };
}

/**
 * Export to Anki deck (CSV format)
 */
function exportToAnki(options: ExportOptions): ExportResult {
  // Parse flashcards from content
  const cards = parseFlashcards(options.content);
  
  // Create CSV content
  const csvRows = ["Question,Answer,Tag"];
  for (const card of cards) {
    const question = escapeCSV(card.question);
    const answer = escapeCSV(card.answer);
    const tag = options.kind || "general";
    csvRows.push(`${question},${answer},${tag}`);
  }

  const csvContent = csvRows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const filename = `${options.title.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, "_")}_anki.csv`;

  return {
    url,
    filename,
    size: blob.size,
  };
}

/**
 * Helper: Convert Markdown to HTML
 */
function convertMarkdownToHTML(markdown: string): string {
  let html = markdown
    // Headers
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    // Bold and Italic
    .replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    // Lists
    .replace(/^\- (.*$)/gim, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>")
    // Code blocks
    .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    // Blockquotes
    .replace(/^> (.*$)/gim, "<blockquote>$1</blockquote>")
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Line breaks
    .replace(/\n/g, "<br>");

  return html;
}

/**
 * Helper: Parse slides from content
 */
function parseSlides(content: string): Array<{ title: string; content: string }> {
  const slides: Array<{ title: string; content: string }> = [];
  const slideMatches = content.split(/---SLIDE---/i).slice(1);

  for (const slideContent of slideMatches) {
    const endIndex = slideContent.indexOf("---END---");
    const slideText = endIndex > -1 ? slideContent.slice(0, endIndex) : slideContent;
    const lines = slideText.trim().split("\n");
    const title = lines[0]?.replace(/^#+\s*/, "").trim() || "شريحة";
    const slideContentStr = lines.slice(1).join("\n").trim();
    
    if (title || slideContentStr) {
      slides.push({ title, content: slideContentStr });
    }
  }

  return slides;
}

/**
 * Helper: Parse flashcards from content
 */
function parseFlashcards(content: string): Array<{ question: string; answer: string }> {
  const cards: Array<{ question: string; answer: string }> = [];
  const cardMatches = content.split(/---CARD---/i).slice(1);

  for (const cardContent of cardMatches) {
    const endIndex = cardContent.indexOf("---END---");
    const cardText = endIndex > -1 ? cardContent.slice(0, endIndex) : cardContent;
    
    const questionMatch = cardText.match(/\*\*السؤال:\*\*\s*([\s\S]*?)(?=\*\*الجواب:\*\*|$)/i);
    const answerMatch = cardText.match(/\*\*الجواب:\*\*\s*([\s\S]*?)$/i);
    
    if (questionMatch && answerMatch) {
      cards.push({
        question: questionMatch[1].trim(),
        answer: answerMatch[1].trim(),
      });
    }
  }

  return cards;
}

/**
 * Helper: Escape CSV field
 */
function escapeCSV(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Download file helper
 */
export function downloadFile(result: ExportResult): void {
  if (!result.url) return;
  
  const link = document.createElement("a");
  link.href = result.url;
  link.download = result.filename;
  link.click();
  
  // Cleanup
  setTimeout(() => URL.revokeObjectURL(result.url), 1000);
}

/**
 * Get available export formats
 */
export function getAvailableFormats(): ExportFormat[] {
  return ["markdown", "pdf", "word", "powerpoint", "anki"];
}