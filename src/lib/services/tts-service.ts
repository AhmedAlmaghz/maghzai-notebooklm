/**
 * Text-to-Speech Service
 * Supports multiple TTS providers: ElevenLabs, Google Cloud TTS, and browser native
 */

export type TTSProvider = "elevenlabs" | "google" | "browser";

export interface TTSOptions {
  text: string;
  language?: string;
  voice?: string;
  speed?: number;
  provider?: TTSProvider;
}

export interface TTSResult {
  audioUrl: string;
  duration: number;
  provider: TTSProvider;
}

/**
 * Generates speech from text using the configured TTS provider
 */
export async function generateSpeech(options: TTSOptions): Promise<TTSResult | null> {
  const provider = options.provider || detectProvider();
  
  switch (provider) {
    case "elevenlabs":
      return generateWithElevenLabs(options);
    case "google":
      return generateWithGoogleTTS(options);
    case "browser":
    default:
      return generateWithBrowserTTS(options);
  }
}

/**
 * Detects available TTS provider based on environment variables
 */
function detectProvider(): TTSProvider {
  if (process.env.ELEVENLABS_API_KEY) {
    return "elevenlabs";
  }
  if (process.env.GOOGLE_CLOUD_TTS_API_KEY) {
    return "google";
  }
  return "browser";
}

/**
 * ElevenLabs TTS Integration
 * High-quality AI voices with natural intonation
 */
async function generateWithElevenLabs(options: TTSOptions): Promise<TTSResult | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.log("[TTS] ElevenLabs API key not configured");
    return null;
  }

  try {
    const voiceId = options.voice || process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // Default: Rachel (Arabic-capable)
    
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: options.text.slice(0, 5000), // ElevenLabs limit
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.5,
          speed: options.speed || 1.0,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[TTS] ElevenLabs error:", error);
      return null;
    }

    const audioBuffer = await response.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
    const audioUrl = URL.createObjectURL(audioBlob);
    
    // Estimate duration (roughly 150 words per minute)
    const wordCount = options.text.split(/\s+/).length;
    const duration = (wordCount / 150) * 60;

    return {
      audioUrl,
      duration,
      provider: "elevenlabs",
    };
  } catch (error) {
    console.error("[TTS] ElevenLabs generation error:", error);
    return null;
  }
}

/**
 * Google Cloud TTS Integration
 * Good quality with multiple Arabic voices
 */
async function generateWithGoogleTTS(options: TTSOptions): Promise<TTSResult | null> {
  const apiKey = process.env.GOOGLE_CLOUD_TTS_API_KEY;
  if (!apiKey) {
    console.log("[TTS] Google Cloud TTS API key not configured");
    return null;
  }

  try {
    const languageCode = options.language || "ar-SA";
    const voiceName = options.voice || "ar-SA-Wavenet-A"; // Arabic male voice
    
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: { text: options.text.slice(0, 5000) },
          voice: {
            languageCode,
            name: voiceName,
            ssmlGender: "MALE",
          },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate: options.speed || 1.0,
            pitch: 0,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[TTS] Google TTS error:", error);
      return null;
    }

    const data = await response.json();
    const audioContent = data.audioContent;
    
    if (!audioContent) {
      console.error("[TTS] No audio content in response");
      return null;
    }

    // Decode base64 audio
    const audioBuffer = Buffer.from(audioContent, "base64");
    const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
    const audioUrl = URL.createObjectURL(audioBlob);
    
    // Estimate duration
    const wordCount = options.text.split(/\s+/).length;
    const duration = (wordCount / 150) * 60;

    return {
      audioUrl,
      duration,
      provider: "google",
    };
  } catch (error) {
    console.error("[TTS] Google TTS generation error:", error);
    return null;
  }
}

/**
 * Browser Native TTS (Web Speech API)
 * Fallback option, no API key required
 */
async function generateWithBrowserTTS(options: TTSOptions): Promise<TTSResult | null> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) {
      console.error("[TTS] Browser does not support speech synthesis");
      resolve(null);
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(options.text);
    utterance.lang = options.language || "ar-SA";
    utterance.rate = options.speed || 1.0;
    utterance.pitch = 1;
    utterance.volume = 1;

    // Try to find an Arabic voice
    const voices = window.speechSynthesis.getVoices();
    const arabicVoice = voices.find((voice) => voice.lang.startsWith("ar"));
    if (arabicVoice) {
      utterance.voice = arabicVoice;
    }

    // Estimate duration
    const wordCount = options.text.split(/\s+/).length;
    const duration = (wordCount / 150) * 60;

    // For browser TTS, we return a special marker
    resolve({
      audioUrl: "browser-tts",
      duration,
      provider: "browser",
    });
  });
}

/**
 * Preloads browser voices (needed for some browsers)
 */
export function preloadBrowserVoices(): void {
  if ("speechSynthesis" in window) {
    // Trigger voice loading
    window.speechSynthesis.getVoices();
    
    // Some browsers load voices asynchronously
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }
}

/**
 * Checks if TTS is available
 */
export function isTTSAvailable(): boolean {
  return (
    !!process.env.ELEVENLABS_API_KEY ||
    !!process.env.GOOGLE_CLOUD_TTS_API_KEY ||
    "speechSynthesis" in window
  );
}

/**
 * Gets available TTS providers
 */
export function getAvailableProviders(): TTSProvider[] {
  const providers: TTSProvider[] = [];
  
  if (process.env.ELEVENLABS_API_KEY) {
    providers.push("elevenlabs");
  }
  if (process.env.GOOGLE_CLOUD_TTS_API_KEY) {
    providers.push("google");
  }
  if ("speechSynthesis" in window) {
    providers.push("browser");
  }
  
  return providers;
}