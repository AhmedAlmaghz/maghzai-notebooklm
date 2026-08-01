/**
 * Splits normalized text into overlapping chunks suitable for retrieval.
 */
export function splitIntoChunks(
  text: string,
  chunkSize = 900,
  overlap = 150,
): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  if (!clean) return [];

  // Split on paragraph boundaries first, then greedily pack into chunks.
  const paragraphs = clean.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (para.length > chunkSize) {
      // Paragraph itself is too long — split by sentence.
      const sentences = para.split(/(?<=[.!?؟。])\s+/);
      for (const sentence of sentences) {
        if ((current + " " + sentence).trim().length > chunkSize) {
          if (current.trim()) chunks.push(current.trim());
          current = sentence;
        } else {
          current = (current + " " + sentence).trim();
        }
      }
      continue;
    }

    if ((current + "\n\n" + para).trim().length > chunkSize) {
      if (current.trim()) chunks.push(current.trim());
      current = para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  if (chunks.length <= 1) return chunks;

  // Add light overlap between consecutive chunks for better context continuity.
  const withOverlap: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    if (i === 0) {
      withOverlap.push(chunks[i]);
      continue;
    }
    const prevTail = chunks[i - 1].slice(-overlap);
    withOverlap.push(`${prevTail}\n\n${chunks[i]}`.trim());
  }
  return withOverlap;
}
