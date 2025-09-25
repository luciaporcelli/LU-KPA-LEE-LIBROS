import React, { useState, useCallback, useRef } from 'react';
import { UploadIcon, ArrowLeftIcon } from './Icons';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onCancel: () => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, onCancel }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File | null | undefined) => {
    if (file && file.type === 'application/epub+zip') {
      onFileSelect(file);
    } else {
      alert('Por favor, sube un archivo .epub válido.');
    }
  }, [onFileSelect]);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  }

  return (
    <div>
        <button onClick={onCancel} className="flex items-center space-x-2 text-subtle-text dark:text-dark-subtle-text hover:text-dark-text dark:hover:text-light-text mb-4 transition-colors">
            <ArrowLeftIcon className="w-5 h-5" />
            <span>Volver a la Biblioteca</span>
        </button>
        <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label="Zona para arrastrar y soltar o hacer clic para seleccionar un archivo EPUB"
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-primary-accent dark:focus:ring-dark-primary-accent ${isDragging ? 'border-primary-accent bg-gray-100 dark:border-dark-primary-accent dark:bg-dark-card-bg' : 'border-border-color dark:border-dark-border-color hover:border-dark-text dark:hover:border-light-text'}`}
        >
        <div className="flex flex-col items-center justify-center space-y-4">
            <UploadIcon className="w-16 h-16 text-subtle-text" />
            <p className="text-subtle-text dark:text-dark-subtle-text">
            <span className="font-semibold text-dark-text dark:text-light-text">Haz clic para subir</span> o arrastra y suelta
            </p>
            <p className="text-xs text-subtle-text dark:text-dark-subtle-text">Solo formato de archivo EPUB</p>
            <input
                ref={fileInputRef}
                type="file"
                id="file-upload"
                className="hidden"
                accept=".epub"
                onChange={handleFileChange}
            />
            <label
                htmlFor="file-upload"
                className="cursor-pointer px-6 py-2 bg-primary-accent text-light-text dark:bg-dark-primary-accent dark:text-dark-text font-semibold rounded-md hover:bg-opacity-90 transition-all duration-200"
            >
                Seleccionar archivo
            </label>
        </div>
        </div>
    </div>
  );
};

export default FileUpload;