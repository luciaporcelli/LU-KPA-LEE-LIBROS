import React, { useState, useEffect, useCallback, useMemo, useRef, RefObject } from 'react';
import type { EpubData } from '../types';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';
import Loader from './Loader';
import {
  PlayIcon,
  PauseIcon,
  RewindIcon,
  ForwardIcon,
  BookOpenIcon,
  ArrowLeftIcon,
  Replay15Icon,
  Forward15Icon,
  MoonIcon,
} from './Icons';

interface AudioPlayerProps {
  epubData: EpubData;
  onBackToLibrary: () => void;
}

// Hook para detectar clics fuera de un elemento
type Event = MouseEvent | TouchEvent;
const useClickOutside = <T extends HTMLElement = HTMLElement>(
  ref: RefObject<T>,
  handler: (event: Event) => void
) => {
  useEffect(() => {
    const listener = (event: Event) => {
      const el = ref?.current;
      // No hacer nada si se hace clic en el elemento de la ref o en sus descendientes
      if (!el || el.contains((event?.target as Node) || null)) {
        return;
      }
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
};


const AudioPlayer: React.FC<AudioPlayerProps> = ({ epubData, onBackToLibrary }) => {
  const { title, coverUrl } = epubData;
  
  const {
    isSpeaking,
    isPaused,
    currentChapterIndex,
    currentChunkIndex,
    currentCharIndex,
    currentChunkText,
    play,
    pause,
    resume,
    skip,
    error,
    totalChapters,
    voices,
    selectedVoiceURI,
    setSelectedVoiceURI,
    playbackRate,
    setPlaybackRate,
    chapterProgressPercentage,
    handleNextChapter,
    handlePrevChapter,
    isProgressLoading,
    sleepTimer,
    setSleepTimer,
  } = useSpeechSynthesis(epubData);

  const [isTimerMenuOpen, setIsTimerMenuOpen] = useState(false);
  const timerMenuRef = useRef<HTMLDivElement>(null);
  const silentAudioRef = useRef<HTMLAudioElement>(null);

  useClickOutside(timerMenuRef, () => {
    if (isTimerMenuOpen) {
      setIsTimerMenuOpen(false);
    }
  });

  const handlePlayPause = useCallback(() => {
    const audio = silentAudioRef.current;
    if (!audio) return;

    if (isSpeaking) {
      pause();
      if (!audio.paused) {
        audio.pause();
      }
    } else { // Covers isPaused and stopped states
      if (isPaused) {
        resume();
      } else {
        play(currentChapterIndex, currentChunkIndex);
      }

      if (audio.paused) {
        audio.play().catch(e => {
            // This error is expected if the user rapidly clicks play/pause. It can be safely ignored.
            if (e.name !== 'AbortError') {
                 console.error("Error al reproducir audio silencioso:", e);
            }
        });
      }
    }
  }, [isSpeaking, isPaused, pause, resume, play, currentChapterIndex, currentChunkIndex]);

  const handleSkipSeconds = useCallback((seconds: number) => {
    skip(seconds);
  }, [skip]);


  const progressPercentage = useMemo(() => {
    if (totalChapters === 0) return 0;
    return (currentChapterIndex / totalChapters) * 100;
  }, [currentChapterIndex, totalChapters]);

  const handleSetTimer = (duration: number | 'end-of-chapter' | null) => {
    setSleepTimer(duration);
    setIsTimerMenuOpen(false);
  }
  
  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleSilentAudioLoop = useCallback(() => {
    const audio = silentAudioRef.current;
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(e => {
        if (e.name !== 'AbortError') {
          console.error("Error al reiniciar el bucle de audio silencioso:", e);
        }
      });
    }
  }, []);


  if (isProgressLoading) {
    return <Loader message="Cargando tu libro..." />;
  }

  return (
    <div className="flex flex-col items-center space-y-4 sm:space-y-6" aria-labelledby="book-title">
       <button onClick={onBackToLibrary} className="self-start flex items-center space-x-2 text-subtle-text dark:text-dark-subtle-text hover:text-dark-text dark:hover:text-light-text transition-colors">
            <ArrowLeftIcon className="w-5 h-5" />
            <span>Volver a la Biblioteca</span>
        </button>

      <div className="w-40 h-40 sm:w-56 sm:h-56 rounded-lg shadow-md overflow-hidden flex items-center justify-center bg-gray-100 dark:bg-dark-bg">
        {coverUrl ? (
          <img src={coverUrl} alt={`Portada de ${title}`} className="w-full h-full object-cover" />
        ) : (
          <BookOpenIcon className="w-24 h-24 text-gray-300 dark:text-gray-700" />
        )}
      </div>

      <div className="text-center">
        <h2 id="book-title" className="text-xl sm:text-2xl font-bold text-dark-text dark:text-light-text">{title}</h2>
        <div className="flex items-center justify-center space-x-2 mt-1">
            <p className="text-subtle-text dark:text-dark-subtle-text">Capítulo {currentChapterIndex + 1} de {totalChapters}</p>
        </div>
      </div>

      {/* Progress Bars */}
       <div className="w-full max-w-sm space-y-3">
        {/* Overall Progress */}
        <div>
            <div id="progress-total-label" className="flex justify-between text-xs text-subtle-text dark:text-dark-subtle-text mb-1">
                <span>Progreso Total</span>
                <span>Cap. {currentChapterIndex + 1} / {totalChapters}</span>
            </div>
            <progress
                className="w-full h-2"
                value={progressPercentage}
                max="100"
                aria-labelledby="progress-total-label"
            >
                {progressPercentage}%
            </progress>
        </div>

        {/* Chapter Progress */}
        <div>
             <div id="progress-capitulo-label" className="flex justify-between text-xs text-subtle-text dark:text-dark-subtle-text mb-1">
                <span>Progreso del Capítulo</span>
                <span>{Math.round(chapterProgressPercentage)}%</span>
            </div>
            <progress
                className="w-full h-1.5 progress-chapter"
                value={chapterProgressPercentage}
                max="100"
                aria-labelledby="progress-capitulo-label"
            >
                {chapterProgressPercentage}%
            </progress>
        </div>
      </div>
      
      {/* Text Display */}
      <div 
        id="current-text-display"
        aria-live="assertive"
        aria-atomic="true"
        className="w-full max-w-sm h-32 sm:h-40 overflow-y-auto bg-light-bg dark:bg-dark-bg rounded-lg p-4 text-dark-text dark:text-light-text text-left border border-border-color dark:border-dark-border-color"
      >
        {currentChunkText ? (
          <p className="leading-relaxed">
            <span className="bg-gray-200 dark:bg-gray-800 text-dark-text dark:text-light-text">{currentChunkText.substring(0, currentCharIndex)}</span>
            <span className="text-subtle-text dark:text-dark-subtle-text">{currentChunkText.substring(currentCharIndex)}</span>
          </p>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-subtle-text dark:text-dark-subtle-text italic text-center">El texto aparecerá aquí mientras se lee...</p>
          </div>
        )}
      </div>

      {error && <p className="text-red-500 text-sm text-center" role="alert">{error}</p>}
      
      {/* Controls */}
      <div className="w-full max-w-sm flex items-center justify-between sm:justify-around">
        <button onClick={handlePrevChapter} aria-label="Capítulo anterior" className="flex flex-col items-center text-subtle-text dark:text-dark-subtle-text hover:text-dark-text dark:hover:text-light-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed" disabled={currentChapterIndex === 0}>
            <RewindIcon className="w-8 h-8 sm:w-10 sm:h-10" />
            <span className="text-xs font-semibold mt-1 uppercase tracking-wider hidden sm:block">Cap. Anterior</span>
        </button>

        <div className="flex items-center justify-center space-x-4">
            <button onClick={() => handleSkipSeconds(-15)} aria-label="Retroceder 15 segundos" className="text-subtle-text dark:text-dark-subtle-text hover:text-dark-text dark:hover:text-light-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed" disabled={!isSpeaking && !isPaused}>
                <Replay15Icon className="w-8 h-8" />
            </button>
            <button
                onClick={handlePlayPause}
                aria-label={isSpeaking ? 'Pausar' : 'Reproducir'}
                aria-pressed={isSpeaking}
                aria-controls="current-text-display"
                className="w-20 h-20 bg-primary-accent dark:bg-dark-primary-accent rounded-full flex items-center justify-center text-light-text dark:text-dark-text hover:bg-opacity-90 transition-all duration-200 transform hover:scale-105 shadow-lg"
            >
                {isSpeaking ? <PauseIcon className="w-10 h-10" /> : <PlayIcon className="w-10 h-10 ml-1" />}
            </button>
            <button onClick={() => handleSkipSeconds(15)} aria-label="Adelantar 15 segundos" className="text-subtle-text dark:text-dark-subtle-text hover:text-dark-text dark:hover:text-light-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed" disabled={!isSpeaking && !isPaused}>
                <Forward15Icon className="w-8 h-8" />
            </button>
        </div>
        
        <button onClick={handleNextChapter} aria-label="Siguiente capítulo" className="flex flex-col items-center text-subtle-text dark:text-dark-subtle-text hover:text-dark-text dark:hover:text-light-text transition-colors disabled:opacity-40 disabled:cursor-not-allowed" disabled={currentChapterIndex >= totalChapters - 1}>
            <ForwardIcon className="w-8 h-8 sm:w-10 sm:h-10" />
            <span className="text-xs font-semibold mt-1 uppercase tracking-wider hidden sm:block">Próximo Cap.</span>
        </button>
      </div>


      {/* Settings */}
      {(voices && voices.length > 0) && (
        <div className="w-full max-w-sm flex flex-col sm:flex-row sm:items-end space-y-6 sm:space-y-0 sm:space-x-4 pt-4 border-t border-border-color dark:border-dark-border-color mt-4">
           <div className="w-full sm:flex-1">
            <label htmlFor="voice-select" className="block text-sm font-medium text-subtle-text dark:text-dark-subtle-text mb-1">Voz</label>
            <select
                id="voice-select"
                value={selectedVoiceURI ?? ''}
                onChange={(e) => setSelectedVoiceURI(e.target.value)}
                className="w-full p-2 border border-border-color dark:border-dark-border-color rounded-md bg-card-bg dark:bg-dark-card-bg focus:outline-none focus:ring-2 focus:ring-primary-accent dark:focus:ring-dark-primary-accent transition-colors"
            >
                {voices.map(voice => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name} ({voice.lang})
                </option>
                ))}
            </select>
           </div>
           <div className="w-full sm:flex-1">
                <label htmlFor="rate-slider" className="block text-sm font-medium text-subtle-text dark:text-dark-subtle-text mb-1">Velocidad ({playbackRate.toFixed(1)}x)</label>
                <input
                    id="rate-slider"
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={playbackRate}
                    onChange={(e) => setPlaybackRate(parseFloat(e.target.value))}
                    className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer dark:bg-dark-border-color accent-primary-accent dark:accent-dark-primary-accent"
                />
           </div>
           <div className="relative w-full sm:w-auto flex flex-col items-center" ref={timerMenuRef}>
              <label className="block text-sm font-medium text-subtle-text dark:text-dark-subtle-text mb-1">Timer</label>
              <button 
                onClick={() => setIsTimerMenuOpen(prev => !prev)} 
                className={`p-2 rounded-md transition-colors ${sleepTimer ? 'text-primary-accent dark:text-dark-primary-accent' : 'text-subtle-text dark:text-dark-subtle-text'} hover:bg-gray-200 dark:hover:bg-gray-700`}
                aria-label="Configurar temporizador de apagado"
              >
                <MoonIcon className="w-6 h-6" />
              </button>
              {typeof sleepTimer === 'number' && (
                <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-xs text-primary-accent dark:text-dark-primary-accent font-semibold">
                  {formatTime(sleepTimer)}
                </span>
              )}
              {isTimerMenuOpen && (
                <div className="absolute bottom-full right-0 sm:right-auto mb-2 w-48 bg-card-bg dark:bg-dark-card-bg rounded-lg shadow-xl border border-border-color dark:border-dark-border-color z-10">
                  <ul className="py-1">
                    <li className="px-3 py-1 text-xs text-subtle-text dark:text-dark-subtle-text">Parar Audio En...</li>
                    <li className="hover:bg-gray-100 dark:hover:bg-gray-700"><button onClick={() => handleSetTimer(15 * 60)} className="w-full text-left px-3 py-1.5">15 minutos</button></li>
                    <li className="hover:bg-gray-100 dark:hover:bg-gray-700"><button onClick={() => handleSetTimer(30 * 60)} className="w-full text-left px-3 py-1.5">30 minutos</button></li>
                    <li className="hover:bg-gray-100 dark:hover:bg-gray-700"><button onClick={() => handleSetTimer(60 * 60)} className="w-full text-left px-3 py-1.5">60 minutos</button></li>
                    <li className="hover:bg-gray-100 dark:hover:bg-gray-700"><button onClick={() => handleSetTimer('end-of-chapter')} className="w-full text-left px-3 py-1.5">Fin del capítulo</button></li>
                    {sleepTimer && <>
                      <li className="h-px bg-border-color dark:bg-dark-border-color my-1"></li>
                      <li className="hover:bg-gray-100 dark:hover:bg-gray-700"><button onClick={() => handleSetTimer(null)} className="w-full text-left px-3 py-1.5 font-bold">Desactivar</button></li>
                    </>}
                  </ul>
                </div>
              )}
           </div>
        </div>
      )}
      <audio 
        ref={silentAudioRef} 
        onEnded={handleSilentAudioLoop}
        src="data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSUNSAAAACgAAADIZNzMxMDYAVFNFAAAAAgAAAzZERBu/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/LADAm/uc/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+9EeqgAAAAIm/uf/+-`
      aria-hidden="true" />
    </div>
  );
};

export default AudioPlayer;