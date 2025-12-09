import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ProjectMap from '../components/ProjectMap';
import GeneralAnalytics from '../components/GeneralAnalytics';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import SignaturePad from 'signature_pad';
import { generatePDF, generateListPDF, generateQuotePDF, generatePayrollReceipt, generateVacationFormat } from '../utils/reportGenerator';
import { API_URL } from '../utils/api';

/* --- HELPERS (después de las importaciones) --- */
// --- HELPER NÓMINA: Calcular Antigüedad ---
const calculateSeniority = (startDate) => {
    if (!startDate) return "Sin dato";
    const start = new Date(startDate);
    const now = new Date();
    const diffTime = Math.abs(now - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    return `${years} años, ${months} meses`;
};

// --- HELPER: CALCULAR DÍAS HÁBILES (MÉXICO) 🇲🇽 ---
const getBusinessDays = (startDate, endDate) => {
    let count = 0;
    const curDate = new Date(startDate + "T12:00:00"); // Medio día para evitar problemas de zona horaria
    const lastDate = new Date(endDate + "T12:00:00");

    // Días Festivos Oficiales LFT (Mes-Día)
    // 1 Ene, 1 May, 16 Sep, 25 Dic son fijos.
    // 5 Feb, 21 Mar, 20 Nov se mueven al lunes más cercano (Aquí ponemos las fechas reales de 2025 para precisión)
    const holidays2025 = [
        "1-1",   // Año Nuevo
        "2-3",   // Constitución (Primer lunes feb)
        "3-17",  // Benito Juárez (Tercer lunes mar)
        "5-1",   // Día del Trabajo
        "9-16",  // Independencia
        "11-17", // Revolución (Tercer lunes nov)
        "12-25"  // Navidad
    ];

    while (curDate <= lastDate) {
        const dayOfWeek = curDate.getDay();
        const dateStr = `${curDate.getMonth() + 1}-${curDate.getDate()}`; // Formato M-D

        // 0 = Domingo, 6 = Sábado
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isHoliday = holidays2025.includes(dateStr);

        if (!isWeekend && !isHoliday) {
            count++;
        }
        curDate.setDate(curDate.getDate() + 1);
    }
    return count;
};

// --- HELPER NÓMINA: Calcular Vacaciones (Ley México) ---
const calculateVacations = (startDate) => {
    if (!startDate) return 0;
    const start = new Date(startDate);
    const now = new Date();
    const years = Math.floor((now - start) / (1000 * 60 * 60 * 24 * 365));
    // Tabla 2024: 1 año=12 días, 2=14, 3=16, 4=18, 5=20, 6-10=22
    if (years < 1) return 0;
    if (years === 1) return 12;
    if (years === 2) return 14;
    if (years === 3) return 16;
    if (years === 4) return 18;
    if (years === 5) return 20;
    return 22;
};


const Dashboard = () => {
  const navigate = useNavigate();
  const locationURL = useLocation();
  // --- ESTADOS VACACIONES ---
  const [showVacationModal, setShowVacationModal] = useState(false);
  const [vacationEmployee, setVacationEmployee] = useState(null);
  const [vacationForm, setVacationForm] = useState({ days: '', startDate: '', endDate: '' });



  // ==================================================================================
  // 1. ESTADOS DEL SISTEMA Y USUARIO
  // ==================================================================================

  // ==================================================================================
  // Estado del usuario logueado
  // ==================================================================================
  const [user, setUser] = useState({
    id: null,
    role: '',
    email: '',
    first_name: '',
    middle_name: '',
    last_name_paternal: '',
    last_name_maternal: '',
    phone_mobile: '',
    phone_home: '',
    occupation: '',
    photo_url: null
  });
  // ==================================================================================
  // 1. Control de Vistas y UI
  // ==================================================================================
  const [activeView, setActiveView] = useState('general');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  // ==================================================================================
  // 2. CAMPANA DE NOTIFICACIONES
  // ==================================================================================

  const [notifications, setNotifications] = useState([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/notifications`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setNotifications(data);
            setUnreadCount(data.filter(n => n.is_read === 0).length);
          }
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteNotif = async (e, id) => {
      // ⚠️ CRÍTICO: Detenemos la propagación para que no marque como 'leída' la notificación
      e.stopPropagation(); 
      
      try {
          const loading = toast.loading("Ocultando notificación...");
          
          await fetch(`${API_URL}/notifications/${id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` } // Usamos el token del estado global
          });
          
          // Actualizamos la lista localmente (filtro la que borré)
          setNotifications(prev => prev.filter(n => n.id !== id));
          
          // Recalculamos el contador de no leídas
          setUnreadCount(prev => {
             const wasUnread = notifications.find(n => n.id === id)?.is_read === 0;
             return wasUnread ? Math.max(0, prev - 1) : prev;
          });
          
          toast.dismiss(loading);
          toast.success("Notificación oculta correctamente", { icon: '✅' });

      } catch (err) {
          toast.dismiss(loading);
          toast.error("Error al ocultar notificación");
          console.error(err);
      }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000); // Revisar cada 10 seg
    return () => clearInterval(interval);
  }, []);

  const handleNotifClick = async (notif) => {
    if (notif.is_read === 0) {
        try {
            await fetch(`${API_URL}/notifications/${notif.id}/read`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const newNotifs = notifications.map(n => n.id === notif.id ? {...n, is_read: 1} : n);
            setNotifications(newNotifs);
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (e) {}
    }
  };

  // ==================================================================================
  // 2. ESTADOS DE DATOS (Base de Datos)
  // ==================================================================================

  const [projects, setProjects] = useState([]);
  const [clientsList, setClientsList] = useState([]);
  const [allUsersList, setAllUsersList] = useState([]);
  const [engineersList, setEngineersList] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isEditingProj, setIsEditingProj] = useState(false);
  const [editingProjId, setEditingProjId] = useState(null);

  // ==================================================================================
  // --- NUEVOS ESTADOS PARA GESTIÓN DE PRODUCTOS ---
  // ==================================================================================
  const [showProductModal, setShowProductModal] = useState(false);
  const [isEditingProduct, setIsEditingProduct] = useState(false);
  const [currentProductId, setCurrentProductId] = useState(null);
  const [productForm, setProductForm] = useState({
      code: '', name: '', category_id: '1', unit: 'Pieza', 
      price: '', stock: '', min_stock: '10'
  });

  // ==================================================================================
  // Estados para Bitácora específica
  // ==================================================================================
  const [selectedProjectReports, setSelectedProjectReports] = useState([]);
  const [selectedProjectName, setSelectedProjectName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [currentProjectData, setCurrentProjectData] = useState(null);

  // ==================================================================================
  // Buscador y Filtros
  // ==================================================================================
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');

  // ==================================================================================
  // 3. ESTADOS DE INTERFAZ (Modals)
  // ==================================================================================

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [quoteToSend, setQuoteToSend] = useState(null);

  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedEngineers, setSelectedEngineers] = useState([]);

  const token = localStorage.getItem('geoToken');

  // ==================================================================================
  // --- 4. ESTADOS DEL COTIZADOR ---
  // ==================================================================================
  const [quoteCart, setQuoteCart] = useState([]);
  const [selectedClientForQuote, setSelectedClientForQuote] = useState('');
  const [selectedProjectForQuote, setSelectedProjectForQuote] = useState('');
  const [quoteHistory, setQuoteHistory] = useState([]);

  // ==================================================================================
  // --- 5. ESTADOS PARA MATERIALES DE OBRA (NUEVO) ---
  // ==================================================================================
  const [projectMaterials, setProjectMaterials] = useState([]);
  const [materialForm, setMaterialForm] = useState({ product_id: '', quantity: '' });
  const [bitacoraTab, setBitacoraTab] = useState('avances');

  // ==================================================================================
  // --- 6. ESTADOS FIRMA DIGITAL ---
  // ==================================================================================
  const canvasRef = useRef(null);      // Para el elemento HTML <canvas>
  const signaturePadRef = useRef(null); // Para la lógica de la firma
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [quoteToSign, setQuoteToSign] = useState(null);

  // ==================================================================================
  // --- 7. NUEVOS ESTADOS: COMPRAS Y PROVEEDORES ---
  // ==================================================================================  
  const [suppliersList, setSuppliersList] = useState([]);
  const [purchasesList, setPurchasesList] = useState([]);
  const [purchaseCart, setPurchaseCart] = useState([]);
  const [selectedSupplierForPurchase, setSelectedSupplierForPurchase] = useState('');
  const [supplierCatalog, setSupplierCatalog] = useState([]);

  const [newSupplier, setNewSupplier] = useState({ 
      name: '', category_id: '1', contact_name: '', phone: '', email: '', address: '' 
  });

  // ==================================================================================
  // --- 8. ESTADOS CRONOGRAMA ---
    // ==================================================================================
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [projectStages, setProjectStages] = useState([]);
  const [newStage, setNewStage] = useState({ name: '', start_date: '', end_date: '', percentage_weight: '' });
  const [financialData, setFinancialData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // ==================================================================================
  // --- 9. ESTADOS DE LOS MODALES ---
  // ==================================================================================
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [tempProductToAdd, setTempProductToAdd] = useState(null); // Producto temporal
  const [tempQty, setTempQty] = useState(1);
  const [tempCost, setTempCost] = useState(0);

  // ==================================================================================
  // --- 10. ESTADOS DEL REPORTE DE MOVIMIENTOS ---
  // ==================================================================================  
  const [materialMovements, setMaterialMovements] = useState([]);

  // ==================================================================================
  // --- 11. FORMULARIOS (Objetos de Estado)
  // ================================================================================== 

  const [newReport, setNewReport] = useState({
    project_id: '',
    description: '',
    image: null 
  });

  const [newUser, setNewUser] = useState({
    first_name: '',
    middle_name: '',
    last_name_paternal: '',
    last_name_maternal: '',
    email: '',
    password: '',
    phone_mobile: '',
    phone_home: '',
    occupation: '',
    role: 'ingeniero',
    nss: '',
    start_date: '',
    salary: '',
    payment_period: 'quincenal'
  });

  const [newProject, setNewProject] = useState({
    name: '',
    location: '',
    start_date: '',
    client_id: '',
    lat: '',
    lng: '',
    image: null,
    pdf: null,
    budget: ''
  });

  const [passwordForm, setPasswordForm] = useState({
    newPass: '',
    confirmPass: ''
  });

  const [profileForm, setProfileForm] = useState({
    first_name: '',
    middle_name: '',
    last_name_paternal: '',
    last_name_maternal: '',
    email: '',
    phone_mobile: '',
    phone_home: '',
    occupation: '',
    photo: null
  });

  // Helper para obtener nombre completo
  const getFullName = (u) => {
    if (!u) return 'Usuario';
    return `${u.first_name || ''} ${u.last_name_paternal || ''}`.trim() || 'Usuario';
  };

  // --- HELPER PARA KPI FINANCIERO ---
  const cleanNumber = (val) => {
      // Convierte "1,000" a 1000 para poder compararlos
      if (!val) return 0;
      return parseFloat(String(val).replace(/,/g, '')) || 0;
  };

  // ==================================================================================
  // 5. LÓGICA DE FILTRADO, TEMA Y EXPORTACIÓN
  // ==================================================================================

  // Inicializar Dark Mode al cargar
  useEffect(() => {
    const savedTheme = localStorage.getItem('geoTheme');
    if (savedTheme === 'dark') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  // Alternar Dark Mode
  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('geoTheme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('geoTheme', 'light');
    }
  };

  // Filtro de proyectos en tiempo real
  const filteredProjects = projects.filter(proj => {
    const matchesSearch = proj.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          proj.location.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'todos' ? true : proj.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // --- FUNCIÓN EXPORTAR A EXCEL (ESTILO EJECUTIVO CON LOGO) ---
  const handleExportExcel = async (dataToExport, fileName) => {
    if (!dataToExport || dataToExport.length === 0) {
        return toast.error("No hay datos para exportar");
    }

    const loadingToast = toast.loading("Generando Reporte...");

    try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet(fileName.replace('_', ' '));

        // Logo
        try {
            const response = await fetch('/logo.png'); 
            if (response.ok) {
                const buffer = await response.arrayBuffer();
                const logoId = workbook.addImage({ buffer: buffer, extension: 'png' });
                sheet.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 160, height: 50 } });
            }
        } catch (e) {}

        let columns = [];
        let rows = [];

        if (fileName === 'Reporte_Obras') {
            columns = [
                { header: 'ID', key: 'id', width: 10 },
                { header: 'PROYECTO', key: 'name', width: 35 },
                { header: 'UBICACIÓN', key: 'location', width: 25 },
                { header: 'ESTATUS', key: 'status', width: 15 },
                { header: 'AVANCE', key: 'progress', width: 12 },
                { header: 'CLIENTE', key: 'client', width: 25 },
                { header: 'RESPONSABLES', key: 'engineers', width: 40 },
                { header: 'INICIO', key: 'start', width: 15 },
            ];
            rows = dataToExport.map(item => ({
                id: item.id,
                name: item.name,
                location: item.location,
                // BLINDAJE: Si no hay status, ponemos N/A
                status: item.status ? item.status.toUpperCase() : 'N/A', 
                progress: (item.progress || 0) + '%',
                client: item.client_name || "Sin asignar",
                engineers: item.assigned_names || "Sin asignar",
                start: item.start_date ? new Date(item.start_date).toLocaleDateString() : '-'
            }));
        } else if (fileName === 'Reporte_Inventario') {
            columns = [
                { header: 'CÓDIGO', key: 'code', width: 15 },
                { header: 'PRODUCTO', key: 'name', width: 35 },
                { header: 'CATEGORÍA', key: 'cat', width: 20 },
                { header: 'STOCK', key: 'stock', width: 15 },
                { header: 'UNIDAD', key: 'unit', width: 10 },
                { header: 'PRECIO', key: 'price', width: 15 },
                { header: 'ESTADO', key: 'status', width: 15 },
            ];
            rows = dataToExport.map(item => ({
                code: item.code,
                name: item.name,
                cat: item.category_name,
                stock: item.stock,
                unit: item.unit,
                price: item.price,
                // CORRECCIÓN: Usamos status_stock
                status: item.status_stock || 'N/A' 
            }));
        } else {
             columns = [
                { header: 'NOMBRE', key: 'name', width: 20 },
                { header: 'APELLIDO', key: 'lastname', width: 20 },
                { header: 'EMAIL', key: 'email', width: 30 },
                { header: 'ROL', key: 'role', width: 15 },
                { header: 'PUESTO', key: 'job', width: 20 },
                { header: 'TELÉFONO', key: 'phone', width: 15 },
            ];
            rows = dataToExport.map(item => ({
                name: item.first_name,
                lastname: item.last_name_paternal,
                email: item.email,
                role: item.role ? item.role.toUpperCase() : 'N/A',
                job: item.occupation || '-',
                phone: item.phone_mobile || '-'
            }));
        }
        
        sheet.columns = columns;

        // Título
        const lastColIndex = columns.length; 
        const lastColLetter = sheet.getColumn(lastColIndex).letter;
        sheet.mergeCells(`C2:${lastColLetter}2`); 
        const titleCell = sheet.getCell('C2');
        titleCell.value = fileName.replace(/_/g, ' ').toUpperCase();
        titleCell.style = { font: { name: 'Arial', size: 18, bold: true, color: { argb: 'FF1E3A8A' } }, alignment: { vertical: 'middle', horizontal: 'center' }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } } };
        sheet.getRow(2).height = 40; 

        // Headers
        sheet.spliceRows(1, 1); 
        const headerRow = sheet.getRow(4);
        headerRow.values = columns.map(c => c.header);
        headerRow.height = 25;
        
        headerRow.eachCell((cell) => {
            cell.style = { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF101828' } }, font: { name: 'Arial', color: { argb: 'FFFFFFFF' }, bold: true, size: 10 }, alignment: { vertical: 'middle', horizontal: 'center' }, border: { top: {style:'thin', color: {argb:'FFFFFFFF'}}, left: {style:'thin', color: {argb:'FFFFFFFF'}}, bottom: {style:'thin', color: {argb:'FFFFFFFF'}}, right: {style:'thin', color: {argb:'FFFFFFFF'}} } };
        });

        // Datos
        rows.forEach(row => {
            const newRow = sheet.addRow(row);
            // Pintar de rojo si es inventario crítico
            if (fileName === 'Reporte_Inventario' && row.status === 'CRITICO') {
                 newRow.eachCell((cell) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } }; 
                    cell.font = { color: { argb: 'FF991B1B' } }; 
                 });
            }
        });

        sheet.eachRow((row, rowNumber) => {
            if (rowNumber > 4) { 
                row.eachCell((cell) => {
                    cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
                    if (!cell.style.alignment) cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                });
            }
        });

        // Descargar
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `${fileName}_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
        
        toast.dismiss(loadingToast);
        toast.success("Reporte descargado");

    } catch (error) {
        console.error("Error Excel:", error);
        toast.dismiss(loadingToast);
        toast.error("Error al generar reporte");
    }
  };

  // ==================================================================================
  // 6. CARGA INICIAL (USE EFFECT)
  // ==================================================================================

  useEffect(() => {
    const savedUser = localStorage.getItem('geoUser');
    
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      fetchProjects(parsedUser.id, parsedUser.role);

      if (['admin', 'ingeniero'].includes(parsedUser.role)) {
        fetchClients();
        fetchInventory();
        fetchQuotes();
        fetchSuppliers();
        fetchPurchases();
      }
      if (parsedUser.role === 'admin') {
        fetchAllUsers();
        fetchEngineers();
      }
      if (parsedUser.role === 'admin' || parsedUser.role === 'contador') {
        fetchMaterialAudits();
      }

      const params = new URLSearchParams(locationURL.search);
      const pId = params.get('projectId');

      if (pId) {
        setTimeout(() => {
          viewBitacora({ id: pId, name: 'Cargando proyecto...' });
        }, 800);
      }

    } else {
      navigate('/login');
    }
    
  }, [navigate, locationURL]);

  // --- INICIALIZAR FIRMA AL ABRIR MODAL ---
  useEffect(() => {
    if (showSignatureModal && canvasRef.current) {
      // Inicializamos el Pad sobre el canvas
      signaturePadRef.current = new SignaturePad(canvasRef.current, {
        backgroundColor: 'rgba(255, 255, 255, 0)', // Fondo transparente
        penColor: 'black'
      });
      
      // Ajuste para pantallas de alta densidad (Retina) si fuera necesario
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvasRef.current.width = canvasRef.current.offsetWidth * ratio;
      canvasRef.current.height = canvasRef.current.offsetHeight * ratio;
      canvasRef.current.getContext("2d").scale(ratio, ratio);
    }
  }, [showSignatureModal]);

  //FETCH CRONOGRAMA

  useEffect(() => {
    if (!token) return;

    const intervalId = setInterval(() => {
      // Solo recargamos la vista activa
      if (activeView === 'obras') {
          // CORRECCIÓN AQUÍ: Usar 'user', no 'parsedUser'
          fetchProjects(user.id, user.role);
          fetchFinancials(selectedYear);
      } 
      else if (activeView === 'inventory') fetchInventory();
      else if (activeView === 'cotizador') fetchQuotes();
      else if (activeView === 'usuarios' && user.role === 'admin') fetchAllUsers();
      else if (activeView === 'proveedores') fetchSuppliers();
      else if (activeView === 'compras') fetchPurchases();
      
      // AGREGADO PARA EL ANÁLISIS MENSUAL
      else if (activeView === 'general') {
          if(typeof fetchFinancials === 'function') fetchFinancials();
      }
    }, 5000); 

    return () => clearInterval(intervalId);
  }, [activeView, user.id, user.role, token]);

  // ==================================================================================
  // 7. FETCH FUNCTIONS
  // ==================================================================================

  const getTokenHeader = (contentType = 'application/json') => {
    const token = localStorage.getItem('geoToken');
    const headers = { 
        'Authorization': `Bearer ${token}` 
    };
    if (contentType !== 'multipart/form-data') {
        headers['Content-Type'] = contentType;
    }
    return headers;
};

const fetchFinancials = (year) => {
    // Si no mandan año, usa el actual o el seleccionado
    const yearToUse = year || selectedYear; 
    // Fíjate que aquí uso backticks ` ` y no comillas simples ' '
    fetch(`${API_URL}/analytics/monthly?year=${yearToUse}`, { 
        headers: { 'Authorization': `Bearer ${token}` } 
    })
    .then(res => res.json())
    .then(data => setFinancialData(data))
    .catch(err => console.error(err));
};

  const fetchProjects = (userId, role) => {
    setIsLoading(true);
    // AQUI ESTABA EL ERROR: Faltaba abrir llaves { } después de la URL
    fetch(`${API_URL}/projects?userId=${userId}&role=${role}`, {
        method: 'GET',
        headers: { 
            'Authorization': `Bearer ${token}` 
        }
    })
      .then(res => {
        if (!res.ok) {
             // Si el token venció, sacamos al usuario
             if (res.status === 401 || res.status === 403) {
                  localStorage.removeItem('geoUser');
                  localStorage.removeItem('geoToken');
                  window.location.href = '/login'; // Forzamos la recarga hacia login
                  throw new Error("Sesión expirada");
             }
             throw new Error("Error del servidor");
        }
        return res.json();
      })
      .then(data => {
        // BLINDAJE: Si data no es un array, ponemos [] para que no explote .filter()
        if (Array.isArray(data)) {
            setProjects(data);
        } else {
            setProjects([]);
        }
        setTimeout(() => setIsLoading(false), 800);
      })
      .catch(err => {
        console.error("Error cargando proyectos:", err);
        setProjects([]); // En error, lista vacía
        setIsLoading(false);
      });
  };

  const fetchClients = () => {
    fetch(`${API_URL}/clients-list`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => setClientsList(data))
      .catch(err => console.error("Error cargando clientes:", err));
  };

  const fetchAllUsers = () => {
      // Asegúrate que el puerto sea 3001 (o el que uses en backend)
      fetch(`${API_URL}/users`, { 
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
      })
      .then(res => {
          if (!res.ok) throw new Error("Error en la respuesta del servidor");
          return res.json();
      })
      .then(data => setAllUsersList(data))
      .catch(err => console.error("Error cargando usuarios:", err));
  };

  const fetchEngineers = () => {
    fetch(`${API_URL}/engineers-list`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => setEngineersList(data))
      .catch(err => console.error("Error cargando ingenieros:", err));
  };

  // --- Cargar Inventario ---
  const fetchInventory = () => {
      fetch(`${API_URL}/inventory`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => {
          // Si el token venció, no explotamos, solo limpiamos
          if (!res.ok) throw new Error("Error cargando inventario");
          return res.json();
      })
      .then(data => {
          // Verificamos que sea una lista real antes de guardarla
          if (Array.isArray(data)) {
              setInventory(data);
          } else {
              setInventory([]); 
          }
      })
      .catch(err => {
          console.error(err);
          setInventory([]); // En caso de error, lista vacía para que no truene
      });
  };

  const fetchCategories = () => {
      // El 403 ocurre si falta esta parte de 'headers' 👇
      fetch(`${API_URL}/categories`, { 
          method: 'GET',
          headers: { 
            'Authorization': `Bearer ${token}` 
          }
      })
      .then(res => {
          if (!res.ok) throw new Error("Error al cargar categorías");
          return res.json();
      })
      .then(data => setCategories(data)) // Asegúrate de tener el estado: const [categories, setCategories] = useState([]);
      .catch(err => console.error(err));
  };

  const fetchSuppliers = () => fetch(`${API_URL}/suppliers`, { headers: { 'Authorization': `Bearer ${token}` } }).then(res => res.json()).then(data => setSuppliersList(data));
  const fetchPurchases = () => fetch(`${API_URL}/purchases`, { headers: { 'Authorization': `Bearer ${token}` } }).then(res => res.json()).then(data => setPurchasesList(data));
  
const fetchSupplierProducts = async (supplierId) => {
      if(!supplierId) {
          setSupplierCatalog([]);
          return;
      }
      try {
          const res = await fetch(`${API_URL}/suppliers/${supplierId}/products`, { 
              headers: { 'Authorization': `Bearer ${token}` } 
          });
          const data = await res.json();
          setSupplierCatalog(data);
      } catch(e) { console.error(e); }
  };

  const fetchMaterialAudits = () => {
    fetch(`${API_URL}/audits/materials`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
            if (data.error) throw new Error(data.error);
            setMaterialMovements(data);
        })
        .catch(err => {
            console.error("Error cargando auditoría:", err);
            toast.error(err.message || "No tienes permisos para ver el reporte de movimientos.");
            setMaterialMovements([]);
        });
};

  // ==================================================================================
  // 8. HANDLERS (ACCIONES)
  // ==================================================================================

  const handleLogout = () => {
    localStorage.removeItem('geoUser');
    localStorage.removeItem('geoToken');
    navigate('/');
  };

  

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm("¿Estás seguro de eliminar este proyecto? Se borrará toda su información y reportes.")) return;

    try {
      const response = await fetch(`${API_URL}/projects/${projectId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.success) {
        toast.success("Proyecto eliminado correctamente");
        fetchProjects(user.id, user.role);
      } else {
        toast.error("Error al eliminar: " + data.error);
      }
    } catch (error) {
      toast.error("Error de conexión");
    }
  };

  const handleDeleteUser = async (userId) => {
    if (userId === user.id) return toast.error("No puedes borrarte a ti mismo.");
    if (!window.confirm("¿Estás seguro de eliminar este usuario?")) return;

    try {
      const response = await fetch(`${API_URL}/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.success) {
        toast.success("Usuario eliminado");
        fetchAllUsers();
        fetchClients();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error("Error de conexión");
    }
  };

