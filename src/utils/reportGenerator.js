import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ==================================================================================
// CONFIGURACIÓN GLOBAL
// ==================================================================================

// Logo en Base64 (Para asegurar que cargue offline y sin errores de ruta)
const logoBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAAAyCAYAAAAZUD4LAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAABNSURBVHgB7c6xAQAgDMCw1v6/uYayQweB4A5Jqy33u/cBg0iIBEIiQAIhESCBkAiQQEgESCAkAiQQEgESCIkACYREgARCIkACIREggR5s0wH5wa3FmQAAAABJRU5ErkJggg==";

// ==================================================================================
// 1. REPORTE INDIVIDUAL DE OBRA (BITÁCORA + MATERIALES)
// ==================================================================================
export const generatePDF = (project, reports, materials = []) => {
  const doc = new jsPDF();
  const margin = 14;

  // --- ENCABEZADO ---
  doc.setFillColor(30, 58, 138); // Azul Geo
  doc.rect(0, 0, 210, 25, 'F'); 
  
  try { 
      doc.addImage(logoBase64, 'PNG', margin, 5, 40, 15); 
  } catch(e) {
      console.warn("No se pudo cargar el logo");
  }
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text("REPORTE EJECUTIVO DE OBRA", 200, 18, { align: 'right' });

  // --- INFORMACIÓN DEL PROYECTO ---
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text(`Proyecto: ${project.name}`, margin, 40);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Ubicación: ${project.location}`, margin, 46);
  doc.text(`Estatus: ${project.status ? project.status.toUpperCase() : 'N/A'}`, margin, 52);
  
  // Presupuesto (si existe)
  if (project.budget) {
      doc.text(`Presupuesto Autorizado: $${parseFloat(project.budget).toLocaleString()}`, 200, 46, { align: 'right' });
  }
  
  // Línea divisoria
  doc.setDrawColor(200);
  doc.line(margin, 58, 200, 58);

  // --- SECCIÓN 1: BITÁCORA DE AVANCES ---
  let finalY = 65;
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text("1. Bitácora de Avances y Sucesos", margin, finalY);

  const reportRows = reports.map(r => [
    new Date(r.report_date).toLocaleDateString(),
    r.user_name,
    r.description,
  ]);

  autoTable(doc, {
    startY: finalY + 5,
    head: [['Fecha', 'Reportado Por', 'Detalle del Avance']],
    body: reportRows,
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 
        0: { cellWidth: 25 }, 
        1: { cellWidth: 40 },
        2: { cellWidth: 'auto' }
    },
  });

  finalY = doc.lastAutoTable.finalY + 15;

  // --- SECCIÓN 2: MATERIALES ASIGNADOS (Si existen) ---
  if (materials && materials.length > 0) {
      // Verificar si cabe en la página, si no, nueva página
      if (finalY + 40 > doc.internal.pageSize.height) {
          doc.addPage();
          finalY = margin;
      }

      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text("2. Materiales Suministrados / Utilizados", margin, finalY);
      
      const materialRows = materials.map(m => [
          new Date(m.assigned_at).toLocaleDateString(),
          m.code || '-',
          m.name,
          `${m.quantity} ${m.unit}`
      ]);

      autoTable(doc, {
        startY: finalY + 5,
        head: [['Fecha', 'Código', 'Material', 'Cantidad']],
        body: materialRows,
        headStyles: { fillColor: [249, 115, 22], textColor: 255, fontStyle: 'bold' }, // Naranja
        theme: 'grid',
        styles: { fontSize: 9 },
        columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } }
      });
  } else {
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text("(No se han registrado movimientos de materiales en sistema)", margin, finalY + 5);
  }

  // --- PIE DE PÁGINA ---
  const pageCount = doc.internal.getNumberOfPages();
  for(let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${pageCount} - Generado por Geo Portal`, margin, 285);
      doc.text(new Date().toLocaleString(), 200, 285, { align: 'right' });
  }
  
  doc.save(`Bitacora_${project.name.replace(/\s+/g, '_')}.pdf`);
};


