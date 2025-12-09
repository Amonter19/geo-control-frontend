import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { API_URL } from '../utils/api';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Función que se ejecuta al darle "Ingresar"
  const handleLogin = async (e) => {
    e.preventDefault();
    
    try {
        // 1. Enviamos los datos al Backend
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }) // Enviamos lo que escribiste
        });

        const data = await response.json();

        if (data.success) {
        // toast.success("¡Bienvenido!"); // Opcional
        localStorage.setItem('geoUser', JSON.stringify(data.user));
        localStorage.setItem('geoToken', data.token);
        navigate('/dashboard');
    } else {
        // ANTES: alert("❌ Error: " + data.message);
        toast.error("Error: " + data.message); // AHORA
    }

} catch (error) {
    console.error("Error de conexión:", error);
    // ANTES: alert("❌ No se pudo conectar...");
    toast.error("No se pudo conectar con el servidor."); // AHORA
}
  };

  return (
    <div className="min-h-screen bg-geo-dark flex items-center justify-center px-4">
      
      {/* Tarjeta del Formulario */}
      <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-md border-t-4 border-geo-orange">
        
        <h2 className="text-3xl font-bold text-geo-dark text-center mb-2">
            Acceso Privado
        </h2>
        <p className="text-gray-500 text-center mb-8">
            Sistema de Gestión Geo Control Dom
        </p>

        <form onSubmit={handleLogin} className="space-y-6">
          
          {/* Campo Email */}
          <div>
            <label className="block text-gray-700 font-bold mb-2 text-sm uppercase tracking-wide">
                Correo Electrónico
            </label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded border border-gray-300 focus:border-geo-blue focus:ring-2 focus:ring-blue-100 outline-none transition text-geo-dark"
              placeholder="ingeniero@geocontrol.com"
              required
            />
          </div>

          {/* Campo Password */}
          <div>
            <label className="block text-gray-700 font-bold mb-2 text-sm uppercase tracking-wide">
                Contraseña
            </label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded border border-gray-300 focus:border-geo-blue focus:ring-2 focus:ring-blue-100 outline-none transition text-geo-dark"
              placeholder="••••••••"
              required
            />
          </div>

          {/* Botón Entrar */}
          <button 
            type="submit"
            className="w-full bg-geo-blue text-white font-bold py-3 rounded hover:bg-blue-900 transition duration-300 shadow-lg transform hover:-translate-y-1"
          >
            INGRESAR AL SISTEMA
          </button>
        </form>
        
        {/* Enlace para volver */}
        <div className="mt-8 text-center border-t border-gray-100 pt-6">
            <a href="/" className="text-sm text-gray-400 hover:text-geo-orange flex items-center justify-center gap-2 transition">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Volver al sitio web
            </a>
        </div>

      </div>
    </div>
  );
};

export default Login;