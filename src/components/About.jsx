import React from 'react';

const About = () => {
  return (
    <section id="nosotros" className="py-20 bg-white">
      <div className="container mx-auto px-4">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            
            {/* Columna Izquierda: Imagen Corporativa */}
            <div className="relative">
                {/* Imagen principal */}
                <img 
                    src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=2070&auto=format&fit=crop" 
                    alt="Ingenieros en obra" 
                    className="rounded-lg shadow-2xl w-full object-cover h-[500px]"
                />
                
                {/* Cuadro decorativo flotante (Experiencia) */}
                <div className="absolute -bottom-6 -right-6 bg-geo-orange text-white p-6 rounded-lg shadow-xl hidden md:block">
                    <p className="text-4xl font-bold">15+</p>
                    <p className="text-sm font-medium uppercase tracking-wide">Años de Experiencia</p>
                </div>
            </div>

            {/* Columna Derecha: Texto */}
            <div>
                <span className="text-geo-orange font-bold uppercase tracking-wider text-sm">
                    Sobre Geo Control Dom
                </span>
                <h2 className="text-3xl md:text-4xl font-bold text-geo-dark mt-2 mb-6">
                    Liderazgo técnico en supervisión y control de obras.
                </h2>
                <p className="text-gray-600 mb-6 text-lg leading-relaxed">
                    Somos una firma especializada en la Dirección de Obra Maestra (DOM) y control de calidad geotécnico. 
                    Nuestra misión es mitigar riesgos constructivos mediante una supervisión rigurosa y tecnología de precisión.
                </p>
                <p className="text-gray-600 mb-8 leading-relaxed">
                    Desde grandes infraestructuras viales hasta edificaciones verticales, nuestro equipo de ingenieros certificados garantiza que cada centímetro de su proyecto cumpla con las normativas vigentes y los más altos estándares de seguridad.
                </p>

                {/* Lista de valores / Puntos clave */}
                <div className="space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="mt-1 w-6 h-6 bg-geo-blue/10 rounded-full flex items-center justify-center text-geo-blue">
                            ✓
                        </div>
                        <div>
                            <h4 className="font-bold text-geo-dark">Certificación Técnica</h4>
                            <p className="text-sm text-gray-500">Personal acreditado y laboratorios certificados.</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <div className="mt-1 w-6 h-6 bg-geo-blue/10 rounded-full flex items-center justify-center text-geo-blue">
                            ✓
                        </div>
                        <div>
                            <h4 className="font-bold text-geo-dark">Tecnología de Vanguardia</h4>
                            <p className="text-sm text-gray-500">Uso de software especializado para reportes en tiempo real.</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
      </div>
    </section>
  );
};

export default About;