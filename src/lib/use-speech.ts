"use client";

/// <reference path="./speech.d.ts" />

import { useState, useRef, useCallback, useEffect } from "react";

interface UseSpeechOptions {
  onTranscript: (text: string, isFinal: boolean) => void;
}

export function useSpeech({ onTranscript }: UseSpeechOptions) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

    if (!SR) {
      setIsSupported(false);
      return;
    }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        onTranscriptRef.current(result[0].transcript, result.isFinal);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setIsSupported(false);
      }
      if (event.error === "network" && isListeningRef.current) {
        setTimeout(() => {
          try { recognitionRef.current?.start(); } catch {}
        }, 1000);
      }
    };

    recognition.onend = () => {
      if (isListeningRef.current) {
        try { recognitionRef.current?.start(); } catch {}
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try { recognition.stop(); } catch {}
    };
  }, []);

  const start = useCallback(() => {
    isListeningRef.current = true;
    setIsListening(true);
    try { recognitionRef.current?.start(); } catch {}
  }, []);

  const stop = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    try { recognitionRef.current?.stop(); } catch {}
  }, []);

  return { isListening, isSupported, start, stop };
}
