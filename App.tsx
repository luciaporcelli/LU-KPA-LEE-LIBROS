import React, { useState, useCallback, useEffect } from 'react';
import { useEpubParser } from './hooks/useEpubParser';
import FileUpload from './components/FileUpload';
import AudioPlayer from './components/AudioPlayer';
import Loader from './components/Loader';
import Library from './components/Library';
import type { EpubData } from './types';
import { SunIcon, MoonIcon } from './components/Icons';
import { useTheme } from './hooks/useTheme';

type View = 'library' | 'upload' | 'player' | 'loading';

const App: React.FC = () => {
  const [view, setView] = useState<View>('loading');
  const [library, setLibrary] = useState<EpubData[]>([]);
  const [selectedBook, setSelectedBook] = useState<EpubData | null>(null);
  const [fileToParse, setFileToParse] = useState<File | null>(null);

  const { theme, toggleTheme } = useTheme();
  const { epubData, isLoading, error, reset: resetParser } = useEpubParser(fileToParse);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, []);

  // Load library from local storage on initial mount
  useEffect(() => {
    try {
      const savedLibrary = localStorage.getItem('lukpaleelibros-library');
      if (savedLibrary) {
        setLibrary(JSON.parse(savedLibrary));
      }
    } catch (e) {
      console.error("No se pudo cargar la biblioteca:", e);
      setLibrary([]);
    }
    setView('library');
  }, []);

  // Save library to local storage whenever it changes
  useEffect(() => {
    try {
        if (view !== 'loading') { // Avoid saving initial empty state
             localStorage.setItem('lukpaleelibros-library', JSON.stringify(library));
        }
    } catch (e) {
      console.error("No se pudo guardar la biblioteca:", e);
    }
  }, [library, view]);
  
  // Effect to handle book parsing result
  useEffect(() => {
    if (epubData) {
      setLibrary(prev => {
        // Avoid duplicates
        if (prev.some(book => book.filename === epubData.filename)) {
          return prev;
        }
        return [...prev, epubData];
      });
      setSelectedBook(epubData);
      setView('player');
      setFileToParse(null);
      resetParser();
    }
  }, [epubData, resetParser]);

  const handleFileSelect = useCallback((file: File) => {
    setView('loading');
    setFileToParse(file);
  }, []);

  const handleBookSelect = useCallback((book: EpubData) => {
    setSelectedBook(book);
    setView('player');
  }, []);

  const handleBookDelete = (filename: string) => {
    setLibrary(prev => prev.filter(book => book.filename !== filename));
    // Also remove its progress
    localStorage.removeItem(`lukpaleelibros-progress-${filename}`);
  };

  const handleBackToLibrary = useCallback(() => {
    setSelectedBook(null);
    setView('library');
  }, []);

  const renderContent = () => {
    if (view === 'loading' || isLoading) {
      return <Loader message="Procesando tu EPUB..." />;
    }
    if (error) {
      return (
        <div className="text-center text-red-500" role="alert">
          <p>Error: {error}</p>
          <button
            onClick={() => {
                resetParser();
                setView('library');
            }}
            className="mt-4 px-4 py-2 bg-primary-accent text-light-text dark:bg-dark-primary-accent dark:text-dark-text rounded-lg hover:bg-opacity-90 transition-colors"
          >
            Volver a la Biblioteca
          </button>
        </div>
      );
    }
    
    switch(view) {
        case 'library':
            return <Library books={library} onSelectBook={handleBookSelect} onAddBook={() => setView('upload')} onDeleteBook={handleBookDelete} />;
        case 'upload':
            return <FileUpload onFileSelect={handleFileSelect} onCancel={() => setView('library')} />;
        case 'player':
            if (selectedBook) {
                return <AudioPlayer epubData={selectedBook} onBackToLibrary={handleBackToLibrary} />;
            }
            // Fallback to library if no book is selected
            setView('library');
            return null;
        default:
            return <p>Estado inesperado</p>;
    }
  };

  return (
    <div className="min-h-screen bg-light-bg dark:bg-dark-bg flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 font-sans transition-colors duration-300">
      <div className="w-full max-w-2xl mx-auto relative">
        <button
            onClick={toggleTheme}
            className="absolute top-0 right-0 p-2 text-subtle-text dark:text-dark-subtle-text hover:text-primary-accent dark:hover:text-dark-primary-accent transition-colors"
            aria-label="Cambiar tema de color"
        >
            {theme === 'dark' ? <SunIcon className="w-6 h-6" /> : <MoonIcon className="w-6 h-6" />}
        </button>
        <header className="text-center mb-6 sm:mb-8">
          <h1 className="text-4xl sm:text-5xl font-light text-dark-text dark:text-light-text tracking-tight uppercase">
            LUKPALEE<span className="font-bold">LIBROS</span>
          </h1>
          <p className="mt-2 text-lg text-subtle-text dark:text-dark-subtle-text">
            Convierte tus ebooks en audiolibros, al instante.
          </p>
        </header>
        <main className="bg-card-bg dark:bg-dark-card-bg rounded-xl shadow-lg p-4 sm:p-8">
          {renderContent()}
        </main>
        <footer className="text-center mt-8 text-subtle-text dark:text-dark-subtle-text text-sm">
          <p>&copy; {new Date().getFullYear()} LUKPALEELIBROS. Todos los derechos reservados.</p>
        </footer>
      </div>
    </div>
  );
};

export default App;