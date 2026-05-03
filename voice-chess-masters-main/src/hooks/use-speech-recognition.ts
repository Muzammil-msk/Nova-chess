import { useCallback, useEffect, useRef, useState } from "react";

type SRConstructor = new () => SpeechRecognition;
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
interface SpeechRecognitionEvent {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
  resultIndex: number;
}

function getRecognitionCtor(): SRConstructor | null {
  if (typeof window === "undefined") return null;
  // @ts-expect-error vendor prefixed
  return (window.SpeechRecognition || window.webkitSpeechRecognition) ?? null;
}

function detectIframe(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

const RESTART_DELAY_MS = 1500;
const MAX_RETRIES = 3;

export interface UseSpeechRecognitionOptions {
  onFinal: (transcript: string) => void;
  lang?: string;
}

export function useSpeechRecognition({ onFinal, lang = "en-US" }: UseSpeechRecognitionOptions) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isInIframe, setIsInIframe] = useState(false);

  const recRef = useRef<SpeechRecognition | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  // Lifecycle refs (stable across renders, no stale closures)
  const userWantsListeningRef = useRef(false);
  const isActiveRef = useRef(false); // mic actually engaged
  const retryCountRef = useRef(0);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastErrorRef = useRef<string | null>(null);

  // Init once
  useEffect(() => {
    setIsInIframe(detectIframe());
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      return;
    }
    setSupported(true);
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = lang;

    rec.onstart = () => {
      isActiveRef.current = true;
      setListening(true);
      setError(null);
      lastErrorRef.current = null;
      retryCountRef.current = 0;
    };

    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const transcript = result[0].transcript.toLowerCase().trim();
          if (transcript) {
            try {
              onFinalRef.current(transcript);
            } catch (err) {
              console.error("Voice handler threw:", err);
            }
          }
        }
      }
    };

    rec.onerror = (e) => {
      lastErrorRef.current = e.error;
      // Hard-stop conditions: do NOT auto-restart.
      if (e.error === "network") {
        userWantsListeningRef.current = false;
        setError("Network issue. Click retry.");
        return;
      }
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        userWantsListeningRef.current = false;
        setError("Microphone blocked. Allow mic access in your browser settings.");
        return;
      }
      if (e.error === "audio-capture") {
        userWantsListeningRef.current = false;
        setError("No microphone detected. Check your device.");
        return;
      }
      // Silent / aborted — ignore quietly, let onend decide whether to restart.
      if (e.error === "no-speech" || e.error === "aborted") return;
      // Other transient errors — surface but allow onend's restart logic to debounce.
      setError(`Speech error: ${e.error}`);
    };

    rec.onend = () => {
      isActiveRef.current = false;
      setListening(false);

      if (!userWantsListeningRef.current) return;

      // Don't restart on hard-stop errors (already cleared the flag above, but double-check).
      const last = lastErrorRef.current;
      if (last === "network" || last === "not-allowed" || last === "service-not-allowed" || last === "audio-capture") {
        return;
      }

      if (retryCountRef.current >= MAX_RETRIES) {
        userWantsListeningRef.current = false;
        setError("Microphone unstable. Click retry to try again.");
        return;
      }

      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      restartTimerRef.current = setTimeout(() => {
        if (!userWantsListeningRef.current || isActiveRef.current) return;
        retryCountRef.current += 1;
        try {
          rec.start();
        } catch {
          /* already started or failed silently */
        }
      }, RESTART_DELAY_MS);
    };

    recRef.current = rec;
    return () => {
      userWantsListeningRef.current = false;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      try {
        rec.abort();
      } catch {
        /* noop */
      }
      recRef.current = null;
      isActiveRef.current = false;
    };
  }, [lang]);

  const start = useCallback(() => {
    if (!recRef.current) return;
    if (isInIframe) {
      setError("Voice may not work in preview. Open in new tab.");
      return;
    }
    if (isActiveRef.current) return; // prevent multiple instances
    setError(null);
    lastErrorRef.current = null;
    retryCountRef.current = 0;
    userWantsListeningRef.current = true;
    try {
      recRef.current.start();
    } catch {
      // Already started — ignore.
    }
  }, [isInIframe]);

  const stop = useCallback(() => {
    userWantsListeningRef.current = false;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
  }, []);

  const retry = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    setError(null);
    lastErrorRef.current = null;
    retryCountRef.current = 0;
    userWantsListeningRef.current = false;
    try {
      recRef.current?.abort();
    } catch {
      /* noop */
    }
    // Small gap, then a fresh start (still considered a user-gesture-initiated chain).
    setTimeout(() => {
      if (!recRef.current) return;
      userWantsListeningRef.current = true;
      try {
        recRef.current.start();
      } catch {
        /* noop */
      }
    }, 300);
  }, []);

  return { supported, listening, interim, error, isInIframe, start, stop, retry };
}
