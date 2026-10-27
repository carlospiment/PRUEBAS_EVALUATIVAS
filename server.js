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
const CONFIG_FILE_3 = path.join(DATA_DIR, 'prueba_3ro.json');
const CONFIG_FILE_4 = path.join(DATA_DIR, 'prueba_4to.json');
const CONFIG_FILE_5 = path.join(DATA_DIR, 'prueba_5to.json');
const ESTUDIANTES_FILE = path.join(DATA_DIR, 'estudiantes.json');
const RESULTADOS_FILE = path.join(DATA_DIR, 'resultados.json');

function getConfigFileForGrade(grado) {
  const g = parseInt(grado, 10);
  if (g === 5) return CONFIG_FILE_5;
  if (g === 4) return CONFIG_FILE_4;
  return CONFIG_FILE_3;
}

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

// Normalizer for text answers
function normalizeText(str) {
  if (!str) return '';
  let cleaned = str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,;:!?¿¡"']/g, '')
    .replace(/\s+/g, ' ');
  cleaned = cleaned.replace(/^(el|la|los|las|un|una|unos|unas)\s+/, '');
  return cleaned;
}

// Format seconds into MM:SS
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

// 1. Get test config by grade (Safe for student)
app.get('/api/prueba', (req, res) => {
  const grado = req.query.grado || '3';
  const file = getConfigFileForGrade(grado);
  const config = readJSON(file, {});

  // Safe clone
  const safeConfig = JSON.parse(JSON.stringify(config));
  if (safeConfig.secciones) {
    if (safeConfig.secciones.parte_a?.preguntas) {
      safeConfig.secciones.parte_a.preguntas.forEach(p => {
        delete p.respuestas_validas;
        delete p.respuestas_validas_conjunto;
      });
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
    if (safeConfig.secciones.parte_e?.preguntas) {
      safeConfig.secciones.parte_e.preguntas.forEach(e => delete e.palabras_clave);
    }
  }

  res.json(safeConfig);
});

// 2. Get students by grade
app.get('/api/estudiantes', (req, res) => {
  const grado = req.query.grado ? parseInt(req.query.grado, 10) : null;
  const estudiantes = readJSON(ESTUDIANTES_FILE, []);
  const resultados = readJSON(RESULTADOS_FILE, []);

  let listaFiltrada = estudiantes;
  if (grado) {
    listaFiltrada = estudiantes.filter(e => e.grado === grado);
  }

  const lista = listaFiltrada.map(est => {
    const resExistente = resultados.find(r => 
      (r.estudiante_id && r.estudiante_id === est.id) ||
      normalizeText(r.estudiante_nombre) === normalizeText(est.nombre)
    );
    return {
      id: est.id,
      num: est.num,
      grado: est.grado,
      grupo: est.grupo,
      grupo_label: est.grupo_label,
      nombre: est.nombre,
      nombre_simple: est.nombre_simple,
      completado: !!resExistente,
      fecha_completado: resExistente ? resExistente.completado_at : null,
      duracion: resExistente ? resExistente.duracion_formato : null,
      puntos: resExistente ? resExistente.puntos_obtenidos : null,
      nota_meduca: resExistente ? resExistente.nota_meduca : null
    };
  });

  lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  res.json(lista);
});

// 3. Submit and Grade Test (Supports 3rd, 4th and 5th grade)
app.post('/api/evaluar', (req, res) => {
  const { estudiante_nombre, estudiante_id, respuestas, duracion_segundos, iniciado_at, grado } = req.body;

  if (!estudiante_nombre || !respuestas) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  const gradoNum = parseInt(grado, 10) || 3;
  const configFile = getConfigFileForGrade(gradoNum);
  const config = readJSON(configFile, {});
  const resultados = readJSON(RESULTADOS_FILE, []);

  // Check single attempt
  const previo = resultados.find(r => 
    (r.grado === gradoNum || !r.grado) && (
      normalizeText(r.estudiante_nombre) === normalizeText(estudiante_nombre) ||
      (estudiante_id && r.estudiante_id === estudiante_id)
    )
  );

  if (previo) {
    return res.status(403).json({
      error: 'UNICO_INTENTO_PERMITIDO',
      mensaje: `El estudiante ${estudiante_nombre} ya envió esta prueba de ${gradoNum}to grado. Solo se permite un intento.`,
      resultado_previo: previo
    });
  }

  let puntosObtenidos = 0;
  const evaluacionDetallada = {
    parte_a: { puntos: 0, items: [] },
    parte_b: { puntos: 0, items: [] },
    parte_c: { puntos: 0, items: [] },
    parte_d: { puntos: 0, items: [] },
    parte_e: { puntos: 0, items: [] }
  };

  // Parte A: Completa
  const pAConfig = config.secciones?.parte_a?.preguntas || [];
  pAConfig.forEach(pregunta => {
    if (pregunta.tipo === 'triple') {
      // 3 blanks for classification (economicos, nutritivos, comunitarios)
      const r1 = normalizeText(respuestas.parte_a ? respuestas.parte_a['a2_1'] : '');
      const r2 = normalizeText(respuestas.parte_a ? respuestas.parte_a['a2_2'] : '');
      const r3 = normalizeText(respuestas.parte_a ? respuestas.parte_a['a2_3'] : '');
      const dadas = [r1, r2, r3].filter(r => r.length > 0);

      const targets = [
        ['economicos', 'economico'],
        ['nutritivos', 'nutritivo'],
        ['comunitarios', 'comunitario']
      ];

      let matchCount = 0;
      targets.forEach(targetGroup => {
        const foundIndex = dadas.findIndex(d => targetGroup.includes(d));
        if (foundIndex !== -1) {
          matchCount++;
          dadas.splice(foundIndex, 1);
        }
      });

      puntosObtenidos += matchCount;
      evaluacionDetallada.parte_a.puntos += matchCount;
      evaluacionDetallada.parte_a.items.push({
        id: pregunta.id,
        numero: pregunta.numero,
        respuesta_dada: `${r1 || '_'}, ${r2 || '_'}, ${r3 || '_'}`,
        es_correcta: matchCount === 3,
        respuesta_esperada: 'económicos, nutritivos, comunitarios',
        puntos: matchCount
      });
    } else {
      const respEst = respuestas.parte_a ? respuestas.parte_a[pregunta.id] : '';
      const norm = normalizeText(respEst);
      const validas = (pregunta.respuestas_validas || []).map(normalizeText);
      const esCorrecta = validas.includes(norm);
      const pts = esCorrecta ? pregunta.puntos : 0;

      puntosObtenidos += pts;
      evaluacionDetallada.parte_a.puntos += pts;
      evaluacionDetallada.parte_a.items.push({
        id: pregunta.id,
        numero: pregunta.numero,
        respuesta_dada: respEst || '(En blanco)',
        es_correcta: esCorrecta,
        respuesta_esperada: pregunta.respuestas_validas ? pregunta.respuestas_validas[0] : '',
        puntos: pts
      });
    }
  });

  // Parte B: Selección Múltiple
  const pBConfig = config.secciones?.parte_b?.preguntas || [];
  pBConfig.forEach(pregunta => {
    const respEst = respuestas.parte_b ? respuestas.parte_b[pregunta.id] : '';
    const esCorrecta = (respEst || '').toLowerCase() === (pregunta.respuesta_correcta || '').toLowerCase();
    const pts = esCorrecta ? pregunta.puntos : 0;

    puntosObtenidos += pts;
    evaluacionDetallada.parte_b.puntos += pts;
    evaluacionDetallada.parte_b.items.push({
      id: pregunta.id,
      numero: pregunta.numero,
      respuesta_dada: respEst || '(Sin responder)',
      es_correcta: esCorrecta,
      respuesta_esperada: pregunta.respuesta_correcta,
      puntos: pts
    });
  });

  // Parte C: Verdadero o Falso
  const pCConfig = config.secciones?.parte_c?.preguntas || [];
  pCConfig.forEach(pregunta => {
    const respEst = respuestas.parte_c ? respuestas.parte_c[pregunta.id] : '';
    const esCorrecta = (respEst || '').toUpperCase() === (pregunta.respuesta_correcta || '').toUpperCase();
    const pts = esCorrecta ? pregunta.puntos : 0;

    puntosObtenidos += pts;
    evaluacionDetallada.parte_c.puntos += pts;
    evaluacionDetallada.parte_c.items.push({
      id: pregunta.id,
      numero: pregunta.numero,
      respuesta_dada: respEst || '(Sin responder)',
      es_correcta: esCorrecta,
      respuesta_esperada: pregunta.respuesta_correcta,
      puntos: pts
    });
  });

  // Parte D: Relaciona
  const pDConceptos = config.secciones?.parte_d?.conceptos || [];
  pDConceptos.forEach(item => {
    const respEst = respuestas.parte_d ? respuestas.parte_d[item.id] : '';
    const esCorrecta = (respEst || '').toUpperCase() === (item.respuesta_correcta || '').toUpperCase();
    const pts = esCorrecta ? 1 : 0;

    puntosObtenidos += pts;
    evaluacionDetallada.parte_d.puntos += pts;
    evaluacionDetallada.parte_d.items.push({
      id: item.id,
      numero: item.numero,
      termino: item.termino,
      respuesta_dada: respEst || '(Sin asignar)',
      es_correcta: esCorrecta,
      respuesta_esperada: item.respuesta_correcta,
      puntos: pts
    });
  });

  // Parte E: Respuesta Corta (solo para 4to grado)
  if (config.secciones?.parte_e?.preguntas) {
    config.secciones.parte_e.preguntas.forEach(pregunta => {
      const respEst = respuestas.parte_e ? respuestas.parte_e[pregunta.id] : '';
      const textNorm = normalizeText(respEst);
      const keywords = pregunta.palabras_clave || [];
      const hasKeyword = keywords.some(kw => textNorm.includes(normalizeText(kw)));
      const hasLength = textNorm.length >= 4;
      const esCorrecta = hasLength && (hasKeyword || textNorm.length >= 8);
      const pts = esCorrecta ? 1 : 0;

      puntosObtenidos += pts;
      evaluacionDetallada.parte_e.puntos += pts;
      evaluacionDetallada.parte_e.items.push({
        id: pregunta.id,
        numero: pregunta.numero,
        enunciado: pregunta.enunciado,
        respuesta_dada: respEst || '(En blanco)',
        es_correcta: esCorrecta,
        puntos: pts
      });
    });
  }

  const puntosTotales = config.puntos_totales || (gradoNum === 4 ? 24 : 19);
  const notaMeduca = calculateMeducaGrade(puntosObtenidos, puntosTotales);
  const porcentaje = Math.round((puntosObtenidos / puntosTotales) * 100);
  const duracionSeg = parseInt(duracion_segundos, 10) || 0;
  const perf = getPerformanceLevel(notaMeduca);

  const nuevoResultado = {
    id: 'res-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    grado: gradoNum,
    estudiante_id: estudiante_id || null,
    estudiante_nombre: estudiante_nombre.trim(),
    iniciado_at: iniciado_at || new Date().toISOString(),
    completado_at: new Date().toLocaleString('es-PA', { timeZone: 'America/Panama' }),
    completado_timestamp: Date.now(),
    duracion_segundos: duracionSeg,
    duracion_formato: formatDuration(duracionSeg),
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
    mensaje: `Prueba de ${gradoNum}to grado enviada y evaluada con éxito`,
    resultado: nuevoResultado
  });
});

