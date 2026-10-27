const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'prueba_config.json');
const ESTUDIANTES_FILE = path.join(DATA_DIR, 'estudiantes.json');
const RESULTADOS_FILE = path.join(DATA_DIR, 'resultados.json');

// Helper functions for reading/writing JSON
function readJSON(file, defaultValue = []) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2), 'utf8');
      return defaultValue;
    }
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error leyendo ${file}:`, err);
    return defaultValue;
  }
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error guardando ${file}:`, err);
    return false;
  }
}

// Normalizer for text answers (remove accents, trim, lowercase, strip leading articles)
function normalizeText(str) {
  if (!str) return '';
  let cleaned = str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,;:!?¿¡"']/g, '')
    .replace(/\s+/g, ' ');
  // Strip leading articles like 'el ', 'la ', 'los ', 'las '
  cleaned = cleaned.replace(/^(el|la|los|las|un|una|unos|unas)\s+/, '');
  return cleaned;
}

// Format seconds into MM:SS or HH:MM:SS
function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const pad = (n) => n.toString().padStart(2, '0');
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${pad(remMins)}m ${pad(secs)}s`;
  }
  return `${pad(mins)}:${pad(secs)} min`;
}

// Calculate Panamanian MEDUCA Grade (1.0 to 5.0)
function calculateMeducaGrade(points, total) {
  if (total <= 0) return 1.0;
  // Escala oficial: Nota = 1.0 + 4.0 * (puntos / total)
  const nota = 1.0 + 4.0 * (points / total);
  return Number(Math.max(1.0, Math.min(5.0, nota)).toFixed(1));
}

function getPerformanceLevel(nota) {
  if (nota >= 4.5) return { nivel: 'Excelente', badge: '⭐ Sobresaliente', color: '#16a34a' };
  if (nota >= 4.0) return { nivel: 'Bueno', badge: '👍 Muy Bueno', color: '#2563eb' };
  if (nota >= 3.0) return { nivel: 'Regular / Aprobado', badge: '✔️ Aprobado', color: '#d97706' };
  return { nivel: 'Necesita Reforzar', badge: '⚠️ En Progreso', color: '#dc2626' };
}

// --- API ROUTES ---

// 1. Get test config (Safe for student: without answers)
app.get('/api/prueba', (req, res) => {
  const config = readJSON(CONFIG_FILE, {});
  // Deep clone to strip answer keys for student security
  const safeConfig = JSON.parse(JSON.stringify(config));

  // Strip answers in safe config
  if (safeConfig.secciones) {
    if (safeConfig.secciones.parte_a?.preguntas) {
      safeConfig.secciones.parte_a.preguntas.forEach(p => delete p.respuestas_validas);
    }
    if (safeConfig.secciones.parte_b?.preguntas) {
      safeConfig.secciones.parte_b.preguntas.forEach(p => delete p.respuesta_correcta);
    }
    if (safeConfig.secciones.parte_c?.preguntas) {
      safeConfig.secciones.parte_c.preguntas.forEach(p => delete p.respuesta_correcta);
    }
    if (safeConfig.secciones.parte_d?.conceptos) {
      safeConfig.secciones.parte_d.conceptos.forEach(c => delete c.respuesta_correcta);
    }
  }

  res.json(safeConfig);
});

// 2. Get students with their completion status
app.get('/api/estudiantes', (req, res) => {
  const estudiantes = readJSON(ESTUDIANTES_FILE, []);
  const resultados = readJSON(RESULTADOS_FILE, []);

  // Map each student to check if already submitted
  const lista = estudiantes.map(est => {
    const resExistente = resultados.find(r => 
      (r.estudiante_id && r.estudiante_id === est.id) ||
      normalizeText(r.estudiante_nombre) === normalizeText(est.nombre)
    );
    return {
      id: est.id,
      nombre: est.nombre,
      completado: !!resExistente,
      fecha_completado: resExistente ? resExistente.completado_at : null,
      duracion: resExistente ? resExistente.duracion_formato : null,
      puntos: resExistente ? resExistente.puntos_obtenidos : null,
      nota_meduca: resExistente ? resExistente.nota_meduca : null
    };
  });

  // Sort alphabetically
  lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  res.json(lista);
});

// 3. Verify specific student eligibility (One-time attempt check)
app.get('/api/estudiantes/verificar', (req, res) => {
  const nombre = req.query.nombre;
  if (!nombre) {
    return res.status(400).json({ error: 'Nombre es requerido' });
  }

  const resultados = readJSON(RESULTADOS_FILE, []);
  const previo = resultados.find(r => normalizeText(r.estudiante_nombre) === normalizeText(nombre));

  if (previo) {
    return res.json({
      permitido: false,
      mensaje: 'Ya realizaste esta prueba evaluativa.',
      resultado: {
        estudiante_nombre: previo.estudiante_nombre,
        completado_at: previo.completado_at,
        duracion_formato: previo.duracion_formato,
        puntos_obtenidos: previo.puntos_obtenidos,
        puntos_totales: previo.puntos_totales,
        nota_meduca: previo.nota_meduca,
        desempeno: previo.desempeno
      }
    });
  }

  res.json({ permitido: true });
});

// 4. Submit and Grade Test (Server-side validation & evaluation)
app.post('/api/evaluar', (req, res) => {
  const { estudiante_nombre, estudiante_id, respuestas, duracion_segundos, iniciado_at } = req.body;

  if (!estudiante_nombre || !respuestas) {
    return res.status(400).json({ error: 'Faltan datos requeridos (nombre o respuestas)' });
  }

  const resultados = readJSON(RESULTADOS_FILE, []);
  const config = readJSON(CONFIG_FILE, {});

  // STRICT SINGLE-ATTEMPT CHECK
  const previo = resultados.find(r => 
    normalizeText(r.estudiante_nombre) === normalizeText(estudiante_nombre) ||
    (estudiante_id && r.estudiante_id === estudiante_id)
  );

  if (previo) {
    return res.status(403).json({
      error: 'UNICO_INTENTO_PERMITIDO',
      mensaje: `El estudiante ${estudiante_nombre} ya envió esta prueba previamente. Solo se permite un intento.`,
      resultado_previo: previo
    });
  }

  // EVALUATION LOGIC
  let puntosObtenidos = 0;
  const evaluacionDetallada = {
    parte_a: { puntos: 0, items: [] },
    parte_b: { puntos: 0, items: [] },
    parte_c: { puntos: 0, items: [] },
    parte_d: { puntos: 0, items: [] }
  };

  // Parte A: Completa (5 pts)
  const parteAConfig = config.secciones?.parte_a?.preguntas || [];
  parteAConfig.forEach(pregunta => {
    const respuestaEstudiante = respuestas.parte_a ? respuestas.parte_a[pregunta.id] : '';
    const normEst = normalizeText(respuestaEstudiante);
    const validas = (pregunta.respuestas_validas || []).map(normalizeText);
    const esCorrecta = validas.includes(normEst);

    const pts = esCorrecta ? pregunta.puntos : 0;
    puntosObtenidos += pts;
    evaluacionDetallada.parte_a.puntos += pts;
    evaluacionDetallada.parte_a.items.push({
      id: pregunta.id,
      numero: pregunta.numero,
      respuesta_dada: respuestaEstudiante || '(En blanco)',
      es_correcta: esCorrecta,
      respuesta_esperada: pregunta.respuestas_validas[0],
      puntos: pts
    });
  });

  // Parte B: Selección Múltiple (4 pts)
  const parteBConfig = config.secciones?.parte_b?.preguntas || [];
  parteBConfig.forEach(pregunta => {
    const respuestaEstudiante = respuestas.parte_b ? respuestas.parte_b[pregunta.id] : '';
    const esCorrecta = (respuestaEstudiante || '').toLowerCase() === (pregunta.respuesta_correcta || '').toLowerCase();

    const pts = esCorrecta ? pregunta.puntos : 0;
    puntosObtenidos += pts;
    evaluacionDetallada.parte_b.puntos += pts;
    evaluacionDetallada.parte_b.items.push({
      id: pregunta.id,
      numero: pregunta.numero,
      respuesta_dada: respuestaEstudiante || '(Sin responder)',
      es_correcta: esCorrecta,
      respuesta_esperada: pregunta.respuesta_correcta,
      puntos: pts
    });
  });

  // Parte C: Verdadero o Falso (6 pts)
  const parteCConfig = config.secciones?.parte_c?.preguntas || [];
  parteCConfig.forEach(pregunta => {
    const respuestaEstudiante = respuestas.parte_c ? respuestas.parte_c[pregunta.id] : '';
    const esCorrecta = (respuestaEstudiante || '').toUpperCase() === (pregunta.respuesta_correcta || '').toUpperCase();

    const pts = esCorrecta ? pregunta.puntos : 0;
    puntosObtenidos += pts;
    evaluacionDetallada.parte_c.puntos += pts;
    evaluacionDetallada.parte_c.items.push({
      id: pregunta.id,
      numero: pregunta.numero,
      respuesta_dada: respuestaEstudiante || '(Sin responder)',
      es_correcta: esCorrecta,
      respuesta_esperada: pregunta.respuesta_correcta,
      puntos: pts
    });
  });

  // Parte D: Relaciona (4 pts)
  const parteDConceptos = config.secciones?.parte_d?.conceptos || [];
  parteDConceptos.forEach(item => {
    const respuestaEstudiante = respuestas.parte_d ? respuestas.parte_d[item.id] : '';
    const esCorrecta = (respuestaEstudiante || '').toUpperCase() === (item.respuesta_correcta || '').toUpperCase();

    const pts = esCorrecta ? 1 : 0;
    puntosObtenidos += pts;
    evaluacionDetallada.parte_d.puntos += pts;
    evaluacionDetallada.parte_d.items.push({
      id: item.id,
      numero: item.numero,
      termino: item.termino,
      respuesta_dada: respuestaEstudiante || '(Sin asignar)',
      es_correcta: esCorrecta,
      respuesta_esperada: item.respuesta_correcta,
      puntos: pts
    });
  });

  const puntosTotales = config.puntos_totales || 19;
  const notaMeduca = calculateMeducaGrade(puntosObtenidos, puntosTotales);
  const porcentaje = Math.round((puntosObtenidos / puntosTotales) * 100);
  const duracionSeg = parseInt(duracion_segundos, 10) || 0;
  const duracionTexto = formatDuration(duracionSeg);
  const perf = getPerformanceLevel(notaMeduca);

  const nuevoResultado = {
    id: 'res-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    estudiante_id: estudiante_id || null,
    estudiante_nombre: estudiante_nombre.trim(),
    iniciado_at: iniciado_at || new Date().toISOString(),
    completado_at: new Date().toLocaleString('es-PA', { timeZone: 'America/Panama' }),
    completado_timestamp: Date.now(),
    duracion_segundos: duracionSeg,
    duracion_formato: duracionTexto,
    puntos_obtenidos: puntosObtenidos,
    puntos_totales: puntosTotales,
    porcentaje: porcentaje,
    nota_meduca: notaMeduca,
    desempeno: perf.nivel,
    detalles: evaluacionDetallada
  };

  resultados.push(nuevoResultado);
  writeJSON(RESULTADOS_FILE, resultados);

  res.json({
    exito: true,
    mensaje: 'Prueba enviada y evaluada con éxito',
    resultado: nuevoResultado
  });
});

// 5. Teacher: Get all results with analytics
app.get('/api/resultados', (req, res) => {
  const resultados = readJSON(RESULTADOS_FILE, []);
  const estudiantes = readJSON(ESTUDIANTES_FILE, []);

  const totalEstudiantes = estudiantes.length;
  const totalCompletados = resultados.length;
  const tasaCompletado = totalEstudiantes > 0 ? Math.round((totalCompletados / totalEstudiantes) * 100) : 0;

  let sumaNotas = 0;
  let sumaTiempo = 0;
  let notaMaxima = 1.0;
  let notaMinima = 5.0;

  resultados.forEach(r => {
    sumaNotas += r.nota_meduca;
    sumaTiempo += r.duracion_segundos || 0;
    if (r.nota_meduca > notaMaxima) notaMaxima = r.nota_meduca;
    if (r.nota_meduca < notaMinima) notaMinima = r.nota_meduca;
  });

  const promedioNotas = totalCompletados > 0 ? Number((sumaNotas / totalCompletados).toFixed(2)) : 0;
  const promedioTiempoSegundos = totalCompletados > 0 ? Math.round(sumaTiempo / totalCompletados) : 0;
  const promedioTiempo = formatDuration(promedioTiempoSegundos);

  res.json({
    estadisticas: {
      totalEstudiantes,
      totalCompletados,
      tasaCompletado,
      promedioNotas,
      promedioTiempo,
      promedioTiempoSegundos,
      notaMaxima: totalCompletados > 0 ? notaMaxima : 0,
      notaMinima: totalCompletados > 0 ? notaMinima : 0
    },
    resultados: resultados.sort((a, b) => b.completado_timestamp - a.completado_timestamp)
  });
});

// 6. Teacher: Reset a student attempt (Allows retaking if needed)
app.post('/api/resultados/reiniciar', (req, res) => {
  const { id, estudiante_nombre } = req.body;
  let resultados = readJSON(RESULTADOS_FILE, []);

  const initialCount = resultados.length;
  if (id) {
    resultados = resultados.filter(r => r.id !== id);
  } else if (estudiante_nombre) {
    resultados = resultados.filter(r => normalizeText(r.estudiante_nombre) !== normalizeText(estudiante_nombre));
  }

  if (resultados.length === initialCount) {
    return res.status(404).json({ error: 'No se encontró el intento para reiniciar' });
  }

  writeJSON(RESULTADOS_FILE, resultados);
  res.json({ exito: true, mensaje: 'Intento reiniciado correctamente' });
});

// 7. Teacher: Update student roster
app.post('/api/estudiantes/actualizar', (req, res) => {
  const { lista_texto } = req.body;
  if (!lista_texto || typeof lista_texto !== 'string') {
    return res.status(400).json({ error: 'Se requiere una lista de nombres de texto' });
  }

  const lineas = lista_texto.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const nuevosEstudiantes = lineas.map((nombre, index) => {
    // Clean numbering if copied from a numbered list (e.g. "1. Juan Perez")
    const nombreLimpio = nombre.replace(/^(\d+[\.\-\)]\s*)/, '').trim();
    return {
      id: `est-${(index + 1).toString().padStart(2, '0')}`,
      nombre: nombreLimpio
    };
  });

  writeJSON(ESTUDIANTES_FILE, nuevosEstudiantes);
  res.json({
    exito: true,
    total: nuevosEstudiantes.length,
    estudiantes: nuevosEstudiantes
  });
});

// 8. Teacher: Export to CSV
app.get('/api/exportar/csv', (req, res) => {
  const resultados = readJSON(RESULTADOS_FILE, []);
  
  let csv = '\uFEFF'; // UTF-8 BOM for Excel in Spanish
  csv += 'N°,Estudiante,Fecha y Hora,Tiempo Empleado,Puntos (de 19),Nota MEDUCA,Nivel,Parte A (5 pts),Parte B (4 pts),Parte C (6 pts),Parte D (4 pts)\n';

  resultados.forEach((r, idx) => {
    const ptsA = r.detalles?.parte_a?.puntos ?? '-';
    const ptsB = r.detalles?.parte_b?.puntos ?? '-';
    const ptsC = r.detalles?.parte_c?.puntos ?? '-';
    const ptsD = r.detalles?.parte_d?.puntos ?? '-';
    
    csv += `"${idx + 1}","${r.estudiante_nombre}","${r.completado_at}","${r.duracion_formato}",${r.puntos_obtenidos},${r.nota_meduca},"${r.desempeno}",${ptsA},${ptsB},${ptsC},${ptsD}\n`;
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="Resultados_Prueba_Agricultura_3erGrado.csv"');
  res.send(csv);
});

// Helper to get local IP addresses for easy device connection
function getNetworkIps() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

// 9. Server info & local IPs
app.get('/api/servidor-info', (req, res) => {
  res.json({
    puerto: PORT,
    ips_locales: getNetworkIps(),
    urls: getNetworkIps().map(ip => `http://${ip}:${PORT}`)
  });
});

const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🌱 PRUEBA SUMATIVA DE AGRICULTURA - 3ER GRADO 🌱`);
  console.log(`====================================================`);
  console.log(`💻 Acceso Local: http://localhost:${PORT}`);
  const ips = getNetworkIps();
  if (ips.length > 0) {
    console.log(`📱 Acceso en Red Local (Tablets / Celulares):`);
    ips.forEach(ip => console.log(`   ➜ http://${ip}:${PORT}`));
  }
  console.log(`🧑‍🏫 Panel Docente: http://localhost:${PORT}/docente.html`);
  console.log(`====================================================`);
});
