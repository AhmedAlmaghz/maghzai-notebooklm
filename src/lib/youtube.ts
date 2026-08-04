/**
 * YouTube transcript extraction utilities
 */
import type { TranscriptList } from "yt-caption-kit";

const YOUTUBE_FETCH_TIMEOUT_MS = 20000;

// Language codes we prefer, in priority order. "ar" is the app's primary
// language, "en" is the most widely available fallback. These are only a
// *preference* — we do NOT hard-limit to them (that was the bug: videos whose
// tracks are e.g. "es-419"/"pt-BR" would fail with NoTranscriptFound).
const PREFERRED_LANGUAGE_CODES = ["ar", "en"] as const;

export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function isYouTubeUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url) || extractVideoId(url) !== null;
}

interface TranscriptSnippet {
  text: string;
  start: number;
  duration: number;
}

interface VideoMetadata {
  title: string;
  channelName: string;
  description: string;
}

/**
 * Structural type for a transcript track returned by yt-caption-kit.
 * Kept structural so we don't need a static (top-level) import of the
 * library, which is ESM-only and imported dynamically elsewhere.
 */
interface TranscriptTrackLike {
  languageCode: string;
  isGenerated: boolean;
  fetch(preserveFormatting?: boolean): Promise<{ snippets: TranscriptSnippet[] }>;
  translate(languageCode: string): TranscriptTrackLike;
}

export async function fetchYouTubeTranscript(videoId: string): Promise<{
  transcript: string;
  metadata: VideoMetadata;
} | null> {
  // Try using yt-caption-kit first, with dynamic track detection and a
  // sensible fallback chain (manual > generated > translated).
  try {
    const { YtCaptionKit } = await import("yt-caption-kit");
    const kit = new YtCaptionKit();

    const transcript = await fetchTranscriptWithKit(kit, videoId);
    if (transcript) {
      const metadata = await fetchVideoMetadata(videoId);
      return { transcript, metadata };
    }
  } catch (err) {
    // Diagnostic: yt-caption-kit error classes (RequestBlocked, IpBlocked,
    // NoTranscriptFound, TranscriptsDisabled, ...) inherit from
    // CouldNotRetrieveTranscript whose `message` is EMPTY — the useful detail
    // lives in `toString()`. Log both so the real cause is visible.
    const name = err instanceof Error ? err.name : typeof err;
    const detail =
      err && typeof (err as { toString?: () => string }).toString === "function"
        ? String((err as { toString: () => string }).toString())
        : String(err);
    console.error(`[YouTube] yt-caption-kit error (${name}):`, detail);
  }

  // Fallback: try the direct Innertube API approach.
  console.log("[YouTube] yt-caption-kit failed — trying direct Innertube fetch");
  try {
    return await fetchTranscriptDirect(videoId);
  } catch (err) {
    console.error("[YouTube] Direct fetch error:", err);
    return null;
  }
}

/**
 * Lists the caption tracks for a video via yt-caption-kit and picks the best
 * one instead of relying on a fixed language list (which made every video
 * whose tracks weren't literally one of the hard-coded codes fail with
 * NoTranscriptFound).
 *
 * Selection order:
 *   1. manual track in a preferred language (exact code, e.g. "en")
 *   2. manual track whose base language matches (e.g. "es-419" → "es")
 *   3. any manually created track
 *   4. generated (auto) track in a preferred language (exact / base match)
 *   5. any generated track
 *   6. translated track (YouTube exposes translation targets for most tracks)
 */
