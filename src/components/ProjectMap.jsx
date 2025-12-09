import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Arreglo para los íconos de Leaflet que a veces se rompen en React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

const ProjectMap = ({ projects }) => {
  // Filtramos solo proyectos con coordenadas válidas
  const validProjects = projects.filter(p => p.lat && p.lng);

  // Coordenadas por defecto (Centro de México o donde prefieras)
  const defaultCenter = [20.5937, -100.3869]; 

  return (
    <div className="h-full w-full z-0">
      <MapContainer center={defaultCenter} zoom={5} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {validProjects.map((proj) => (
          <Marker key={proj.id} position={[parseFloat(proj.lat), parseFloat(proj.lng)]}>
            <Popup>
              <div className="text-center">
                <h3 className="font-bold text-blue-900">{proj.name}</h3>
                <p className="text-xs text-gray-600">{proj.location}</p>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-bold">
                    {proj.progress || 0}%
                </span>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default ProjectMap;