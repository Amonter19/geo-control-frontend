import React from 'react';

const projects = [
  {
    id: 1,
    title: "Puente Vial Norte",
    category: "Infraestructura",
    image: "https://images.unsplash.com/photo-1545558014-8692077e9b5c?q=80&w=2070&auto=format&fit=crop", 
},
  {
    id: 2,
    title: "Torre Residencial Altos",
    category: "Edificación Vertical",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop", // Edificio alto
  },
  {
    id: 3,
    title: "Estabilización de Taludes",
    category: "Geotecnia",
    image: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=2069&auto=format&fit=crop", // Tierra/Excavadora
  },
  {
    id: 4,
    title: "Nave Industrial Fénix",
    category: "Obra Industrial",
    image: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=2070&auto=format&fit=crop", // Estructura acero
  },
];

const Projects = () => {
  return (
    <section className="py-20 bg-white" id="proyectos">
      <div className="container mx-auto px-4">
        
        {/* Cabecera de Sección */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
            <div className="max-w-xl">
                <h2 className="text-3xl md:text-4xl font-bold text-geo-dark uppercase tracking-wider mb-2">
                    Proyectos Destacados
                </h2>
                <div className="w-24 h-1 bg-geo-orange mb-4"></div>
                <p className="text-geo-gray">
                    Nuestra experiencia en campo respalda cada decisión técnica.
                </p>
            </div>
            <a 
    href="#contacto" 
    className="bg-geo-blue text-white px-6 py-2 rounded font-bold hover:bg-blue-900 transition shadow-md inline-block text-center"
>
    Solicitar Portafolio Completo
</a>
        </div>

        {/* Grid de Proyectos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {projects.map((project) => (
                // 'group' permite que la imagen reaccione cuando tocas la tarjeta entera
                <div key={project.id} className="group relative overflow-hidden rounded-xl shadow-lg cursor-pointer h-80">
                    
                    {/* Imagen con efecto Zoom */}
                    <img 
                        src={project.image} 
                        alt={project.title} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />

                    {/* Capa oscura que aparece al pasar el mouse (Hover Overlay) */}
                    <div className="absolute inset-0 bg-gradient-to-t from-geo-dark/90 to-transparent opacity-80 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                        <span className="text-geo-orange font-bold text-sm uppercase mb-1">
                            {project.category}
                        </span>
                        <h3 className="text-white text-xl font-bold">
                            {project.title}
                        </h3>
                    </div>

                    {/* Texto visible siempre en móvil (opcional, aquí lo dejé integrado en el overlay) */}
                    {/* Nota: En móvil el overlay está siempre visible (opacity-80) para que se lea el texto */}
                </div>
            ))}
        </div>

      </div>
    </section>
  );
};

export default Projects;