const handleCreateProject = async (e) => {
      e.preventDefault();
      
      const formData = new FormData();
      formData.append('name', newProject.name);
      formData.append('location', newProject.location);
      formData.append('start_date', newProject.start_date);
      formData.append('client_id', newProject.client_id);
      formData.append('lat', newProject.lat);
      formData.append('lng', newProject.lng);
      formData.append('budget', newProject.budget);
      formData.append('assigned_engineers', JSON.stringify(selectedEngineers));

      if (newProject.image) formData.append('image', newProject.image);
      if (newProject.pdf) formData.append('pdf', newProject.pdf);

      // LÓGICA HÍBRIDA: Crear o Editar
      const url = isEditingProj 
          ? `${API_URL}/projects/${editingProjId}` 
          : `${API_URL}/projects`
      
      const method = isEditingProj ? 'PUT' : 'POST';

      try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData 
        });
        const data = await response.json();
        
        if(data.success) {
            toast.success(isEditingProj ? "Proyecto actualizado" : "Proyecto creado");
            
            // Limpiar y Resetear
            setNewProject({ name: '', location: '', start_date: '', client_id: '', lat: '', lng: '', image: null, pdf: null, budget: '' });
            setSelectedEngineers([]);
            setIsEditingProj(false); // Volver a modo crear
            setEditingProjId(null);
            
            if(document.getElementById('file-image')) document.getElementById('file-image').value = "";
            if(document.getElementById('file-pdf')) document.getElementById('file-pdf').value = "";
            
            fetchProjects(user.id, user.role);
            setActiveView('obras');
        } else {
            toast.error("Error: " + data.error);
        }
      } catch (error) { toast.error("Error de conexión"); }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newUser)
      });
      const data = await response.json();

      if (data.success) {
        toast.success("Usuario creado correctamente");
        setNewUser({
          first_name: '',
          middle_name: '',
          last_name_paternal: '',
          last_name_maternal: '',
          email: '',
          password: '',
          phone_mobile: '',
          phone_home: '',
          occupation: '',
          role: 'ingeniero'
        });
        fetchClients();
        fetchAllUsers();
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error("Error de conexión");
    }
  };

  const handleEditProfile = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    Object.keys(profileForm).forEach(key => {
      if (key !== 'photo') formData.append(key, profileForm[key]);
    });
    if (profileForm.photo instanceof File) {
      formData.append('photo', profileForm.photo);
    }

    try {
      const response = await fetch(`${API_URL}/users/${user.id}/profile`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await response.json();

      if (data.success) {
        const updatedUser = { ...user, ...profileForm, photo_url: data.user.photo_url || user.photo_url };
        setUser(updatedUser);
        localStorage.setItem('geoUser', JSON.stringify(updatedUser));
        toast.success("Perfil actualizado");
        setShowEditProfileModal(false);
      } else {
        toast.error(data.error);
      }
    } catch (error) {
      toast.error("Error de conexión");
    }
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append('project_id', selectedProjectId);
    formData.append('user_id', user.id);
    formData.append('description', newReport.description);
    if (newReport.image) formData.append('image', newReport.image);

    try {
      const response = await fetch(`${API_URL}/reports`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await response.json();
      if (data.success) {
        toast.success("Reporte guardado");
        setNewReport({ description: '', image: null });
        if (document.getElementById('report-image')) document.getElementById('report-image').value = "";
        viewBitacora(currentProjectData);
      }
    } catch (error) {
      toast.error("Error de conexión");
    }
  };

  // --- BORRAR REPORTE BITÁCORA ---
  const handleDeleteReport = (reportId) => {
      toast((t) => (
          <div className="flex flex-col gap-3 min-w-[280px]">
              <div className="flex items-start gap-3">
                  <div className="bg-red-100 text-red-600 p-2 rounded-full mt-1">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                  </div>
                  <div>
                      <p className="font-bold text-gray-800 dark:text-white text-sm">¿Borrar Avance?</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Esta acción eliminará la evidencia permanentemente.</p>
                  </div>
              </div>
              
              <div className="flex gap-2 mt-2">
                  <button 
                    onClick={() => toast.dismiss(t.id)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-xs font-bold transition dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => {
                        toast.dismiss(t.id);
                        performDeleteReport(reportId);
                    }}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-xs font-bold shadow-sm transition"
                  >
                    Sí, Borrar
                  </button>
              </div>
          </div>
      ), { duration: 5000, className: "dark:bg-gray-800 dark:border-gray-700" });
  };

  const performDeleteReport = async (reportId) => {
      const loading = toast.loading("Eliminando...");
      try {
          const res = await fetch(`${API_URL}/reports/${reportId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();

          if (data.success) {
              toast.dismiss(loading);
              toast.success("Reporte eliminado");
              viewBitacora(currentProjectData); // Recargar la vista
          } else {
              toast.dismiss(loading);
              toast.error("Error al eliminar");
          }
      } catch (error) {
          toast.dismiss(loading);
          toast.error("Error de conexión");
      }
  };

  const updateProgress = async (id, newProgress) => {
    if (newProgress < 0) newProgress = 0;
    if (newProgress > 100) newProgress = 100;
    try {
      await fetch(`${API_URL}/projects/${id}/progress`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ progress: newProgress })
      });
      fetchProjects(user.id, user.role);
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdateStatus = async (projectId, newStatus) => {
    try {
      await fetch(`${API_URL}/projects/${projectId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      toast.success(`Estatus actualizado`);
      fetchProjects(user.id, user.role);
    } catch (error) {
      toast.error("Error al actualizar estatus");
    }
  };

  const viewBitacora = (proj) => {
    setSelectedProjectId(proj.id);
    setSelectedProjectName(proj.name);
    setCurrentProjectData(proj);
    
    // --- AGREGAR ESTAS LÍNEAS ---
    setBitacoraTab('avances'); // Resetear a la pestaña principal
    fetchProjectMaterials(proj.id); // Cargar materiales
    // ----------------------------

    fetch(`${API_URL}/reports/${proj.id}`, {
        method: 'GET', headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
        setSelectedProjectReports(data);
        setActiveView('bitacora'); 
    });
  };

const handleDownloadPDF = async () => { // <--- DEBE SER ASÍNCRONA
    if(currentProjectData && selectedProjectReports) {
        const loadingToast = toast.loading("Generando Reporte Completo...");
        try {
            // CRÍTICO: Debe usar await
            await generatePDF(currentProjectData, selectedProjectReports); 
            toast.dismiss(loadingToast);
            toast.success("PDF Descargado");
        } catch(error) {
            toast.dismiss(loadingToast);
            console.error("Error al generar PDF:", error); // Si falla, lo vemos aquí
            alert("Error al generar PDF. Ver consola.");
        }
    } else {
        alert("Datos incompletos para generar el reporte.");
    }
};

  const handleShowQR = (project) => {
    setSelectedProject(project);
    setShowQRModal(true);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPass !== passwordForm.confirmPass) return toast.error("Las contraseñas no coinciden");
    if (passwordForm.newPass.length < 4) return toast.error("La contraseña es muy corta");

    try {
      const response = await fetch(`${API_URL}/users/${user.id}/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: passwordForm.newPass })
      });
      const data = await response.json();

      if (data.success) {
        toast.success("Contraseña actualizada. Inicia sesión de nuevo.");
        handleLogout();
      } else {
        toast.error("Error: " + data.error);
      }
    } catch (error) {
      toast.error("Error de conexión");
    }
  };

  const handleDownloadListPDF = async (type) => {
      if (type === 'projects') {
          if (filteredProjects.length === 0) return toast.error("No hay datos");
          // Llama a la función que creamos en reportGenerator.js
          await generateListPDF("Reporte General de Obras", filteredProjects, 'projects');
          toast.success("PDF de Obras descargado");
      } else if (type === 'users') {
          if (allUsersList.length === 0) return toast.error("No hay usuarios");
          await generateListPDF("Reporte de Personal", allUsersList, 'users');
          toast.success("PDF de Usuarios descargado");
      }
  };

const handleEditProjectClick = (proj) => {
      // 1. Activamos modo edición
      setIsEditingProj(true);
      setEditingProjId(proj.id);
      
      // 2. Rellenamos el formulario con los datos del proyecto seleccionado
      setNewProject({
          name: proj.name,
          location: proj.location,
          // Convertimos la fecha al formato yyyy-MM-dd para el input date
          start_date: proj.start_date ? new Date(proj.start_date).toISOString().split('T')[0] : '',
          client_id: proj.client_id || '',
          lat: proj.lat || '',
          lng: proj.lng || '',
          budget: proj.budget || '',
          image: null, 
          pdf: null
      });
      
      // 3. Rellenamos los ingenieros asignados
      // (Asegúrate de que el backend envíe 'assigned_ids' en /projects, si no, esto quedará vacío pero no romperá nada)
      setSelectedEngineers(proj.assigned_ids || []);

      // 4. Cambiamos de vista al formulario
      setActiveView('nuevo_proyecto');
  };

  // --- GENERAR LAYOUT DE NÓMINA (ARCHIVO BANCARIO) ---
  const handleGeneratePayroll = () => {
      const loading = toast.loading("Generando layout bancario...");

      // 1. Filtramos empleados con salario > 0
      const employees = allUsersList.filter(u => parseFloat(u.salary) > 0);

      if (employees.length === 0) {
          toast.dismiss(loading);
          return toast.error("No hay empleados con salario registrado para pagar.");
      }

      // 2. Construimos el contenido del archivo (Formato Genérico CSV)
      // Encabezados: Cuenta Destino, Monto, Nombre Beneficiario, Concepto
      let csvContent = "CUENTA,MONTO,BENEFICIARIO,CONCEPTO\n";

      employees.forEach(emp => {
          // Simulamos una cuenta bancaria si no existe (deberías agregar este campo a la BD)
          const account = "1234567890"; 
          const amount = parseFloat(emp.salary).toFixed(2);
          const name = `${emp.first_name} ${emp.last_name_paternal}`;
          const concept = `NOMINA ${new Date().toLocaleDateString()}`;
          
          csvContent += `${account},${amount},${name},${concept}\n`;
      });

      // 3. Crear Blob y Descargar
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `Layout_Nomina_${new Date().toISOString().slice(0,10)}.csv`);

      toast.dismiss(loading);
      toast.success("Layout de nómina descargado");
  };

  // --- HANDLERS VACACIONES ---
  const openVacationModal = (emp) => {
      setVacationEmployee(emp);
      setVacationForm({ days: '', startDate: '', endDate: '' });
      setShowVacationModal(true);
  };

  const handleProcessVacation = async (e) => {
      e.preventDefault();
      const daysToTake = parseInt(vacationForm.days);
      const currentBalance = parseInt(vacationEmployee.vacation_days || 0);

      if (daysToTake <= 0) return toast.error("La cantidad debe ser mayor a 0");
      if (daysToTake > currentBalance) return toast.error(`Saldo insuficiente. Solo tiene ${currentBalance} días.`);

      const newBalance = currentBalance - daysToTake;
      const loading = toast.loading("Procesando vacaciones...");

      try {
          // 1. Actualizar DB
          await fetch(`${API_URL}/users/${vacationEmployee.id}/vacations`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ remaining_days: newBalance })
          });

          // 2. Generar PDF
          generateVacationFormat(vacationEmployee, {
              daysRequested: daysToTake,
              startDate: vacationForm.startDate,
              endDate: vacationForm.endDate,
              remainingDays: newBalance
          });

          toast.dismiss(loading);
          toast.success("Vacaciones registradas y formato descargado");
          setShowVacationModal(false);
          fetchAllUsers(); // Recargar tabla para ver nuevo saldo
      } catch (error) {
          toast.dismiss(loading);
          toast.error("Error al procesar");
      }
  };

  // --- HANDLERS DE PRODUCTOS ---
  
  // Abrir Modal (Limpio o con datos para editar)
  const openProductModal = (prod = null) => {
      if (prod) {
          // MODO EDICIÓN: Activamos la bandera y guardamos el ID
          setIsEditingProduct(true);
          setCurrentProductId(prod.id);
          
          // Llenamos el formulario con los datos actuales
          setProductForm({
              code: prod.code,
              name: prod.name,
              category_id: prod.category_id,
              unit: prod.unit,
              price: prod.price,
              stock: prod.stock,
              min_stock: prod.min_stock
          });
      } else {
          // MODO CREAR: Apagamos la bandera y limpiamos
          setIsEditingProduct(false);
          setCurrentProductId(null);
          setProductForm({ 
              code: '', name: '', category_id: '1', unit: 'Pieza', 
              price: '', stock: '', min_stock: '10' 
          });
      }
      setShowProductModal(true);
  };

  // Guardar (Crear o Editar)
  const handleSaveProduct = async (e) => {
      e.preventDefault();
      
      // 1. Determinamos si es Edición o Creación
      const isEdit = isEditingProduct && currentProductId;
      
      // 2. Configuramos el Método y la URL
      const method = isEdit ? 'PUT' : 'POST';
      const url = isEdit 
          ? `${API_URL}/products/${currentProductId}` // URL para Editar (con ID)
          : `${API_URL}/products`;                    // URL para Crear (sin ID)

      // Debug en consola para verificar qué está haciendo
      console.log(`Enviando ${method} a ${url}`);

      try {
          const res = await fetch(url, { 
              method: method, 
              headers: { 
                  'Content-Type': 'application/json', 
                  'Authorization': `Bearer ${token}` 
              }, 
              body: JSON.stringify(productForm) 
          });
          
          const d = await res.json();
          
          if (d.success) { 
              toast.success(isEdit ? "Inventario actualizado" : "Producto creado"); 
              setShowProductModal(false); 
              fetchInventory(); // Recargamos la tabla para ver los cambios
          } else { 
              toast.error("Error: " + d.error); 
          }
      } catch (e) { 
          console.error(e);
          toast.error("Error de conexión"); 
      }
  };

  // Eliminar
const handleDeleteProduct = async (id) => {
      toast((t) => (
          <div className="flex flex-col gap-3 min-w-[250px]">
              <div className="flex items-center gap-3">
                  <div className="bg-red-100 text-red-600 p-2 rounded-full">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                      </svg>
                  </div>
                  <div>
                      <p className="font-bold text-gray-800 dark:text-white text-sm">¿Eliminar Producto?</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Esta acción no se puede deshacer.</p>
                  </div>
              </div>
              
              <div className="flex gap-2 mt-1">
                  <button 
                    onClick={() => toast.dismiss(t.id)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-xs font-bold transition dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => {
                        toast.dismiss(t.id);
                        performDelete(id);
                    }}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md text-xs font-bold shadow-sm transition"
                  >
                    Sí, Eliminar
                  </button>
              </div>
          </div>
      ), { 
          duration: 8000, // Dura más para dar tiempo a leer
          style: {
              background: '#ffffff',
              color: '#333',
              borderRadius: '12px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              padding: '16px',
              border: '1px solid #e5e7eb'
          },
          // Soporte para Dark Mode en el contenedor del toast (si usas librería externa puede requerir config extra, pero esto cubre lo básico)
          className: "dark:bg-gray-800 dark:border-gray-700"
      });
  };

  const performDelete = async (id) => {
      const loading = toast.loading("Eliminando...");
      
      try {
          const response = await fetch(`${API_URL}/products/${id}`, {
              method: 'DELETE',
              headers: { 
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json' 
              }
          });

          const data = await response.json();

          if (data.success) {
              toast.success("Producto eliminado correctamente", { id: loading });
              fetchInventory(); // Recargar la tabla
          } else {
              // Si el backend dice "Acceso denegado" o cualquier otro error, lo mostramos aquí
              toast.error(`Error: ${data.error || 'No se pudo eliminar'}`, { id: loading });
          }
      } catch (error) {
          console.error(error);
          toast.error("Error de conexión con el servidor", { id: loading });
      }
  };

  // --- ESTADO PARA HISTORIAL ---
  const [quotesList, setQuotesList] = useState([]);

  // 1. Cargar historial de cotizaciones
  const fetchQuotes = () => {
      fetch(`${API_URL}/quotes?userId=${user.id}&role=${user.role}`, {
          headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => setQuotesList(data))
      .catch(err => console.error(err));
  };

  // 2. Descargar PDF de una cotización
  const handlePrintQuote = async (quoteId) => {
      const loading = toast.loading("Generando PDF...");
      try {
          const res = await fetch(`${API_URL}/quotes/${quoteId}`, {
              headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          
          if (data.success) {
              await generateQuotePDF(data.quote, data.items);
              toast.success("Descargado");
          }
      } catch (error) {
          toast.error("Error al generar PDF");
      } finally {
          toast.dismiss(loading);
      }
  };

  // 3. Carga inicial
  useEffect(() => {
      if(['admin', 'ingeniero'].includes(user.role)) {
          fetchClients();
          fetchCategories();
      }
      if(user.role === 'admin') {
          fetchAllUsers();
      }
  }, [user.role]); // Se ejecuta cuando carga el usuario


// --- HANDLERS COMPRAS Y PROVEEDORES ---

 const handleCreateSupplier = async (e) => {
      e.preventDefault();
      const loading = toast.loading("Guardando proveedor...");
      try {
          await fetch(`${API_URL}/suppliers`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(newSupplier) });
          toast.dismiss(loading);
          toast.success("Proveedor registrado exitosamente"); 
          setNewSupplier({name:'', category_id:'1', contact_name:'', phone:'', email:'', address:''}); 
          fetchSuppliers();
      } catch(e) { 
          toast.dismiss(loading);
          toast.error("Error al crear proveedor"); 
      }
  };

  // 2. Agregar al Carrito (Con validación visual)
  const openPurchaseModal = (prod) => {
      setTempProductToAdd(prod);
      setTempQty(100); // Valor por defecto
      setTempCost(prod.price); // Sugerir precio actual
      setShowQuantityModal(true);
  };

  const confirmAddToCart = () => {
      if (!tempProductToAdd) return;
      if (tempQty <= 0 || tempCost < 0) return toast.error("Valores inválidos");

      setPurchaseCart([...purchaseCart, { 
          product_id: tempProductToAdd.id, 
          name: tempProductToAdd.name, 
          quantity: parseInt(tempQty), 
          cost: parseFloat(tempCost) 
      }]);
      
      toast.success(`Agregado: ${tempQty} x ${tempProductToAdd.name}`, { icon: '🛒' });
      setShowQuantityModal(false);
  };

  // 3. Generar Orden
  const handleCreatePurchase = async () => {
     if(!selectedSupplierForPurchase || purchaseCart.length===0) return toast.error("Debes seleccionar un proveedor y agregar productos");
     
     const loading = toast.loading("Generando Orden de Compra...");
     const total = purchaseCart.reduce((acc, item) => acc + (item.quantity * item.cost), 0);
     
     try {
         const res = await fetch(`${API_URL}/purchases`, { 
             method: 'POST', 
             headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
             body: JSON.stringify({ supplier_id: selectedSupplierForPurchase, items: purchaseCart, total }) 
         });
         const d = await res.json();
         
         toast.dismiss(loading);
         if(d.success) { 
             toast.success("Orden Enviada al Proveedor", { icon: '📨' }); 
             setPurchaseCart([]); 
             fetchPurchases(); 
         } else {
             toast.error(d.error || "Error al guardar");
         }
     } catch(e) { 
         toast.dismiss(loading);
         toast.error("Error de conexión"); 
     }
  };

  // 4. RECIBIR MERCANCÍA (CON CONFIRMACIÓN TOAST ESTILIZADA) ✨
  const handleReceiveOrder = (id) => {
      toast((t) => (
          <div className="flex flex-col gap-3 min-w-[280px]">
              <div className="flex items-start gap-3">
                  <div className="bg-green-100 text-green-600 p-2 rounded-full mt-1">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                      <p className="font-bold text-gray-800 dark:text-white text-sm">¿Confirmar Recepción?</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Esto aumentará el stock en el inventario automáticamente.</p>
                  </div>
              </div>
              
              <div className="flex gap-2 mt-2">
                  <button 
                    onClick={() => toast.dismiss(t.id)}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-md text-xs font-bold transition dark:bg-gray-700 dark:text-gray-300"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => {
                        toast.dismiss(t.id);
                        performReceive(id);
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md text-xs font-bold shadow-sm transition"
                  >
                    Sí, Recibir
                  </button>
              </div>
          </div>
      ), { duration: 8000, className: "dark:bg-gray-800 dark:border-gray-700" });
  };

  // Función auxiliar para ejecutar la recepción
  const performReceive = async (id) => {
      const loading = toast.loading("Actualizando inventario...");
      try {
          const res = await fetch(`${API_URL}/purchases/${id}/receive`, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}` } });
          const d = await res.json();
          
          toast.dismiss(loading);
          if(d.success) { 
              toast.success("Stock Actualizado Correctamente", { icon: '📦' }); 
              fetchPurchases(); 
              fetchInventory(); // Refrescar visualmente
          } else { 
              toast.error(d.error || "Error al recibir"); 
          }
      } catch(e) { 
          toast.dismiss(loading);
          toast.error("Error de conexión"); 
      }
  };

  //FIN DE LAS FUNCIONES HANDLER//



  const openProfileModal = () => {
    setProfileForm({
      first_name: user.first_name || '',
      middle_name: user.middle_name || '',
      last_name_paternal: user.last_name_paternal || '',
      last_name_maternal: user.last_name_maternal || '',
      email: user.email || '',
      phone_mobile: user.phone_mobile || '',
      phone_home: user.phone_home || '',
      occupation: user.occupation || '',
      photo: null
    });
    setShowEditProfileModal(true);
    setShowProfileMenu(false);
  };

  // Animación de entrada suave (Fade In Up)
  const fadeInUp = {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.4 }
  };

  // --- FUNCIONES DEL COTIZADOR ---

  // 1. Agregar producto al carrito
  const addToCart = (product, quantity) => {
      if (quantity <= 0) return toast.error("Cantidad inválida");
      if (quantity > product.stock) return toast.error("No hay suficiente stock");

      const existingItem = quoteCart.find(item => item.product_id === product.id);
      if (existingItem) {
          // Si ya existe, actualizamos cantidad
          setQuoteCart(quoteCart.map(item => 
              item.product_id === product.id 
              ? { ...item, quantity: item.quantity + parseInt(quantity) } 
              : item
          ));
      } else {
          // Si no, lo agregamos
          setQuoteCart([...quoteCart, {
              product_id: product.id,
              name: product.name,
              price: product.price,
              quantity: parseInt(quantity),
              total: product.price * parseInt(quantity)
          }]);
      }
      toast.success("Agregado al carrito");
  };

  // 2. Eliminar del carrito
  const removeFromCart = (index) => {
      const newCart = [...quoteCart];
      newCart.splice(index, 1);
      setQuoteCart(newCart);
  };

  // 3. Guardar la Venta (Enviar al Backend)
  const handleSaveQuote = async (statusType = 'pendiente') => {
      if (!selectedClientForQuote) return toast.error("Selecciona un cliente");
      if (quoteCart.length === 0) return toast.error("El carrito está vacío");

      // Validar stock antes de vender (solo si es venta directa)
      if (statusType === 'entregada') {
          for (let item of quoteCart) {
              const currentProd = inventory.find(p => p.id === item.product_id);
              if (currentProd && item.quantity > currentProd.stock) {
                  return toast.error(`Stock insuficiente para ${item.name}`);
              }
          }
      }

      const totalAmount = quoteCart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
      const loading = toast.loading(statusType === 'entregada' ? "Procesando venta..." : "Guardando cotización...");

      try {
          const response = await fetch(`${API_URL}/quotes`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({
                  client_id: selectedClientForQuote,
                  project_id: selectedProjectForQuote,
                  items: quoteCart,
                  total: totalAmount,
                  status: statusType // <--- ENVIAMOS EL ESTATUS
              })
          });
          const data = await response.json();

          toast.dismiss(loading);

          if (data.success) {
              toast.success(data.message);
              setQuoteCart([]);
              setSelectedClientForQuote('');
              
              // IMPORTANTE: Recargar inventario y ventas
              fetchInventory(); 
              fetchQuotes();
              fetchFinancials(selectedYear); // Actualizar gráficas de dinero
              
              // Opcional: Si es venta, ofrecer imprimir ticket
              if(statusType === 'entregada') {
                  handlePrintQuote(data.quoteId);
              }
          } else {
              toast.error("Error: " + data.error);
          }
      } catch (error) { 
          toast.dismiss(loading);
          toast.error("Error de conexión"); 
      }
  };

  const handleQuoteStatus = async (quoteId, newStatus) => {
      try {
          await fetch(`${API_URL}/quotes/${quoteId}/status`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ status: newStatus })
          });
          toast.success("Estatus actualizado");
          fetchQuotes(); // Recargar la tabla
      } catch (error) { toast.error("Error al actualizar"); }
  };

  const fetchProjectMaterials = (projectId) => {
      fetch(`${API_URL}/projects/${projectId}/materials`, {
          headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => setProjectMaterials(data))
      .catch(err => console.error(err));
  };

  const handleAssignMaterial = async (e) => {
      e.preventDefault();
      if(!materialForm.product_id || !materialForm.quantity) return toast.error("Completa los campos");

      try {
          const response = await fetch(`${API_URL}/projects/${selectedProjectId}/materials`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify(materialForm)
          });
          const data = await response.json();

          if (data.success) {
              toast.success("Material asignado correctamente");
              setMaterialForm({ product_id: '', quantity: '' });
              fetchProjectMaterials(selectedProjectId); // Actualizamos la lista local
              fetchInventory(); // Actualizamos el inventario global (porque bajó el stock)
          } else {
              toast.error(data.error);
          }
      } catch (error) { toast.error("Error de conexión"); }
  };

  const openSendModal = (quote) => {
      setQuoteToSend(quote);
      setShowSendModal(true);
  };

  const sendViaWhatsApp = () => {
      if (!quoteToSend) return;
      const text = `Hola! 👷‍♂️ Le comparto la cotización con folio #${quoteToSend.id} por un total de $${quoteToSend.total}. Quedo atento a sus comentarios.`;
      // Abre WhatsApp Web/App para elegir contacto
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
      setShowSendModal(false);
  };

  const sendViaEmail = () => {
      if (!quoteToSend) return;
      const subject = `Cotización #${quoteToSend.id} - Geo Control Dom`;
      const body = `Estimado cliente,\n\nPor medio de la presente le comparto la cotización solicitada con folio #${quoteToSend.id} por un monto total de $${quoteToSend.total}.\n\nQuedamos a la espera de su confirmación.\n\nSaludos cordiales,\nGeo Control Dom`;
      window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      setShowSendModal(false);
  };

  // --- HANDLERS FIRMA ✍️ ---
  
  const openSignatureModal = (quote) => {
      setQuoteToSign(quote);
      setShowSignatureModal(true);
  };