// ==================================================================================
// 2. REPORTE DE LISTAS GENERALES (OBRAS O USUARIOS)
// ==================================================================================
export const generateListPDF = (title, data, type) => {
    const doc = new jsPDF('l', 'mm', 'a4'); // Horizontal (Landscape)
    const margin = 14;

    // Header Azul
    doc.setFillColor(30, 58, 138); 
    doc.rect(0, 0, 297, 25, 'F'); 

    try { 
        doc.addImage(logoBase64, 'PNG', margin, 5, 40, 15); 
    } catch(e) {}
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text(title.toUpperCase(), 283, 18, { align: 'right' });

    let headers = [];
    let body = [];

    if (type === 'projects') {
        headers = [['ID', 'PROYECTO', 'UBICACIÓN', 'ESTATUS', 'AVANCE', 'CLIENTE', 'RESPONSABLES']];
        body = data.map(p => [
            p.id,
            p.name,
            p.location,
            p.status ? p.status.toUpperCase() : 'N/A',
            (p.progress || 0) + '%',
            p.client_name || 'Sin asignar',
            p.assigned_names || 'Sin asignar'
        ]);
    } else if (type === 'users') {
        headers = [['NOMBRE', 'APELLIDO', 'CORREO', 'ROL', 'PUESTO', 'TELÉFONO']];
        body = data.map(u => [
            u.first_name,
            u.last_name_paternal,
            u.email,
            u.role ? u.role.toUpperCase() : 'N/A',
            u.occupation || '-',
            u.phone_mobile || '-'
        ]);
    }

    autoTable(doc, {
        startY: 35,
        head: headers,
        body: body,
        headStyles: { 
            fillColor: [30, 58, 138], 
            textColor: 255, 
            fontStyle: 'bold', 
            halign: 'center' 
        },
        bodyStyles: { fontSize: 10 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: {
            0: { halign: 'center' },
            3: { halign: 'center', fontStyle: 'bold' },
            4: { halign: 'center' }
        }
    });

    // Pie de página
    const pageCount = doc.internal.getNumberOfPages();
    const pageWidth = doc.internal.pageSize.width;
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${pageCount}`, margin, doc.internal.pageSize.height - 10);
        doc.text(new Date().toLocaleString(), pageWidth - margin, doc.internal.pageSize.height - 10, { align: 'right' });
    }

    doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
};


// ==================================================================================
// 3. COTIZACIÓN / VENTA CON FIRMA DIGITAL
// ==================================================================================
export const generateQuotePDF = (quote, items, signatureImage = null) => {
    const doc = new jsPDF();
    const margin = 14;

    // --- ENCABEZADO ---
    doc.setFillColor(30, 58, 138); 
    doc.rect(0, 0, 210, 30, 'F'); 
    
    try { 
        doc.addImage(logoBase64, 'PNG', margin, 8, 40, 15); 
    } catch(e) {}

    // Lógica de Título: Si no está pendiente, es una Venta
    const isSale = ['aprobada', 'en_ruta', 'entregada'].includes(quote.status);
    const docTitle = isSale ? "NOTA DE VENTA" : "COTIZACIÓN";

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text(docTitle, 200, 20, { align: 'right' });
    
    doc.setFontSize(10);
    doc.text(`Folio: #${quote.id.toString().padStart(6, '0')}`, 200, 26, { align: 'right' });

    // --- DATOS DEL CLIENTE Y FECHA ---
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    
    // Columna Izquierda
    doc.setFont(undefined, 'bold');
    doc.text("CLIENTE:", margin, 45);
    doc.setFont(undefined, 'normal');
    doc.text(quote.client_name || 'Cliente General', margin, 50);
    if(quote.client_email) doc.text(quote.client_email, margin, 55);

    // Columna Derecha
    doc.setFont(undefined, 'bold');
    doc.text("FECHA:", 140, 45);
    doc.setFont(undefined, 'normal');
    doc.text(new Date(quote.created_at).toLocaleDateString(), 140, 50);
    
    doc.setFont(undefined, 'bold');
    doc.text("VENDEDOR:", 140, 60);
    doc.setFont(undefined, 'normal');
    doc.text(quote.seller_name || 'Administración', 140, 65);
    
    // Estatus visual
    doc.setFont(undefined, 'bold');
    doc.text("ESTATUS:", 140, 75);
    doc.setTextColor(isSale ? 22 : 200, isSale ? 101 : 100, isSale ? 52 : 0); // Verde si es venta
    doc.text(quote.status ? quote.status.toUpperCase().replace('_', ' ') : 'PENDIENTE', 160, 75);
    doc.setTextColor(0, 0, 0);

    // --- TABLA DE PRODUCTOS ---
    const tableRows = items.map(item => [
        item.code || '-',
        item.product_name,
        item.quantity,
        `$${parseFloat(item.price_snapshot).toFixed(2)}`,
        `$${(item.quantity * item.price_snapshot).toFixed(2)}`
    ]);

    autoTable(doc, {
        startY: 85,
        head: [['Código', 'Descripción', 'Cant.', 'Precio Unit.', 'Total']],
        body: tableRows,
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 'auto' },
            2: { halign: 'center' },
            3: { halign: 'right' },
            4: { halign: 'right', fontStyle: 'bold' }
        },
        foot: [['', '', '', 'TOTAL NETO:', `$${parseFloat(quote.total).toFixed(2)}`]],
        footStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold', halign: 'right' }
    });

    let finalY = doc.lastAutoTable.finalY + 20;

    // --- FIRMA DIGITAL (Si existe) ---
    if (signatureImage) {
        // Verificar espacio en página
        if (finalY + 50 > doc.internal.pageSize.height) {
            doc.addPage();
            finalY = margin;
        }

        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text("FIRMA DE CONFORMIDAD:", margin, finalY);
        
        try {
            doc.addImage(signatureImage, 'PNG', margin, finalY + 5, 60, 30);
            doc.setDrawColor(0);
            doc.line(margin, finalY + 35, margin + 60, finalY + 35); // Línea de firma
        } catch (e) {
            console.error("Error agregando firma al PDF", e);
        }
        
        finalY += 45;
    }

    // --- TÉRMINOS ---
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.setFont(undefined, 'normal');
    
    if (isSale) {
        doc.text("Gracias por su compra.", margin, finalY);
        doc.text("Este documento sirve como comprobante de pedido y salida de almacén.", margin, finalY + 5);
    } else {
        doc.text("Términos y condiciones:", margin, finalY);
        doc.text("1. Esta cotización tiene una vigencia de 15 días.", margin, finalY + 5);
        doc.text("2. Precios sujetos a cambio sin previo aviso.", margin, finalY + 10);
        doc.text("3. Tiempo de entrega sujeto a disponibilidad de stock.", margin, finalY + 15);
    }
    
    doc.save(`${docTitle}_${quote.id}.pdf`);

    
};

