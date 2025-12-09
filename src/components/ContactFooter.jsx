import React from 'react';

const ContactFooter = () => {
  return (
    <footer className="bg-geo-dark text-white pt-20 pb-10" id="contacto">
      <div className="container mx-auto px-4">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">
            
            {/* Columna Izquierda: Información de Contacto */}
            <div>
                <h2 className="text-3xl font-bold mb-6">Hablemos de su próximo proyecto</h2>
                <p className="text-gray-400 mb-8 text-lg">
                    Estamos listos para aportar precisión técnica y control total a su obra.
                    Contáctenos para una evaluación inicial.
                </p>

                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-geo-blue rounded-full flex items-center justify-center text-geo-orange">
                            {/* Icono Mapa */}
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-gray-400 text-sm">Oficinas Centrales</p>
                            <p className="font-semibold">Av. Ingenieros 500, Piso 4, Celaya, Guanajuato.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-geo-blue rounded-full flex items-center justify-center text-geo-orange">
                            {/* Icono Teléfono */}
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-gray-400 text-sm">Llámenos</p>
                            <p className="font-semibold">+52 (55) 1234 - 5678</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Columna Derecha: Formulario */}
            <form className="bg-white/5 p-8 rounded-xl border border-white/10 shadow-2xl">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Nombre Completo</label>
                        <input type="text" className="w-full bg-geo-dark border border-gray-600 rounded px-4 py-3 focus:outline-none focus:border-geo-orange transition text-white" placeholder="Ing. Juan Pérez" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Correo Electrónico</label>
                        <input type="email" className="w-full bg-geo-dark border border-gray-600 rounded px-4 py-3 focus:outline-none focus:border-geo-orange transition text-white" placeholder="correo@empresa.com" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Mensaje o Requerimiento</label>
                        <textarea rows="4" className="w-full bg-geo-dark border border-gray-600 rounded px-4 py-3 focus:outline-none focus:border-geo-orange transition text-white" placeholder="Describa brevemente su proyecto..."></textarea>
                    </div>
                    <button type="button" className="w-full bg-geo-orange text-white font-bold py-3 rounded hover:bg-orange-600 transition shadow-lg mt-2">
                        Enviar Mensaje
                    </button>
                </div>
            </form>

        </div>

        {/* --- CAMBIO: Solo mostramos el Copyright centrado --- */}
        <div className="border-t border-gray-800 pt-8 text-center text-gray-500 text-sm">
            <p>&copy; 2024 Geo Control Dom. Todos los derechos reservados.</p>
        </div>

      </div>
    </footer>
  );
};

export default ContactFooter;