async function fetchTranscriptWithKit(
  kit: { list(videoId: string): Promise<TranscriptList> },
  videoId: string,
): Promise<string | null> {
  let list: TranscriptList;
  try {
    list = await kit.list(videoId);
  } catch (err) {
    console.error(
      "[YouTube] Failed to list transcript tracks:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }

  const tracks = [...list] as TranscriptTrackLike[];
  const manual = tracks.filter((t) => !t.isGenerated);
  const generated = tracks.filter((t) => t.isGenerated);

  const byPreferred = (pool: TranscriptTrackLike[]): TranscriptTrackLike | null => {
    for (const code of PREFERRED_LANGUAGE_CODES) {
      const exact = pool.find((t) => t.languageCode === code);
      if (exact) return exact;
    }
    for (const code of PREFERRED_LANGUAGE_CODES) {
      const base = pool.find((t) => t.languageCode.split("-")[0] === code);
      if (base) return base;
    }
    return null;
  };

  // 1–2. Manual tracks (exact, then base-language match).
  const manualPick = byPreferred(manual);
  if (manualPick) return fetchAndJoinTranscript(manualPick);

  // 3. Any manually created transcript.
  if (manual.length > 0) {
    return fetchAndJoinTranscript(manual[0]);
  }

  // 4–5. Generated (auto-generated) transcripts.
  const generatedPick = byPreferred(generated);
  if (generatedPick) return fetchAndJoinTranscript(generatedPick);
  if (generated.length > 0) {
    return fetchAndJoinTranscript(generated[0]);
  }

  // 6. No usable track — try translating a manual track into a preferred
  //    language (e.g. Arabic), which YouTube supports for most tracks.
  if (tracks.length > 0) {
    for (const target of PREFERRED_LANGUAGE_CODES) {
      try {
        const translated = await fetchAndJoinTranscript(tracks[0].translate(target));
        if (translated) return translated;
      } catch {
        // Translation target unavailable for this track — try next target.
      }
    }
  }

  return null;
}

/** Fetches a single transcript track and joins its snippets into one string. */
async function fetchAndJoinTranscript(
  track: TranscriptTrackLike,
): Promise<string | null> {
  try {
    const fetched = await track.fetch(false);
    if (!fetched || !fetched.snippets || fetched.snippets.length === 0) {
      return null;
    }
    return fetched.snippets
      .map((s: TranscriptSnippet) => s.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  } catch (err) {
    console.error(
      "[YouTube] Failed to fetch transcript track:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Fetches video metadata from the watch page.
 * Accepts an optional pre-fetched `html` so callers that already downloaded the
 * page (fetchTranscriptDirect) don't trigger a duplicate network request.
 */
async function fetchVideoMetadata(videoId: string, html?: string): Promise<VideoMetadata> {
  try {
    if (!html) {
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        signal: AbortSignal.timeout(YOUTUBE_FETCH_TIMEOUT_MS),
      });
      html = await res.text();
    }

    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch
      ? titleMatch[1].replace(/ - YouTube$/, "").trim()
      : `فيديو يوتيوب ${videoId}`;

    const channelMatch = html.match(/"ownerChannelName":"([^"]+)"/);
    const channelName = channelMatch ? channelMatch[1] : "";

    const descMatch = html.match(/"shortDescription":"([^"]+)"/);
    const description = descMatch
      ? descMatch[1].replace(/\\n/g, "\n").slice(0, 500)
      : "";

    return { title, channelName, description };
  } catch {
    return {
      title: `فيديو يوتيوب ${videoId}`,
      channelName: "",
      description: "",
    };
  }
}

async function fetchTranscriptDirect(videoId: string): Promise<{
  transcript: string;
  metadata: VideoMetadata;
} | null> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Step 1: Fetch video page to get API key (single page fetch — the HTML is
  // reused below for metadata, avoiding a redundant request).
  const pageRes = await fetch(videoUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    signal: AbortSignal.timeout(YOUTUBE_FETCH_TIMEOUT_MS),
  });
  const html = await pageRes.text();

  // Note: tolerate whitespace around the key (YouTube may emit
  // `"INNERTUBE_API_KEY": "..."`). The previous regex without `\s*` missed it.
  const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":\s*"([^"]+)"/);
  if (!apiKeyMatch) {
    // Diagnostic: log whether the page looks like a consent/blocked page.
    const looksBlocked = /consent\.youtube\.com|g-recaptcha|Sign in to confirm/i.test(html);
    console.error(
      `[YouTube] INNERTUBE_API_KEY not found (looksBlocked=${looksBlocked}, htmlLen=${html.length})`,
    );
    return null;
  }
  const apiKey = apiKeyMatch[1];

  // Step 2: Call player API
  const playerRes = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "WEB",
          clientVersion: "2.20240101.00.00",
        },
      },
      videoId,
    }),
    signal: AbortSignal.timeout(YOUTUBE_FETCH_TIMEOUT_MS),
  });
  const playerData = await playerRes.json();

  const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks || tracks.length === 0) {
    console.error("[YouTube] No caption tracks found");
    return null;
  }

  // Prefer Arabic, then English (exact or base-language match), then any.
  const preferredLangs = PREFERRED_LANGUAGE_CODES as readonly string[];
  let track = null;
  for (const lang of preferredLangs) {
    track = tracks.find((t: { languageCode: string }) => t.languageCode === lang);
    if (track) break;
  }
  if (!track) {
    for (const lang of preferredLangs) {
      track = tracks.find((t: { languageCode: string }) => t.languageCode.split("-")[0] === lang);
      if (track) break;
    }
  }
  if (!track) track = tracks[0];

  // Step 3: Fetch transcript XML
  const transcriptRes = await fetch(track.baseUrl, {
    signal: AbortSignal.timeout(YOUTUBE_FETCH_TIMEOUT_MS),
  });
  const xml = await transcriptRes.text();

  // Parse XML to extract text (decode XML entities properly).
  const textMatches = [...xml.matchAll(/<text[^>]*>([^<]*)<\/text>/g)];
  const transcript = textMatches
    .map((m) => m[1])
    .map((t) => decodeXmlEntities(t))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!transcript) {
    return null;
  }

  // Reuse the already-fetched page HTML for metadata (no duplicate request).
  const metadata = await fetchVideoMetadata(videoId, html);
  return { transcript, metadata };
}

/** Decodes the XML entities used in YouTube caption XML. */
const AMP = String.fromCharCode(38);
const LT = String.fromCharCode(60);
const GT = String.fromCharCode(62);
const APOS = String.fromCharCode(39);
const QUOT = String.fromCharCode(34);
function decodeXmlEntities(input: string): string {
  return input
    .replace(new RegExp(AMP + "amp;", "g"), AMP)
    .replace(new RegExp(LT + "lt;", "g"), LT)
    .replace(new RegExp(GT + "gt;", "g"), GT)
    .replace(new RegExp(APOS + "#39;", "g"), APOS)
    .replace(new RegExp(QUOT + "quot;", "g"), QUOT)
    .replace(new RegExp(AMP + "nbsp;", "g"), " ");
}

export function formatYouTubeContent(
  transcript: string,
  metadata: VideoMetadata,
): string {
  let content = "";

  if (metadata.channelName) {
    content += `**القناة:** ${metadata.channelName}\n\n`;
  }

  if (metadata.description) {
    content += `**الوصف:**\n${metadata.description}\n\n---\n\n`;
  }

  content += `**النص الكامل للفيديو:**\n\n${transcript}`;

  return content;
}