// ... (al final del archivo)

// 4. RECIBO DE NÓMINA INDIVIDUAL 🧾
export const generatePayrollReceipt = (employee) => {
    const doc = new jsPDF();
    const margin = 20;
    
    // --- ENCABEZADO ---
    doc.setFillColor(30, 58, 138); 
    doc.rect(0, 0, 210, 35, 'F'); 
    
    // Logo (Si existe la variable logoBase64 arriba, úsala)
    try { doc.addImage(logoBase64, 'PNG', margin, 8, 40, 15); } catch(e) {}

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text("RECIBO DE NÓMINA", 200, 20, { align: 'right' });
    doc.setFontSize(10);
    doc.text(`Periodo: ${employee.payment_period ? employee.payment_period.toUpperCase() : 'QUINCENAL'}`, 200, 28, { align: 'right' });

    // --- DATOS DEL EMPLEADO ---
    let y = 50;
    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(`NOMBRE: ${employee.first_name} ${employee.last_name_paternal}`, margin, y);
    doc.text(`PUESTO: ${employee.occupation || 'No especificado'}`, 120, y);
    y += 8;
    doc.setFont(undefined, 'normal');
    doc.text(`RFC: XAXX010101000 (Simulado)`, margin, y); // Aquí iría el RFC real si lo tuvieras
    doc.text(`NSS: ${employee.nss || 'No registrado'}`, 120, y);
    y += 8;
    doc.text(`Fecha de Ingreso: ${employee.start_date ? new Date(employee.start_date).toLocaleDateString() : '-'}`, margin, y);

    // --- TABLA DE CONCEPTOS ---
    y += 15;
    const salary = parseFloat(employee.salary) || 0;
    // Simulamos deducciones básicas (aprox. 10%)
    const deductions = salary * 0.10; 
    const netPay = salary - deductions;

    autoTable(doc, {
        startY: y,
        head: [['Concepto', 'Percepciones', 'Deducciones']],
        body: [
            ['Sueldo Base', `$${salary.toFixed(2)}`, ''],
            ['Bono de Puntualidad (Simulado)', '$0.00', ''],
            ['Retención ISR / IMSS (Estimado)', '', `$${deductions.toFixed(2)}`],
        ],
        headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right', textColor: [200, 0, 0] } },
        theme: 'grid'
    });

    // --- TOTALES ---
    y = doc.lastAutoTable.finalY + 5;
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text(`NETO A PAGAR: $${netPay.toFixed(2)}`, 200, y + 10, { align: 'right' });

    // --- CANTIDAD CON LETRA (Simulada) ---
    doc.setFontSize(9);
    doc.setFont(undefined, 'italic');
    doc.text(`(Cantidad en moneda nacional)`, 200, y + 16, { align: 'right' });

    // --- FIRMA ---
    y += 50;
    doc.setDrawColor(0);
    doc.line(70, y, 140, y); // Línea de firma
    doc.setFont(undefined, 'normal');
    doc.text("Firma del Empleado", 105, y + 5, { align: 'center' });
    doc.text("Recibí de conformidad", 105, y + 10, { align: 'center' });

    // Pie de página
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("Este documento es un comprobante interno de pago.", margin, 280);
    
    doc.save(`Recibo_${employee.first_name}_${new Date().toISOString().slice(0,10)}.pdf`);
};

