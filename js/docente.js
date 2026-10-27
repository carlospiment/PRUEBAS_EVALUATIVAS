/* ===================================================
   LÓGICA DEL PANEL DOCENTE - ADMINISTRACIÓN Y REPORTES
   Soporte: Servidor Local, GitHub Pages y Modo Offline
   =================================================== */

let allResults = [];
let allStudents = [];
let serverInfo = null;
let currentGroupFilter = 'todos';

document.addEventListener('DOMContentLoaded', async () => {
  await loadServerInfo();
  await loadData();
  setupDocenteEvents();
});

// Load Server Info (if online / local server)
async function loadServerInfo() {
  try {
    const res = await fetch('/api/servidor-info');
    if (res.ok) {
      serverInfo = await res.json();
      renderServerLinks();
    } else {
      renderGitHubPagesLinks();
    }
  } catch (err) {
    renderGitHubPagesLinks();
  }
}

function renderServerLinks() {
  const container = document.getElementById('networkLinksContainer');
  if (!container || !serverInfo) return;

  let html = `<div><strong>Acceso en esta computadora:</strong> <a href="http://localhost:${serverInfo.puerto}" target="_blank">http://localhost:${serverInfo.puerto}</a></div>`;
  if (serverInfo.urls && serverInfo.urls.length > 0) {
    html += `<div style="margin-top: 8px;"><strong>Acceso para Tablets / Celulares de estudiantes (misma red WiFi):</strong></div><ul style="margin-left: 20px; margin-top: 4px;">`;
    serverInfo.urls.forEach(u => {
      html += `<li><a href="${u}" target="_blank" style="font-weight: 700; color: #15803d;">${u}</a></li>`;
    });
    html += `</ul>`;
  }
  container.innerHTML = html;
}

function renderGitHubPagesLinks() {
  const container = document.getElementById('networkLinksContainer');
  if (!container) return;
  const currentUrl = window.location.href.replace('docente.html', 'index.html');
  container.innerHTML = `
    <div><strong>Modo Web / GitHub Pages Activo:</strong></div>
    <div style="margin-top: 4px;">
      🔗 Enlace de la prueba para compartir con estudiantes: 
      <a href="${currentUrl}" target="_blank" style="font-weight: 700; color: #15803d;">${currentUrl}</a>
    </div>
    <div style="font-size: 0.88rem; color: #64748b; margin-top: 6px;">
      ⚡ Los estudiantes pueden abrir este enlace en sus tablets o teléfonos. Gracias a la tecnología PWA, una vez cargado pueden continuar incluso si se interrumpe la conexión a internet.
    </div>
  `;
}

