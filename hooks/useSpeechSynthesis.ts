import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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


export const useSpeechSynthesis = (epubData: EpubData | null) => {
  const chapters = epubData?.chapters ?? [];
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0); // For highlighting
  const [error, setError] = useState<string | null>(null);
  const [isProgressLoading, setIsProgressLoading] = useState(true);

  // Voice and speed controls
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(null);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Sleep Timer state
  const [sleepTimer, setSleepTimer] = useState<number | 'end-of-chapter' | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  const chapterChunks = useRef<string[][]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const progressRef = useRef({ chapter: 0, chunk: 0 });
  const watchdogTimerRef = useRef<number | null>(null);

  // Keep progress ref updated for intervals and cleanup functions
  useEffect(() => {
    progressRef.current = { chapter: currentChapterIndex, chunk: currentChunkIndex };
  }, [currentChapterIndex, currentChunkIndex]);
  
  const progressKey = useMemo(() => 
    epubData ? `lukpaleelibros-progress-${epubData.filename}` : null
  , [epubData]);

  const saveProgress = useCallback(() => {
    if (progressKey) {
        localStorage.setItem(progressKey, JSON.stringify({
            currentChapterIndex: progressRef.current.chapter,
            currentChunkIndex: progressRef.current.chunk,
        }));
    }
  }, [progressKey]);
  
  // Load progress on mount
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
  
  // Periodic saving while speaking
  useEffect(() => {
    if (isSpeaking) {
        const intervalId = setInterval(saveProgress, 30000); // Save every 30 seconds
        return () => clearInterval(intervalId);
    }
  }, [isSpeaking, saveProgress]);

  // Save progress on unmount
  useEffect(() => {
    return () => {
        saveProgress();
    };
  }, [saveProgress]);


  useEffect(() => {
    const handleVoicesChanged = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      // Prioritize Latin American Spanish, then any Spanish, then any voice
      const latAmSpanishVoices = availableVoices.filter(v => v.lang.startsWith('es-') && !v.lang.startsWith('es-ES'));
      const anySpanishVoices = availableVoices.filter(v => v.lang.startsWith('es-'));

      let voicesToSet = latAmSpanishVoices;
      if (voicesToSet.length === 0) {
        voicesToSet = anySpanishVoices;
      }
      if (voicesToSet.length === 0) { // Fallback to all voices if no Spanish is available
          voicesToSet = availableVoices;
      }

      setVoices(voicesToSet);
      if (voicesToSet.length > 0) {
        // Try to set a default voice, preferring a previously saved one
        const savedVoiceURI = localStorage.getItem('lukpaleelibros-voice');
        if (savedVoiceURI && voicesToSet.some(v => v.voiceURI === savedVoiceURI)) {
            setSelectedVoiceURI(savedVoiceURI);
        } else {
            setSelectedVoiceURI(voicesToSet[0].voiceURI);
        }
      }
    };

    const voiceInterval = setInterval(() => {
        if (window.speechSynthesis.getVoices().length) {
            handleVoicesChanged();
            clearInterval(voiceInterval);
        }
    }, 100);

    window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
    handleVoicesChanged();

    const savedRate = localStorage.getItem('lukpaleelibros-rate');
    if (savedRate) {
        setPlaybackRate(parseFloat(savedRate));
    }

    return () => {
      clearInterval(voiceInterval);
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => {
    if (selectedVoiceURI) {
        localStorage.setItem('lukpaleelibros-voice', selectedVoiceURI);
    }
  }, [selectedVoiceURI]);

  useEffect(() => {
    localStorage.setItem('lukpaleelibros-rate', playbackRate.toString());
  }, [playbackRate]);

  useEffect(() => {
    // Si hay una locución en curso, actualiza su velocidad dinámicamente.
    if (window.speechSynthesis.speaking && utteranceRef.current) {
      utteranceRef.current.rate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    chapterChunks.current = chapters.map(chunkText);
    setCurrentChapterIndex(prev => Math.min(prev, chapters.length - 1));
    setCurrentChunkIndex(prev => chapters.length > 0 ? prev : 0);
    setCurrentCharIndex(0);
  }, [chapters]);
  
  const pause = useCallback((fromTimer = false) => {
    if (window.speechSynthesis.speaking || window.speechSynthesis.paused) {
      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
      window.speechSynthesis.pause();
      setIsPaused(true);
      setIsSpeaking(false);
      if (!fromTimer) { // Don't save progress if paused by timer, let user resume
          saveProgress();
      }
    }
  }, [saveProgress]);

  // Sleep Timer logic
  useEffect(() => {
    if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
    }

    if (isSpeaking && typeof sleepTimer === 'number' && sleepTimer > 0) {
        timerIntervalRef.current = window.setInterval(() => {
            setSleepTimer(prevTime => {
                if (typeof prevTime === 'number' && prevTime > 1) {
                    return prevTime - 1;
                } else {
                    pause(true); // Pause without saving progress
                    return null; // Reset timer
                }
            });
        }, 1000);
    }

    return () => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
        }
    };
  }, [isSpeaking, sleepTimer, pause]);


  const cancel = useCallback(() => {
    if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
    }
    if (window.speechSynthesis) {
      utteranceRef.current = null;
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentCharIndex(0);
    saveProgress(); // Save state on cancellation (e.g., chapter change)
  }, [saveProgress]);

  const speak = useCallback((chapterIdx: number, chunkIdx: number, startCharIndex = 0) => {
    if (!window.speechSynthesis || !epubData) {
      setError("Tu navegador no soporta la síntesis de voz.");
      return;
    }
    
    const fullChunkText = chapterChunks.current[chapterIdx]?.[chunkIdx];
    if (!fullChunkText) {
        cancel();
        return;
    }

    const textToSpeak = fullChunkText.substring(startCharIndex);
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utteranceRef.current = utterance;
    
    if (selectedVoiceURI) {
        const voice = voices.find(v => v.voiceURI === selectedVoiceURI);
        if (voice) utterance.voice = voice;
    }
    utterance.rate = playbackRate;
    
    // Clear any previous watchdog
    if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
    }
    // Watchdog for stuck synthesis
    const estimatedDurationMs = (textToSpeak.length / (15 * playbackRate)) * 1000;
    const watchdogTimeout = estimatedDurationMs + 10000; // 10-second buffer

    watchdogTimerRef.current = window.setTimeout(() => {
        console.warn('Speech synthesis watchdog triggered. Advancing.');
        cancel(); 
        const nextChunkIndex = chunkIdx + 1;
        if (nextChunkIndex < chapterChunks.current[chapterIdx]?.length) {
            speak(chapterIdx, nextChunkIndex);
        } else {
            const nextChapterIndex = chapterIdx + 1;
            if (nextChapterIndex < chapterChunks.current.length) {
                speak(nextChapterIndex, 0);
            }
        }
    }, watchdogTimeout);
    
    utterance.onboundary = (event) => {
        if (event.name === 'word') {
            setCurrentCharIndex(startCharIndex + event.charIndex);
        }
    };

    utterance.onend = () => {
      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
      if (utteranceRef.current !== utterance) return;
      setCurrentCharIndex(0);

      const nextChunkIndex = chunkIdx + 1;
      const isLastChunk = nextChunkIndex >= chapterChunks.current[chapterIdx].length;

      if (!isLastChunk) {
        setCurrentChunkIndex(nextChunkIndex);
        speak(chapterIdx, nextChunkIndex);
      } else {
        if (sleepTimer === 'end-of-chapter') {
            pause(true);
            setSleepTimer(null);
            return;
        }

        const nextChapterIndex = chapterIdx + 1;
        if (nextChapterIndex < chapterChunks.current.length) {
          setCurrentChapterIndex(nextChapterIndex);
          setCurrentChunkIndex(0);
          speak(nextChapterIndex, 0);
        } else {
          setIsSpeaking(false);
        }
      }
    };

    utterance.onerror = (event) => {
      // 'canceled' and 'interrupted' are expected behaviors in this app, not errors.
      // 'canceled' happens when we intentionally stop speech (e.g., skip chapter, skip time).
      // 'interrupted' can happen if a new speech command is issued before the old one finishes.
      if (event.error === 'interrupted' || event.error === 'canceled') {
        return;
      }
      console.error('SpeechSynthesisUtterance.onerror', event);
      setError(`Ocurrió un error en la síntesis de voz: ${event.error}`);
      cancel();
    };
    
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
    setIsPaused(false);
    setCurrentChapterIndex(chapterIdx);
    setCurrentChunkIndex(chunkIdx);
    setCurrentCharIndex(startCharIndex);

  }, [cancel, voices, selectedVoiceURI, playbackRate, epubData, sleepTimer, pause]);

  const play = useCallback((chapterIdx: number, chunkIdx: number, startCharIndex = 0) => {
    speak(chapterIdx, chunkIdx, startCharIndex);
  }, [speak]);

  const resume = useCallback(() => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsSpeaking(true);
    }
  }, []);

  // Pause speech when tab becomes hidden (addresses background playback)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && isSpeaking) {
        pause();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isSpeaking, pause]);
  
  const jumpToChapter = useCallback((chapterIdx: number, chunkIdx: number = 0) => {
      cancel();
      setCurrentChapterIndex(chapterIdx);
      setCurrentChunkIndex(chunkIdx);
      setCurrentCharIndex(0);
  }, [cancel]);

  const handleNextChapter = useCallback(() => {
    const nextIndex = Math.min(currentChapterIndex + 1, chapters.length - 1);
    if (nextIndex !== currentChapterIndex) {
        jumpToChapter(nextIndex);
    }
  }, [currentChapterIndex, chapters.length, jumpToChapter]);

  const handlePrevChapter = useCallback(() => {
    const prevIndex = Math.max(currentChapterIndex - 1, 0);
    if (prevIndex !== currentChapterIndex) {
        jumpToChapter(prevIndex);
    }
  }, [currentChapterIndex, jumpToChapter]);


  const skip = useCallback((charOffset: number) => {
    const shouldResume = isSpeaking || isPaused;
    if (!shouldResume) return;

    window.speechSynthesis.cancel();
    
    let chapterIdx = currentChapterIndex;
    let chunkIdx = currentChunkIndex;
    let targetCharInChunk = currentCharIndex + charOffset;

    while (targetCharInChunk < 0) {
        chunkIdx--;
        if (chunkIdx < 0) {
            chapterIdx--;
            if (chapterIdx < 0) {
                chapterIdx = 0;
                chunkIdx = 0;
                targetCharInChunk = 0;
                break;
            }
            chunkIdx = chapterChunks.current[chapterIdx].length - 1;
        }
        targetCharInChunk += chapterChunks.current[chapterIdx][chunkIdx].length;
    }

    let currentChunkLength = chapterChunks.current[chapterIdx]?.[chunkIdx]?.length ?? 0;
    while (targetCharInChunk >= currentChunkLength && currentChunkLength > 0) {
        targetCharInChunk -= currentChunkLength;
        chunkIdx++;
        if (chunkIdx >= chapterChunks.current[chapterIdx].length) {
            chapterIdx++;
            if (chapterIdx >= chapterChunks.current.length) {
                chapterIdx = chapters.length - 1;
                chunkIdx = chapterChunks.current[chapterIdx].length - 1;
                targetCharInChunk = chapterChunks.current[chapterIdx][chunkIdx].length;
                break;
            }
            chunkIdx = 0;
        }
        currentChunkLength = chapterChunks.current[chapterIdx]?.[chunkIdx]?.length ?? 0;
    }

    const finalChunkLength = chapterChunks.current[chapterIdx]?.[chunkIdx]?.length ?? 0;
    const finalCharIndex = Math.max(0, Math.min(targetCharInChunk, finalChunkLength));

    if (shouldResume) {
        setTimeout(() => play(chapterIdx, chunkIdx, finalCharIndex), 50);
    } else {
        setCurrentChapterIndex(chapterIdx);
        setCurrentChunkIndex(chunkIdx);
        setCurrentCharIndex(finalCharIndex);
    }
  }, [isSpeaking, isPaused, currentChapterIndex, currentChunkIndex, currentCharIndex, play, chapters.length]);
  

  useEffect(() => {
    return () => cancel();
  }, [cancel]);

  const currentChunkText = useMemo(() => {
    return chapterChunks.current[currentChapterIndex]?.[currentChunkIndex] || '';
  }, [currentChapterIndex, currentChunkIndex]);

  const chapterProgressPercentage = useMemo(() => {
    const chunksInChapter = chapterChunks.current[currentChapterIndex];
    if (!chunksInChapter || chunksInChapter.length === 0) return 0;

    const totalCharsInChapter = chunksInChapter.reduce((acc, chunk) => acc + chunk.length, 0);
    if (totalCharsInChapter === 0) return 0;

    let spokenChars = 0;
    for (let i = 0; i < currentChunkIndex; i++) {
        spokenChars += chunksInChapter[i].length;
    }
    spokenChars += currentCharIndex;

    return (spokenChars / totalCharsInChapter) * 100;
  }, [currentChapterIndex, currentChunkIndex, currentCharIndex]);


  return {
    isSpeaking,
    isPaused,
    currentChapterIndex,
    currentChunkIndex,
    currentCharIndex,
    currentChunkText,
    chapterProgressPercentage,
    play,
    pause: () => pause(false), // Expose a version that always saves progress
    resume,
    jumpToChapter,
    skip,
    error,
    totalChapters: chapters.length,
    voices,
    selectedVoiceURI,
    setSelectedVoiceURI,
    playbackRate,
    setPlaybackRate,
    handleNextChapter,
    handlePrevChapter,
    isProgressLoading,
    sleepTimer,
    setSleepTimer,
  };
};