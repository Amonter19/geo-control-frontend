import React from 'react';

const Hero = () => {
  return (
    // Asegúrate de que este ID="inicio" exista para que el botón del Navbar funcione
    <div id="inicio" className="relative h-screen flex items-center justify-center text-white">
      
      {/* 1. Imagen de Fondo */}
      <div 
        className="absolute inset-0 bg-cover bg-center z-0"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1541888946425-d81bb19240f5?q=80&w=2070&auto=format&fit=crop')" }}
      ></div>
      
      {/* 2. Capa oscura (Overlay) */}
      <div className="absolute inset-0 bg-geo-blue/80 z-10"></div>

      {/* 3. El Contenido Principal */}
      <div className="relative z-20 text-center px-4 max-w-4xl mx-auto">
        <span className="uppercase tracking-widest text-geo-orange font-bold mb-4 block">
            Control • Supervisión • Calidad
        </span>
        <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
          Ingeniería de Precisión para su Obra
        </h1>
        <p className="text-xl text-gray-200 mb-8 max-w-2xl mx-auto">
          Especialistas en Dirección de Obra (DOM) y control geotécnico. 
          Garantizamos el cumplimiento normativo y la seguridad de su proyecto.
        </p>
        
        {/* --- AQUÍ ESTÁ EL CAMBIO --- */}
        <div className="flex flex-col md:flex-row gap-4 justify-center">
            {/* Botón 1: Lleva al contacto */}
            <a 
                href="#contacto" 
                className="bg-geo-orange px-8 py-4 rounded text-lg font-bold hover:bg-orange-600 transition shadow-lg cursor-pointer inline-block"
            >
                Solicitar Cotización
            </a>
            
            {/* Botón 2: Lleva a servicios */}
            <a 
                href="#servicios" 
                className="border-2 border-white px-8 py-4 rounded text-lg font-bold hover:bg-white hover:text-geo-blue transition cursor-pointer inline-block"
            >
                Ver Servicios
            </a>
        </div>
        {/* --------------------------- */}

      </div>
    </div>
  );
};

export default Hero;