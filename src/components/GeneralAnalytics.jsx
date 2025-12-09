import React, { useRef, useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend,
  ComposedChart,
  Line 
} from 'recharts';
import ProjectMap from './ProjectMap';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';

const GeneralAnalytics = ({ 
    projects = [], 
    inventory = [], 
    quotes = [], 
    purchases = [], 
    financialData = [], 
    currentMonthFinancials, 
    selectedMonthName, 
    selectedYear,
    onNavigate, 
    onFilter 
}) => {
  // Referencia para capturar el dashboard visualmente
  const dashboardRef = useRef(null);
  
  // Estado para controlar qué modal se muestra
  const [activeModal, setActiveModal] = useState(null);

  // Función para cerrar el modal activo
  const closeModal = () => setActiveModal(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };

    // Activamos el escucha
    window.addEventListener('keydown', handleKeyDown);

    // Limpiamos el escucha al salir
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ==================================================================================
  // 1. LÓGICA DE NEGOCIO Y CÁLCULOS
  // ==================================================================================

  // --- Helper para limpiar números que vienen como texto ---
  const cleanNum = (val) => {
      if (!val) return 0;
      return parseFloat(String(val).replace(/[^0-9.-]+/g,"")) || 0;
  };

  // --- CÁLCULOS DE PROYECTOS (OBRAS) ---
  const totalProjects = projects.length;
  
  const activeProjectsList = projects.filter(p => p.status === 'activo');
  const activeProjectsCount = activeProjectsList.length;
  
  const pausedProjectsList = projects.filter(p => p.status === 'pausa');
  const pausedProjectsCount = pausedProjectsList.length;
  
  const finishedProjectsList = projects.filter(p => p.status === 'finalizado');
  const finishedProjectsCount = finishedProjectsList.length;
  
  const totalProgress = projects.reduce((acc, curr) => acc + (curr.progress || 0), 0);
  // Evitamos división por cero
  const avgProgress = totalProjects > 0 ? Math.round(totalProgress / totalProjects) : 0;

  // --- CÁLCULOS FINANCIEROS GLOBALES (ACUMULADO DE PROYECTOS) ---
  const totalBudget = projects.reduce((acc, p) => acc + cleanNum(p.budget), 0);
  const totalSpent = projects.reduce((acc, p) => acc + cleanNum(p.total_spent), 0);
  
  // Porcentaje de salud financiera (Gasto Real / Presupuesto Total)
  const budgetHealth = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  // --- CÁLCULOS DE INVENTARIO (ALERTAS) ---
  // Filtramos productos cuyo stock actual es menor o igual al mínimo permitido
  const lowStockItems = inventory.filter(p => p.stock <= p.min_stock);
  const lowStockCount = lowStockItems.length;

  // --- CÁLCULOS DE VENTAS (COTIZADOR) ---
  const pendingSales = quotes.filter(q => q.status === 'pendiente');
  const pendingSalesAmount = pendingSales.reduce((acc, q) => acc + cleanNum(q.total), 0);
  const pendingSalesCount = pendingSales.length;

  // --- CÁLCULOS DE COMPRAS (PROVEEDORES) ---
  const pendingPurchases = purchases.filter(p => p.status !== 'recibida');
  const pendingPurchasesCount = pendingPurchases.length;

  // --- CÁLCULOS MENSUALES (DEL SELECTOR DE FECHA) ---
  // Estos datos vienen pre-filtrados desde el Dashboard padre
  const monthSales = currentMonthFinancials?.Ventas || 0;
  const monthPurchases = currentMonthFinancials?.Compras || 0;
  // Si la utilidad viene calculada, la usamos; si no, la calculamos
  const monthProfit = (currentMonthFinancials?.Utilidad) !== undefined 
      ? currentMonthFinancials.Utilidad 
      : (monthSales - monthPurchases);


  // ==================================================================================
  // 2. PREPARACIÓN DE DATOS PARA GRÁFICAS
  // ==================================================================================
  
  // Datos para la Gráfica de Dona (Estado de Obras)
  const statusData = [
    { name: 'Activos', value: activeProjectsCount, color: '#3b82f6' }, // Azul
    { name: 'En Pausa', value: pausedProjectsCount, color: '#f59e0b' }, // Naranja
    { name: 'Finalizados', value: finishedProjectsCount, color: '#10b981' }, // Verde
  ].filter(item => item.value > 0);

  // Datos para la Gráfica de Barras (Top Avance)
  // Ordenamos por progreso descendente y tomamos los primeros 5
  const progressData = [...projects]
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 5)
    .map(p => ({
      name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name, 
      fullName: p.name,
      avance: p.progress || 0
    }));


  // ==================================================================================
  // 3. FUNCIÓN: EXPORTAR REPORTE GERENCIAL (PDF MULTI-PÁGINA)
  // ==================================================================================
  const handleExportBI = async () => {
      const t = toast.loading("Redactando Informe Gerencial...");
      
      try {
          // Configuración inicial del PDF
          const pdf = new jsPDF('p', 'mm', 'a4'); // Vertical
          const w = pdf.internal.pageSize.getWidth();
          const h = pdf.internal.pageSize.getHeight();
          const margin = 20;
          let y = 20; // Cursor vertical

          // --- PÁGINA 1: PORTADA ---
          pdf.setFillColor(30, 58, 138); // Azul Geo
          pdf.rect(0, 0, w, 297, 'F'); // Fondo completo azul
          
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(24);
          pdf.text("INFORME DE INTELIGENCIA DE NEGOCIO", w/2, 100, { align: 'center' });
          
          pdf.setFontSize(16);
          pdf.text(`Periodo Analizado: ${selectedMonthName || 'GENERAL'} ${selectedYear || ''}`, w/2, 115, { align: 'center' });
          
          pdf.setFontSize(12);
          pdf.text("Generado por sistema Geo Control Dom", w/2, 250, { align: 'center' });
          
          // Nueva Página para el contenido
          pdf.addPage(); 
          
          // Fondo blanco para contenido
          pdf.setFillColor(255, 255, 255);
          pdf.rect(0, 0, w, h, 'F');
          y = 20;

          // --- CAPÍTULO 1: RESULTADOS FINANCIEROS ---
          pdf.setFontSize(18);
          pdf.setTextColor(30, 58, 138);
          pdf.text("1. Resultados Financieros del Periodo", margin, y);
          y += 10;

          pdf.setFontSize(11);
          pdf.setTextColor(0);
          // Texto dinámico narrativo
          const financeText = `Durante el mes de ${selectedMonthName}, la organización registró ingresos por ventas totales de $${monthSales.toLocaleString()} y egresos operativos por compras de material de $${monthPurchases.toLocaleString()}. Esto resulta en una utilidad operativa neta de $${monthProfit.toLocaleString()}. A nivel global de proyectos activos, se ha ejercido un ${budgetHealth.toFixed(1)}% del presupuesto total autorizado ($${totalBudget.toLocaleString()}).`;
          
          const splitFinance = pdf.splitTextToSize(financeText, w - (margin*2));
          pdf.text(splitFinance, margin, y);
          y += (splitFinance.length * 6) + 10;

          // Capturar Gráfica Financiera del DOM
          const finChart = document.getElementById('financial-chart-section');
          if(finChart) {
              const canvas = await html2canvas(finChart, { scale: 2 });
              const imgData = canvas.toDataURL('image/png');
              const imgHeight = (w - 2*margin) * 0.5; // Ajuste de altura proporcional
              pdf.addImage(imgData, 'PNG', margin, y, w - 2*margin, imgHeight);
              y += imgHeight + 15;
          }

          // --- CAPÍTULO 2: DESEMPEÑO OPERATIVO ---
          // Verificamos si cabe en la página, si no, salto
          if(y > 200) { pdf.addPage(); y = 20; }
          
          pdf.setFontSize(18);
          pdf.setTextColor(30, 58, 138);
          pdf.text("2. Estado de la Cartera de Proyectos", margin, y);
          y += 10;

          pdf.setFontSize(11);
          pdf.setTextColor(0);
          const opsText = `La cartera actual consta de ${totalProjects} proyectos registrados. De estos, ${activeProjectsCount} se encuentran en ejecución activa, ${pausedProjectsCount} en pausa y ${finishedProjectsCount} han sido entregados. El avance físico promedio ponderado de la cartera es del ${avgProgress}%.`;
          
          const splitOps = pdf.splitTextToSize(opsText, w - (margin*2));
          pdf.text(splitOps, margin, y);
          y += (splitOps.length * 6) + 10;

          // Capturar Gráficas Operativas (Dona y Barras)
          const statusChart = document.getElementById('status-chart-section');
          if(statusChart) {
              const canvas = await html2canvas(statusChart, { scale: 2 });
              const img = canvas.toDataURL('image/png');
              // La ponemos a la izquierda
              pdf.addImage(img, 'PNG', margin, y, 80, 60);
          }
          
          const progChart = document.getElementById('progress-chart-section');
          if(progChart) {
              const canvas = await html2canvas(progChart, { scale: 2 });
              const img = canvas.toDataURL('image/png');
              // La ponemos a la derecha
              pdf.addImage(img, 'PNG', w/2 + 10, y, 80, 60);
          }
          y += 70;

          // --- CAPÍTULO 3: GESTIÓN DE INVENTARIO ---
          if(y > 220) { pdf.addPage(); y = 20; }

          pdf.setFontSize(18);
          pdf.setTextColor(30, 58, 138);
          pdf.text("3. Alertas de Inventario y Logística", margin, y);
          y += 10;

          if(lowStockCount > 0) {
              pdf.setTextColor(220, 0, 0); // Rojo
              pdf.setFontSize(12);
              pdf.text(`⚠️ ALERTA CRÍTICA: ${lowStockCount} productos requieren reabastecimiento.`, margin, y);
              y += 8;
              pdf.setFontSize(10);
              pdf.setTextColor(100);
              pdf.text("Se recomienda generar órdenes de compra inmediatas para los productos marcados en el sistema.", margin, y);
          } else {
              pdf.setTextColor(0, 150, 0); // Verde
              pdf.text("✅ Inventario Saludable: Todos los niveles de stock son óptimos.", margin, y);
          }
          
          // Información adicional de logística
          y += 15;
          pdf.setTextColor(0);
          pdf.setFontSize(11);
          pdf.text(`• Pedidos a proveedores pendientes de recibir: ${pendingPurchasesCount}`, margin, y);
          y += 7;
          pdf.text(`• Cotizaciones de venta pendientes de cierre: ${pendingSalesCount}`, margin, y);

          // Pie de página con numeración
          const totalPages = pdf.internal.getNumberOfPages();
          for (let i = 1; i <= totalPages; i++) {
              pdf.setPage(i);
              pdf.setFontSize(8);
              pdf.setTextColor(150);
              pdf.text(`Página ${i} de ${totalPages}`, w - margin, 285, { align: 'right' });
              pdf.text(`Generado el ${new Date().toLocaleString()}`, margin, 285);
          }

          // Descargar archivo
          pdf.save(`Reporte_Gerencial_${selectedMonthName}_${selectedYear}.pdf`);
          toast.dismiss(t); 
          toast.success("Informe Generado Exitosamente");

      } catch (e) { 
          console.error(e); 
          toast.dismiss(t); 
          toast.error("Error al generar reporte PDF"); 
      }
  };

  // ==================================================================================
  // 4. COMPONENTE INTERNO: MODAL DE DETALLE (GENÉRICO)
  // ==================================================================================
  const DetailModal = ({ title, children }) => (
    <div className="fixed inset-0 bg-black/60 z-50 p-4 flex justify-center items-center backdrop-blur-sm animate-fadeIn">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-xl font-bold text-geo-dark dark:text-white">{title}</h3>
                <button onClick={closeModal} className="text-3xl text-gray-400 hover:text-red-500 transition">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto pr-2">
                {children}
            </div>
            <div className="mt-4 pt-2 border-t border-gray-100 dark:border-gray-700 text-right">
                <button 
                    onClick={closeModal} 
                    className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-white px-6 py-2 rounded-lg font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition"
                >
                    Cerrar Vista Detallada
                </button>
            </div>
        </div>
    </div>
  );

  // ==================================================================================
  // 5. RENDERIZADO PRINCIPAL DEL DASHBOARD
  // ==================================================================================

  return (
    <div className="space-y-6 animate-fadeIn relative">
      
      {/* Botón Flotante de Exportación (Arriba a la derecha) */}
      <div className="flex justify-end mb-2">
          <button 
              onClick={handleExportBI}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-bold text-sm shadow-lg flex items-center gap-2 transition transform hover:scale-105"
          >
              {/* Icono de Cámara/Reporte */}
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
              Descargar Reporte Gerencial
          </button>
      </div>

      {/* --- CONTENEDOR PRINCIPAL DEL DASHBOARD --- */}
      <div ref={dashboardRef} className="space-y-8 p-6 bg-gray-100 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
          
          {/* SECCIÓN 1: ANÁLISIS FINANCIERO MENSUAL (GRÁFICA DE EVOLUCIÓN) */}
          {/* ID para captura PDF: 'financial-chart-section' */}
          <div id="financial-chart-section" className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              
              {/* CAMBIO 1: Encabezado Responsivo (Columna en móvil, Fila en PC) */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                  <div>
                      <h3 className="text-lg font-bold text-geo-dark dark:text-white">Evolución Financiera {selectedYear}</h3>
                      <p className="text-xs text-gray-500">Comparativa de Ingresos (Ventas) vs. Egresos (Compras)</p>
                  </div>
                  
                  {/* Tarjeta de Utilidad del Mes Seleccionado */}
                  <div 
                    onClick={() => setActiveModal('financial_month')}
                    className={`w-full md:w-auto text-center md:text-right cursor-pointer hover:opacity-80 transition p-3 rounded border ${monthProfit >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}
                  >
                      <p className="text-xs text-gray-500 uppercase font-bold">Utilidad {selectedMonthName}</p>
                      <p className={`text-2xl font-bold ${monthProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ${monthProfit.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-gray-400">Click para detalle</p>
                  </div>
              </div>
              
              {/* CAMBIO 2: Contenedor más alto y flexible (h-96 en vez de h-300px fijo) */}
              <div className="w-full h-80 md:h-96">
                  <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={financialData} margin={{ top: 20, right: 10, bottom: 20, left: -10 }}>
                          <CartesianGrid stroke="#f3f4f6" vertical={false} />
                          {/* Ajustamos tamaño de fuente en ejes para móvil */}
                          <XAxis 
                            dataKey="name" 
                            style={{fontSize:'10px', fontWeight:'bold'}} 
                            tickLine={false} 
                            axisLine={false} 
                            interval="preserveStartEnd" // Evita que se oculten etiquetas
                          />
                          <YAxis 
                            style={{fontSize:'10px'}} 
                            tickFormatter={(v)=>`$${v/1000}k`} 
                            tickLine={false} 
                            axisLine={false} 
                            width={40} // Espacio fijo para evitar cortes
                          />
                          <Tooltip 
                              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}
                              formatter={(value) => [`$${value.toLocaleString()}`, '']}
                          />
                          
                          {/* CAMBIO 3: Leyenda abajo para dar aire a la gráfica */}
                          <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                          
                          {/* Barras de Ventas y Compras */}
                          <Bar dataKey="Ventas" name="Ventas" barSize={10} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="Compras" name="Compras" barSize={10} fill="#ef4444" radius={[4, 4, 0, 0]} />
                          
                          {/* Línea de Utilidad */}
                          <Line type="monotone" dataKey="Utilidad" name="Utilidad" stroke="#10b981" strokeWidth={3} dot={{r: 3}} />
                      </ComposedChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* SECCIÓN 2: TARJETAS DE NEGOCIO (CLICKEABLES) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* TARJETA: STOCK CRÍTICO */}
              <div 
                onClick={() => setActiveModal('stock')} 
                className={`p-5 rounded-xl shadow-sm border-l-4 flex items-center justify-between bg-white dark:bg-gray-800 cursor-pointer hover:scale-[1.02] transition ${lowStockCount > 0 ? 'border-red-500' : 'border-green-500'}`}
              >
                  <div>
                      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Alerta de Stock</p>
                      <p className={`text-3xl font-bold mt-1 ${lowStockCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {lowStockCount > 0 ? `${lowStockCount} Críticos` : 'Todo OK'}
                      </p>
                      {lowStockCount > 0 && <p className="text-xs text-red-400 mt-1 font-semibold">Click para ver productos →</p>}
                  </div>
                  <div className={`p-3 rounded-full ${lowStockCount > 0 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3.75h3.75M12 15.75h3.75M12 7.5v8.25" /></svg>
                  </div>
              </div>

              {/* TARJETA: VENTAS PENDIENTES */}
              <div 
                onClick={() => setActiveModal('sales')} 
                className="p-5 rounded-xl bg-white dark:bg-gray-800 shadow-sm border-l-4 border-blue-500 flex items-center justify-between cursor-pointer hover:scale-[1.02] transition"
              >
                  <div>
                      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ventas en Proceso</p>
                      <p className="text-3xl font-bold text-blue-600 mt-1">
                          ${pendingSalesAmount.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400 mt-1 font-semibold">{pendingSales.length} cotizaciones pendientes →</p>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-full text-blue-500">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
              </div>

              {/* TARJETA: COMPRAS PENDIENTES */}
              <div 
                onClick={() => setActiveModal('purchases')} 
                className="p-5 rounded-xl bg-white dark:bg-gray-800 shadow-sm border-l-4 border-purple-500 flex items-center justify-between cursor-pointer hover:scale-[1.02] transition"
              >
                  <div>
                      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pedidos a Proveedor</p>
                      <p className="text-3xl font-bold text-purple-600 mt-1">
                          {pendingPurchasesCount} Pendientes
                      </p>
                      <p className="text-xs text-gray-400 mt-1 font-semibold">Ver seguimiento de entrega →</p>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-full text-purple-500">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.717" /></svg>
                  </div>
              </div>
          </div>

          {/* SECCIÓN 3: KPI FINANCIERO OBRAS (CLICKEABLE) */}
          <div 
            onClick={() => setActiveModal('financial')} 
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 cursor-pointer hover:shadow-md transition-all group"
          >
              <div className="flex justify-between items-end mb-4">
                  <div>
                      <h3 className="text-lg font-bold text-geo-dark dark:text-white group-hover:text-blue-600 transition-colors">Salud Financiera de Proyectos Activos</h3>
                      <p className="text-xs text-gray-500">Relación Presupuesto Autorizado vs. Gasto Real en Materiales</p>
                  </div>
                  <div className="text-right">
                      <p className="text-sm font-bold text-gray-500">Gasto Real Global</p>
                      <p className="text-2xl font-bold text-geo-dark dark:text-white">${totalSpent.toLocaleString()}</p>
                  </div>
              </div>
              
              {/* Barra de Progreso Financiero */}
              <div className="relative pt-1">
                  <div className="flex mb-2 items-center justify-between">
                      <div>
                          <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-green-600 bg-green-200">
                              Eficiencia de Gasto
                          </span>
                      </div>
                      <div className="text-right">
                          <span className={`text-xs font-semibold inline-block ${budgetHealth > 100 ? 'text-red-600' : 'text-green-600'}`}>
                              {budgetHealth.toFixed(1)}% del Presupuesto Global
                          </span>
                      </div>
                  </div>
                  <div className="overflow-hidden h-4 mb-4 text-xs flex rounded bg-gray-200 dark:bg-gray-700 relative">
                      <div 
                          style={{ width: `${Math.min(budgetHealth, 100)}%` }} 
                          className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-1000 ${budgetHealth > 100 ? 'bg-red-500' : 'bg-green-500'}`}
                      ></div>
                      {/* Marcador de límite */}
                      <div className="absolute top-0 bottom-0 w-0.5 bg-black/30 z-10" style={{ left: '100%' }}></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                      <span>$0</span>
                      <span>Presupuesto Total Autorizado: ${totalBudget.toLocaleString()}</span>
                  </div>
              </div>
          </div>

          {/* SECCIÓN 4: TARJETAS DE OBRAS (CLICKEABLES) */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Total */}
            <div 
                onClick={() => setActiveModal('total')} 
                className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border-l-4 border-geo-blue flex items-center justify-between cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-700 transition"
            >
                <div><p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Total Obras</p><p className="text-3xl font-bold text-geo-dark dark:text-white mt-1">{totalProjects}</p></div>
                <div className="text-geo-blue text-2xl">📋</div>
            </div>
            {/* Ejecución */}
            <div 
                onClick={() => setActiveModal('active')} 
                className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border-l-4 border-green-500 flex items-center justify-between cursor-pointer hover:bg-green-50 dark:hover:bg-gray-700 transition"
            >
                <div><p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">En Ejecución</p><p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">{activeProjectsCount}</p></div>
                <div className="text-green-600 text-2xl">🏗️</div>
            </div>
            {/* Avance */}
            <div 
                onClick={() => setActiveModal('progress')} 
                className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border-l-4 border-geo-orange flex items-center justify-between cursor-pointer hover:bg-orange-50 dark:hover:bg-gray-700 transition"
            >
                <div><p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Avance Global</p><p className="text-3xl font-bold text-geo-orange dark:text-orange-400 mt-1">{avgProgress}%</p></div>
                <div className="text-geo-orange text-2xl">📈</div>
            </div>
            {/* Entregados */}
            <div 
                onClick={() => setActiveModal('finished')} 
                className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border-l-4 border-purple-500 flex items-center justify-between cursor-pointer hover:bg-purple-50 dark:hover:bg-gray-700 transition"
            >
                <div><p className="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">Entregados</p><p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-1">{finishedProjectsCount}</p></div>
                <div className="text-purple-600 text-2xl">✅</div>
            </div>
          </div>

          {/* SECCIÓN 5: GRÁFICAS DE DETALLE (CON IDs PARA PDF) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* GRÁFICA 1: ESTADO DE OBRAS */}
            <div 
                id="status-chart-section"
                onClick={() => setActiveModal('status_chart')}
                className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm h-80 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.01]"
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-gray-700 dark:text-white font-bold">Estado de la Cartera</h3>
                    <span className="text-xs text-blue-500 bg-blue-50 px-2 py-1 rounded-full">Ver Detalle</span>
                </div>
                <div style={{ width: '100%', height: 220 }}>
                    <ResponsiveContainer>
                        <PieChart>
                            <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                            </Pie>
                            <Tooltip />
                            <Legend verticalAlign="bottom" />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* GRÁFICA 2: TOP AVANCE FÍSICO */}
            <div 
                id="progress-chart-section"
                onClick={() => setActiveModal('progress_chart')}
                className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm h-80 cursor-pointer hover:shadow-lg transition-all hover:scale-[1.01]"
            >
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-gray-700 dark:text-white font-bold">Top Avance Físico</h3>
                    <span className="text-xs text-blue-500 bg-blue-50 px-2 py-1 rounded-full">Ver Ranking</span>
                </div>
                <div style={{ width: '100%', height: 220 }}>
                    <ResponsiveContainer>
                        <BarChart data={progressData} layout="vertical" margin={{ left: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" width={100} style={{fontSize: '12px'}} />
                            <Tooltip />
                            <Bar dataKey="avance" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
          </div>

          {/* SECCIÓN 6: MAPA */}
          <div 
            onClick={() => setActiveModal('map_detail')}
            className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm h-96 border border-gray-200 dark:border-gray-700 relative z-0 cursor-pointer hover:shadow-lg transition-all"
          >
              <h3 className="text-gray-700 font-bold mb-2 absolute top-4 left-4 z-10 bg-white/90 px-3 py-1 rounded shadow text-sm flex items-center gap-2">
                 🗺️ Ubicación Geográfica <span className="text-[10px] text-gray-400 font-normal">(Click para ampliar)</span>
              </h3>
              {/* Bloqueamos eventos del mapa pequeño para que el click lo capture el div contenedor */}
              <div className="pointer-events-none h-full w-full">
                  <ProjectMap projects={projects} />
              </div>
          </div>

      </div>

      {/* ================================================================================== */}
      {/* MODALES DE DETALLE (VENTANAS EMERGENTES) */}
      {/* ================================================================================== */}
      
      {/* 1. STOCK CRÍTICO */}
      {activeModal === 'stock' && (
          <DetailModal title="Productos con Stock Crítico">
              {lowStockItems.length === 0 ? <p className="text-gray-500 p-4 text-center">✅ No hay alertas de inventario. Todo bajo control.</p> : (
                  <table className="w-full text-left text-sm dark:text-white">
                      <thead className="bg-red-50 dark:bg-red-900/20 border-b dark:border-red-800">
                          <tr><th className="p-3">Producto</th><th className="p-3 text-center">Stock Actual</th><th className="p-3 text-center">Mínimo</th><th className="p-3 text-center">Estado</th></tr>
                      </thead>
                      <tbody>
                          {lowStockItems.map(i => (
                              <tr key={i.id} className="border-b dark:border-gray-700">
                                  <td className="p-3 font-bold">{i.name} <span className="text-gray-400 text-xs font-normal">({i.code})</span></td>
                                  <td className="p-3 text-center font-mono text-red-600 font-bold text-lg">{i.stock} <span className="text-xs text-gray-500">{i.unit}</span></td>
                                  <td className="p-3 text-center text-gray-500">{i.min_stock}</td>
                                  <td className="p-3 text-center"><span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold animate-pulse">CRÍTICO</span></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              )}
          </DetailModal>
      )}

      {/* 2. VENTAS PENDIENTES */}
      {activeModal === 'sales' && (
          <DetailModal title="Cotizaciones Pendientes de Cierre">
              {pendingSales.length === 0 ? <p className="text-gray-500 p-4 text-center">No hay ventas pendientes.</p> : (
                  <table className="w-full text-left text-sm dark:text-white">
                      <thead className="bg-blue-50 dark:bg-blue-900/20 border-b dark:border-blue-800">
                          <tr><th className="p-3">Folio</th><th className="p-3">Cliente</th><th className="p-3 text-right">Total</th><th className="p-3 text-center">Fecha</th></tr>
                      </thead>
                      <tbody>
                          {pendingSales.map(q => (
                              <tr key={q.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                                  <td className="p-3 font-mono text-blue-600">#{q.id}</td>
                                  <td className="p-3 font-bold">{q.client_name}</td>
                                  <td className="p-3 text-right text-green-600 font-bold text-lg">${parseFloat(q.total).toLocaleString()}</td>
                                  <td className="p-3 text-center text-xs text-gray-500">{new Date(q.created_at).toLocaleDateString()}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              )}
          </DetailModal>
      )}

      {/* 3. COMPRAS PENDIENTES */}
      {activeModal === 'purchases' && (
          <DetailModal title="Pedidos a Proveedores en Tránsito">
              {pendingPurchases.length === 0 ? <p className="text-gray-500 p-4 text-center">Todo el material ha sido recibido en almacén.</p> : (
                  <table className="w-full text-left text-sm dark:text-white">
                      <thead className="bg-purple-50 dark:bg-purple-900/20 border-b dark:border-purple-800">
                          <tr><th className="p-3">Folio</th><th className="p-3">Proveedor</th><th className="p-3 text-right">Costo Total</th><th className="p-3 text-center">Estatus</th></tr>
                      </thead>
                      <tbody>
                          {pendingPurchases.map(p => (
                              <tr key={p.id} className="border-b dark:border-gray-700">
                                  <td className="p-3 font-mono">#{p.id}</td>
                                  <td className="p-3 font-bold">{p.supplier_name}</td>
                                  <td className="p-3 text-right font-mono">${parseFloat(p.total).toLocaleString()}</td>
                                  <td className="p-3 text-center"><span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-bold uppercase">{p.status}</span></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              )}
          </DetailModal>
      )}

      {/* 4. FINANCIERO DETALLADO */}
      {activeModal === 'financial' && (
          <DetailModal title="Desglose Financiero por Proyecto">
              <table className="w-full text-left text-sm dark:text-white">
                  <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 uppercase text-xs">
                      <tr><th className="p-3">Proyecto</th><th className="p-3 text-right">Presupuesto</th><th className="p-3 text-right">Gastado</th><th className="p-3 text-center">Salud</th></tr>
                  </thead>
                  <tbody>
                      {projects.map(p => { 
                          const spent = parseFloat(p.total_spent||0); 
                          const budget = parseFloat(p.budget||0); 
                          const health = budget>0?(spent/budget)*100:0; 
                          return (
                              <tr key={p.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                                  <td className="p-3 font-bold">{p.name}</td>
                                  <td className="p-3 text-right text-green-600">${budget.toLocaleString()}</td>
                                  <td className={`p-3 text-right ${spent>budget?'text-red-600 font-bold':'text-gray-600 dark:text-gray-300'}`}>${spent.toLocaleString()}</td>
                                  <td className="p-3 text-center align-middle">
                                      <div className="w-24 bg-gray-200 h-3 rounded-full mx-auto overflow-hidden border border-gray-300">
                                          <div className={`h-full ${health>100?'bg-red-500':'bg-green-500'}`} style={{width:`${Math.min(health,100)}%`}}></div>
                                      </div>
                                      <span className="text-xs text-gray-400">{health.toFixed(1)}%</span>
                                  </td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
          </DetailModal>
      )}

      {/* 5. DETALLE MENSUAL (NUEVO) 💰 */}
      {activeModal === 'financial_month' && (
          <DetailModal title={`Detalle Financiero: ${selectedMonthName} ${selectedYear}`}>
              <div className="grid grid-cols-2 gap-6 text-center mb-6">
                  <div className="p-6 bg-blue-50 rounded-xl">
                      <h4 className="text-blue-800 font-bold uppercase tracking-widest text-xs mb-2">Ingresos Totales</h4>
                      <p className="text-3xl text-blue-600 font-bold">${monthSales.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-1">Ventas cerradas y facturadas</p>
                  </div>
                  <div className="p-6 bg-red-50 rounded-xl">
                      <h4 className="text-red-800 font-bold uppercase tracking-widest text-xs mb-2">Egresos Totales</h4>
                      <p className="text-3xl text-red-600 font-bold">${monthPurchases.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-1">Compras a proveedores</p>
                  </div>
              </div>
              
              <div className={`p-6 rounded-xl text-center border-2 border-dashed ${monthProfit >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                   <h4 className="font-bold uppercase tracking-widest text-xs mb-2">Utilidad Operativa Neta</h4>
                   <p className={`text-4xl font-bold ${monthProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                       {monthProfit >= 0 ? '+' : '-'}${Math.abs(monthProfit).toLocaleString()}
                   </p>
              </div>
          </DetailModal>
      )}

      {/* 6. DETALLE GRÁFICA ESTADO (DONA) */}
      {activeModal === 'status_chart' && (
          <DetailModal title="Desglose por Estatus de Obra">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-96">
                  <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={statusData} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value" label>
                                {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                            </Pie>
                            <Tooltip />
                            <Legend verticalAlign="bottom" />
                        </PieChart>
                  </ResponsiveContainer>
                  <div className="overflow-y-auto pt-10">
                      <table className="w-full text-sm text-left dark:text-white">
                          <thead className="bg-gray-100 dark:bg-gray-700"><tr><th className="p-2">Estatus</th><th className="p-2 text-right">Cantidad</th><th className="p-2 text-right">%</th></tr></thead>
                          <tbody>
                              {statusData.map((d, i) => (
                                  <tr key={i} className="border-b dark:border-gray-700">
                                      <td className="p-2 font-bold flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{backgroundColor: d.color}}></span> {d.name}</td>
                                      <td className="p-2 text-right">{d.value}</td>
                                      <td className="p-2 text-right">{Math.round((d.value/totalProjects)*100)}%</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </DetailModal>
      )}

      {/* 7. DETALLE GRÁFICA AVANCE (BARRAS) */}
      {activeModal === 'progress_chart' && (
          <DetailModal title="Ranking de Avance Físico">
               <div className="h-96 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={progressData} layout="vertical" margin={{ left: 100, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} />
                            <XAxis type="number" domain={[0, 100]} />
                            <YAxis type="category" dataKey="fullName" width={150} style={{fontSize: '12px', fontWeight: 'bold'}} />
                            <Tooltip cursor={{fill: '#f3f4f6'}} />
                            <Bar dataKey="avance" name="Avance %" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={30} label={{ position: 'right', fill: '#666' }} />
                        </BarChart>
                    </ResponsiveContainer>
               </div>
          </DetailModal>
      )}

      {/* 8. DETALLE MAPA (MODAL GIGANTE) */}
      {activeModal === 'map_detail' && (
          <div className="fixed inset-0 bg-black/80 z-50 flex flex-col animate-fadeIn">
              <div className="bg-white dark:bg-gray-900 p-4 flex justify-between items-center shadow-md z-50">
                  <h3 className="text-xl font-bold text-geo-dark dark:text-white">Mapa Global de Proyectos</h3>
                  <button onClick={closeModal} className="bg-red-600 text-white px-4 py-2 rounded font-bold hover:bg-red-700">Cerrar Mapa</button>
              </div>
              <div className="flex-1 w-full relative">
                  {/* Mapa Interactivo a pantalla completa */}
                  <ProjectMap projects={projects} />
                  
                  {/* Leyenda Flotante */}
                  <div className="absolute bottom-8 left-8 bg-white/90 dark:bg-gray-800/90 p-4 rounded-lg shadow-lg backdrop-blur-sm max-w-xs">
                      <h4 className="font-bold mb-2 text-sm dark:text-white">Resumen de Zona</h4>
                      <p className="text-xs text-gray-600 dark:text-gray-300">Total Obras: <b>{totalProjects}</b></p>
                      <p className="text-xs text-green-600 font-bold">Activas: {activeProjectsCount}</p>
                  </div>
              </div>
          </div>
      )}

      {/* 9. LISTADOS SIMPLES DE OBRAS (MODAL REUTILIZABLE) */}
      {(activeModal === 'total' || activeModal === 'active' || activeModal === 'progress' || activeModal === 'finished') && (
          <DetailModal title={
              activeModal === 'total' ? 'Listado General de Proyectos' : 
              activeModal === 'active' ? 'Proyectos en Ejecución' : 
              activeModal === 'finished' ? 'Proyectos Entregados' : 'Avance General de Obras'
          }>
               <table className="w-full text-left text-sm dark:text-white">
                  <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 uppercase text-xs">
                      <tr><th className="p-3">Nombre</th><th className="p-3">Ubicación</th><th className="p-3 text-center">Estatus</th><th className="p-3 text-center">Avance Físico</th></tr>
                  </thead>
                  <tbody>
                      {(activeModal === 'total' ? projects : activeModal === 'active' ? activeProjectsList : activeModal === 'finished' ? finishedProjectsList : projects).map(p => (
                          <tr key={p.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="p-3 font-bold">{p.name}</td>
                              <td className="p-3 text-gray-500">{p.location}</td>
                              <td className="p-3 text-center">
                                  <span className={`text-xs px-3 py-1 rounded-full uppercase font-bold ${p.status==='activo'?'bg-blue-100 text-blue-800':p.status==='finalizado'?'bg-green-100 text-green-800':'bg-orange-100 text-orange-800'}`}>
                                      {p.status}
                                  </span>
                              </td>
                              <td className="p-3 text-center font-bold text-blue-600">{p.progress}%</td>
                          </tr>
                      ))}
                  </tbody>
               </table>
          </DetailModal>
      )}

    </div>
  );
};

export default GeneralAnalytics;