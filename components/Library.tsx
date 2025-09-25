import React from 'react';
import type { EpubData } from '../types';
import { BookOpenIcon, PlusIcon, TrashIcon } from './Icons';

interface LibraryProps {
  books: EpubData[];
  onSelectBook: (book: EpubData) => void;
  onAddBook: () => void;
  onDeleteBook: (filename: string) => void;
}

const Library: React.FC<LibraryProps> = ({ books, onSelectBook, onAddBook, onDeleteBook }) => {

  const handleDelete = (e: React.MouseEvent, filename: string) => {
    e.stopPropagation(); // Prevent onSelectBook from firing
    if (window.confirm('¿Estás seguro de que quieres eliminar este libro?')) {
      onDeleteBook(filename);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-dark-text dark:text-light-text mb-6">Mi Biblioteca</h2>
      {books.length === 0 ? (
         <button 
            type="button"
            onClick={onAddBook}
            className="w-full flex flex-col items-center justify-center p-10 border-2 border-dashed border-border-color dark:border-dark-border-color rounded-lg text-center cursor-pointer hover:border-dark-text dark:hover:border-light-text hover:bg-card-bg dark:hover:bg-dark-card-bg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-accent dark:focus:ring-dark-primary-accent"
        >
            <BookOpenIcon className="w-16 h-16 text-subtle-text mb-4" />
            <h3 className="text-lg font-semibold text-dark-text dark:text-light-text">Tu biblioteca está vacía</h3>
            <p className="text-subtle-text dark:text-dark-subtle-text mt-1">Haz clic aquí para añadir tu primer libro.</p>
        </button>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
          {books.map(book => (
            <div key={book.filename} className="group relative">
                <button 
                    type="button"
                    onClick={() => onSelectBook(book)} 
                    aria-label={`Seleccionar libro: ${book.title}`}
                    className="w-full aspect-[2/3] bg-gray-100 dark:bg-dark-bg rounded-lg shadow-md overflow-hidden cursor-pointer transform hover:-translate-y-1 transition-transform duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-accent dark:focus:ring-offset-dark-bg"
                >
                {book.coverUrl ? (
                    <img src={book.coverUrl} alt={`Portada de ${book.title}`} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-2">
                        <BookOpenIcon className="w-10 h-10 text-subtle-text" />
                        <span className="text-center text-sm text-subtle-text mt-2">{book.title}</span>
                    </div>
                )}
                </button>
                 <button 
                    onClick={(e) => handleDelete(e, book.filename)}
                    className="absolute top-1 right-1 bg-black/60 p-1.5 rounded-full text-white opacity-0 group-hover:opacity-100 hover:bg-black/80 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-accent dark:focus:ring-dark-primary-accent"
                    aria-label={`Eliminar libro: ${book.title}`}
                >
                    <TrashIcon className="w-4 h-4" />
                </button>
            </div>
          ))}
          <button 
            type="button"
            onClick={onAddBook}
            className="aspect-[2/3] border-2 border-dashed border-border-color dark:border-dark-border-color rounded-lg flex items-center justify-center cursor-pointer text-subtle-text hover:text-dark-text dark:hover:text-light-text hover:border-dark-text dark:hover:border-light-text transition-colors focus:outline-none focus:ring-2 focus:ring-primary-accent dark:focus:ring-dark-primary-accent"
            aria-label="Añadir nuevo libro"
            >
            <PlusIcon className="w-10 h-10" />
          </button>
        </div>
      )}
    </div>
  );
};

export default Library;