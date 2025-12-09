import React from 'react';

// 1. Datos de los servicios (Esto simula una base de datos)
const servicesData = [
  {
    id: 1,
    title: "Dirección de Obra (DOM)",
    description: "Supervisión técnica integral para asegurar el cumplimiento de planos, normas y cronogramas en cada etapa de la construcción.",
    iconPath: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" // Icono de edificio
  },
  {
    id: 2,
    title: "Control de Calidad y Materiales",
    description: "Verificación rigurosa de materiales (concreto, acero, suelos) mediante pruebas de laboratorio certificadas y normativa vigente.",
    iconPath: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" // Icono de Checkmark
  },
  {
    id: 3,
    title: "Estudios Geotécnicos y Suelos",
    description: "Análisis del terreno y mecánica de suelos para garantizar cimentaciones seguras y estables. La base de 'Geo' Control.",
    iconPath: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" // Icono de Mundo/Geo
  },
];


const Services = () => {
  return (
    // Sección principal con fondo gris claro para contrastar
    <section className="py-20 bg-gray-50" id="servicios">
      <div className="container mx-auto px-4">
        
        {/* Título de la sección */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-geo-dark uppercase tracking-wider mb-4">
            Nuestras Especialidades
          </h2>
          <div className="w-24 h-1 bg-geo-orange mx-auto"></div> {/* Línea decorativa naranja */}
          <p className="text-geo-gray mt-4 max-w-2xl mx-auto">
            Soluciones técnicas integrales para garantizar la seguridad y calidad de su infraestructura.
          </p>
        </div>

        {/* GRD: Aquí está la magia de Tailwind */}
        {/* grid-cols-1 = 1 columna en celular */}
        {/* md:grid-cols-3 = 3 columnas en pantallas medianas (tablets/PC) en adelante */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Mapeamos los datos para crear las tarjetas */}
          {servicesData.map((service) => (
            <div key={service.id} className="bg-white p-8 rounded-xl shadow-md hover:shadow-2xl transition-shadow duration-300 border-b-4 border-transparent hover:border-geo-orange group">
                {/* Ícono SVG (Cambia de color al pasar el mouse gracias a 'group-hover') */}
                <div className="w-16 h-16 mb-6 text-geo-blue group-hover:text-geo-orange transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-full h-full">
                        <path strokeLinecap="round" strokeLinejoin="round" d={service.iconPath} />
                    </svg>
                </div>
              
              <h3 className="text-xl font-bold text-geo-dark mb-4 group-hover:text-geo-blue transition">
                {service.title}
              </h3>
              <p className="text-geo-gray leading-relaxed">
                {service.description}
              </p>
            </div>
          ))}

        </div>
      </div>
    </section>
  );
};

export default Services;