/* ===================================================
   LÓGICA DEL PANEL DOCENTE - ADMINISTRACIÓN Y REPORTES
   =================================================== */

let allResults = [];
let allStudents = [];
let serverInfo = null;

document.addEventListener('DOMContentLoaded', async () => {
  await loadServerInfo();
  await loadData();
  setupDocenteEvents();
});

async function loadServerInfo() {
  try {
    const res = await fetch('/api/servidor-info');
    serverInfo = await res.json();
    renderServerLinks();
  } catch (err) {
    console.error('Error cargando info del servidor:', err);
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

async function loadData() {
  try {
    const [resResultados, resEstudiantes] = await Promise.all([
      fetch('/api/resultados'),
      fetch('/api/estudiantes')
    ]);

    const dataResultados = await resResultados.json();
    allStudents = await resEstudiantes.json();
    allResults = dataResultados.resultados || [];

    renderStatistics(dataResultados.estadisticas);
    renderTable();
  } catch (err) {
    console.error('Error cargando datos del panel docente:', err);
  }
}

function renderStatistics(stats) {
  if (!stats) return;

  const totalEst = allStudents.length;
  const realizadas = allResults.length;
  const pendientes = Math.max(0, totalEst - realizadas);

  document.getElementById('statTotal').textContent = totalEst;
  document.getElementById('statRealizadas').textContent = realizadas;
  document.getElementById('statPendientes').textContent = pendientes;
  document.getElementById('statPromedioNota').textContent = stats.promedioNotas ? stats.promedioNotas.toFixed(2) : '-';
  document.getElementById('statPromedioTiempo').textContent = stats.promedioTiempo || '-';
}

function renderTable() {
  const tbody = document.getElementById('resultsTableBody');
  const search = (document.getElementById('searchInput').value || '').toLowerCase().trim();
  const filter = document.getElementById('statusFilter').value;

  tbody.innerHTML = '';

  // Combine student roster with submission results
  const rows = allStudents.map(student => {
    const res = allResults.find(r => 
      (r.estudiante_id && r.estudiante_id === student.id) ||
      r.estudiante_nombre.toLowerCase().trim() === student.nombre.toLowerCase().trim()
    );
    return {
      student,
      result: res
    };
  });

  // Filter
  const filtered = rows.filter(item => {
    const matchesSearch = item.student.nombre.toLowerCase().includes(search);
    if (!matchesSearch) return false;

    if (filter === 'realizadas') return !!item.result;
    if (filter === 'pendientes') return !item.result;
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 24px; color: #6b7280;">No se encontraron registros con los filtros seleccionados</td></tr>`;
    return;
  }

  filtered.forEach((item, idx) => {
    const tr = document.createElement('tr');
    const { student, result } = item;

    if (result) {
      // Completed test
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
        <td><strong>${student.nombre}</strong></td>
        <td><span style="background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 999px; font-size: 0.82rem; font-weight: 700;">✅ Realizada</span></td>
        <td>${result.completado_at || '-'}</td>
        <td style="font-family: monospace; font-weight: 700; color: #92400e;">⏱️ ${result.duracion_formato}</td>
        <td><strong>${result.puntos_obtenidos}</strong> / ${result.puntos_totales}</td>
        <td>
          <span style="background: ${badgeColor}; color: ${textColor}; padding: 4px 12px; border-radius: 999px; font-weight: 800; font-size: 1.05rem;">
            ${result.nota_meduca.toFixed(1)}
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
      // Pending
      tr.innerHTML = `
        <td style="font-weight: 700; color: #64748b;">${idx + 1}</td>
        <td><strong>${student.nombre}</strong></td>
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

  document.getElementById('refreshBtn').addEventListener('click', loadData);

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
    alert('Error de conexión al guardar lista.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 Guardar Lista de Estudiantes';
  }
}

// Reset student attempt
async function resetAttempt(resultId, studentName) {
  const confirmReset = confirm(`¿Estás seguro de que deseas reiniciar el intento de "${studentName}"?\n\nEsto eliminará su calificación anterior y le permitirá volver a realizar la prueba.`);
  if (!confirmReset) return;

  try {
    const res = await fetch('/api/resultados/reiniciar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: resultId })
    });

    const data = await res.json();
    if (data.exito) {
      alert(`Intento de ${studentName} reiniciado correctamente.`);
      await loadData();
    } else {
      alert(data.error || 'No se pudo reiniciar el intento');
    }
  } catch (err) {
    console.error('Error reiniciando intento:', err);
    alert('Error al reiniciar intento.');
  }
}

// View student answer details
function viewDetail(resultId) {
  const res = allResults.find(r => r.id === resultId);
  if (!res) return;

  const modal = document.getElementById('detailModal');
  document.getElementById('detailStudentName').textContent = res.estudiante_nombre;
  document.getElementById('detailScore').textContent = `${res.puntos_obtenidos} / ${res.puntos_totales} (Nota: ${res.nota_meduca.toFixed(1)})`;
  document.getElementById('detailTime').textContent = res.duracion_formato;
  document.getElementById('detailDate').textContent = res.completado_at;

  const body = document.getElementById('detailModalBody');
  body.innerHTML = '';

  const d = res.detalles;
  if (!d) {
    body.innerHTML = '<p>No hay detalles disponibles para este intento.</p>';
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
  d.parte_a.items.forEach(item => {
    const icon = item.es_correcta ? '✅' : '❌';
    html += `
      <li style="padding: 6px 0; border-bottom: 1px solid #f1f5f9;">
        ${icon} <strong>Item ${item.numero}:</strong> Respuesta dada: <em>"${item.respuesta_dada}"</em> 
        ${!item.es_correcta ? `<span style="color: #15803d; font-weight: 700;">(Correcta: ${item.respuesta_esperada})</span>` : ''}
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
  d.parte_b.items.forEach(item => {
    const icon = item.es_correcta ? '✅' : '❌';
    html += `
      <li style="padding: 6px 0; border-bottom: 1px solid #f1f5f9;">
        ${icon} <strong>Pregunta ${item.numero}:</strong> Opción elegida: <strong>${item.respuesta_dada.toUpperCase()}</strong>
        ${!item.es_correcta ? `<span style="color: #15803d; font-weight: 700;">(Correcta: ${item.respuesta_esperada.toUpperCase()})</span>` : ''}
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
  d.parte_c.items.forEach(item => {
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
  d.parte_d.items.forEach(item => {
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
