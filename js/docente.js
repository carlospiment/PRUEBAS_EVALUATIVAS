/* ===================================================
   LÓGICA DEL PANEL DOCENTE - ADMINISTRACIÓN Y REPORTES
   Soporte Multi-Grado: 3er y 4to Grado de Primaria
   =================================================== */

let allResults = [];
let allStudents = [];
let serverInfo = null;
let currentGradeFilter = 'todos';

document.addEventListener('DOMContentLoaded', async () => {
  await loadServerInfo();
  await loadData();
  setupDocenteEvents();
});

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
    html += `<div style="margin-top: 8px;"><strong>Acceso en Red Local (Tablets / Celulares):</strong></div><ul style="margin-left: 20px; margin-top: 4px;">`;
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
  const baseUrl = window.location.href.replace('docente.html', '');
  container.innerHTML = `
    <div><strong>Enlaces Oficiales de GitHub Pages:</strong></div>
    <ul style="margin-left: 20px; margin-top: 6px; line-height: 1.8;">
      <li>🥕 <strong>Prueba 4to Grado:</strong> <a href="${baseUrl}cuarto_grado.html" target="_blank" style="font-weight: 700; color: #ea580c;">${baseUrl}cuarto_grado.html</a></li>
      <li>🌿 <strong>Prueba 3er Grado:</strong> <a href="${baseUrl}tercer_grado.html" target="_blank" style="font-weight: 700; color: #15803d;">${baseUrl}tercer_grado.html</a></li>
    </ul>
    <div style="font-size: 0.88rem; color: #64748b; margin-top: 6px;">
      ⚡ Funciona 100% Offline (PWA). Una vez abierta por primera vez, no requiere conexión a internet continua.
    </div>
  `;
}

function getLocalResults(grade) {
  try {
    if (grade) {
      const raw = localStorage.getItem(`meduca_agri_eval_${grade}to_grado`);
      return raw ? JSON.parse(raw) : [];
    }
    const r3 = JSON.parse(localStorage.getItem('meduca_agri_eval_3to_grado') || '[]');
    const r4 = JSON.parse(localStorage.getItem('meduca_agri_eval_4to_grado') || '[]');
    const rOld = JSON.parse(localStorage.getItem('meduca_agri_eval_3er_grado') || '[]');
    return [...r3, ...r4, ...rOld];
  } catch {
    return [];
  }
}

async function loadData() {
  try {
    // 1. Load Students
    try {
      const resEst = await fetch('/api/estudiantes');
      if (resEst.ok) allStudents = await resEst.json();
      else throw new Error();
    } catch {
      const resStatic = await fetch('./data/estudiantes.json');
      allStudents = await resStatic.json();
    }

    // 2. Load Results
    let serverResults = [];
    try {
      const resRes = await fetch('/api/resultados');
      if (resRes.ok) {
        const data = await resRes.json();
        serverResults = data.resultados || [];
      }
    } catch {}

    const localResults = getLocalResults();
    const combinedMap = new Map();
    serverResults.forEach(r => combinedMap.set((r.grado || '3') + '_' + (r.id || r.estudiante_nombre), r));
    localResults.forEach(r => {
      const key = (r.grado || '3') + '_' + (r.id || r.estudiante_nombre);
      if (!combinedMap.has(key)) combinedMap.set(key, r);
    });

    allResults = Array.from(combinedMap.values());

    calculateAndRenderStats();
    renderTable();
  } catch (err) {
    console.error('Error cargando datos:', err);
  }
}

