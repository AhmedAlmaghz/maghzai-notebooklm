/**
 * YouTube transcript extraction utilities
 */

const YOUTUBE_FETCH_TIMEOUT_MS = 15000;

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

export async function fetchYouTubeTranscript(videoId: string): Promise<{
  transcript: string;
  metadata: VideoMetadata;
} | null> {
  try {
    // Try using yt-caption-kit first
    const { YtCaptionKit } = await import("yt-caption-kit");
    const kit = new YtCaptionKit();

    // Note: "auto" is not a valid language code for yt-caption-kit and would
    // make the whole lookup fail with NoTranscriptFound, so we only request
    // real language codes here.
    const result = await kit.fetch(videoId, {
      languages: ["ar", "en", "fr", "de", "es"],
      preserveFormatting: false,
    });

    if (result && result.snippets && result.snippets.length > 0) {
      const transcript = result.snippets
        .map((s: TranscriptSnippet) => s.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      // Get video metadata (single watch-page fetch)
      const metadata = await fetchVideoMetadata(videoId);

      return {
        transcript,
        metadata,
      };
    }
  } catch (err) {
    console.error("[YouTube] yt-caption-kit error:", err);
  }

  // Fallback: Try direct Innertube API approach
  try {
    return await fetchTranscriptDirect(videoId);
  } catch (err) {
    console.error("[YouTube] Direct fetch error:", err);
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

  const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
  if (!apiKeyMatch) {
    console.error("[YouTube] INNERTUBE_API_KEY not found");
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

  // Prefer Arabic, then English, then any available
  const preferredLangs = ["ar", "en"];
  let track = null;
  for (const lang of preferredLangs) {
    track = tracks.find((t: { languageCode: string }) => t.languageCode === lang);
    if (track) break;
  }
  if (!track) track = tracks[0];

  // Step 3: Fetch transcript XML
  const transcriptRes = await fetch(track.baseUrl, {
    signal: AbortSignal.timeout(YOUTUBE_FETCH_TIMEOUT_MS),
  });
  const xml = await transcriptRes.text();

  // Parse XML to extract text
  const textMatches = [...xml.matchAll(/<text[^>]*>([^<]*)<\/text>/g)];
  const transcript = textMatches
    .map((m) => m[1])
    .map((t) => t.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/'/g, "'").replace(/"/g, '"'))
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
