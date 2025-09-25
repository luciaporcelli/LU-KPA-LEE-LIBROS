import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { EpubData } from '../types';

const CHUNK_CHAR_LIMIT = 250;

const chunkText = (text: string): string[] => {
  if (!text) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    let chunkEnd = i + CHUNK_CHAR_LIMIT;
    if (chunkEnd < text.length) {
      let sentenceEnd = text.lastIndexOf('.', chunkEnd);
      if (sentenceEnd <= i) sentenceEnd = text.lastIndexOf('?', chunkEnd);
      if (sentenceEnd <= i) sentenceEnd = text.lastIndexOf('!', chunkEnd);
      if (sentenceEnd > i) {
        chunkEnd = sentenceEnd + 1;
      }
    }
    const chunk = text.substring(i, chunkEnd).trim();
    if (chunk) {
      chunks.push(chunk);
    }
    i = chunkEnd;
  }
  return chunks;
};

const postMessageToSw = (message: any) => {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(message);
  }
};

export const useSpeechSynthesis = (epubData: EpubData | null) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isProgressLoading, setIsProgressLoading] = useState(true);

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [sleepTimer, setSleepTimer] = useState<number | 'end-of-chapter' | null>(null);

  const chapterChunks = useMemo(() => epubData?.chapters.map(chunkText) ?? [], [epubData]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const watchdogTimerRef = useRef<number | null>(null);
  const speakRef = useRef<((chapterIdx: number, chunkIdx: number, charIdx?: number) => void) | null>(null);
  
  const playbackStateRef = useRef({ isSpeaking, isPaused });
  useEffect(() => {
    playbackStateRef.current = { isSpeaking, isPaused };
  });

  const sleepTimerRef = useRef(sleepTimer);
  useEffect(() => {
    sleepTimerRef.current = sleepTimer;
  });

  const progressKey = useMemo(() => 
    epubData ? `lukpaleelibros-progress-${epubData.filename}` : null
  , [epubData]);

  // Load progress from localStorage
  useEffect(() => {
    if (!progressKey) {
        setIsProgressLoading(false);
        return;
    };
    
    const savedProgress = localStorage.getItem(progressKey);
    if (savedProgress) {
      try {
        const progress = JSON.parse(savedProgress);
        if (progress && typeof progress.currentChapterIndex === 'number') {
           setCurrentChapterIndex(progress.currentChapterIndex);
           setCurrentChunkIndex(progress.currentChunkIndex ?? 0);
        }
      } catch (e) {
        console.error("Fallo al leer el progreso guardado", e);
      }
    }
    setIsProgressLoading(false);
  }, [progressKey]);
  
  // Save progress whenever it changes
  useEffect(() => {
    if ((isSpeaking || isPaused) && progressKey) {
        localStorage.setItem(progressKey, JSON.stringify({
            currentChapterIndex,
            currentChunkIndex,
        }));
    }
  }, [isSpeaking, isPaused, progressKey, currentChapterIndex, currentChunkIndex]);


  // Load voices and saved preferences
  useEffect(() => {
    const handleVoicesChanged = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length === 0) return;

      const latAmSpanishVoices = availableVoices.filter(v => v.lang.startsWith('es-') && !v.lang.startsWith('es-ES'));
      const anySpanishVoices = availableVoices.filter(v => v.lang.startsWith('es-'));

      let voicesToSet = latAmSpanishVoices.length > 0 ? latAmSpanishVoices : anySpanishVoices;
      if (voicesToSet.length === 0) voicesToSet = availableVoices;

      setVoices(voicesToSet);
      const savedVoiceURI = localStorage.getItem('lukpaleelibros-voice');
      if (savedVoiceURI && voicesToSet.some(v => v.voiceURI === savedVoiceURI)) {
          setSelectedVoiceURI(savedVoiceURI);
      } else {
          setSelectedVoiceURI(voicesToSet[0].voiceURI);
      }
    };

    const voiceInterval = setInterval(() => {
        if (window.speechSynthesis.getVoices().length) {
            handleVoicesChanged();
            clearInterval(voiceInterval);
        }
    }, 100);

    window.speechSynthesis.onvoiceschanged = handleVoicesChanged;

    const savedRate = localStorage.getItem('lukpaleelibros-rate');
    if (savedRate) setPlaybackRate(parseFloat(savedRate));

    return () => {
      clearInterval(voiceInterval);
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
      if(watchdogTimerRef.current) clearTimeout(watchdogTimerRef.current);
    };
  }, []);

  const clearWatchdog = useCallback(() => {
    if (watchdogTimerRef.current) {
      clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
  }, []);

  const pause = useCallback(() => {
    clearWatchdog();
    window.speechSynthesis.pause();
    setIsSpeaking(false);
    setIsPaused(true);
  }, [clearWatchdog]);

  const speak = useCallback((chapterIdx: number, chunkIdx: number, charIdx: number = 0) => {
    clearWatchdog();
    const textToSpeak = chapterChunks[chapterIdx]?.[chunkIdx]?.substring(charIdx);
    
    if (!textToSpeak) {
        setIsSpeaking(false);
        return;
    }
    
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utteranceRef.current = utterance;
    
    const voice = voices.find(v => v.voiceURI === selectedVoiceURI);
    if (voice) utterance.voice = voice;
    utterance.rate = playbackRate;
    
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        setCurrentCharIndex(charIdx + event.charIndex);
      }
    };
    
    utterance.onend = () => {
      clearWatchdog();
      if (!playbackStateRef.current.isSpeaking) return;
      
      const nextChunk = chunkIdx + 1;
      if (nextChunk < chapterChunks[chapterIdx].length) {
        setCurrentChunkIndex(nextChunk);
        setCurrentCharIndex(0);
        speakRef.current?.(chapterIdx, nextChunk);
      } else { // End of chapter
        if (sleepTimerRef.current === 'end-of-chapter') {
          pause();
          setSleepTimer(null);
          return;
        }

        const nextChapter = chapterIdx + 1;
        if (nextChapter < chapterChunks.length) {
          setCurrentChapterIndex(nextChapter);
          setCurrentChunkIndex(0);
          setCurrentCharIndex(0);
          speakRef.current?.(nextChapter, 0);
        } else {
          setIsSpeaking(false); // End of book
        }
      }
    };
    
    utterance.onerror = (e) => {
      console.error("Speech synthesis error", e);
      setError("Ocurrió un error al leer el texto.");
      clearWatchdog();
      setIsSpeaking(false);
    };

    // Do not call cancel here; it's handled by play(), skip(), etc.
    window.speechSynthesis.speak(utterance);
    
    const estimatedDurationMs = (textToSpeak.length / (15 * playbackRate)) * 1000;
    const watchdogTimeout = Math.max(5000, estimatedDurationMs + 10000); // Min 5s
    watchdogTimerRef.current = window.setTimeout(() => {
      if (utteranceRef.current === utterance && window.speechSynthesis.speaking) {
        console.warn("Speech synthesis watchdog triggered. Advancing...");
        utterance.onend?.(new SpeechSynthesisEvent('end', { utterance }));
      }
    }, watchdogTimeout);

  }, [chapterChunks, voices, selectedVoiceURI, playbackRate, clearWatchdog, pause, setSleepTimer]);

  useEffect(() => {
    speakRef.current = speak;
  }, [speak]);

  // Cleanup effect
  useEffect(() => {
    if (!isSpeaking && !isPaused) {
      clearWatchdog();
      utteranceRef.current = null;
      window.speechSynthesis.cancel();
    }
  }, [isSpeaking, isPaused, clearWatchdog]);

  const play = useCallback((chapterIdx: number, chunkIdx: number) => {
    setError(null);
    setCurrentChapterIndex(chapterIdx);
    setCurrentChunkIndex(chunkIdx);
    setCurrentCharIndex(0);
    setIsPaused(false);
    setIsSpeaking(true);

    window.speechSynthesis.cancel();
    // Use a small timeout to allow the speech engine to reset before speaking.
    setTimeout(() => {
        // Check if we are still supposed to be speaking.
        if (playbackStateRef.current.isSpeaking) {
            speak(chapterIdx, chunkIdx);
        }
    }, 50);
  }, [speak]);

  const resume = useCallback(() => {
    setError(null);
    window.speechSynthesis.resume();
    setIsSpeaking(true);
    setIsPaused(false);
  }, []);

  const jumpToChapter = useCallback((chapterIdx: number, playOnJump: boolean) => {
    setCurrentChapterIndex(chapterIdx);
    setCurrentChunkIndex(0);
    setCurrentCharIndex(0);
    setIsPaused(false);
    setIsSpeaking(playOnJump);

    window.speechSynthesis.cancel();

    if (playOnJump) {
        setTimeout(() => {
            if (playbackStateRef.current.isSpeaking) {
                speak(chapterIdx, 0);
            }
        }, 50);
    }
  }, [speak]);

  const handleNextChapter = useCallback(() => {
    if (currentChapterIndex < chapterChunks.length - 1) {
      jumpToChapter(currentChapterIndex + 1, isSpeaking || isPaused);
    }
  }, [currentChapterIndex, chapterChunks.length, isSpeaking, isPaused, jumpToChapter]);

  const handlePrevChapter = useCallback(() => {
    if (currentChapterIndex > 0) {
      jumpToChapter(currentChapterIndex - 1, isSpeaking || isPaused);
    }
  }, [currentChapterIndex, isSpeaking, isPaused, jumpToChapter]);

  const skip = useCallback((seconds: number) => {
    if (!isSpeaking && !isPaused) return;

    const charOffset = Math.round(seconds * 15 * playbackRate); // Estimate
    let chap = currentChapterIndex;
    let chunk = currentChunkIndex;
    let char = currentCharIndex + charOffset;

    while(char < 0) {
        chunk--;
        if (chunk < 0) {
            chap--;
            if (chap < 0) { chap=0; chunk=0; char=0; break; }
            chunk = chapterChunks[chap].length - 1;
        }
        char += chapterChunks[chap][chunk].length;
    }

    while(char >= (chapterChunks[chap]?.[chunk]?.length ?? 0)) {
        char -= chapterChunks[chap][chunk].length;
        chunk++;
        if (chunk >= chapterChunks[chap].length) {
            chap++;
            if (chap >= chapterChunks.length) {
                chap = chapterChunks.length - 1;
                chunk = chapterChunks[chap].length - 1;
                char = chapterChunks[chap][chunk].length - 1;
                break;
            }
            chunk = 0;
        }
    }
    
    setCurrentChapterIndex(chap);
    setCurrentChunkIndex(chunk);
    setCurrentCharIndex(char);

    // If we were paused, resume speaking from the new position.
    if (isPaused) {
        setIsPaused(false);
        setIsSpeaking(true);
    }
    
    window.speechSynthesis.cancel();
    setTimeout(() => {
        // Check ref to avoid race conditions if user paused/stopped during timeout.
        if (playbackStateRef.current.isSpeaking) {
             speak(chap, chunk, char);
        }
    }, 50);

  }, [isSpeaking, isPaused, playbackRate, currentChapterIndex, currentChunkIndex, currentCharIndex, chapterChunks, speak]);

  const handleSetSelectedVoiceURI = useCallback((voiceURI: string) => {
    setSelectedVoiceURI(voiceURI);
    localStorage.setItem('lukpaleelibros-voice', voiceURI);
  }, []);

  const handleSetPlaybackRate = useCallback((rate: number) => {
    setPlaybackRate(rate);
    localStorage.setItem('lukpaleelibros-rate', rate.toString());
  }, []);

  // Robust sleep timer logic using useEffect
  useEffect(() => {
    if (typeof sleepTimer !== 'number' || !isSpeaking) {
      return;
    }

    if (sleepTimer <= 0) {
      pause();
      setSleepTimer(null);
      return;
    }

    const intervalId = setInterval(() => {
      setSleepTimer(t => (typeof t === 'number' ? t - 1 : t));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [sleepTimer, isSpeaking, pause]);
  
  // SW Communication
  useEffect(() => {
    postMessageToSw({
        command: 'updateState',
        payload: {
            title: epubData?.title,
            coverUrl: epubData?.coverUrl,
            isSpeaking: isSpeaking && !isPaused,
            currentChapterIndex,
        }
    });
  }, [epubData, isSpeaking, isPaused, currentChapterIndex]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
        const { command, payload } = event.data;
        switch (command) {
            case 'resume': resume(); break;
            case 'pause': pause(); break;
            case 'nextChapter': handleNextChapter(); break;
            case 'prevChapter': handlePrevChapter(); break;
            case 'skip': skip(payload.seconds); break;
        }
    };
    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [resume, pause, handleNextChapter, handlePrevChapter, skip]);

  const currentChunkText = useMemo(() => {
    return chapterChunks[currentChapterIndex]?.[currentChunkIndex] || '';
  }, [currentChapterIndex, currentChunkIndex, chapterChunks]);

  const chapterProgressPercentage = useMemo(() => {
    const chunksInChapter = chapterChunks[currentChapterIndex];
    if (!chunksInChapter || chunksInChapter.length === 0) return 0;
    const totalCharsInChapter = chunksInChapter.reduce((acc, chunk) => acc + chunk.length, 0);
    if (totalCharsInChapter === 0) return 0;
    let spokenChars = 0;
    for (let i = 0; i < currentChunkIndex; i++) {
        spokenChars += chunksInChapter[i].length;
    }
    spokenChars += currentCharIndex;
    return (spokenChars / totalCharsInChapter) * 100;
  }, [currentChapterIndex, currentChunkIndex, currentCharIndex, chapterChunks]);


  return {
    isSpeaking,
    isPaused,
    currentChapterIndex,
    currentChunkIndex,
    currentCharIndex,
    currentChunkText,
    chapterProgressPercentage,
    play,
    pause,
    resume,
    skip,
    error,
    totalChapters: epubData?.chapters.length ?? 0,
    voices,
    selectedVoiceURI,
    setSelectedVoiceURI: handleSetSelectedVoiceURI,
    playbackRate,
    setPlaybackRate: handleSetPlaybackRate,
    handleNextChapter,
    handlePrevChapter,
    isProgressLoading,
    sleepTimer,
    setSleepTimer,
  };
};