// 4. Get all results with analytics
app.get('/api/resultados', (req, res) => {
  const gradoFilter = req.query.grado ? parseInt(req.query.grado, 10) : null;
  const resultados = readJSON(RESULTADOS_FILE, []);
  const estudiantes = readJSON(ESTUDIANTES_FILE, []);

  let filteredResultados = resultados;
  let filteredEstudiantes = estudiantes;

  if (gradoFilter) {
    filteredResultados = resultados.filter(r => r.grado === gradoFilter);
    filteredEstudiantes = estudiantes.filter(e => e.grado === gradoFilter);
  }

  const totalEstudiantes = filteredEstudiantes.length;
  const totalCompletados = filteredResultados.length;
  const tasaCompletado = totalEstudiantes > 0 ? Math.round((totalCompletados / totalEstudiantes) * 100) : 0;

  let sumaNotas = 0;
  let sumaTiempo = 0;
  filteredResultados.forEach(r => {
    sumaNotas += Number(r.nota_meduca) || 1.0;
    sumaTiempo += r.duracion_segundos || 0;
  });

  const promedioNotas = totalCompletados > 0 ? Number((sumaNotas / totalCompletados).toFixed(2)) : 0;
  const promedioTiempoSegundos = totalCompletados > 0 ? Math.round(sumaTiempo / totalCompletados) : 0;

  res.json({
    estadisticas: {
      totalEstudiantes,
      totalCompletados,
      tasaCompletado,
      promedioNotas,
      promedioTiempo: formatDuration(promedioTiempoSegundos)
    },
    resultados: filteredResultados.sort((a, b) => b.completado_timestamp - a.completado_timestamp)
  });
});

// 5. Reset attempt
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
    return res.status(404).json({ error: 'No se encontró el intento' });
  }

  writeJSON(RESULTADOS_FILE, resultados);
  res.json({ exito: true, mensaje: 'Intento reiniciado correctamente' });
});

// Helper to get local IP addresses
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

app.get('/api/servidor-info', (req, res) => {
  res.json({
    puerto: PORT,
    ips_locales: getNetworkIps(),
    urls: getNetworkIps().map(ip => `http://${ip}:${PORT}`)
  });
});

const server = app.listen(PORT, () => {
  console.log(`🌱 SERVIDOR DE EVALUACIONES MEDUCA ACTIVO (PUERTO ${PORT}) 🌱`);
});
