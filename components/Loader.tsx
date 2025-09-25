import React from 'react';

interface LoaderProps {
  message?: string;
}

const Loader: React.FC<LoaderProps> = ({ message = 'Cargando...' }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <div className="w-12 h-12 border-4 border-border-color dark:border-dark-border-color border-t-dark-text dark:border-t-light-text rounded-full animate-spin"></div>
      <p className="text-subtle-text dark:text-dark-subtle-text">{message}</p>
    </div>
  );
};

export default Loader;