const clearSignature = () => { 
      if (signaturePadRef.current) signaturePadRef.current.clear(); 
  };

const handleSignAndDownload = async () => {
      if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
          return toast.error("Firme primero");
      }
      
      const load = toast.loading("Firmando...");
      try {
          // Obtenemos la imagen base64 directamente
          const signUrl = signaturePadRef.current.toDataURL('image/png');
          
          const res = await fetch(`${API_URL}/quotes/${quoteToSign.id}`, { 
              headers: { 'Authorization': `Bearer ${token}` } 
          });
          const d = await res.json();
          
          if(d.success) { 
              generateQuotePDF(d.quote, d.items, signUrl); 
              toast.success("Firmado y Descargado"); 
              setShowSignatureModal(false); 
          }
      } catch(e) { 
          console.error(e);
          toast.error("Error al firmar"); 
      } finally { 
          toast.dismiss(load); 
      }
  };

// --- HANDLERS CRONOGRAMA ---
  const openScheduleModal = (proj) => {
      setSelectedProject(proj);
      fetchStages(proj.id);
      setShowScheduleModal(true);
  };

  const fetchStages = (projId) => {
      fetch(`${API_URL}/projects/${projId}/stages`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => res.json()).then(data => setProjectStages(data));
  };

  const handleCreateStage = async (e) => {
      e.preventDefault();
      try {
          await fetch(`${API_URL}/stages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ ...newStage, project_id: selectedProject.id })
          });
          toast.success("Etapa agregada");
          setNewStage({ name: '', start_date: '', end_date: '', percentage_weight: '' });
          fetchStages(selectedProject.id);
      } catch(e) { toast.error("Error"); }
  };

  const toggleStage = async (stage) => {
      try {
          await fetch(`${API_URL}/stages/${stage.id}/toggle`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ is_completed: !stage.is_completed, project_id: selectedProject.id })
          });
          fetchStages(selectedProject.id);
          fetchProjects(user.id, user.role); // ¡Esto actualiza la barra de afuera!
      } catch(e) { toast.error("Error"); }
  };

  const handleDeleteStage = async (id) => {
      if(!window.confirm("¿Borrar etapa?")) return;
      await fetch(`${API_URL}/stages/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      fetchStages(selectedProject.id);
  };

  const monthNames = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
  const currentMonthFinancials = financialData.find(d => d.name === monthNames[selectedMonth]) || { Ventas: 0, Compras: 0, Utilidad: 0 };

  // ==================================================================================
  // 9. RENDERIZADO (JSX COMPLETO)
  // ==================================================================================

  return (

    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex font-sans overflow-hidden transition-colors duration-300">

      {/* OVERLAY MÓVIL */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setIsMobileSidebarOpen(false)}></div>
      )}

      {/* SIDEBAR (ASIDE) */}
      <aside className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-geo-dark text-white flex flex-col transition-transform duration-300 ease-in-out
          ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
          md:relative md:translate-x-0 dark:bg-black border-r dark:border-gray-800
      `}>
        <div className="flex flex-col items-center justify-center py-6 border-b border-gray-800">
            
            {/* 1. LOGO E IMAGEN (Centrados) */}
            <div className="flex items-center gap-3 mb-2">
                {/* Imagen del Logo */}
                <img 
                    src="/logo.png" 
                    alt="Geo Control Logo" 
                    className="h-10 w-auto object-contain" 
                />
                
                {/* Título Principal */}
                <h1 className="text-xl font-bold text-white tracking-wider leading-none">
                    GEO <span className="text-geo-orange">CONTROL</span>
                </h1>
            </div>

            {/* 2. SUBTÍTULO (Sistema Integral) */}
            {/* Si quieres borrarlo, elimina esta línea <p> */}
            <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em]">
                Sistema Integral v2.0
            </p>

        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {[
                { 
                    id: 'general', 
                    label: 'Panel Financiero ', 
                    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>,
                    roles: ['admin', 'contador'] // <-- TODOS VEN EL PANEL
                },
                { 
                    id: 'obras', 
                    label: 'Mis Obras', 
                    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" /></svg>,
                    roles: ['admin', 'ingeniero', 'cliente'] // <-- CONTADOR NO VE OBRAS TÉCNICAS
                },
                { 
                    id: 'inventory', 
                    label: 'Inventario', 
                    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>,
                    roles: ['admin'] // <-- CONTADOR NO MUEVE INVENTARIO FÍSICO
                },
                { 
                    id: 'proveedores', 
                    label: 'Proveedores', 
                    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.717" /></svg>,
                    roles: ['admin', 'contador'] // <-- CONTADOR SÍ VE PROVEEDORES (Para pagos)
                },
                { 
                    id: 'compras', 
                    label: 'Compras / Gastos', 
                    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>,
                    roles: ['admin', 'contador'] // <-- CONTADOR VE GASTOS
                },
                { 
                    id: 'movimientos', 
                    label: 'C. de Materiales', 
                    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 0c0-.834.42-1.637 1.139-2.222a4.484 4.484 0 014.283-1.077 4.5 4.5 0 015.522 3.65 4.482 4.482 0 013.91 3.527M3.75 12c0 .834.42 1.637 1.139 2.222a4.484 4.484 0 004.283 1.077 4.5 4.5 0 005.522-3.65 4.482 4.482 0 003.91-3.527" /></svg>,
                    roles: ['admin', 'contador'] // 🔒 SOLO ELLOS
                },
                { 
                    id: 'cotizador', 
                    label: 'Ventas / Ingresos', 
                    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" /></svg>,
                    roles: ['admin', 'ingeniero', 'contador'] // <-- CONTADOR VE INGRESOS
                },
                { 
                    id: 'reporte', 
                    label: 'Nuevo Reporte', 
                    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>,
                    roles: ['admin', 'ingeniero'] 
                },
                { 
                    id: 'usuarios', 
                    label: 'Nuevo Usuario', 
                    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z" /></svg>,
                    roles: ['admin'] 
                },
                { 
                    id: 'nuevo_proyecto', 
                    label: 'Crear Proyecto', 
                    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75m-.75 3h.75m-.75 3h.75m-.75 3h.75" /></svg>,
                    roles: ['admin', 'ingeniero'] 
                },
                {
                    id: 'nomina',
                    label: 'Nómina y RH',
                    roles: ['admin', 'contador'], // SOLO ELLOS
                    icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 8.25H9m6 3H9m3 6l-3.258-3.259a48.325 48.325 0 00-3.84-3.128c-.26-.199-.557-.461-.81-.723a4.198 4.198 0 01-1.104-2.79C2.998 5.216 5.175 3.75 8 3.75c2.336 0 4.087 1.13 5 2.25 1.06-1.26 2.99-2.25 5-2.25 2.826 0 5.003 1.466 5.003 4.502 0 1.244-.428 2.023-1.104 2.79-.253.262-.55.524-.81.723a48.326 48.326 0 00-3.84 3.128L12 17.25z" /></svg>
                  }
                  ]
            .filter(item => item.roles.includes(user.role))
            .map((item) => (
                <button 
                    key={item.id} 
                    onClick={() => { setActiveView(item.id); setIsMobileSidebarOpen(false); }} 
                    className={`w-full text-left px-4 py-3 rounded font-bold flex gap-3 items-center transition ${activeView === item.id ? 'bg-geo-blue/20 text-geo-orange border-l-4 border-geo-orange' : 'text-gray-300 hover:bg-gray-800 dark:hover:bg-gray-900'}`}
                >
                    {item.icon} {item.label}
                </button>
            ))}
        </nav>

        <div className="p-4 border-t border-gray-700 shrink-0">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 text-red-400 hover:text-red-300 transition text-sm font-semibold px-4 py-2">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">

        {/* Header */}
        <header className="bg-white dark:bg-gray-800 shadow-sm p-4 flex justify-between items-center shrink-0 z-30 transition-colors duration-300">
          
          {/* SECCIÓN IZQUIERDA: Título, Menú Móvil y Fechas */}
          <div className="flex items-center gap-4">
            <button onClick={() => setIsMobileSidebarOpen(true)} className="md:hidden text-geo-dark dark:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
            </button>
            <h1 className="text-xl md:text-3xl font-bold text-geo-dark dark:text-white capitalize truncate">
              {activeView === 'bitacora' ? `Bitácora` : activeView.replace('_', ' ')}
            </h1>
            {activeView === 'general' && (
                    <div className="hidden md:flex gap-2 ml-4">
                        <select 
                            value={selectedMonth} 
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                            className="p-1 border rounded text-sm font-bold text-geo-dark"
                        >
                            {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
                        </select>
                        <select 
                            value={selectedYear} 
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                            className="p-1 border rounded text-sm font-bold text-geo-dark"
                        >
                            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                )}
          </div>

          {/* SECCIÓN DERECHA: GRUPO DE ICONOS (Campana + Tema + Perfil) */}
          {/* Al ponerlos todos en este DIV con 'gap-3', se mantendrán juntos */}
          <div className="flex items-center gap-3 md:gap-4">
            
            {/* 1. CAMPANA DE NOTIFICACIONES */}
            <div className="relative">
                <button 
                    onClick={() => setShowNotifMenu(!showNotifMenu)}
                    className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition relative"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                    </svg>
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse border-2 border-white dark:border-gray-800">
                            {unreadCount}
                        </span>
                    )}
                </button>

                {showNotifMenu && (
                    <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 animate-fadeIn origin-top-right">
                        <div className="p-3 border-b dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900 rounded-t-lg">
                            <span className="font-bold text-sm text-geo-dark dark:text-white">Notificaciones</span>
                            <button onClick={fetchNotifications} className="text-xs text-blue-500 hover:underline">Actualizar</button>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            {notifications.length === 0 ? (
                      <p className="p-4 text-center text-xs text-gray-500">Sin notificaciones</p>
                  ) : (
                      notifications.map(n => (
                          <div 
                              key={n.id} 
                              onClick={() => handleNotifClick(n)} 
                              className={`group relative p-3 border-b dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 flex gap-2 ${n.is_read ? 'opacity-50' : 'bg-blue-50 dark:bg-blue-900/20'}`}
                          >
                              
                              {/* Indicador de Color */}
                              <div className={`w-2 h-2 mt-1 rounded-full shrink-0 ${n.type==='warning'?'bg-red-500':'bg-blue-500'}`}></div>
                              
                              {/* Contenido de texto */}
                              <div className="flex-1 pr-4"> 
                                  <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{n.title}</p>
                                  <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">{n.message}</p>
                                  <p className="text-[9px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                              </div>

                              {/* --- AQUÍ ESTÁ EL BOTÓN QUE TE FALTA --- */}
                              <button 
                                  onClick={(e) => handleDeleteNotif(e, n.id)}
                                  className="absolute top-2 right-2 text-gray-400 hover:text-red-600 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full p-1 transition-colors z-50"
                                  title="Ocultar notificación"
                              >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                              </button>
                              {/* --------------------------------------- */}

                          </div>
                      ))
                  )}
                        </div>
                    </div>
                )}
            </div>

            {/* 2. BOTÓN DARK MODE */}
            <button onClick={toggleTheme} className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition">
              {darkMode ? '☀️' : '🌙'}
            </button>

            {/* 3. PERFIL */}
            <div className="relative">
              <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="bg-white dark:bg-gray-700 p-1 md:p-2 rounded-full shadow-sm flex items-center gap-2 md:gap-3 px-3 md:px-4 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 transition">
                <div className="text-right hidden md:block">
                  <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{getFullName(user)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">{user.role}</p>
                </div>

                <div className="w-8 h-8 md:w-10 md:h-10 bg-geo-blue rounded-full flex items-center justify-center text-white font-bold text-sm overflow-hidden border border-gray-300">
                  {user.photo_url ? (
                    <img src={user.photo_url} alt="Perfil" className="w-full h-full object-cover" />
                  ) : (
                    user.first_name ? user.first_name.charAt(0).toUpperCase() : 'U'
                  )}
                </div>

                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-500 dark:text-gray-400"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 border border-gray-100 dark:border-gray-700 z-50">
                  <button onClick={openProfileModal} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                    ✏️ Editar Perfil
                  </button>
                  <button onClick={() => { setShowPasswordModal(true); setShowProfileMenu(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">
                    🔐 Cambiar Contraseña
                  </button>
                  <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                  <button onClick={handleLogout} className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700">
                    🚪 Cerrar Sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* CONTENIDO PRINCIPAL */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative text-geo-dark dark:text-gray-200">

          {isLoading ? (
            /* --- SKELETON LOADING --- */
            <div className="space-y-6 animate-pulse">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl border border-gray-300 dark:border-gray-600"></div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="h-80 bg-gray-200 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600"></div>
                <div className="h-80 bg-gray-200 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600"></div>
              </div>
              <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600"></div>
            </div>
          ) : (
            /* --- VISTAS --- */
            <>
              {/* 1. VISTA GENERAL (GRÁFICAS) */}
             {activeView === 'general' && (
                         <motion.div {...fadeInUp} key="general">
                            <GeneralAnalytics 
                                projects={projects} 
                                inventory={inventory} 
                                quotes={quotesList} 
                                purchases={purchasesList}
                                financialData={financialData}
                                onNavigate={setActiveView}
                                onFilter={setStatusFilter}
                                currentMonthFinancials={currentMonthFinancials}
                                selectedMonthName={monthNames[selectedMonth]}
                                selectedYear={selectedYear}
                            />
                         </motion.div>
                    )}

              {/* 2. VISTA MIS OBRAS */}
                    {(activeView === 'inventario' || activeView === 'inventory') && (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ duration: 0.4 }}
                    className="space-y-6"
                >
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
                        <h2 className="text-xl font-bold text-geo-dark dark:text-white">
                            Inventario
                        </h2>
                        <div className="flex gap-2">
                            {/* Botón Nuevo Producto */}
                            <button 
                                onClick={() => openProductModal()} 
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-bold text-sm shadow-md transition flex items-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                                Nuevo Producto
                            </button>
                            
                            {/* Botón Excel */}
                            <button 
                                onClick={() => handleExportExcel(inventory, 'Reporte_Inventario')} 
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-bold text-sm flex items-center gap-2 shadow-md transition"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M13.125 12h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125M20.625 12c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5M12 14.625v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 14.625c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 1.5v-1.5m0 0c0-.621.504-1.125 1.125-1.125m0 0h7.5" />
                                </svg>
                                Excel
                            </button>
                        </div>
                    </div>
                    
                    {/* TABLA */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto border border-gray-200 dark:border-gray-700">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold uppercase">
                                <tr>
                                    <th className="p-4">Código</th>
                                    <th className="p-4">Producto</th>
                                    <th className="p-4">Categoría</th>
                                    <th className="p-4 text-center">Stock</th>
                                    <th className="p-4 text-right">Precio</th>
                                    <th className="p-4 text-center">Estado</th>
                                    <th className="p-4 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {inventory.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="p-8 text-center text-gray-400">
                                            No hay productos registrados en la base de datos.
                                        </td>
                                    </tr>
                                ) : (
                                    inventory.map(p => (
                                        <tr key={p.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white transition-colors">
                                            <td className="p-4 font-mono text-xs text-gray-500 dark:text-gray-400">{p.code}</td>
                                            <td className="p-4 font-bold">{p.name}</td>
                                            <td className="p-4 text-xs uppercase text-gray-500">{p.category_name}</td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${p.stock <= p.min_stock ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>
                                                    {p.stock} {p.unit}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right font-mono">${p.price}</td>
                                            <td className="p-4 text-center">
                                                {p.stock <= p.min_stock && (
                                                    <span className="text-xs font-bold text-red-500 animate-pulse">⚠️ BAJO</span>
                                                )}
                                            </td>
                                            
                                            {/* BOTONES DE ACCIÓN */}
                                            <td className="p-4 text-center flex justify-center gap-3">
                                                <button 
                                                    onClick={() => openProductModal(p)} 
                                                    className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-blue-50 dark:hover:bg-gray-600 transition" 
                                                    title="Editar"
                                                >
                                                    ✏️
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteProduct(p.id)} 
                                                    className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-gray-600 transition" 
                                                    title="Eliminar"
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            )}

                    {activeView === 'cotizador' && (
                 <motion.div {...fadeInUp} key="cotizador" className="space-y-6">
                     <h2 className="text-xl font-bold text-geo-dark dark:text-white">Nueva Cotización</h2>
                     
                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* COLUMNA IZQUIERDA: CLIENTE, OBRA Y PRODUCTOS */}
                        <div className="lg:col-span-2 space-y-6">
                            
                            {/* 1. SELECCIÓN DE CLIENTE Y OBRA (PASO 4 REALIZADO AQUÍ) */}
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-500 mb-1">Cliente</label>
                                    <select 
                                        className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white"
                                        value={selectedClientForQuote}
                                        onChange={(e) => {
                                            setSelectedClientForQuote(e.target.value);
                                            setSelectedProjectForQuote(''); // Resetear proyecto al cambiar cliente
                                        }}
                                    >
                                        <option value="">-- Seleccionar Cliente --</option>
                                        {clientsList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                
                                {/* Selector de Proyecto (Solo aparece si hay cliente seleccionado) */}
                                {selectedClientForQuote && (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-500 mb-1">Asignar a Obra (Opcional)</label>
                                        <select 
                                            className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white"
                                            value={selectedProjectForQuote}
                                            onChange={(e) => setSelectedProjectForQuote(e.target.value)}
                                        >
                                            <option value="">-- Venta General / Sin Obra --</option>
                                            {projects
                                                .filter(p => p.client_id == selectedClientForQuote) // Filtramos sus obras
                                                .map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                                            }
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* 2. LISTA DE PRODUCTOS (CATÁLOGO) */}
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow h-96 overflow-y-auto">
                                <h3 className="font-bold mb-4 dark:text-white">Agregar Productos</h3>
                                <table className="w-full text-sm text-left dark:text-gray-300">
                                    <thead>
                                        <tr className="border-b dark:border-gray-700">
                                            <th className="p-2">Producto</th>
                                            <th className="p-2 text-right">Precio</th>
                                            <th className="p-2 text-center">Stock</th>
                                            <th className="p-2 text-center">Acción</th>
                                        </tr>
                                    </thead>
                            <tbody className="text-sm">
                            {inventory.map(p => (
                                <tr key={p.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white">
                                    <td className="p-3 font-mono text-xs">{p.code}</td>
                                    <td className="p-3 font-bold">{p.name}</td>
                                    <td className="p-3 text-center">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${p.stock <= p.min_stock ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                            {p.stock} {p.unit}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right">${p.price}</td>
                                    
                                    {/* COLUMNA DE ACCIONES CORREGIDA */}
                                    <td className="p-3 text-center flex justify-center gap-2">
                                        {/* Botón EDITAR (El que faltaba) */}
                                        <button 
                                            onClick={() => openProductModal(p)} 
                                            className="text-blue-500 hover:text-blue-700 p-1" 
                                            title="Editar"
                                        >
                                            ✏️
                                        </button>
                                        
                                        {/* Botón ELIMINAR */}
                                        <button 
                                            onClick={() => handleDeleteProduct(p.id)} 
                                            className="text-red-500 hover:text-red-700 p-1" 
                                            title="Eliminar"
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                    <td className="p-3 text-center">
                                        <button 
                                            onClick={() => addToCart(p, 1)} 
                                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded shadow text-xs font-bold transition flex items-center gap-1 mx-auto"
                                            disabled={p.stock <= 0}
                                        >
                                            {p.stock > 0 ? (
                                                <>
                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                                    </svg>
                                                    Agregar
                                                </>
                                            ) : (
                                                'Agotado'
                                            )}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                                </table>
                            </div>
                        </div>

                        {/* COLUMNA DERECHA: TICKET / RESUMEN */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow h-fit border-t-4 border-geo-orange">
                            <h3 className="font-bold text-lg mb-4 dark:text-white">Resumen de Venta</h3>
                            
                            {quoteCart.length === 0 ? (
                                <p className="text-gray-400 text-center py-8">El carrito está vacío</p>
                            ) : (
                                <div className="space-y-4">
                                    {quoteCart.map((item, index) => (
                                        <div key={index} className="flex justify-between items-center border-b border-gray-100 pb-2">
                                            <div>
                                                <p className="font-bold text-sm dark:text-white">{item.name}</p>
                                                <p className="text-xs text-gray-500">{item.quantity} x ${item.price}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-geo-blue">${item.quantity * item.price}</p>
                                                <button onClick={() => removeFromCart(index)} className="text-red-400 text-xs hover:underline">Quitar</button>
                                            </div>
                                        </div>
                                    ))}

                                    <div className="pt-4 mt-4 border-t border-gray-200">
                                        <div className="flex justify-between text-xl font-bold text-geo-dark dark:text-white">
                                            <span>TOTAL:</span>
                                            <span>${quoteCart.reduce((acc, item) => acc + (item.price * item.quantity), 0).toFixed(2)}</span>
                                        </div>
                                        <div className="flex gap-2 mt-6">
                                        <button 
                                            onClick={() => handleSaveQuote('pendiente')}
                                            className="flex-1 bg-gray-600 text-white py-3 rounded-lg font-bold hover:bg-gray-700 transition shadow"
                                        >
                                            📄 Solo Cotizar
                                        </button>
                                        <button 
                                            onClick={() => handleSaveQuote('entregada')}
                                            className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition shadow-lg flex justify-center items-center gap-2"
                                        >
                                            💵 Venta Directa
                                        </button>
                                    </div>
                                    </div>
                                </div>
                            )}
                        </div>
                     </div>

                     {/* --- HISTORIAL DE COTIZACIONES --- */}
                     <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mt-8 border border-gray-200 dark:border-gray-700">
                         <h3 className="text-lg font-bold mb-4 text-geo-dark dark:text-white">Historial de Pedidos</h3>
                         
                         <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm dark:text-gray-300">
                                <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 uppercase text-xs font-bold">
                                    <tr>
                                        <th className="p-3">Folio</th>
                                        <th className="p-3">Cliente</th>
                                        <th className="p-3">Destino / Obra</th>
                                        <th className="p-3">Fecha</th>
                                        <th className="p-3">Vendedor</th>
                                        <th className="p-3 text-right">Total</th>
                                        <th className="p-3 text-center">Estatus Envío</th>
                                        <th className="p-3 text-center">Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {quotesList.length === 0 ? (
                                        <tr><td colSpan="8" className="p-4 text-center text-gray-400">No hay cotizaciones registradas.</td></tr>
                                    ) : (
                                        quotesList.map(q => (
                                            <tr key={q.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                                                <td className="p-3 font-mono text-xs">#{q.id.toString().padStart(4, '0')}</td>
                                                <td className="p-3 font-bold">{q.client_name || 'Cliente General'}</td>
                                                <td className="p-3 text-xs text-gray-500">{q.project_name || 'Venta General'}</td>
                                                <td className="p-3">{new Date(q.created_at).toLocaleDateString()}</td>
                                                <td className="p-3 text-xs">{q.seller_name}</td>
                                                <td className="p-3 text-right font-mono text-green-600 font-bold">${q.total}</td>
                                                
                                                {/* SELECTOR DE ESTATUS DE ENVÍO */}
                                                <td className="p-3">
                                                    <select 
                                                        value={q.status} 
                                                        onChange={(e) => handleQuoteStatus(q.id, e.target.value)}
                                                        className={`text-xs px-2 py-1 rounded-full font-bold uppercase border-none cursor-pointer outline-none
                                                            ${q.status === 'pendiente' ? 'bg-yellow-100 text-yellow-800' : 
                                                              q.status === 'en_ruta' ? 'bg-blue-100 text-blue-800' : 
                                                              q.status === 'entregada' ? 'bg-green-100 text-green-800' : 'bg-red-100'}`}
                                                    >
                                                        <option value="pendiente">Pendiente</option>
                                                        <option value="aprobada">Aprobada</option>
                                                        <option value="en_ruta">🚚 En Ruta</option>
                                                        <option value="entregada">✅ Entregada</option>
                                                        <option value="cancelada">❌ Cancelada</option>
                                                    </select>
                                                </td>

                                               <td className="p-3">
                                                    {/* Contenedor Flex para alinear botones horizontalmente */}
                                                    <div className="flex items-center justify-center gap-2">
                                                        
                                                        {/* Botón Firmar (NUEVO) */}
                                                    <button 
                                                        onClick={() => openSignatureModal(q)}
                                                        className="bg-purple-100 text-purple-600 px-3 py-1 rounded hover:bg-purple-200 text-xs font-bold flex items-center gap-1 transition"
                                                        title="Firmar Documento"
                                                    >
                                                        ✒️
                                                    </button>
                                                        
                                                        {/* Botón PDF */}
                                                        <button 
                                                            onClick={() => handlePrintQuote(q.id)}
                                                            className="bg-red-100 text-red-600 px-3 py-1 rounded hover:bg-red-200 text-xs font-bold flex items-center gap-1 transition"
                                                            title="Descargar PDF"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                                            </svg>
                                                            PDF
                                                        </button>

                                                        {/* Botón Enviar */}
                                                        <button 
                                                            onClick={() => openSendModal(q)}
                                                            className="bg-blue-100 text-blue-600 px-3 py-1 rounded hover:bg-blue-200 text-xs font-bold flex items-center gap-1 transition"
                                                            title="Enviar por Correo o WhatsApp"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                                                            </svg>
                                                            Enviar
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                         </div>
                     </div>

                 </motion.div>
            )}

            {activeView === 'movimientos' && ['admin', 'contador'].includes(user.role) && (
                <motion.div {...fadeInUp} key="movimientos" className="space-y-6">
                    <h2 className="text-xl font-bold dark:text-white">Auditoría: Movimientos de Materiales (Últimos 50)</h2>
                    
                    <div className="flex justify-end">
                         {/* Botón para exportar Excel de Movimientos (podemos reutilizar handleExportExcel) */}
                         <button 
                            onClick={() => handleExportExcel(materialMovements, 'Auditoria_Movimientos')}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-bold text-sm flex items-center gap-2 shadow-md transition"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                            Exportar a Excel
                        </button>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto border border-gray-200 dark:border-gray-700">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold uppercase">
                                <tr>
                                    <th className="p-4">Fecha/Hora</th>
                                    <th className="p-4">Material (Costo Unit.)</th>
                                    <th className="p-4">Proyecto Destino</th>
                                    <th className="p-4 text-center">Cantidad</th>
                                    <th className="p-4 text-right">Costo Total</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {materialMovements.length === 0 ? (
                                    <tr><td colSpan="5" className="p-8 text-center text-gray-400">No hay movimientos registrados.</td></tr>
                                ) : (
                                    materialMovements.map(m => (
                                        <tr key={m.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                                            <td className="p-4">
                                                {new Date(m.assigned_at).toLocaleString()}
                                                <p className="text-[10px] text-gray-500 mt-1">Por: {m.user_name}</p>
                                            </td>
                                            <td className="p-4 font-bold">{m.product_name} 
                                                <span className="text-xs text-gray-500 block">(${parseFloat(m.price).toLocaleString()})</span>
                                            </td>
                                            <td className="p-4 text-blue-600 font-medium">{m.project_name}</td>
                                            <td className="p-4 text-center font-bold text-lg">{m.quantity} {m.unit}</td>
                                            <td className="p-4 text-right font-bold text-red-600">${parseFloat(m.total_cost).toLocaleString()}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
              )}
                    {/* --- MODAL DE PRODUCTO (PONLO AL FINAL JUNTO A LOS OTROS MODALS) --- */}
                    {showProductModal && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg w-full max-w-lg shadow-2xl">
                                <h3 className="text-xl font-bold mb-4 text-geo-dark dark:text-white">
                                    {isEditingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                                </h3>
                                <form onSubmit={handleSaveProduct} className="grid grid-cols-2 gap-4">
                                    <div className="col-span-1">
                                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Código (SKU)</label>
                                        <input type="text" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={productForm.code} onChange={(e) => setProductForm({...productForm, code: e.target.value})} required />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Categoría</label>
                                        <select className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={productForm.category_id} onChange={(e) => setProductForm({...productForm, category_id: e.target.value})}>
                                            <option value="1">Materiales Construcción</option>
                                            <option value="2">Soluciones Empaque</option>
                                            <option value="3">Servicios</option>
                                        </select>
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Nombre del Producto</label>
                                        <input type="text" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={productForm.name} onChange={(e) => setProductForm({...productForm, name: e.target.value})} required />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Precio Unitario</label>
                                        <input type="number" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={productForm.price} onChange={(e) => setProductForm({...productForm, price: e.target.value})} required />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Unidad de Medida</label>
                                        <input type="text" placeholder="Ej. Pza, Kg, m3" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={productForm.unit} onChange={(e) => setProductForm({...productForm, unit: e.target.value})} required />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Stock Actual</label>
                                        <input type="number" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white font-bold text-blue-600" value={productForm.stock} onChange={(e) => setProductForm({...productForm, stock: e.target.value})} required />
                                    </div>
                                    <div className="col-span-1">
                                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 text-red-500">Stock Mínimo (Alerta)</label>
                                        <input type="number" className="w-full p-2 border rounded border-red-200 dark:bg-gray-700 dark:border-red-900 dark:text-white" value={productForm.min_stock} onChange={(e) => setProductForm({...productForm, min_stock: e.target.value})} required />
                                    </div>
                                    
                                    <div className="col-span-2 flex gap-4 mt-4">
                                        <button type="button" onClick={() => setShowProductModal(false)} className="flex-1 py-2 border rounded hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700">Cancelar</button>
                                        <button type="submit" className="flex-1 py-2 bg-geo-blue text-white rounded font-bold hover:bg-blue-900">Guardar</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* --- MODAL ENVIAR COTIZACIÓN (NUEVO) --- */}
      {showSendModal && quoteToSend && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl text-center max-w-sm w-full relative border border-gray-100 dark:border-gray-700">
            
            <button onClick={() => setShowSendModal(false)} className="absolute top-3 right-4 text-gray-400 hover:text-red-500 font-bold text-xl">&times;</button>
            
            <h3 className="text-xl font-bold text-geo-dark dark:text-white mb-1">Enviar Cotización</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Folio #{quoteToSend.id} • ${quoteToSend.total}</p>
            
            <div className="space-y-3">
                {/* Opción WhatsApp */}
                <button onClick={sendViaWhatsApp} className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white py-3 rounded-lg font-bold flex items-center justify-center gap-3 transition transform hover:-translate-y-1 shadow-md">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592z"/>
                    </svg>
                    Enviar por WhatsApp
                </button>

                {/* Opción Correo */}
                <button onClick={sendViaEmail} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-3 transition transform hover:-translate-y-1 shadow-md">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    Enviar por Correo
                </button>
            </div>
            
            <p className="mt-4 text-xs text-gray-400">
                Tip: Descarga primero el PDF para adjuntarlo.
            </p>
          </div>
        </div>
      )}

              {/* 3. VISTA BITÁCORA */}
              {activeView === 'bitacora' && (
                <motion.div {...fadeInUp} key="bitacora" className="space-y-6">
                    
                    {/* Encabezado y Botones */}
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
                        <button onClick={() => setActiveView('obras')} className="text-geo-blue dark:text-blue-400 hover:underline self-start md:self-center">← Volver a Obras</button>
                        <h2 className="text-xl font-bold dark:text-white text-center">Proyecto: {selectedProjectName}</h2>
                        <button onClick={handleDownloadPDF} className="bg-red-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-red-700 font-bold text-sm shadow">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                            Reporte PDF
                        </button>
                    </div>

                    {/* PESTAÑAS DE NAVEGACIÓN */}
                    <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
                        <button
                            onClick={() => setBitacoraTab('avances')}
                            className={`flex-1 py-3 text-center font-bold transition border-b-2 ${bitacoraTab === 'avances' ? 'border-geo-blue text-geo-blue dark:text-blue-400 dark:border-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                        >
                            📸 Avances y Reportes
                        </button>
                        <button
                            onClick={() => setBitacoraTab('materiales')}
                            className={`flex-1 py-3 text-center font-bold transition border-b-2 ${bitacoraTab === 'materiales' ? 'border-geo-blue text-geo-blue dark:text-blue-400 dark:border-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                        >
                            🧱 Materiales Asignados
                        </button>
                        <button
                            onClick={() => setBitacoraTab('galeria')}
                            className={`flex-1 py-3 px-4 text-center font-bold transition border-b-2 whitespace-nowrap ${bitacoraTab === 'galeria' ? 'border-geo-blue text-geo-blue dark:text-blue-400 dark:border-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                        >
                            🖼️ Galería Visual
                        </button>
                    </div>

                    {/* CONTENIDO: PESTAÑA AVANCES (Lo que ya tenías) */}
                    {bitacoraTab === 'avances' && (
                        <div className="space-y-6 animate-fadeIn">
                            {user.role !== 'cliente' && (
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border-l-4 border-blue-500">
                                    <h4 className="font-bold mb-4 dark:text-white">Nuevo Reporte de Avance</h4>
                                    <form onSubmit={handleSubmitReport} className="space-y-4">
                                        <textarea className="w-full p-3 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Descripción del avance..." value={newReport.description} onChange={(e) => setNewReport({...newReport, description: e.target.value})} required></textarea>
                                        <div><label className="text-sm text-gray-600 dark:text-gray-400 block mb-1">Evidencia (Foto)</label><input id="report-image" type="file" accept="image/*" className="text-sm w-full dark:text-gray-300" onChange={(e) => setNewReport({...newReport, image: e.target.files[0]})} /></div>
                                        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-bold text-sm">Publicar Avance</button>
                                    </form>
                                </div>
                            )}
                            {selectedProjectReports.length === 0 ? <div className="bg-white dark:bg-gray-800 p-8 rounded text-center text-gray-500">No hay reportes aún.</div> : selectedProjectReports.map(rep => (
                                <div key={rep.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border-l-4 border-geo-orange flex flex-col gap-3 group relative">
                                    
                                    {/* Cabecera del Reporte */}
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-sm text-gray-400 font-bold">Por: <span className="text-geo-dark dark:text-white">{rep.user_name}</span></p>
                                            <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 px-2 py-1 rounded mt-1 inline-block">
                                                {new Date(rep.report_date).toLocaleDateString()} {new Date(rep.report_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        </div>

                                        {/* BOTÓN BORRAR (Solo Admin o el Dueño del reporte) */}
                                        {(user.role === 'admin' || user.id === rep.user_id) && (
                                            <button 
                                                onClick={() => handleDeleteReport(rep.id)}
                                                className="text-gray-300 hover:text-red-500 transition p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20"
                                                title="Eliminar Reporte"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>

                                    <p className="text-gray-800 dark:text-gray-200 whitespace-pre-line">{rep.description}</p>
                                    
                                    {rep.image_url && (
                                        <div className="mt-2 rounded overflow-hidden border border-gray-200 dark:border-gray-700">
                                            <img src={rep.image_url} alt="Evidencia" className="max-h-96 object-contain w-full bg-gray-50 dark:bg-black" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* CONTENIDO: PESTAÑA MATERIALES (NUEVO) */}
                    {bitacoraTab === 'materiales' && (
                        <div className="space-y-6 animate-fadeIn">
                            {/* Formulario de Asignación (Solo Inge/Admin) */}
                            {user.role !== 'cliente' && (
                                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border-l-4 border-green-500">
                                    <h4 className="font-bold mb-4 dark:text-white">Solicitar / Asignar Material</h4>
                                    <form onSubmit={handleAssignMaterial} className="flex flex-col md:flex-row gap-4 items-end">
                                        <div className="flex-1 w-full">
                                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Producto del Almacén</label>
                                            <select 
                                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                value={materialForm.product_id}
                                                onChange={(e) => setMaterialForm({...materialForm, product_id: e.target.value})}
                                                required
                                            >
                                                <option value="">-- Seleccionar --</option>
                                                {inventory.map(p => (
                                                    <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                                                        {p.name} (Disp: {p.stock} {p.unit})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="w-full md:w-32">
                                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Cantidad</label>
                                            <input 
                                                type="number" 
                                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                                placeholder="0"
                                                value={materialForm.quantity}
                                                onChange={(e) => setMaterialForm({...materialForm, quantity: e.target.value})}
                                                required
                                            />
                                        </div>
                                        <button type="submit" className="w-full md:w-auto bg-green-600 text-white px-6 py-2 rounded font-bold hover:bg-green-700">
                                            + Asignar
                                        </button>
                                    </form>
                                </div>
                            )}

                            {/* Tabla de Materiales Usados */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                                <table className="w-full text-left text-sm dark:text-gray-300">
                                    <thead className="bg-gray-100 dark:bg-gray-700 uppercase text-xs font-bold text-gray-600 dark:text-white">
                                        <tr>
                                            <th className="p-3">Fecha</th>
                                            <th className="p-3">Código</th>
                                            <th className="p-3">Material</th>
                                            <th className="p-3 text-right">Cantidad</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {projectMaterials.length === 0 ? (
                                            <tr><td colSpan="4" className="p-6 text-center text-gray-400">No se han asignado materiales a esta obra.</td></tr>
                                        ) : (
                                            projectMaterials.map(mat => (
                                                <tr key={mat.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                                                    <td className="p-3">{new Date(mat.assigned_at).toLocaleDateString()}</td>
                                                    <td className="p-3 font-mono text-xs">{mat.code}</td>
                                                    <td className="p-3 font-medium">{mat.name}</td>
                                                    <td className="p-3 text-right font-bold">{mat.quantity} {mat.unit}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    {bitacoraTab === 'galeria' && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="flex justify-between items-end">
                                <div>
                                    <h3 className="text-lg font-bold dark:text-white">Evolución Fotográfica</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Historial visual de "Antes y Después" ordenado por fecha.</p>
                                </div>
                                <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-bold">
                                    {selectedProjectReports.filter(r => r.image_url).length} Fotos
                                </span>
                            </div>
                            
                            {/* GRID DE FOTOS */}
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {selectedProjectReports.filter(r => r.image_url).length === 0 ? (
                                    <div className="col-span-full py-12 text-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                                        <p className="text-gray-400 text-sm">No se ha subido evidencia fotográfica todavía.</p>
                                    </div>
                                ) : (
                                    // Filtramos solo los que tienen imagen y mapeamos
                                    selectedProjectReports
                                    .filter(r => r.image_url)
                                    .sort((a, b) => new Date(a.report_date) - new Date(b.report_date)) // Ordenar: Más antiguo primero (El "Antes")
                                    .map((rep, index) => (
                                        <div 
                                            key={rep.id} 
                                            className="group relative aspect-square bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden cursor-zoom-in shadow-md hover:shadow-2xl transition-all duration-300 border border-gray-200 dark:border-gray-600"
                                            onClick={() => window.open(rep.image_url, '_blank')} // Click para ver grande
                                        >
                                            {/* Imagen */}
                                            <img 
                                                src={rep.image_url} 
                                                alt="Evidencia de Obra" 
                                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                loading="lazy"
                                            />
                                            
                                            {/* Etiqueta de "Inicio" en la primera foto */}
                                            {index === 0 && (
                                                <div className="absolute top-2 left-2 bg-geo-orange text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg z-10">
                                                    ORIGEN (ANTES)
                                                </div>
                                            )}
                                            {/* Etiqueta de "Actual" en la última foto */}
                                            {index === (selectedProjectReports.filter(r => r.image_url).length - 1) && (
                                                <div className="absolute top-2 right-2 bg-green-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg z-10">
                                                    ACTUAL (DESPUÉS)
                                                </div>
                                            )}

                                            {/* Overlay de Información (Aparece al pasar el mouse) */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                                                <p className="text-geo-orange text-[10px] font-bold uppercase tracking-wider mb-1">
                                                    {new Date(rep.report_date).toLocaleDateString()}
                                                </p>
                                                <p className="text-white text-xs font-medium line-clamp-2 leading-relaxed">
                                                    {rep.description}
                                                </p>
                                                <p className="text-gray-400 text-[9px] mt-2">
                                                    Subido por: {rep.user_name || 'Ingeniero'}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                </motion.div>
            )}

              {/* 4. VISTA NUEVO REPORTE */}
              {activeView === 'reporte' && user.role !== 'cliente' && (
                <motion.div {...fadeInUp} key="reporte" className="max-w-2xl bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
                  <h3 className="text-xl font-bold mb-6 text-geo-dark dark:text-white">Registrar Avance de Obra</h3>
                  <form onSubmit={handleSubmitReport} className="space-y-6">
                    <div className="flex flex-col">
                      <label className="mb-1 text-sm font-bold text-gray-600 dark:text-gray-400">Seleccionar Obra</label>
                      <select
                        className="w-full p-3 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        value={newReport.project_id}
                        onChange={(e) => {
                          setNewReport({ ...newReport, project_id: e.target.value });
                          setSelectedProjectId(e.target.value);
                        }}
                        required
                      >
                        <option value="">-- Seleccione --</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <label className="mb-1 text-sm font-bold text-gray-600 dark:text-gray-400">Descripción del Hallazgo</label>
                      <textarea className="w-full p-3 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white h-32" value={newReport.description} onChange={(e) => setNewReport({ ...newReport, description: e.target.value })} required></textarea>
                    </div>
                    <button type="submit" className="bg-geo-orange text-white px-6 py-3 rounded font-bold w-full shadow hover:bg-orange-600 transition">Guardar en Bitácora</button>
                  </form>
                </motion.div>
              )}

              {/* 2. VISTA MIS OBRAS */}
            {activeView === 'obras' && (
                <motion.div {...fadeInUp} key="obras" className="space-y-6">

                  {/* BARRA DE HERRAMIENTAS */}
                  <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">

                    {/* Buscador */}
                    <div className="relative w-full md:w-96">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 focus:border-geo-blue focus:ring-1 focus:ring-geo-blue sm:text-sm transition duration-150 ease-in-out"
                        placeholder="Buscar por nombre o ubicación..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>

                    {/* Filtros de Estatus */}
                    <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
                      {[
                        { id: 'todos', label: 'Todos' },
                        { id: 'activo', label: 'Activos' },
                        { id: 'pausa', label: 'En Pausa' },
                        { id: 'finalizado', label: 'Finalizados' }
                      ].map(filter => (
                        <button
                          key={filter.id}
                          onClick={() => setStatusFilter(filter.id)}
                          className={`px-4 py-2 rounded-full text-xs font-bold uppercase transition whitespace-nowrap
                                                ${statusFilter === filter.id
                              ? 'bg-geo-dark dark:bg-white text-white dark:text-black shadow-md'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>

                    {/* BOTONES DE EXPORTACIÓN */}
                    <div className="flex gap-2">
                        {/* Botón EXCEL */}
                        <button 
                            onClick={() => handleExportExcel(filteredProjects, 'Reporte_Obras')}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md font-bold text-sm flex items-center gap-2 transition shadow-md whitespace-nowrap"
                            title="Descargar Excel"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                        </button>
                        
                        {/* Botón PDF */}
                        <button 
                            onClick={() => handleDownloadListPDF('projects')}
                            className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-md font-bold text-sm flex items-center gap-2 transition shadow-md whitespace-nowrap"
                            title="Descargar PDF"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                        </button>
                    </div>
                  </div>

                  {/* GRID DE PROYECTOS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredProjects.length === 0 ? (
                      <div className="col-span-1 md:col-span-2 text-center py-12 bg-white dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                        <p className="text-gray-400 dark:text-gray-500 text-lg">No se encontraron obras con esos criterios.</p>
                        <button onClick={() => { setSearchQuery(''); setStatusFilter('todos') }} className="mt-2 text-geo-blue dark:text-blue-400 font-bold hover:underline">
                          Limpiar filtros
                        </button>
                      </div>
                    ) : filteredProjects.map((proj) => (
                      <div key={proj.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow">

                        {/* Portada */}
                        {proj.image_url && (
                          <div className="h-40 w-full mb-4 overflow-hidden rounded-md relative group">
                            <img
                              src={
                                proj.image_url?.startsWith('http')
                                  ? proj.image_url
                                  : `${API_URL}${proj.image_url}`
                              }
                              alt="Portada"
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                          </div>
                        )}

                        {/* Info Principal y Estatus */}
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-xl font-bold text-geo-dark dark:text-white">{proj.name}</h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              {proj.location}
                            </p>
                          </div>

                          {/* Selector de Estatus (Solo Admin/Inge) */}
                          {['admin', 'ingeniero'].includes(user.role) ? (
                            <select
                              value={proj.status}
                              onChange={(e) => handleUpdateStatus(proj.id, e.target.value)}
                              className={`text-xs px-2 py-1 rounded-full font-bold uppercase border-none focus:ring-2 cursor-pointer outline-none
                                                        ${proj.status === 'activo' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                  proj.status === 'pausa' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                                    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <option value="activo">Activo</option>
                              <option value="pausa">En Pausa</option>
                              <option value="finalizado">Finalizado</option>
                            </select>
                          ) : (
                            <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase 
                                                    ${proj.status === 'activo' ? 'bg-blue-100 text-blue-800' :
                                proj.status === 'pausa' ? 'bg-orange-100 text-orange-800' :
                                  'bg-green-100 text-green-800'}`}>
                              {proj.status}
                            </span>
                          )}
                        </div>

                        {/* Link a PDF */}
                        {proj.pdf_url && (
                          <a href={proj.pdf_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4 block font-semibold flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                            Ver Planos / Documentos
                          </a>
                        )}

                        {/* Barra Progreso (Físico) */}
                        <div className="mb-2">
                          <div className="flex justify-between text-sm font-bold text-gray-600 dark:text-gray-400 mb-1">
                            <span>Avance</span><span>{proj.progress || 0}%</span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                            <div className="bg-geo-orange h-4 rounded-full transition-all duration-1000 ease-out" style={{ width: `${proj.progress || 0}%` }}></div>
                          </div>
                        </div>

                        {/* KPI FINANCIERO (Dinero) 💰 */}
                        {['admin', 'ingeniero'].includes(user.role) && (
                            <div className="mb-4 bg-gray-50 dark:bg-gray-900 p-3 rounded border border-gray-100 dark:border-gray-700">
                                <div className="flex justify-between text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">
                                    <span>Presupuesto: ${parseInt(proj.budget || 0).toLocaleString()}</span>
                                    <span className={cleanNumber(proj.total_spent) > cleanNumber(proj.budget) ? "text-red-500" : "text-green-600"}>
                                        Gasto: ${parseInt(proj.total_spent || 0).toLocaleString()}
                                    </span>
                                </div>
                                {/* Barra de Gasto */}
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                    <div 
                                        className={`h-2 rounded-full transition-all duration-1000 ${cleanNumber(proj.total_spent) > cleanNumber(proj.budget) ? 'bg-red-500' : 'bg-green-500'}`} 
                                        style={{ width: `${Math.min((cleanNumber(proj.total_spent) / (cleanNumber(proj.budget) || 1)) * 100, 100)}%` }}
                                    ></div>
                                </div>
                                {cleanNumber(proj.total_spent) > cleanNumber(proj.budget) && (
                                    <p className="text-[10px] text-red-500 font-bold mt-1 text-center animate-pulse">⚠️ PRESUPUESTO EXCEDIDO</p>
                                )}
                            </div>
                        )}

                        {/* Controles Admin (Editar/Borrar/Avance) */}
                        {user.role === 'admin' && (
                          <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <div className="flex gap-2">
                              <button 
                                    onClick={() => openScheduleModal(proj)}
                                    className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded text-xs font-bold hover:bg-indigo-200 flex items-center gap-1"
                                >
                                    📅 Cronograma
                                </button>
                            </div>
                            
                            <div className="flex gap-2">
                                {/* Botón Editar */}
                                <button 
                                    onClick={() => handleEditProjectClick(proj)} 
                                    className="text-blue-500 hover:text-blue-700 p-2 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
                                    title="Editar Proyecto"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                    </svg>
                                </button>

                                {/* Botón Eliminar */}
                                <button
                                  onClick={() => handleDeleteProject(proj.id)}
                                  className="text-red-500 hover:text-red-700 p-2 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition"
                                  title="Eliminar Proyecto"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                  </svg>
                                </button>
                            </div>
                          </div>
                        )}

                        {/* BOTONES INFERIORES */}
                        <div className="flex gap-2 mt-4">
                          <button onClick={() => viewBitacora(proj)} className="flex-1 border border-geo-blue text-geo-blue dark:text-blue-400 dark:border-blue-400 py-2 rounded hover:bg-geo-blue hover:text-white dark:hover:bg-blue-900 transition shadow-sm">
                            {user.role === 'cliente' ? 'Ver Reportes' : 'Gestionar Bitácora'}
                          </button>
                          <button
                            onClick={() => handleShowQR(proj)}
                            className="px-3 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition shadow-sm"
                            title="Ver Código QR"
                          >
                            📱
                          </button>
                        </div>

                      </div>
                    ))}
                  </div>
                </motion.div>
            )}

              {/* 5. VISTA USUARIOS */}
              {activeView === 'usuarios' && ['admin', 'contador'].includes(user.role) && (
                <motion.div {...fadeInUp} key="usuarios">
                  <div className="max-w-4xl bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg border-t-4 border-geo-blue mb-8">
                    <h3 className="text-xl font-bold mb-6 text-geo-dark dark:text-white">Registrar Nuevo Empleado / Cliente</h3>
                    <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">

                      <div className="col-span-1">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Primer Nombre *</label>
                        <input type="text" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={newUser.first_name} onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })} required />
                      </div>
                      <div className="col-span-1">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Segundo Nombre</label>
                        <input type="text" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={newUser.middle_name} onChange={(e) => setNewUser({ ...newUser, middle_name: e.target.value })} />
                      </div>
                      <div className="col-span-1">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Apellido Paterno *</label>
                        <input type="text" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={newUser.last_name_paternal} onChange={(e) => setNewUser({ ...newUser, last_name_paternal: e.target.value })} required />
                      </div>
                      <div className="col-span-1">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Apellido Materno</label>
                        <input type="text" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={newUser.last_name_maternal} onChange={(e) => setNewUser({ ...newUser, last_name_maternal: e.target.value })} />
                      </div>

                      <div className="col-span-1">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Teléfono Celular</label>
                        <input type="text" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={newUser.phone_mobile} onChange={(e) => setNewUser({ ...newUser, phone_mobile: e.target.value })} />
                      </div>
                      <div className="col-span-1">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Teléfono Casa</label>
                        <input type="text" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={newUser.phone_home} onChange={(e) => setNewUser({ ...newUser, phone_home: e.target.value })} />
                      </div>

                      <div className="col-span-1 md:col-span-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Ocupación / Puesto</label>
                        <select 
                            className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-geo-blue outline-none"
                            value={newUser.occupation} 
                            onChange={(e) => setNewUser({ ...newUser, occupation: e.target.value })}
                        >
                          <option value="" className="dark:bg-gray-700">-- Seleccionar Puesto --</option>
                          
                          {/* ÁREA DIRECTIVA (Texto Morado) */}
                          <optgroup label="Área Directiva" className="font-bold text-purple-600 dark:text-purple-400 bg-white dark:bg-gray-800">
                              <option value="Director General" className="text-gray-700 dark:text-gray-200 font-normal">Director General</option>
                              <option value="Gerente de Proyectos" className="text-gray-700 dark:text-gray-200 font-normal">Gerente de Proyectos</option>
                          </optgroup>

                          {/* ÁREA ADMINISTRATIVA (Texto Azul) */}
                          <optgroup label="Área Administrativa" className="font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800">
                              <option value="Administrador de Obra" className="text-gray-700 dark:text-gray-200 font-normal">Administrador de Obra</option>
                              <option value="Contador" className="text-gray-700 dark:text-gray-200 font-normal">Contador</option>
                              <option value="Auxiliar Contable" className="text-gray-700 dark:text-gray-200 font-normal">Auxiliar Contable</option>
                              <option value="Recursos Humanos" className="text-gray-700 dark:text-gray-200 font-normal">Recursos Humanos</option>
                              <option value="Encargado de Compras" className="text-gray-700 dark:text-gray-200 font-normal">Encargado de Compras</option>
                              <option value="Encargado de Ventas" className="text-gray-700 dark:text-gray-200 font-normal">Encargado de Ventas</option>
                              <option value="Recepción" className="text-gray-700 dark:text-gray-200 font-normal">Recepción</option>
                              <option value="Asistente Administrativa" className="text-gray-700 dark:text-gray-200 font-normal">Asistente Administrativa</option>
                          </optgroup>

                          {/* ÁREA OPERATIVA (Texto Naranja) */}
                          <optgroup label="Área Operativa" className="font-bold text-orange-600 dark:text-orange-400 bg-white dark:bg-gray-800">
                              <option value="Ingeniero Civil" className="text-gray-700 dark:text-gray-200 font-normal">Ingeniero Civil</option>
                              <option value="Arquitecto" className="text-gray-700 dark:text-gray-200 font-normal">Arquitecto</option>
                              <option value="Residente de Obra" className="text-gray-700 dark:text-gray-200 font-normal">Residente de Obra</option>
                              <option value="Supervisor de Obra" className="text-gray-700 dark:text-gray-200 font-normal">Supervisor de Obra</option>
                              <option value="Topógrafo" className="text-gray-700 dark:text-gray-200 font-normal">Topógrafo</option>
                              <option value="Dibujante CAD" className="text-gray-700 dark:text-gray-200 font-normal">Dibujante CAD</option>
                              <option value="Ingeniero Electromecánico" className="text-gray-700 dark:text-gray-200 font-normal">Ingeniero Electromecánico</option>
                              <option value="Ingeniero en Instalaciones Electricas" className="text-gray-700 dark:text-gray-200 font-normal">Ing. Instalaciones Eléctricas</option>
                              <option value="Maestro de Obra" className="text-gray-700 dark:text-gray-200 font-normal">Maestro de Obra</option>
                              <option value="Albañil" className="text-gray-700 dark:text-gray-200 font-normal">Albañil</option>
                          </optgroup>
                        </select>
                      </div>

                      <div className="col-span-1">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Correo Electrónico *</label>
                        <input type="email" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} required />
                      </div>
                      <div className="col-span-1">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Contraseña *</label>
                        <input type="password" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} required />
                      </div>

                      <div className="col-span-1 md:col-span-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Tipo de empleado</label>
                        <select 
                            className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                            value={newUser.role} 
                            onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                        >
                          <option value="ingeniero">Ingeniero / Arquitecto</option>
                          <option value="admin">Administrador</option>
                          <option value="cliente">Cliente (Solo Lectura)</option>
                          <option value="contador">Contador / Financiero</option>
                        </select>
                      </div>

                      <div>
                                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400">NSS (Seguro Social)</label>
                                  <input type="text" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="1234567890" value={newUser.nss} onChange={(e) => setNewUser({ ...newUser, nss: e.target.value })} />
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Fecha de Ingreso</label>
                                  <input type="date" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={newUser.start_date} onChange={(e) => setNewUser({ ...newUser, start_date: e.target.value })} />
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Salario Mensual Neto ($)</label>
                                  <input type="number" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white font-bold text-green-600" placeholder="0.00" value={newUser.salary} onChange={(e) => setNewUser({ ...newUser, salary: e.target.value })} />
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Periodo de Pago</label>
                                  <select className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={newUser.payment_period} onChange={(e) => setNewUser({ ...newUser, payment_period: e.target.value })}>
                                      <option value="semanal">Semanal</option>
                                      <option value="quincenal">Quincenal</option>
                                      <option value="mensual">Mensual</option>
                                  </select>
                              </div>
                          

                      <div className="col-span-1 md:col-span-2 mt-4">
                        <button type="submit" className="bg-geo-blue text-white px-6 py-3 rounded font-bold w-full hover:bg-blue-900 transition">Registrar Usuario</button>
                      </div>
                    </form>
                  </div>

                  {/* TABLA DE USUARIOS */}
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-700 dark:text-white">Usuarios Registrados</h3>
                        {/* BOTÓN EXCEL USUARIOS */}
                        <button 
                          onClick={() => handleDownloadListPDF('users')}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-bold flex items-center gap-2 transition shadow-sm"
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                          Descargar PDF
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse dark:text-white">
                        <thead>
                          <tr className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
                            <th className="p-3">Nombre</th>
                            <th className="p-3">Correo</th>
                            <th className="p-3">Rol</th>
                            <th className="p-3">Puesto</th>
                            <th className="p-3">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm text-gray-700 dark:text-gray-300">
                          {allUsersList.map(u => (
                            <tr key={u.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                              <td className="p-3 font-semibold">{u.first_name} {u.last_name_paternal}</td>
                              <td className="p-3 text-gray-500 dark:text-gray-400">{u.email}</td>
                              <td className="p-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${u.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' : u.role === 'cliente' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'}`}>
                                  {u.role}
                                </span>
                              </td>
                              <td className="p-3">{u.occupation || '-'}</td>
                              <td className="p-3">
                                <button
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="text-red-500 hover:text-red-700 p-2 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition"
                                  title="Eliminar Usuario"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* MODAL GESTIÓN DE VACACIONES */}
      {showVacationModal && vacationEmployee && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-xl w-full max-w-md shadow-2xl border-t-4 border-orange-500">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-geo-dark dark:text-white">Gestionar Vacaciones</h3>
                    <button onClick={() => setShowVacationModal(false)} className="text-2xl text-gray-400 hover:text-red-500">&times;</button>
                </div>

                <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-300 uppercase font-bold">Colaborador</p>
                    <p className="text-lg font-bold text-geo-dark dark:text-white">{vacationEmployee.first_name} {vacationEmployee.last_name_paternal}</p>
                    <div className="mt-2 text-3xl font-bold text-orange-600">{vacationEmployee.vacation_days || 0} <span className="text-sm text-gray-500 font-normal">días disponibles</span></div>
                </div>

                <form onSubmit={handleProcessVacation} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Desde</label>
                            <input 
                                type="date" 
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                                value={vacationForm.startDate} 
                                onChange={e => {
                                    const newStart = e.target.value;
                                    // Calculamos si ya tenemos fecha fin
                                    let days = 0;
                                    if(vacationForm.endDate && newStart) {
                                        days = getBusinessDays(newStart, vacationForm.endDate);
                                    }
                                    setVacationForm({...vacationForm, startDate: newStart, days: days});
                                }} 
                                required 
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Hasta</label>
                            <input 
                                type="date" 
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                                value={vacationForm.endDate} 
                                onChange={e => {
                                    const newEnd = e.target.value;
                                    // Calculamos usando la fecha inicio existente
                                    let days = 0;
                                    if(vacationForm.startDate && newEnd) {
                                        days = getBusinessDays(vacationForm.startDate, newEnd);
                                    }
                                    setVacationForm({...vacationForm, endDate: newEnd, days: days});
                                }} 
                                required 
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Días a descontar (Hábiles)</label>
                        {/* INPUT BLOQUEADO (READONLY) - SE CALCULA SOLO */}
                        <input 
                            type="number" 
                            className="w-full p-3 border rounded bg-gray-100 dark:bg-gray-600 dark:border-gray-500 dark:text-gray-300 font-bold text-lg text-center cursor-not-allowed" 
                            value={vacationForm.days} 
                            readOnly 
                        />
                        <p className="text-[10px] text-gray-400 text-center mt-1">
                            *Se excluyen sábados, domingos y festivos oficiales automáticamante.
                        </p>
                    </div>
                    
                    <button type="submit" className="w-full bg-geo-orange text-white py-3 rounded-lg font-bold hover:bg-orange-600 transition shadow-lg mt-4">
                        Registrar y Generar Formato
                    </button>
                </form>
            </div>
        </div>
      )}
              
              {/* --- VISTA PROVEEDORES --- */}
                    {/* Formulario Alta */}
                    {activeView === 'proveedores' && (
                <motion.div {...fadeInUp} className="space-y-6">
                    <h2 className="text-xl font-bold dark:text-white">Gestión de Proveedores</h2>
                    
                    {/* FORMULARIO ALTA (SOLO ADMIN Y CONTADOR) 🔒 */}
                    {['admin', 'contador'].includes(user.role) && (
                        <div className="bg-white dark:bg-gray-800 p-6 rounded shadow border-t-4 border-geo-blue">
                            <h3 className="font-bold mb-4 dark:text-white">Nuevo Proveedor</h3>
                            <form onSubmit={handleCreateSupplier} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* ... (tus inputs del formulario siguen igual) ... */}
                                <input className="p-2 border rounded dark:bg-gray-700 dark:text-white" placeholder="Nombre Empresa" value={newSupplier.name} onChange={e=>setNewSupplier({...newSupplier, name:e.target.value})} required />
                                {/* ... resto de inputs ... */}
                                <button type="submit" className="bg-geo-blue text-white font-bold py-2 rounded md:col-span-3 hover:bg-blue-900 transition">Guardar Proveedor</button>
                            </form>
                        </div>
                    )}

                    {/* Lista */}
                    <div className="bg-white dark:bg-gray-800 rounded shadow overflow-x-auto">
                        {/* ... (tu tabla sigue igual) ... */}
                    </div>
                </motion.div>
            )}

            {/* --- VISTA COMPRAS --- */}
            {activeView === 'compras' && (
                <motion.div {...fadeInUp} key="compras" className="space-y-6">
                    <h2 className="text-xl font-bold dark:text-white">Órdenes de Compra (Abastecimiento)</h2>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* COLUMNA IZQUIERDA: PROVEEDOR Y CATÁLOGO */}
                        <div className="lg:col-span-2 space-y-4">
                             {/* Selector de Proveedor */}
                             <div className="bg-white dark:bg-gray-800 p-4 rounded shadow border-l-4 border-indigo-500">
                                 <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">1. Selecciona el Proveedor</label>
                                 <select 
                                     className="w-full p-3 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white font-bold" 
                                     value={selectedSupplierForPurchase} 
                                     onChange={e => {
                                         const id = e.target.value;
                                         setSelectedSupplierForPurchase(id);
                                         // Al cambiar, cargamos los productos de ESE proveedor (Giro)
                                         fetchSupplierProducts(id); 
                                     }}
                                 >
                                     <option value="">-- Seleccionar --</option>
                                     {suppliersList.map(s => (
                                         <option key={s.id} value={s.id}>
                                             {s.name} - {s.category_name}
                                         </option>
                                     ))}
                                 </select>
                             </div>
                             
                             {/* Lista de Productos a Pedir */}
                             <div className="bg-white dark:bg-gray-800 p-4 rounded shadow h-96 overflow-y-auto border border-gray-200 dark:border-gray-700">
                                 <h3 className="font-bold mb-2 dark:text-white text-sm uppercase tracking-wide">
                                     {selectedSupplierForPurchase ? 'Catálogo Disponible' : 'Selecciona un proveedor primero'}
                                 </h3>
                                 
                                 {supplierCatalog.length === 0 && selectedSupplierForPurchase && (
                                     <p className="text-sm text-gray-400 py-4 text-center">
                                         Este proveedor no tiene productos asociados a su categoría en tu inventario.
                                     </p>
                                 )}
                                 
                                 {supplierCatalog.map(p => (
                                     <div key={p.id} className="flex justify-between items-center border-b p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition last:border-0">
                                         <div>
                                             <p className="font-bold text-sm dark:text-white">{p.name}</p>
                                             <p className="text-xs text-gray-500 dark:text-gray-400">
                                                 Código: <span className="font-mono">{p.code}</span> • Stock actual: <span className={p.stock <= p.min_stock ? "text-red-500 font-bold" : "text-green-600"}>{p.stock} {p.unit}</span>
                                             </p>
                                         </div>
                                         <button 
                                             onClick={() => openPurchaseModal(p)}
                                             className="bg-indigo-100 text-indigo-700 px-4 py-1 rounded-full text-xs font-bold hover:bg-indigo-200 transition"
                                         >
                                             + Añadir
                                         </button>
                                     </div>
                                 ))}
                             </div>
                        </div>

                        {/* COLUMNA DERECHA: CARRITO DE COMPRA */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded shadow border-t-4 border-blue-500 h-fit sticky top-4">
                            <h3 className="font-bold mb-4 dark:text-white text-lg">Orden de Compra</h3>
                            
                            {purchaseCart.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 text-sm">
                                    Agrega productos del catálogo para generar la orden.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {purchaseCart.map((i, idx) => (
                                        <div key={idx} className="flex justify-between text-sm border-b pb-2 dark:border-gray-700">
                                            <div>
                                                <p className="font-bold dark:text-white">{i.name}</p>
                                                <p className="text-xs text-gray-500">{i.quantity} x ${i.cost}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-blue-600">${(i.quantity * i.cost).toFixed(2)}</p>
                                                <button onClick={() => {
                                                    const newCart = [...purchaseCart];
                                                    newCart.splice(idx, 1);
                                                    setPurchaseCart(newCart);
                                                }} className="text-red-400 text-xs hover:text-red-600 hover:underline">
                                                    Quitar
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    <div className="pt-4 mt-2 border-t border-gray-200 dark:border-gray-600">
                                        <div className="flex justify-between text-xl font-bold text-geo-dark dark:text-white">
                                            <span>Total Estimado:</span>
                                            <span>${purchaseCart.reduce((a,b)=>a+(b.quantity*b.cost),0).toFixed(2)}</span>
                                        </div>
                                        <button 
                                            onClick={handleCreatePurchase} 
                                            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold mt-6 hover:bg-blue-700 shadow-lg transition transform active:scale-95"
                                        >
                                            GENERAR ORDEN
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* HISTORIAL DE COMPRAS */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mt-8 border border-gray-200 dark:border-gray-700">
                        <h3 className="font-bold mb-4 dark:text-white text-lg">Historial de Pedidos a Proveedores</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm dark:text-white">
                                <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 uppercase text-xs font-bold">
                                    <tr>
                                        <th className="p-3">Folio</th>
                                        <th className="p-3">Proveedor</th>
                                        <th className="p-3">Fecha</th>
                                        <th className="p-3 text-right">Total</th>
                                        <th className="p-3 text-center">Estatus</th>
                                        <th className="p-3 text-center">Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {purchasesList.length === 0 ? (
                                        <tr><td colSpan="6" className="p-4 text-center text-gray-400">No hay órdenes de compra registradas.</td></tr>
                                    ) : (
                                        purchasesList.map(p => (
                                            <tr key={p.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                                                <td className="p-3 font-mono text-xs">#{p.id}</td>
                                                <td className="p-3 font-bold">{p.supplier_name}</td>
                                                <td className="p-3">{new Date(p.created_at).toLocaleDateString()}</td>
                                                <td className="p-3 text-right font-mono">${p.total}</td>
                                                <td className="p-3 text-center">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                                                        p.status==='recibida' 
                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                                                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                                    }`}>
                                                        {p.status}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center">
                                                    {p.status !== 'recibida' && (
                                                        <button 
                                                            onClick={() => handleReceiveOrder(p.id)} 
                                                            className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-md text-xs font-bold shadow transition flex items-center gap-1 mx-auto"
                                                            title="Confirmar que llegó el material al almacén"
                                                        >
                                                            📦 Recibir
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* --- VISTA NÓMINA (RH) --- */}
            {activeView === 'nomina' && ['admin', 'contador'].includes(user.role) && (
                <motion.div {...fadeInUp} className="space-y-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold dark:text-white">Gestión de Nómina y RH</h2>
                        <div className="flex gap-2">
                          <button 
                                onClick={() => {
                                    const t = toast.loading("Actualizando lista...");
                                    fetchAllUsers(); // Llama a la función de recarga
                                    setTimeout(() => toast.dismiss(t), 500);
                                }}
                                className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-4 py-2 rounded font-bold shadow-sm flex items-center gap-2 transition"
                                title="Recargar lista de empleados"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                </svg>
                                Actualizar
                            </button>
                            <button 
                              onClick={handleGeneratePayroll} 
                              className="bg-green-600 text-white px-4 py-2 rounded font-bold shadow hover:bg-green-700 flex items-center gap-2"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                              </svg>
                              Descargar Layout Bancario
                          </button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded shadow overflow-x-auto border border-gray-200 dark:border-gray-700">
                        <table className="w-full text-left text-sm dark:text-white">
                            <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 uppercase font-bold text-xs">
                                <tr>
                                    <th className="p-4">Empleado</th>
                                    <th className="p-4">NSS</th>
                                    <th className="p-4">Ingreso / Antigüedad</th>
                                    <th className="p-4 text-right">Salario Neto</th>
                                    <th className="p-4 text-center">Periodo</th>
                                    <th className="p-4 text-center">Vacaciones</th>
                                    <th className="p-4 text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allUsersList
                                    .filter(u => u.role !== 'cliente')
                                    .map(u => (
                                    <tr key={u.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <td className="p-4">
                                            <p className="font-bold">{u.first_name} {u.last_name_paternal}</p>
                                            <p className="text-xs text-gray-500">{u.email}</p>
                                            <span className="text-[10px] bg-blue-100 text-blue-800 px-1 rounded uppercase">{u.role}</span>
                                        </td>
                                        <td className="p-4 font-mono text-gray-600">{u.nss || 'Sin dato'}</td>
                                        <td className="p-4">
                                            <p>{u.start_date ? new Date(u.start_date).toLocaleDateString() : '-'}</p>
                                            <p className="text-xs text-green-600 font-bold">{calculateSeniority(u.start_date)}</p>
                                        </td>
                                        <td className="p-4 text-right font-bold text-lg">
                                            ${parseFloat(u.salary || 0).toLocaleString()}
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-bold uppercase">{u.payment_period || '-'}</span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex flex-col items-center group cursor-pointer" onClick={() => openVacationModal(u)}>
                                                <span className="font-bold text-xl text-orange-500 group-hover:text-orange-600 underline decoration-dotted transition">
                                                    {u.vacation_days || 0} {/* Usamos el dato directo de la BD, no el cálculo */}
                                                </span>
                                                <span className="text-[10px] text-gray-400">días disp. (Click para gestionar)</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <button 
                                              onClick={() => {
                                                  // Llamamos a la función generadora
                                                  generatePayrollReceipt(u);
                                                  toast.success(`Recibo descargado para ${u.first_name}`);
                                              }}
                                              className="text-blue-600 hover:text-blue-800 text-sm font-bold underline flex items-center justify-center gap-1"
                                          >
                                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                                              Descargar
                                          </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            )}

              {/* 6. VISTA NUEVO PROYECTO */}
              {activeView === 'nuevo_proyecto' && ['admin', 'ingeniero'].includes(user.role) && (
                <motion.div 
                    {...fadeInUp} 
                    key="nuevo_proyecto" 
                    // Centramos todo el contenido en la pantalla
                    className="flex justify-center items-start min-h-full"
                >
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg border-t-4 border-green-500 w-full max-w-2xl">
                        
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-geo-dark dark:text-white">
                                {isEditingProj ? 'Editar Proyecto' : 'Dar de Alta Nuevo Proyecto'}
                            </h3>
                            {/* Botón de Cerrar (X) rápido */}
                            <button 
                                onClick={() => {
                                    setIsEditingProj(false);
                                    setEditingProjId(null);
                                    // Reseteamos el formulario
                                    setNewProject({ name: '', location: '', start_date: '', client_id: '', lat: '', lng: '', image: null, pdf: null, budget: '' });
                                    setSelectedEngineers([]);
                                    setActiveView('obras');
                                }}
                                className="text-gray-400 hover:text-red-500 text-2xl transition"
                                title="Cancelar y Cerrar"
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleCreateProject} className="space-y-4">
                            {/* Inputs existentes... */}
                            <div className="flex flex-col">
                                <label className="text-sm font-bold text-gray-600 dark:text-gray-400 mb-1">Nombre del Proyecto</label>
                                <input type="text" className="w-full p-3 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={newProject.name} onChange={(e) => setNewProject({...newProject, name: e.target.value})} required />
                            </div>
                            <div className="flex flex-col">
                                <label className="text-sm font-bold text-gray-600 dark:text-gray-400 mb-1">Ubicación</label>
                                <input type="text" className="w-full p-3 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={newProject.location} onChange={(e) => setNewProject({...newProject, location: e.target.value})} required />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col">
                                    <label className="text-sm font-bold text-gray-600 dark:text-gray-400 mb-1">Latitud</label>
                                    <input type="text" className="w-full p-3 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={newProject.lat} onChange={(e) => setNewProject({...newProject, lat: e.target.value})} />
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-sm font-bold text-gray-600 dark:text-gray-400 mb-1">Longitud</label>
                                    <input type="text" className="w-full p-3 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={newProject.lng} onChange={(e) => setNewProject({...newProject, lng: e.target.value})} />
                                </div>
                            </div>

                            {/* INPUT PRESUPUESTO */}
                            <div className="flex flex-col">
                                <label className="text-sm font-bold text-gray-600 dark:text-gray-400 mb-1">Presupuesto Autorizado ($)</label>
                                <input 
                                    type="number" 
                                    className="w-full p-3 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white font-bold text-green-600" 
                                    placeholder="0.00"
                                    value={newProject.budget} 
                                    onChange={(e) => setNewProject({...newProject, budget: e.target.value})} 
                                />
                            </div>

                            <div className="flex flex-col">
                                <label className="text-sm font-bold text-gray-600 dark:text-gray-400 mb-1">Fecha de Inicio</label>
                                <input type="date" className="w-full p-3 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={newProject.start_date} onChange={(e) => setNewProject({...newProject, start_date: e.target.value})} required />
                            </div>

                            {/* INPUTS ARCHIVOS */}
                            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded border border-dashed border-gray-300 dark:border-gray-600">
                                <label className="block text-sm text-gray-600 dark:text-gray-400 font-bold mb-2">📷 Fotografía de Portada (Opcional)</label>
                                <input id="file-image" type="file" accept="image/*" className="w-full text-sm dark:text-gray-300" onChange={(e) => setNewProject({...newProject, image: e.target.files[0]})} />
                            </div>

                            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded border border-dashed border-gray-300 dark:border-gray-600">
                                <label className="block text-sm text-gray-600 dark:text-gray-400 font-bold mb-2">📄 Planos / Documentos PDF (Opcional)</label>
                                <input id="file-pdf" type="file" accept=".pdf" className="w-full text-sm dark:text-gray-300" onChange={(e) => setNewProject({...newProject, pdf: e.target.files[0]})} />
                            </div>

                            <div className="pt-4 flex flex-col">
                                <label className="text-sm font-bold text-gray-600 dark:text-gray-400 mb-1">Asignar a Cliente (Opcional)</label>
                                <select 
                                    className="w-full p-3 border rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white" 
                                    value={newProject.client_id} 
                                    onChange={(e) => setNewProject({...newProject, client_id: e.target.value})}
                                >
                                    <option value="">-- Sin Cliente Asignado --</option>
                                    {clientsList.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* ASIGNACIÓN DE INGENIEROS */}
                            <div className="pt-4">
                                <label className="text-sm font-bold text-gray-600 dark:text-gray-400 mb-2 block">Asignar Ingenieros / Arquitectos Responsables</label>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-700 p-3 rounded border border-gray-200 dark:border-gray-600 max-h-40 overflow-y-auto">
                                    {engineersList.length === 0 ? (
                                        <p className="text-xs text-gray-400 col-span-2 text-center">No hay ingenieros registrados.</p>
                                    ) : (
                                        engineersList.map(eng => (
                                            <label key={eng.id} className="flex items-center space-x-2 cursor-pointer hover:bg-white dark:hover:bg-gray-600 p-2 rounded transition border border-transparent hover:border-gray-200 dark:hover:border-gray-500">
                                                <input 
                                                    type="checkbox"
                                                    value={eng.id}
                                                    checked={selectedEngineers.includes(eng.id)}
                                                    onChange={(e) => {
                                                        const id = parseInt(e.target.value);
                                                        if(e.target.checked) {
                                                            setSelectedEngineers([...selectedEngineers, id]);
                                                        } else {
                                                            setSelectedEngineers(selectedEngineers.filter(x => x !== id));
                                                        }
                                                    }}
                                                    className="rounded text-geo-blue focus:ring-geo-blue h-4 w-4"
                                                />
                                                <span className="text-sm text-gray-700 dark:text-white font-medium">{eng.name}</span>
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* BOTONES DE ACCIÓN */}
                            <div className="flex gap-4 pt-4">
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setIsEditingProj(false);
                                        setEditingProjId(null);
                                        setNewProject({ name: '', location: '', start_date: '', client_id: '', lat: '', lng: '', image: null, pdf: null, budget: '' });
                                        setSelectedEngineers([]);
                                        setActiveView('obras');
                                    }}
                                    className="flex-1 py-3 border border-gray-300 dark:border-gray-600 rounded font-bold text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 transition"
                                >
                                    Cancelar
                                </button>

                                <button type="submit" className="flex-1 bg-green-600 text-white px-6 py-3 rounded font-bold hover:bg-green-700 transition shadow-lg">
                                    {isEditingProj ? 'Guardar Cambios' : 'Crear Proyecto'}
                                </button>
                            </div>

                        </form>
                    </div>
                </motion.div>
            )}

            </>
          )}

        </div>
      </main>

      {/* ==========================================
          MODALS (Ventanas Emergentes)
      ========================================== */}

      {/* --- MODAL DE FIRMA DIGITAL --- */}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
                <h3 className="font-bold mb-2 text-center">Firma de Conformidad</h3>
                
                <div className="border-2 border-dashed border-gray-300 rounded mb-4 bg-gray-50 h-40 w-full relative">
                    {/* CANVAS NATIVO HTML5 */}
                    <canvas 
                        ref={canvasRef} 
                        style={{ width: '100%', height: '100%', display: 'block' }}
                    />
                </div>
                
                <div className="flex gap-2">
                    <button onClick={clearSignature} className="flex-1 border py-2 rounded text-gray-600 hover:bg-gray-100">Borrar</button>
                    <button onClick={handleSignAndDownload} className="flex-1 bg-blue-600 text-white py-2 rounded font-bold hover:bg-blue-700">Firmar y PDF</button>
                </div>
                <button onClick={() => setShowSignatureModal(false)} className="mt-2 text-red-500 text-sm w-full hover:underline">Cancelar</button>
            </div>
        </div>
      )}

     {/* --- MODAL QR (CON LIBRERÍA NATIVA) --- */}
     {showQRModal && selectedProject && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl text-center max-w-sm w-full relative border border-gray-200 dark:border-gray-700">

            {/* Botón Cerrar */}
            <button
              onClick={() => setShowQRModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-red-500 text-2xl font-bold transition"
            >
              &times;
            </button>

            <h3 className="text-xl font-bold text-geo-dark dark:text-white mb-1">
              Acceso Rápido
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 font-medium">
              {selectedProject.name}
            </p>

            {/* GENERACIÓN DEL QR (VÍA IMAGEN) */}
            <div className="flex justify-center mb-6 bg-white p-4 rounded-xl shadow-inner border border-gray-100 mx-auto w-fit">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&color=1e3a8a&data=${encodeURIComponent(
                  `${window.location.origin}/dashboard?projectId=${selectedProject.id}`
                )}`}
                alt="Código QR"
                className="w-48 h-48 object-contain"
              />
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 px-4">
              Escanea para abrir la <b>Bitácora Digital</b> de este proyecto en tu celular.
            </p>

            {/* Si tiene PDF, mostramos el botón extra */}
            {selectedProject.pdf_url && (
              <a 
                href={selectedProject.pdf_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="mb-3 block w-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 py-2 rounded-lg text-sm font-bold hover:bg-blue-100 transition"
              >
                📄 Ver Planos PDF
              </a>
            )}

            <button
              onClick={() => setShowQRModal(false)}
              className="bg-gray-800 dark:bg-gray-700 text-white px-4 py-3 rounded-lg hover:bg-black dark:hover:bg-gray-600 w-full text-sm font-bold transition shadow-lg"
            >
              Cerrar Ventana
            </button>
          </div>
        </div>
      )}

      {/* Modal Cambiar Contraseña */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-md">
            <h3 className="text-xl font-bold mb-4 text-geo-dark dark:text-white">Cambiar Contraseña</h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <input type="password" placeholder="Nueva Contraseña" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={passwordForm.newPass} onChange={(e) => setPasswordForm({ ...passwordForm, newPass: e.target.value })} required />
              <input type="password" placeholder="Confirmar Contraseña" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={passwordForm.confirmPass} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPass: e.target.value })} required />
              <div className="flex gap-4 mt-6">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="flex-1 py-2 text-gray-600 border rounded hover:bg-gray-100 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700">Cancelar</button>
                <button type="submit" className="flex-1 py-2 bg-geo-orange text-white font-bold rounded hover:bg-orange-600">Actualizar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Perfil */}
      {showEditProfileModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <h3 className="text-xl font-bold mb-4 text-geo-dark dark:text-white">Editar Mis Datos</h3>

            <form onSubmit={handleEditProfile} className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* --- NUEVA SECCIÓN: FOTO DE PERFIL --- */}
              <div className="col-span-1 md:col-span-2 flex flex-col items-center mb-6">
                <div className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden mb-3 border-4 border-white shadow-md relative group">
                  {/* Lógica de Previsualización */}
                  {profileForm.photo instanceof File ? (
                    <img src={URL.createObjectURL(profileForm.photo)} alt="Preview" className="w-full h-full object-cover" />
                  ) : user.photo_url ? (
                    <img src={user.photo_url} alt="Actual" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl text-gray-400 bg-gray-100">
                      {user.first_name ? user.first_name.charAt(0).toUpperCase() : 'U'}
                    </div>
                  )}

                  {/* Overlay al pasar el mouse */}
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white text-xs font-bold">Cambiar</span>
                  </div>
                </div>

                <label className="cursor-pointer bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-white px-4 py-2 rounded-full text-sm font-medium shadow-sm transition-all active:scale-95">
                  <span>📷 Subir Nueva Foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setProfileForm({ ...profileForm, photo: e.target.files[0] })}
                  />
                </label>
              </div>
              {/* ------------------------------------- */}

              <div className="col-span-1"><label className="text-xs font-bold text-gray-500 dark:text-gray-400">Primer Nombre</label><input type="text" className="w-full p-2 border rounded focus:border-geo-blue outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={profileForm.first_name} onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })} /></div>
              <div className="col-span-1"><label className="text-xs font-bold text-gray-500 dark:text-gray-400">Segundo Nombre</label><input type="text" className="w-full p-2 border rounded focus:border-geo-blue outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={profileForm.middle_name} onChange={(e) => setProfileForm({ ...profileForm, middle_name: e.target.value })} /></div>
              <div className="col-span-1"><label className="text-xs font-bold text-gray-500 dark:text-gray-400">Apellido Paterno</label><input type="text" className="w-full p-2 border rounded focus:border-geo-blue outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={profileForm.last_name_paternal} onChange={(e) => setProfileForm({ ...profileForm, last_name_paternal: e.target.value })} /></div>
              <div className="col-span-1"><label className="text-xs font-bold text-gray-500 dark:text-gray-400">Apellido Materno</label><input type="text" className="w-full p-2 border rounded focus:border-geo-blue outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={profileForm.last_name_maternal} onChange={(e) => setProfileForm({ ...profileForm, last_name_maternal: e.target.value })} /></div>

              <div className="col-span-1"><label className="text-xs font-bold text-gray-500 dark:text-gray-400">Móvil</label><input type="text" className="w-full p-2 border rounded focus:border-geo-blue outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={profileForm.phone_mobile} onChange={(e) => setProfileForm({ ...profileForm, phone_mobile: e.target.value })} /></div>
              <div className="col-span-1"><label className="text-xs font-bold text-gray-500 dark:text-gray-400">Casa</label><input type="text" className="w-full p-2 border rounded focus:border-geo-blue outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={profileForm.phone_home} onChange={(e) => setProfileForm({ ...profileForm, phone_home: e.target.value })} /></div>

              <div className="col-span-1 md:col-span-2"><label className="text-xs font-bold text-gray-500 dark:text-gray-400">Ocupación</label><input type="text" className="w-full p-2 border rounded focus:border-geo-blue outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={profileForm.occupation} onChange={(e) => setProfileForm({ ...profileForm, occupation: e.target.value })} /></div>
              <div className="col-span-1 md:col-span-2"><label className="text-xs font-bold text-gray-500 dark:text-gray-400">Correo</label><input type="email" className="w-full p-2 border rounded focus:border-geo-blue outline-none dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} /></div>

              <div className="flex gap-4 mt-6 col-span-1 md:col-span-2">
                <button type="button" onClick={() => setShowEditProfileModal(false)} className="flex-1 py-3 text-gray-600 border rounded hover:bg-gray-100 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700 font-semibold transition">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-geo-blue text-white rounded hover:bg-blue-900 font-bold shadow-lg transition transform hover:-translate-y-1">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/*MODAL DEL PRODUCTOS*/}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg w-full max-w-lg shadow-2xl">
                <h3 className="text-xl font-bold mb-4 text-geo-dark dark:text-white">
                    {isEditingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                </h3>
                <form onSubmit={handleSaveProduct} className="grid grid-cols-2 gap-4">
                    <div className="col-span-1">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Código (SKU)</label>
                        <input type="text" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={productForm.code} onChange={(e) => setProductForm({...productForm, code: e.target.value})} required />
                    </div>
                    <div className="col-span-1">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Categoría</label>
                        <select className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={productForm.category_id} onChange={(e) => setProductForm({...productForm, category_id: e.target.value})}>
                            <option value="1">Materiales Construcción</option>
                            <option value="2">Soluciones Empaque</option>
                            <option value="3">Servicios</option>
                        </select>
                    </div>
                    <div className="col-span-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Nombre del Producto</label>
                        <input type="text" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={productForm.name} onChange={(e) => setProductForm({...productForm, name: e.target.value})} required />
                    </div>
                    <div className="col-span-1">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Precio Unitario</label>
                        <input type="number" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={productForm.price} onChange={(e) => setProductForm({...productForm, price: e.target.value})} required />
                    </div>
                    <div className="col-span-1">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Unidad de Medida</label>
                        <input type="text" placeholder="Ej. Pza, Kg, m3" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" value={productForm.unit} onChange={(e) => setProductForm({...productForm, unit: e.target.value})} required />
                    </div>
                    <div className="col-span-1">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400">Stock Actual</label>
                        <input type="number" className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white font-bold text-blue-600" value={productForm.stock} onChange={(e) => setProductForm({...productForm, stock: e.target.value})} required />
                    </div>
                    <div className="col-span-1">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 text-red-500">Stock Mínimo (Alerta)</label>
                        <input type="number" className="w-full p-2 border rounded border-red-200 dark:bg-gray-700 dark:border-red-900 dark:text-white" value={productForm.min_stock} onChange={(e) => setProductForm({...productForm, min_stock: e.target.value})} required />
                    </div>
                    
                    <div className="col-span-2 flex gap-4 mt-4">
                        <button type="button" onClick={() => setShowProductModal(false)} className="flex-1 py-2 border rounded hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700">Cancelar</button>
                        <button type="submit" className="flex-1 py-2 bg-geo-blue text-white rounded font-bold hover:bg-blue-900">Guardar</button>
                    </div>
                </form>
            </div>
        </div>
      )}
      {/* --- MODAL CRONOGRAMA (GANTT SIMPLIFICADO) --- */}
      {showScheduleModal && selectedProject && (
          <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold dark:text-white">Cronograma: {selectedProject.name}</h3>
                      <button onClick={() => setShowScheduleModal(false)} className="text-2xl text-gray-500 hover:text-red-500">&times;</button>
                  </div>
                  
                  {/* Formulario */}
                  <form onSubmit={handleCreateStage} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4 bg-gray-50 dark:bg-gray-700 p-3 rounded">
                      <input className="md:col-span-2 p-2 border rounded dark:bg-gray-600 dark:text-white" placeholder="Nombre Etapa (ej. Cimentación)" value={newStage.name} onChange={e=>setNewStage({...newStage, name:e.target.value})} required />
                      <input type="date" className="p-2 border rounded dark:bg-gray-600 dark:text-white" value={newStage.start_date} onChange={e=>setNewStage({...newStage, start_date:e.target.value})} required />
                      <input type="number" className="p-2 border rounded dark:bg-gray-600 dark:text-white" placeholder="% Peso" value={newStage.percentage_weight} onChange={e=>setNewStage({...newStage, percentage_weight:e.target.value})} required />
                      <button type="submit" className="bg-indigo-600 text-white font-bold rounded md:col-span-4 py-2 hover:bg-indigo-700">Agregar Etapa</button>
                  </form>

                  {/* Lista */}
                  <div className="flex-1 overflow-y-auto space-y-2">
                      {projectStages.map(s => (
                          <div key={s.id} className={`p-3 border rounded flex justify-between items-center ${s.is_completed ? 'bg-green-50 border-green-200' : 'bg-white dark:bg-gray-800 dark:border-gray-600'}`}>
                              <div className="flex items-center gap-3">
                                  <input type="checkbox" checked={!!s.is_completed} onChange={() => toggleStage(s)} className="w-5 h-5 cursor-pointer" />
                                  <div>
                                      <p className={`font-bold ${s.is_completed ? 'text-green-700 line-through' : 'dark:text-white'}`}>{s.name}</p>
                                      <p className="text-xs text-gray-500">Valor: {s.percentage_weight}% • {new Date(s.start_date).toLocaleDateString()}</p>
                                  </div>
                              </div>
                              <button onClick={() => handleDeleteStage(s.id)} className="text-red-500 hover:text-red-700">🗑️</button>
                          </div>
                      ))}
                  </div>
                  <div className="mt-4 text-right text-sm dark:text-white">
                      Progreso Total: <b>{projectStages.filter(s=>s.is_completed).reduce((a,b)=>a+b.percentage_weight,0)}%</b>
                  </div>
              </div>
          </div>
      )}

      {/* --- MODAL CANTIDAD DE COMPRA (Ahora sí está separado y limpio) --- */}
      {showQuantityModal && tempProductToAdd && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl w-full max-w-sm border border-gray-200 dark:border-gray-700 animate-fadeIn">
                <h3 className="text-lg font-bold mb-4 text-geo-dark dark:text-white">Agregar a la Orden</h3>
                <p className="text-sm text-gray-500 mb-4">Producto: <span className="font-bold text-geo-blue">{tempProductToAdd.name}</span></p>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Cantidad a pedir</label>
                        <input 
                            type="number" 
                            autoFocus
                            className="w-full p-3 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white font-bold text-lg focus:ring-2 focus:ring-geo-blue outline-none"
                            value={tempQty}
                            onChange={(e) => setTempQty(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Costo Unitario ($)</label>
                        <input 
                            type="number" 
                            className="w-full p-3 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            value={tempCost}
                            onChange={(e) => setTempCost(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button 
                        onClick={() => setShowQuantityModal(false)} 
                        className="flex-1 py-2 text-gray-500 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 rounded font-bold transition"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={confirmAddToCart} 
                        className="flex-1 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 shadow-lg transition transform active:scale-95"
                    >
                        Agregar
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;