// 5. FORMATO DE SOLICITUD DE VACACIONES 🏖️
export const generateVacationFormat = (employee, requestData) => {
    const doc = new jsPDF();
    const margin = 20;

    // Encabezado
    doc.setFillColor(30, 58, 138); 
    doc.rect(0, 0, 210, 30, 'F');
    try { doc.addImage(logoBase64, 'PNG', margin, 5, 40, 15); } catch(e) {}
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text("SOLICITUD DE VACACIONES", 200, 18, { align: 'right' });

    // Datos del Empleado
    let y = 45;
    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text("DATOS DEL COLABORADOR:", margin, y);
    y += 8;
    doc.setFont(undefined, 'normal');
    doc.text(`Nombre: ${employee.first_name} ${employee.last_name_paternal}`, margin, y);
    doc.text(`Puesto: ${employee.occupation || 'No especificado'}`, 120, y);
    y += 8;
    doc.text(`Fecha de Solicitud: ${new Date().toLocaleDateString()}`, margin, y);

    // Detalle de la Solicitud
    y += 15;
    doc.setFont(undefined, 'bold');
    doc.text("DETALLE DEL PERIODO VACACIONAL:", margin, y);
    y += 10;
    
    autoTable(doc, {
        startY: y,
        head: [['Días Solicitados', 'Fecha Inicio', 'Fecha Fin', 'Días Restantes (Saldo)']],
        body: [[
            requestData.daysRequested,
            new Date(requestData.startDate).toLocaleDateString(),
            new Date(requestData.endDate).toLocaleDateString(),
            requestData.remainingDays
        ]],
        headStyles: { fillColor: [30, 58, 138] },
        theme: 'grid'
    });

    // Firmas
    y = doc.lastAutoTable.finalY + 50;
    
    doc.setDrawColor(0);
    doc.line(margin, y, margin + 70, y); // Línea 1
    doc.line(120, y, 190, y); // Línea 2

    doc.setFontSize(10);
    doc.text("Firma del Colaborador", margin + 35, y + 5, { align: 'center' });
    doc.text("Autorización (Jefe Inmediato)", 155, y + 5, { align: 'center' });

    y += 30;
    doc.line(75, y, 135, y); // Línea 3
    doc.text("Vo. Bo. Recursos Humanos", 105, y + 5, { align: 'center' });

    doc.save(`Vacaciones_${employee.first_name}_${requestData.startDate}.pdf`);
};