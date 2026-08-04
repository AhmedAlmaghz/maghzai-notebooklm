"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Pause, Volume2, VolumeX, RotateCcw, Sparkles, X, Download, Share2, Headphones, Loader2 } from "lucide-react";

export default function AudioOverviewPlayer({
  title = "الحوار الصوتي التلخيصي للدفتر",
  notebookId,
  selectedSourceIds,
  onClose,
}: {
  title?: string;
  notebookId?: string;
  selectedSourceIds?: string[];
  onClose?: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<number>(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [provider, setProvider] = useState<string>("browser");
  const [useBrowserTTS, setUseBrowserTTS] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Load audio on mount
  useEffect(() => {
    if (!notebookId) return;

    const loadAudio = async () => {
      setIsLoading(true);
      try {
        // Try to get audio from API
        const res = await fetch(`/api/notebooks/${notebookId}/audio`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ speed, sourceIds: selectedSourceIds }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.audioUrl && data.audioUrl !== "browser-tts") {
            setAudioUrl(data.audioUrl);
            setDuration(data.duration);
            setProvider(data.provider);
            setUseBrowserTTS(false);
          } else {
            // Fallback to browser TTS
            setUseBrowserTTS(true);
            setProvider("browser");
            // Estimate duration
            setDuration(120); // 2 minutes default
          }
        } else {
          // Fallback to browser TTS
          setUseBrowserTTS(true);
          setProvider("browser");
          setDuration(120);
        }
      } catch (error) {
        console.error("[Audio] Failed to load:", error);
        setUseBrowserTTS(true);
        setProvider("browser");
        setDuration(120);
      } finally {
        setIsLoading(false);
      }
    };

    loadAudio();
  }, [notebookId, speed, selectedSourceIds]);

  // Handle audio playback
  useEffect(() => {
    if (!isPlaying) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      return;
    }

    if (useBrowserTTS && "speechSynthesis" in window) {
      // Browser TTS
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(title);
      utterance.lang = "ar-SA";
      utterance.rate = speed;
      utterance.pitch = 1;
      utterance.volume = isMuted ? 0 : 1;

      const voices = window.speechSynthesis.getVoices();
      const arabicVoice = voices.find((voice) => voice.lang.startsWith("ar"));
      if (arabicVoice) {
        utterance.voice = arabicVoice;
      }

      utterance.onend = () => {
        setIsPlaying(false);
        setProgress(0);
      };

      window.speechSynthesis.speak(utterance);
      utteranceRef.current = utterance;

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= duration) {
            clearInterval(progressInterval);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);

      return () => clearInterval(progressInterval);
    } else if (audioUrl && audioRef.current) {
      // Audio file playback
      audioRef.current.src = audioUrl;
      audioRef.current.play();

      const audio = audioRef.current;

      const updateProgress = () => {
        if (audio.duration) {
          setProgress(audio.currentTime);
        }
      };

      const handleEnded = () => {
        setIsPlaying(false);
        setProgress(0);
      };

      audio.addEventListener("timeupdate", updateProgress);
      audio.addEventListener("ended", handleEnded);

      return () => {
        audio.removeEventListener("timeupdate", updateProgress);
        audio.removeEventListener("ended", handleEnded);
        audio.pause();
      };
    }
  }, [isPlaying, useBrowserTTS, audioUrl, speed, isMuted, duration, title]);

  const togglePlay = () => {
    if (isLoading) return;
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value);
    setProgress(newTime);

    if (audioRef.current && audioUrl && !useBrowserTTS) {
      audioRef.current.currentTime = newTime;
    }
  };

  const cycleSpeed = () => {
    const speeds = [0.75, 1, 1.25, 1.5, 2];
    const nextIdx = (speeds.indexOf(speed) + 1) % speeds.length;
    setSpeed(speeds[nextIdx]);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 p-4 text-white shadow-xl shadow-indigo-950/30 dark:border-indigo-900/60 animate-fade-in">
      {/* Background Decorative Glow */}
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-indigo-500/20 blur-2xl" />
      <div className="pointer-events-none absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-purple-500/20 blur-2xl" />

      <div className="relative z-10 flex flex-col gap-3">
        {/* Top bar: title and actions */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-600/80 text-white shadow-inner">
              <Headphones size={18} className={isPlaying ? "animate-pulse" : ""} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 border border-indigo-400/30">
                  {provider === "elevenlabs" ? "ElevenLabs" : provider === "google" ? "Google TTS" : "Browser TTS"} 🎙️
                </span>
                <span className="text-[10px] text-indigo-300/80">حوار صوتي</span>
              </div>
              <h4 className="truncate text-sm font-bold text-slate-100">{title}</h4>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={cycleSpeed}
              className="rounded-lg bg-indigo-800/50 px-2 py-1 text-xs font-mono font-bold text-indigo-200 hover:bg-indigo-700/60 transition"
              title="سرعة التشغيل"
            >
              {speed}x
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-indigo-300 hover:bg-indigo-800/40 hover:text-white transition"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-4">
            <Loader2 size={20} className="animate-spin text-indigo-400" />
            <span className="text-sm text-indigo-300">جارٍ تحميل الصوت...</span>
          </div>
        )}

        {/* Waveform / Visualizer bars */}
        {!isLoading && (
          <>
            <div className="flex h-7 items-center justify-center gap-1 px-2">
              {Array.from({ length: 32 }).map((_, i) => {
                const isActive = isPlaying;
                const heights = [30, 60, 45, 80, 100, 70, 40, 90, 65, 85, 50, 95, 75, 40, 60, 85, 90, 50, 70, 95, 60, 80, 40, 65, 90, 75, 45, 85, 60, 40, 30, 20];
                const heightPct = isActive ? heights[i % heights.length] : 20;
                return (
                  <div
                    key={i}
                    className={`w-1 rounded-full transition-all duration-300 ${(i / 32) * duration <= progress
                        ? "bg-gradient-to-t from-indigo-400 to-purple-300"
                        : "bg-indigo-900/60"
                      }`}
                    style={{
                      height: `${heightPct}%`,
                      animation: isActive ? `wave 1.2s ease-in-out infinite ${i * 0.05}s` : "none",
                    }}
                  />
                );
              })}
            </div>

            {/* Controls and timeline */}
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                disabled={isLoading}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-600/40 transition hover:scale-105 active:scale-95 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : isPlaying ? (
                  <Pause size={18} />
                ) : (
                  <Play size={18} className="mr-0.5" />
                )}
              </button>

              <div className="flex flex-1 flex-col gap-1">
                <input
                  type="range"
                  min={0}
                  max={duration}
                  value={progress}
                  onChange={handleSeek}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-indigo-950 accent-indigo-400"
                />
                <div className="flex items-center justify-between text-[11px] font-mono text-indigo-300/80">
                  <span>{formatTime(progress)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <button
                onClick={() => setIsMuted(!isMuted)}
                className="rounded-lg p-2 text-indigo-300 hover:bg-indigo-800/40 hover:text-white transition"
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            </div>
          </>
        )}

        {/* Hidden audio element for file playback */}
        {audioUrl && !useBrowserTTS && (
          <audio
            ref={audioRef}
            onLoadedMetadata={() => {
              if (audioRef.current) {
                setDuration(audioRef.current.duration);
              }
            }}
            className="hidden"
          />
        )}
      </div>
    </div>
  );
}
