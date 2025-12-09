import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const Register = () => {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    first_name: '',
    last_name_paternal: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'cliente' // Por defecto
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      return toast.error("Las contraseñas no coinciden");
    }
    if (formData.password.length < 6) {
      return toast.error("La contraseña es muy corta (mínimo 6)");
    }

    try {
      // Enviamos datos al endpoint PÚBLICO de usuarios
      const response = await fetch('http://localhost:3001/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            first_name: formData.first_name,
            last_name_paternal: formData.last_name_paternal,
            email: formData.email,
            password: formData.password,
            role: formData.role,
            // Campos opcionales vacíos
            middle_name: '', 
            last_name_maternal: '',
            phone_mobile: '',
            phone_home: '',
            occupation: ''
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success("¡Cuenta creada! Inicia sesión.");
        navigate('/login');
      } else {
        toast.error("Error: " + (data.error || "No se pudo registrar."));
      }

    } catch (error) {
      console.error(error);
      toast.error("Error de conexión con el servidor.");
    }
  };

  return (
    <div className="min-h-screen bg-geo-dark flex items-center justify-center px-4 py-12">
      <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-md border-t-4 border-geo-orange">
        
        <h2 className="text-3xl font-bold text-geo-dark text-center mb-2">Crear Cuenta</h2>
        <p className="text-gray-500 text-center mb-8">Únete a Geo Portal</p>

        <form onSubmit={handleRegister} className="space-y-4">
          
          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-gray-700 font-bold mb-1 text-xs uppercase">Nombre</label>
                <input 
                    type="text" name="first_name"
                    value={formData.first_name} onChange={handleChange}
                    className="w-full px-4 py-2 rounded border focus:border-geo-blue outline-none"
                    required
                />
            </div>
            <div>
                <label className="block text-gray-700 font-bold mb-1 text-xs uppercase">Apellido</label>
                <input 
                    type="text" name="last_name_paternal"
                    value={formData.last_name_paternal} onChange={handleChange}
                    className="w-full px-4 py-2 rounded border focus:border-geo-blue outline-none"
                    required
                />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1 text-xs uppercase">Correo Electrónico</label>
            <input 
                type="email" name="email"
                value={formData.email} onChange={handleChange}
                className="w-full px-4 py-2 rounded border focus:border-geo-blue outline-none"
                required
            />
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1 text-xs uppercase">Soy...</label>
            <select 
                name="role" value={formData.role} onChange={handleChange}
                className="w-full px-4 py-2 rounded border bg-gray-50 focus:border-geo-blue outline-none"
            >
                <option value="cliente">Cliente (Dueño de Obra)</option>
                <option value="ingeniero">Ingeniero / Arquitecto</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1 text-xs uppercase">Contraseña</label>
            <input 
                type="password" name="password"
                value={formData.password} onChange={handleChange}
                className="w-full px-4 py-2 rounded border focus:border-geo-blue outline-none"
                required
            />
          </div>

          <div>
            <label className="block text-gray-700 font-bold mb-1 text-xs uppercase">Confirmar Contraseña</label>
            <input 
                type="password" name="confirmPassword"
                value={formData.confirmPassword} onChange={handleChange}
                className="w-full px-4 py-2 rounded border focus:border-geo-blue outline-none"
                required
            />
          </div>

          <button 
            type="submit"
            className="w-full bg-geo-orange text-white font-bold py-3 rounded hover:bg-orange-600 transition shadow-lg mt-4"
          >
            REGISTRARSE
          </button>
        </form>

        <div className="mt-6 text-center border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-600">
                ¿Ya tienes cuenta?{' '}
                <Link to="/login" className="text-geo-blue font-bold hover:underline">
                    Inicia Sesión aquí
                </Link>
            </p>
        </div>

      </div>
    </div>
  );
};

export default Register;