// LocalStorage Helper
function getLocalResults() {
  try {
    const raw = localStorage.getItem('meduca_agri_eval_3er_grado');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Load Data from Server with LocalStorage Fallback / Merge
async function loadData() {
  try {
    // 1. Load Students (try server first, then local data/estudiantes.json)
    try {
      const resEst = await fetch('/api/estudiantes');
      if (resEst.ok) {
        allStudents = await resEst.json();
      } else {
        throw new Error('API estudiantes error');
      }
    } catch {
      const resStatic = await fetch('./data/estudiantes.json');
      allStudents = await resStatic.json();
    }

    // 2. Load Results (try server first, then merge with local storage)
    let serverResults = [];
    try {
      const resRes = await fetch('/api/resultados');
      if (resRes.ok) {
        const data = await resRes.json();
        serverResults = data.resultados || [];
      }
    } catch {
      // server offline
    }

    const localResults = getLocalResults();

    // Merge without duplicates
    const combinedMap = new Map();
    serverResults.forEach(r => combinedMap.set(r.id || r.estudiante_nombre, r));
    localResults.forEach(r => {
      const key = r.id || r.estudiante_nombre;
      if (!combinedMap.has(key)) {
        combinedMap.set(key, r);
      }
    });

    allResults = Array.from(combinedMap.values());

    calculateAndRenderStats();
    renderTable();
  } catch (err) {
    console.error('Error cargando datos del panel docente:', err);
  }
}

function calculateAndRenderStats() {
  const totalEst = allStudents.length;
  const realizadas = allResults.length;
  const pendientes = Math.max(0, totalEst - realizadas);

  let sumaNotas = 0;
  let sumaTiempo = 0;

  allResults.forEach(r => {
    sumaNotas += Number(r.nota_meduca) || 1.0;
    sumaTiempo += Number(r.duracion_segundos) || 0;
  });

  const promedioNota = realizadas > 0 ? (sumaNotas / realizadas).toFixed(2) : '-';
  const promedioTiempoSec = realizadas > 0 ? Math.round(sumaTiempo / realizadas) : 0;
  const min = Math.floor(promedioTiempoSec / 60);
  const sec = promedioTiempoSec % 60;
  const promedioTiempoFmt = realizadas > 0 
    ? `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')} min` 
    : '-';

  document.getElementById('statTotal').textContent = totalEst;
  document.getElementById('statRealizadas').textContent = realizadas;
  document.getElementById('statPendientes').textContent = pendientes;
  document.getElementById('statPromedioNota').textContent = promedioNota;
  document.getElementById('statPromedioTiempo').textContent = promedioTiempoFmt;
}

function renderTable() {
  const tbody = document.getElementById('resultsTableBody');
  const search = (document.getElementById('searchInput').value || '').toLowerCase().trim();
  const statusFilter = document.getElementById('statusFilter').value;
  const groupFilter = document.getElementById('groupFilterSelect').value;

  tbody.innerHTML = '';

  const rows = allStudents.map(student => {
    const res = allResults.find(r => 
      (r.estudiante_id && r.estudiante_id === student.id) ||
      (r.estudiante_nombre && student.nombre && r.estudiante_nombre.toLowerCase().trim() === student.nombre.toLowerCase().trim())
    );
    return {
      student,
      result: res
    };
  });

  const filtered = rows.filter(item => {
    const s = item.student;
    // Search
    const matchSearch = (s.nombre || '').toLowerCase().includes(search) || 
                        (s.apellidos || '').toLowerCase().includes(search) || 
                        (s.nombres || '').toLowerCase().includes(search);
    if (!matchSearch) return false;

    // Status filter
    if (statusFilter === 'realizadas' && !item.result) return false;
    if (statusFilter === 'pendientes' && item.result) return false;

    // Group filter
    if (groupFilter !== 'todos' && s.grupo !== groupFilter) return false;

    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 24px; color: #6b7280;">No se encontraron registros con los filtros seleccionados</td></tr>`;
    return;
  }

  filtered.forEach((item, idx) => {
    const tr = document.createElement('tr');
    const { student, result } = item;
    const grupoLabel = student.grupo_label || student.grupo || '3°';

    if (result) {
      let badgeColor = '#dcfce7';
      let textColor = '#15803d';
      if (result.nota_meduca < 3.0) {
        badgeColor = '#fee2e2';
        textColor = '#dc2626';
      } else if (result.nota_meduca < 4.0) {
        badgeColor = '#fef3c7';
        textColor = '#d97706';
      }

      tr.innerHTML = `
        <td style="font-weight: 700; color: #64748b;">${idx + 1}</td>
        <td>
          <strong>${student.nombre_simple || student.nombre}</strong>
          <span class="group-pill">${grupoLabel}</span>
        </td>
        <td><span style="background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 999px; font-size: 0.82rem; font-weight: 700;">✅ Realizada</span></td>
        <td>${result.completado_at || '-'}</td>
        <td style="font-family: monospace; font-weight: 700; color: #92400e;">⏱️ ${result.duracion_formato}</td>
        <td><strong>${result.puntos_obtenidos}</strong> / ${result.puntos_totales}</td>
        <td>
          <span style="background: ${badgeColor}; color: ${textColor}; padding: 4px 12px; border-radius: 999px; font-weight: 800; font-size: 1.05rem;">
            ${Number(result.nota_meduca).toFixed(1)}
          </span>
        </td>
        <td>
          <button class="btn-secondary" onclick="viewDetail('${result.id}')" style="margin-right: 6px;">
            👁️ Ver
          </button>
          <button class="btn-danger" onclick="resetAttempt('${result.id}', '${student.nombre}')">
            🔄 Reiniciar
          </button>
        </td>
      `;
    } else {
      tr.innerHTML = `
        <td style="font-weight: 700; color: #64748b;">${idx + 1}</td>
        <td>
          <strong>${student.nombre_simple || student.nombre}</strong>
          <span class="group-pill" style="opacity: 0.7;">${grupoLabel}</span>
        </td>
        <td><span style="background: #f1f5f9; color: #64748b; padding: 4px 10px; border-radius: 999px; font-size: 0.82rem; font-weight: 700;">⏳ Pendiente</span></td>
        <td style="color: #94a3b8;">-</td>
        <td style="color: #94a3b8;">-</td>
        <td style="color: #94a3b8;">-</td>
        <td style="color: #94a3b8;">-</td>
        <td><span style="color: #94a3b8; font-size: 0.85rem;">En espera</span></td>
      `;
    }

    tbody.appendChild(tr);
  });
}

function setupDocenteEvents() {
  document.getElementById('searchInput').addEventListener('input', renderTable);
  document.getElementById('statusFilter').addEventListener('change', renderTable);
  document.getElementById('groupFilterSelect').addEventListener('change', renderTable);
  document.getElementById('refreshBtn').addEventListener('click', loadData);

  // Client-side CSV Download (Works on GitHub Pages & Offline without server!)
  document.getElementById('exportCsvBtn').addEventListener('click', exportResultsCsv);

  // Manage students modal
  const rosterModal = document.getElementById('rosterModal');
  document.getElementById('openRosterBtn').addEventListener('click', () => {
    const listText = allStudents.map(s => s.nombre).join('\n');
    document.getElementById('rosterTextarea').value = listText;
    rosterModal.classList.add('active');
  });

  document.getElementById('closeRosterModal').addEventListener('click', () => {
    rosterModal.classList.remove('active');
  });

  document.getElementById('saveRosterBtn').addEventListener('click', saveRoster);

  // Detail modal close
  document.getElementById('closeDetailModal').addEventListener('click', () => {
    document.getElementById('detailModal').classList.remove('active');
  });
}

// Client-Side CSV Export (Universal for GitHub Pages, Offline, and Local)
function exportResultsCsv() {
  if (allResults.length === 0) {
    alert('Aún no hay pruebas realizadas para exportar.');
    return;
  }

  let csv = '\uFEFF'; // UTF-8 BOM for Excel in Spanish
  csv += 'N°,Grupo,Estudiante,Fecha y Hora,Tiempo Empleado,Puntos (de 19),Nota MEDUCA,Nivel,Parte A (5 pts),Parte B (4 pts),Parte C (6 pts),Parte D (4 pts)\n';

  allResults.forEach((r, idx) => {
    const ptsA = r.detalles?.parte_a?.puntos ?? '-';
    const ptsB = r.detalles?.parte_b?.puntos ?? '-';
    const ptsC = r.detalles?.parte_c?.puntos ?? '-';
    const ptsD = r.detalles?.parte_d?.puntos ?? '-';
    const grupo = r.grupo || '3°';
    
    csv += `"${idx + 1}","${grupo}","${r.estudiante_nombre}","${r.completado_at}","${r.duracion_formato}",${r.puntos_obtenidos},${r.nota_meduca},"${r.desempeno}",${ptsA},${ptsB},${ptsC},${ptsD}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Resultados_Agricultura_3erGrado_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Reset student attempt (Server + LocalStorage)
async function resetAttempt(resultId, studentName) {
  const confirmReset = confirm(`¿Estás seguro de que deseas reiniciar el intento de "${studentName}"?\n\nEsto eliminará su calificación anterior y le permitirá volver a realizar la prueba.`);
  if (!confirmReset) return;

  // 1. Remove from local storage
  try {
    const local = getLocalResults();
    const updated = local.filter(r => r.id !== resultId && r.estudiante_nombre !== studentName);
    localStorage.setItem('meduca_agri_eval_3er_grado', JSON.stringify(updated));
  } catch (e) {
    console.warn(e);
  }

  // 2. Remove from server if online
  try {
    await fetch('/api/resultados/reiniciar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: resultId, estudiante_nombre: studentName })
    });
  } catch {
    // server might be offline, local was already updated
  }

  alert(`Intento de ${studentName} reiniciado correctamente.`);
  await loadData();
}

// View student answer details
function viewDetail(resultId) {
  const res = allResults.find(r => r.id === resultId);
  if (!res) return;

  const modal = document.getElementById('detailModal');
  document.getElementById('detailStudentName').textContent = res.estudiante_nombre;
  document.getElementById('detailScore').textContent = `${res.puntos_obtenidos} / ${res.puntos_totales} (Nota: ${Number(res.nota_meduca).toFixed(1)})`;
  document.getElementById('detailTime').textContent = res.duracion_formato;
  document.getElementById('detailDate').textContent = res.completado_at;

  const body = document.getElementById('detailModalBody');
  body.innerHTML = '';

  const d = res.detalles;
  if (!d) {
    body.innerHTML = '<p>No hay detalles específicos registrados para este intento.</p>';
    modal.classList.add('active');
    return;
  }

  // Parte A
  let html = `
    <div style="margin-bottom: 20px;">
      <h4 style="color: #166534; border-bottom: 2px solid #86efac; padding-bottom: 4px; margin-bottom: 10px;">
        Parte A. Completa (${d.parte_a.puntos} de 5 pts)
      </h4>
      <ul style="list-style: none; padding-left: 0;">
  `;
  (d.parte_a.items || []).forEach(item => {
    const icon = item.es_correcta ? '✅' : '❌';
    html += `
      <li style="padding: 6px 0; border-bottom: 1px solid #f1f5f9;">
        ${icon} <strong>Item ${item.numero}:</strong> Respuesta dada: <em>"${item.respuesta_dada}"</em> 
        ${!item.es_correcta ? `<span style="color: #15803d; font-weight: 700;">(Esperada: ${item.respuesta_esperada})</span>` : ''}
      </li>
    `;
  });
  html += `</ul></div>`;

  // Parte B
  html += `
    <div style="margin-bottom: 20px;">
      <h4 style="color: #166534; border-bottom: 2px solid #86efac; padding-bottom: 4px; margin-bottom: 10px;">
        Parte B. Selección Múltiple (${d.parte_b.puntos} de 4 pts)
      </h4>
      <ul style="list-style: none; padding-left: 0;">
  `;
  (d.parte_b.items || []).forEach(item => {
    const icon = item.es_correcta ? '✅' : '❌';
    html += `
      <li style="padding: 6px 0; border-bottom: 1px solid #f1f5f9;">
        ${icon} <strong>Pregunta ${item.numero}:</strong> Opción elegida: <strong>${(item.respuesta_dada || '').toUpperCase()}</strong>
        ${!item.es_correcta ? `<span style="color: #15803d; font-weight: 700;">(Correcta: ${(item.respuesta_esperada || '').toUpperCase()})</span>` : ''}
      </li>
    `;
  });
  html += `</ul></div>`;

  // Parte C
  html += `
    <div style="margin-bottom: 20px;">
      <h4 style="color: #166534; border-bottom: 2px solid #86efac; padding-bottom: 4px; margin-bottom: 10px;">
        Parte C. Verdadero o Falso (${d.parte_c.puntos} de 6 pts)
      </h4>
      <ul style="list-style: none; padding-left: 0;">
  `;
  (d.parte_c.items || []).forEach(item => {
    const icon = item.es_correcta ? '✅' : '❌';
    html += `
      <li style="padding: 6px 0; border-bottom: 1px solid #f1f5f9;">
        ${icon} <strong>Item ${item.numero}:</strong> Marcó: <strong>${item.respuesta_dada}</strong>
        ${!item.es_correcta ? `<span style="color: #15803d; font-weight: 700;">(Correcta: ${item.respuesta_esperada})</span>` : ''}
      </li>
    `;
  });
  html += `</ul></div>`;

  // Parte D
  html += `
    <div style="margin-bottom: 20px;">
      <h4 style="color: #166534; border-bottom: 2px solid #86efac; padding-bottom: 4px; margin-bottom: 10px;">
        Parte D. Relaciona (${d.parte_d.puntos} de 4 pts)
      </h4>
      <ul style="list-style: none; padding-left: 0;">
  `;
  (d.parte_d.items || []).forEach(item => {
    const icon = item.es_correcta ? '✅' : '❌';
    html += `
      <li style="padding: 6px 0; border-bottom: 1px solid #f1f5f9;">
        ${icon} <strong>${item.numero}. ${item.termino}:</strong> Relacionado con: <strong>${item.respuesta_dada}</strong>
        ${!item.es_correcta ? `<span style="color: #15803d; font-weight: 700;">(Correcta: ${item.respuesta_esperada})</span>` : ''}
      </li>
    `;
  });
  html += `</ul></div>`;

  body.innerHTML = html;
  modal.classList.add('active');
}

async function saveRoster() {
  const text = document.getElementById('rosterTextarea').value;
  if (!text.trim()) {
    alert('Por favor ingresa al menos un nombre de estudiante.');
    return;
  }

  const saveBtn = document.getElementById('saveRosterBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando...';

  try {
    const res = await fetch('/api/estudiantes/actualizar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lista_texto: text })
    });

    const data = await res.json();
    if (data.exito) {
      alert(`¡Lista actualizada exitosamente! Se registraron ${data.total} estudiantes.`);
      document.getElementById('rosterModal').classList.remove('active');
      await loadData();
    } else {
      alert(data.error || 'Error al actualizar lista');
    }
  } catch (err) {
    console.error('Error guardando lista:', err);
    alert('Nota: En modo estático/GitHub Pages, edita el archivo data/estudiantes.json.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 Guardar Lista de Estudiantes';
  }
}
