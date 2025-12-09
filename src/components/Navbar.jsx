import React, { useState, useEffect } from 'react';
import { API_URL } from '../utils/api';

const Navbar = () => {
  // --- ESTADOS ---
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // 1. NUEVO ESTADO: Para saber si estamos logueados y forzar el renderizado
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // --- LÓGICA ---
  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  // 2. EFECTO: Detectar sesión al cargar la página
  useEffect(() => {
    // Verificamos si existe el token
    const token = localStorage.getItem('geoToken');
    // Convertimos a boolean (si hay texto es true, si es null es false)
    setIsLoggedIn(!!token); 
  }, []);

  const fetchNotifications = async () => {
    const token = localStorage.getItem('geoToken');
    if (!token) return; 

    try {
      const res = await fetch(`${API_URL}/notifications`, {
      headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.status === 403 || res.status === 401) {
          localStorage.removeItem('geoToken');
          localStorage.removeItem('geoUser');
          setIsLoggedIn(false); // Actualizamos el estado visual
          return;
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        setNotifications(data);
        setUnreadCount(data.filter(n => n.is_read === 0).length);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (isLoggedIn) { // Solo buscamos notificaciones si estamos logueados
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 10000);
        return () => clearInterval(interval);
    }
  }, [isLoggedIn]); // Se ejecuta cuando cambia el estado de login

  const handleNotifClick = async (notif) => {
    if (notif.is_read === 0) {
        const token = localStorage.getItem('geoToken');
        try {
            await fetch(`http://localhost:3001/notifications/${notif.id}/read`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const newNotifs = notifications.map(n => 
                n.id === notif.id ? {...n, is_read: 1} : n
            );
            setNotifications(newNotifs);
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (e) { console.error(e); }
    }
  };

  // --- RENDERIZADO (JSX) ---
  return (
    <nav className="bg-geo-dark p-4 shadow-lg fixed w-full z-50 top-0">
      <div className="container mx-auto flex justify-between items-center text-white">
        
      {/* LOGO + TEXTO SIMPLE (Sin inventar cosas nuevas) */}
        <a 
          href="/#inicio" 
          className="flex items-center gap-3 z-50 cursor-pointer" // Flex alinea verticalmente al centro
          onClick={() => setIsOpen(false)} 
        >
          {/* 1. TU LOGO (Asegúrate de que 'logo.png' esté en la carpeta public) */}
          <img 
            src="/logo.png" 
            alt="Logo" 
            className="h-10 w-auto object-contain" 
          />

          {/* 2. TU TEXTO EXACTO */}
          <span className="text-2xl font-bold tracking-wider text-white hover:text-geo-orange transition duration-300">
            GEO CONTROL DOM
          </span>
        </a>

        {/* BARRA DERECHA */}
        <div className="flex items-center gap-4">

            {/* 3. AQUÍ USAMOS EL NUEVO ESTADO EN EL JSX */}
            {isLoggedIn && (
                <div className="relative">
                    <button 
                        onClick={() => setShowNotifMenu(!showNotifMenu)}
                        className="text-white hover:text-geo-orange transition relative p-1"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                        </svg>
                        
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse border-2 border-geo-dark">
                                {unreadCount}
                            </span>
                        )}
                    </button>

                    {showNotifMenu && (
                        <div className="absolute right-0 mt-3 w-80 bg-white rounded-lg shadow-2xl overflow-hidden border border-gray-200 z-50 animate-fadeIn top-full">
                            <div className="bg-gray-100 p-3 text-geo-dark text-sm font-bold flex justify-between border-b">
                                <span>Notificaciones</span>
                                <button onClick={fetchNotifications} className="text-xs text-blue-600 hover:underline">🔄</button>
                            </div>
                            <div className="max-h-64 overflow-y-auto">
                                {notifications.length === 0 ? (
                                    <p className="p-4 text-center text-gray-400 text-xs">Sin novedades.</p>
                                ) : (
                                    notifications.map(n => (
                                        <div 
                                            key={n.id} 
                                            onClick={() => handleNotifClick(n)} 
                                            className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 flex gap-2 ${n.is_read ? 'opacity-50 bg-white' : 'bg-blue-50'}`}
                                        >
                                            <div className={`w-2 h-2 mt-1 rounded-full shrink-0 ${n.type==='warning'?'bg-red-500':'bg-blue-500'}`}></div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-800">{n.title}</p>
                                                <p className="text-[11px] text-gray-600 leading-tight">{n.message}</p>
                                                <p className="text-[9px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* MENÚ DE ESCRITORIO */}
            <div className="hidden md:flex items-center space-x-6">
                <a href="/#servicios" className="hover:text-geo-orange transition cursor-pointer">Servicios</a>
                <a href="/#proyectos" className="hover:text-geo-orange transition cursor-pointer">Proyectos</a>
                <a href="/#nosotros" className="hover:text-geo-orange transition cursor-pointer">Nosotros</a>
                
                {/* 4. BOTÓN DE ACCESO (ICONO O TEXTO SEGÚN LOGIN) */}
                {isLoggedIn ? (
                     <a href="/dashboard" className="text-green-400 hover:text-white transition" title="Ir al Panel">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                        </svg>
                     </a>
                ) : (
                    <a href="/login" className="text-gray-400 hover:text-white transition" title="Acceso Administrativo">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                    </a>
                )}

                <a href="/#contacto" className="bg-geo-orange px-5 py-2 rounded font-semibold hover:bg-orange-600 transition duration-300 cursor-pointer">
                  Contacto
                </a>
            </div>

            {/* BOTÓN HAMBURGUESA */}
            <button 
              className="md:hidden z-50 focus:outline-none text-white"
              onClick={toggleMenu}
            >
              {isOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              )}
            </button>
        </div>

        {/* MENÚ MÓVIL */}
        <div className={`fixed inset-0 bg-geo-dark/95 backdrop-blur-sm flex flex-col items-center justify-center space-y-8 text-2xl transition-transform duration-300 md:hidden ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <a href="/#servicios" onClick={toggleMenu} className="hover:text-geo-orange transition">Servicios</a>
            <a href="/#proyectos" onClick={toggleMenu} className="hover:text-geo-orange transition">Proyectos</a>
            <a href="/#nosotros" onClick={toggleMenu} className="hover:text-geo-orange transition">Nosotros</a>
            
            <a href={isLoggedIn ? "/dashboard" : "/login"} onClick={toggleMenu} className="flex items-center gap-2 text-gray-300 hover:text-white transition border border-gray-600 px-6 py-2 rounded-full">
                {isLoggedIn ? "Ir al Sistema" : "Acceso Personal"}
            </a>

            <a href="/#contacto" onClick={toggleMenu} className="bg-geo-orange px-8 py-3 rounded font-semibold hover:bg-orange-600 transition">
              Contacto
            </a>
        </div>

      </div>
    </nav>
  );
};

export default Navbar;