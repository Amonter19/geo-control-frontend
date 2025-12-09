import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
      
      {/* Icono Temático Animado */}
      <div className="mb-8 animate-bounce">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-32 h-32 text-geo-orange">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>

      {/* Texto Principal */}
      <h1 className="text-6xl font-extrabold text-geo-dark mb-2">404</h1>
      <h2 className="text-2xl md:text-3xl font-bold text-gray-700 mb-4">
        ¡Vaya! Te has perdido en la obra.
      </h2>
      
      <p className="text-gray-500 max-w-md mb-8 text-lg">
        La página que buscas no existe, fue movida o está en construcción.
        Mejor regresemos a terreno seguro.
      </p>

      {/* Botones de Acción */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Link 
            to="/dashboard" 
            className="px-8 py-3 bg-geo-blue text-white rounded-lg font-bold hover:bg-blue-900 transition shadow-lg hover:-translate-y-1"
        >
            Ir al Dashboard
        </Link>
        
        <Link 
            to="/" 
            className="px-8 py-3 bg-white text-geo-dark border border-gray-300 rounded-lg font-bold hover:bg-gray-50 transition hover:-translate-y-1"
        >
            Volver al Inicio
        </Link>
      </div>

      {/* Footer decorativo */}
      <div className="mt-12 text-sm text-gray-400">
        Error: PAGE_NOT_FOUND_ON_SITE
      </div>

    </div>
  );
};

export default NotFound;