function calculateAndRenderStats() {
  const gradeSel = document.getElementById('gradeFilterSelect')?.value || 'todos';

  let filteredStudents = allStudents;
  let filteredResults = allResults;

  if (gradeSel === '3') {
    filteredStudents = allStudents.filter(s => s.grado === 3);
    filteredResults = allResults.filter(r => r.grado === 3 || !r.grado);
  } else if (gradeSel === '4') {
    filteredStudents = allStudents.filter(s => s.grado === 4);
    filteredResults = allResults.filter(r => r.grado === 4);
  }

  const totalEst = filteredStudents.length;
  const realizadas = filteredResults.length;
  const pendientes = Math.max(0, totalEst - realizadas);

  let sumaNotas = 0;
  let sumaTiempo = 0;

  filteredResults.forEach(r => {
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
  const gradeFilter = document.getElementById('gradeFilterSelect').value;
  const statusFilter = document.getElementById('statusFilter').value;
  const groupFilter = document.getElementById('groupFilterSelect').value;

  tbody.innerHTML = '';

  const rows = allStudents.map(student => {
    const res = allResults.find(r => 
      ((r.grado === student.grado) || (!r.grado && student.grado === 3)) && (
        (r.estudiante_id && r.estudiante_id === student.id) ||
        (r.estudiante_nombre && student.nombre && r.estudiante_nombre.toLowerCase().trim() === student.nombre.toLowerCase().trim())
      )
    );
    return { student, result: res };
  });

  const filtered = rows.filter(item => {
    const s = item.student;
    // Grade Filter
    if (gradeFilter !== 'todos' && s.grado !== parseInt(gradeFilter, 10)) return false;

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
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 24px; color: #6b7280;">No se encontraron registros con los filtros seleccionados</td></tr>`;
    return;
  }

  filtered.forEach((item, idx) => {
    const tr = document.createElement('tr');
    const { student, result } = item;
    const gradoBadge = student.grado === 4 
      ? `<span style="background: #ffedd5; color: #c2410c; padding: 2px 8px; border-radius: 999px; font-weight: 800; font-size: 0.78rem;">4° Grado</span>` 
      : `<span style="background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 999px; font-weight: 800; font-size: 0.78rem;">3er Grado</span>`;

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
        <td>${gradoBadge}</td>
        <td>
          <strong>${student.nombre_simple || student.nombre}</strong>
          <span class="group-pill">${student.grupo_label || student.grupo}</span>
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
          <button class="btn-danger" onclick="resetAttempt('${result.id}', '${student.nombre}', ${student.grado})">
            🔄 Reiniciar
          </button>
        </td>
      `;
    } else {
      tr.innerHTML = `
        <td style="font-weight: 700; color: #64748b;">${idx + 1}</td>
        <td>${gradoBadge}</td>
        <td>
          <strong>${student.nombre_simple || student.nombre}</strong>
          <span class="group-pill" style="opacity: 0.7;">${student.grupo_label || student.grupo}</span>
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
  document.getElementById('gradeFilterSelect').addEventListener('change', () => {
    calculateAndRenderStats();
    updateGroupFilterOptions();
    renderTable();
  });
  document.getElementById('statusFilter').addEventListener('change', renderTable);
  document.getElementById('groupFilterSelect').addEventListener('change', renderTable);
  document.getElementById('refreshBtn').addEventListener('click', loadData);
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

  document.getElementById('closeDetailModal').addEventListener('click', () => {
    document.getElementById('detailModal').classList.remove('active');
  });
}

function updateGroupFilterOptions() {
  const g = document.getElementById('gradeFilterSelect').value;
  const sel = document.getElementById('groupFilterSelect');
  if (g === '3') {
    sel.innerHTML = `
      <option value="todos">Todos los salones de 3°</option>
      <option value="3A">Salón 3°A</option>
      <option value="3B">Salón 3°B</option>
      <option value="3C">Salón 3°C</option>
    `;
  } else if (g === '4') {
    sel.innerHTML = `
      <option value="todos">Todos los salones de 4°</option>
      <option value="4A">Salón 4°A</option>
      <option value="4B">Salón 4°B</option>
      <option value="4C">Salón 4°C</option>
    `;
  } else {
    sel.innerHTML = `
      <option value="todos">Todos los salones (3° y 4°)</option>
      <option value="3A">Salón 3°A</option>
      <option value="3B">Salón 3°B</option>
      <option value="3C">Salón 3°C</option>
      <option value="4A">Salón 4°A</option>
      <option value="4B">Salón 4°B</option>
      <option value="4C">Salón 4°C</option>
    `;
  }
}

// Client-Side CSV Export
function exportResultsCsv() {
  const gradeSel = document.getElementById('gradeFilterSelect').value;
  let target = allResults;
  if (gradeSel === '3') target = allResults.filter(r => r.grado === 3 || !r.grado);
  else if (gradeSel === '4') target = allResults.filter(r => r.grado === 4);

  if (target.length === 0) {
    alert('No hay evaluaciones registradas con los filtros actuales para exportar.');
    return;
  }

  let csv = '\uFEFF';
  csv += 'N°,Grado,Salón,Estudiante,Fecha y Hora,Tiempo Empleado,Puntos,Nota MEDUCA,Nivel,Parte A,Parte B,Parte C,Parte D,Parte E (4to)\n';

  target.forEach((r, idx) => {
    const ptsA = r.detalles?.parte_a?.puntos ?? '-';
    const ptsB = r.detalles?.parte_b?.puntos ?? '-';
    const ptsC = r.detalles?.parte_c?.puntos ?? '-';
    const ptsD = r.detalles?.parte_d?.puntos ?? '-';
    const ptsE = r.detalles?.parte_e?.puntos ?? '-';
    const grado = r.grado ? `${r.grado}°` : '3°';
    const grupo = r.grupo || '';
    
    csv += `"${idx + 1}","${grado}","${grupo}","${r.estudiante_nombre}","${r.completado_at}","${r.duracion_formato}",${r.puntos_obtenidos},${r.nota_meduca},"${r.desempeno}",${ptsA},${ptsB},${ptsC},${ptsD},${ptsE}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Resultados_Evaluaciones_MEDUCA_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Reset student attempt
async function resetAttempt(resultId, studentName, grado) {
  const confirmReset = confirm(`¿Estás seguro de que deseas reiniciar el intento de "${studentName}" (${grado}° grado)?\n\nEsto eliminará su nota previa y le permitirá realizar la prueba nuevamente.`);
  if (!confirmReset) return;

  try {
    const key = `meduca_agri_eval_${grado}to_grado`;
    const local = JSON.parse(localStorage.getItem(key) || '[]');
    const updated = local.filter(r => r.id !== resultId && r.estudiante_nombre !== studentName);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (e) {
    console.warn(e);
  }

  try {
    await fetch('/api/resultados/reiniciar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: resultId, estudiante_nombre: studentName })
    });
  } catch {}

  alert(`Intento de ${studentName} reiniciado correctamente.`);
  await loadData();
}

// View student answer details
function viewDetail(resultId) {
  const res = allResults.find(r => r.id === resultId);
  if (!res) return;

  const modal = document.getElementById('detailModal');
  document.getElementById('detailStudentName').textContent = `${res.estudiante_nombre} (${res.grado || 3}° Grado)`;
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
        Parte A. Completa (${d.parte_a.puntos} pts)
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
        Parte D. Relaciona (${d.parte_d.puntos} pts)
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

  // Parte E (si aplica para 4to grado)
  if (d.parte_e?.items && d.parte_e.items.length > 0) {
    html += `
      <div style="margin-bottom: 20px;">
        <h4 style="color: #166534; border-bottom: 2px solid #86efac; padding-bottom: 4px; margin-bottom: 10px;">
          Parte E. Respuesta Corta (${d.parte_e.puntos} de 4 pts)
        </h4>
        <ul style="list-style: none; padding-left: 0;">
    `;
    d.parte_e.items.forEach(item => {
      const icon = item.es_correcta ? '✅' : '⚠️';
      html += `
        <li style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
          ${icon} <strong>Pregunta ${item.numero} (${item.enunciado}):</strong><br>
          <div style="background: #f8fafc; padding: 8px 12px; border-left: 3px solid #22c55e; margin-top: 4px; font-style: italic;">
            "${item.respuesta_dada}"
          </div>
        </li>
      `;
    });
    html += `</ul></div>`;
  }

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
      alert(`¡Lista actualizada exitosamente!`);
      document.getElementById('rosterModal').classList.remove('active');
      await loadData();
    }
  } catch (err) {
    alert('Nota: En modo estático/GitHub Pages, edita el archivo data/estudiantes.json.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 Guardar Cambios';
  }
}
