import React from 'react';
// 1. Importamos las herramientas de navegación
import { BrowserRouter, Routes, Route } from 'react-router-dom';
// 2. Importamos las notificaciones (NUEVO)
import { Toaster } from 'react-hot-toast';

// 3. Importamos tus componentes
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import About from './components/About';
import Services from './components/Services';
import Projects from './components/Projects';
import ContactFooter from './components/ContactFooter';

// 4. Importamos tus páginas
import Login from './pages/Login';
import Register from './pages/Register'; // (Agregado previamente)
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound'; // (NUEVO)

// 5. Definimos qué es la página de "Inicio" (Tu Landing Page completa)
const Home = () => {
  return (
    <div className="font-sans antialiased bg-gray-50">
      <Navbar />
      <Hero />
      <About />
      <Services />
      <Projects />
      <ContactFooter />
    </div>
  );
};

// 6. Configuración principal de rutas
function App() {
  return (
    <BrowserRouter>
      
      {/* Configuración Global de Notificaciones (Toast) */}
      <Toaster 
         position="top-center" 
         reverseOrder={false} 
         toastOptions={{
            duration: 4000,
            style: {
               background: '#333',
               color: '#fff',
            },
            success: {
               style: {
                 background: '#dcfce7', // Verde claro
                 color: '#166534',      // Verde oscuro
                 border: '1px solid #86efac'
               },
            },
            error: {
               style: {
                 background: '#fee2e2', // Rojo claro
                 color: '#991b1b',      // Rojo oscuro
                 border: '1px solid #fca5a5'
               },
            },
         }}
      />

      <Routes>
        {/* Si la ruta es "/" muestra el Home */}
        <Route path="/" element={<Home />} />
        
        {/* Rutas de Autenticación */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Ruta Privada */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* --- RUTA COMODÍN (404) --- */}
        {/* Esta ruta atrapa cualquier dirección que no exista arriba */}
        <Route path="*" element={<NotFound />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;