/* ===================================================
   LÓGICA DEL ESTUDIANTE - PRUEBA SUMATIVA MEDUCA
   Soporte Multi-Grado: 3er y 4to Grado de Primaria
   PWA 100% Offline, GitHub Pages y Aleatorización
   =================================================== */

// Global state
let currentGrade = 4; // Default to 4th grade if not specified, or reads URL ?grado=
let rawTestConfig = null;
let randomizedConfig = null;
let allStudents = [];
let currentStudent = null;
let testStartTime = null;
let timerInterval = null;
let elapsedSeconds = 0;
let soundEnabled = true;
let selectedGroupFilter = 'TODOS';

// Register Service Worker for Offline PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('Service Worker activo:', reg.scope))
      .catch((err) => console.warn('SW error:', err));
  });
}

// Sound Synthesizer
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
  if (!soundEnabled) return;
  try {
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'chip') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'success') {
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.connect(g);
        g.connect(audioCtx.destination);
        o.type = 'triangle';
        o.frequency.setValueAtTime(freq, now + idx * 0.09);
        g.gain.setValueAtTime(0.15, now + idx * 0.09);
        g.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.09 + 0.4);
        o.start(now + idx * 0.09);
        o.stop(now + idx * 0.09 + 0.4);
      });
    }
  } catch (e) {
    console.warn('Audio no disponible:', e);
  }
}

// Fisher-Yates Shuffle
function shuffleArray(array) {
  if (!array || !Array.isArray(array)) return [];
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function cleanText(str) {
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

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  setupOnlineStatus();
  detectGrade();
  await initGrade(currentGrade);
  setupAutocomplete();
  setupEventListeners();
  setupTeacherAuthModal();
});

const TEACHER_PIN = '0476';

// Intercept clicks to docente.html and require PIN 0476
function setupTeacherAuthModal() {
  const pinModal = document.getElementById('teacherPinModal');
  const pinInput = document.getElementById('modalPinInput');
  const pinError = document.getElementById('modalPinError');
  const confirmBtn = document.getElementById('confirmPinModalBtn');
  const cancelBtn = document.getElementById('cancelPinModalBtn');

  document.querySelectorAll('a[href*="docente.html"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      // If already authenticated during current session, go directly
      if (sessionStorage.getItem('meduca_docente_auth') === TEACHER_PIN) {
        window.location.href = './docente.html';
        return;
      }
      if (pinModal) {
        pinInput.value = '';
        pinError.style.display = 'none';
        pinModal.classList.add('active');
        setTimeout(() => pinInput.focus(), 150);
      } else {
        const entered = prompt('🔐 Ingrese la clave de acceso docente:');
        if (entered === TEACHER_PIN) {
          sessionStorage.setItem('meduca_docente_auth', TEACHER_PIN);
          window.location.href = './docente.html';
        } else if (entered !== null) {
          alert('❌ Clave incorrecta. Acceso denegado.');
        }
      }
    });
  });

  const checkPin = () => {
    if (!pinInput) return;
    if (pinInput.value.trim() === TEACHER_PIN) {
      sessionStorage.setItem('meduca_docente_auth', TEACHER_PIN);
      pinModal.classList.remove('active');
      window.location.href = './docente.html';
    } else {
      playSound('click');
      pinError.style.display = 'block';
      pinInput.value = '';
      pinInput.focus();
    }
  };

  if (confirmBtn) confirmBtn.addEventListener('click', checkPin);
  if (pinInput) {
    pinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        checkPin();
      }
    });
  }
  if (cancelBtn && pinModal) {
    cancelBtn.addEventListener('click', () => {
      pinModal.classList.remove('active');
    });
  }
}

// Detect Grade strictly from body dataset, pathname, or URL
function detectGrade() {
  // 1. Explicit body attribute (e.g. <body data-grade="5"> or <body data-grade="4"> or <body data-grade="3">)
  if (document.body && document.body.dataset && document.body.dataset.grade) {
    currentGrade = parseInt(document.body.dataset.grade, 10);
    return;
  }
  // 2. Pathname check
  const path = window.location.pathname.toLowerCase();
  if (path.includes('quinto')) {
    currentGrade = 5;
    return;
  }
  if (path.includes('cuarto')) {
    currentGrade = 4;
    return;
  }
  if (path.includes('tercer')) {
    currentGrade = 3;
    return;
  }
  // 3. Query string ?grado=
  const params = new URLSearchParams(window.location.search);
  const g = params.get('grado');
  if (g === '3' || g === '4' || g === '5') {
    currentGrade = parseInt(g, 10);
    return;
  }
  // Default
  currentGrade = 5;
}

function setupOnlineStatus() {
  const updateStatus = () => {
    const badge = document.getElementById('offlineBadge');
    if (!badge) return;
    if (navigator.onLine) {
      badge.innerHTML = '🟢 En línea';
      badge.className = 'status-pill online';
    } else {
      badge.innerHTML = '⚡ Modo Offline (Sin Internet)';
      badge.className = 'status-pill offline';
    }
  };
  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  updateStatus();
}

async function initGrade(gradeNum) {
  currentGrade = gradeNum;

  // Clear inputs if present
  const nameInput = document.getElementById('studentNameInput');
  if (nameInput) nameInput.value = '';
  const startBtn = document.getElementById('startTestBtn');
  if (startBtn) startBtn.disabled = true;
  const alreadyCard = document.getElementById('alreadyDoneCard');
  if (alreadyCard) alreadyCard.style.display = 'none';

  await loadConfig();
  await loadStudents();
}

// Load Config for current grade
async function loadConfig() {
  try {
    let res = null;
    let staticFile = './data/prueba_3ro.json';
    if (currentGrade === 5) staticFile = './data/prueba_5to.json';
    else if (currentGrade === 4) staticFile = './data/prueba_4to.json';

    try {
      res = await fetch(`/api/prueba?grado=${currentGrade}`);
      if (!res.ok) throw new Error('API no disponible');
    } catch {
      res = await fetch(staticFile);
    }
    rawTestConfig = await res.json();
    updateHeaderLabels();
  } catch (err) {
    console.error('Error cargando configuración:', err);
  }
}

function updateHeaderLabels() {
  if (!rawTestConfig) return;
  document.getElementById('testTitle').textContent = rawTestConfig.titulo;
  document.getElementById('testTopic').textContent = `${rawTestConfig.tema} (${rawTestConfig.leccion})`;
  document.getElementById('testGrade').textContent = rawTestConfig.grado;
}

// Load Students for current grade
async function loadStudents() {
  try {
    let list = [];
    try {
      const res = await fetch(`/api/estudiantes?grado=${currentGrade}`);
      if (res.ok) {
        list = await res.json();
      } else {
        throw new Error('API no responde');
      }
    } catch {
      const resStatic = await fetch('./data/estudiantes.json');
      const all = await resStatic.json();
      list = all.filter(s => s.grado === currentGrade);
    }

    const localResults = getLocalResults();
    allStudents = list.map(student => {
      const offlineRes = localResults.find(r => 
        (r.estudiante_id && r.estudiante_id === student.id) ||
        cleanText(r.estudiante_nombre) === cleanText(student.nombre)
      );

      if (offlineRes) {
        return {
          ...student,
          completado: true,
          fecha_completado: offlineRes.completado_at,
          duracion: offlineRes.duracion_formato,
          puntos: offlineRes.puntos_obtenidos,
          nota_meduca: offlineRes.nota_meduca
        };
      }
      return student;
    });

  } catch (err) {
    console.error('Error cargando estudiantes:', err);
  }
}

// LocalStorage Helper
function getLocalResults() {
  try {
    const key = `meduca_agri_eval_${currentGrade}to_grado`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalResult(nuevoResultado) {
  try {
    const key = `meduca_agri_eval_${currentGrade}to_grado`;
    const list = getLocalResults();
    list.push(nuevoResultado);
    localStorage.setItem(key, JSON.stringify(list));
  } catch (e) {
    console.warn(e);
  }
}

// Autocomplete
function setupAutocomplete() {
  const input = document.getElementById('studentNameInput');
  const dropdown = document.getElementById('autocompleteDropdown');
  const startBtn = document.getElementById('startTestBtn');
  const alreadyDoneCard = document.getElementById('alreadyDoneCard');

  input.addEventListener('input', () => {
    const query = cleanText(input.value);
    dropdown.innerHTML = '';
    currentStudent = null;
    startBtn.disabled = true;
    alreadyDoneCard.style.display = 'none';

    if (!query) {
      dropdown.style.display = 'none';
      return;
    }

    let matches = allStudents.filter(s => {
      const matchName = cleanText(s.nombre).includes(query);
      const matchSimple = s.nombre_simple ? cleanText(s.nombre_simple).includes(query) : false;
      const matchApellido = s.apellidos ? cleanText(s.apellidos).includes(query) : false;
      return matchName || matchSimple || matchApellido;
    });

    if (matches.length === 0) {
      dropdown.innerHTML = `<div class="autocomplete-item" style="color: #6b7280; font-style: italic;">No se encontró ningún estudiante de ${currentGrade}° grado con ese nombre</div>`;
      dropdown.style.display = 'block';
      return;
    }

    matches.forEach(student => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      const grupoBadge = student.grupo_label ? `<span class="group-pill">${student.grupo_label}</span>` : '';
      const statusBadge = student.completado 
        ? `<span class="status-tag completado">⚠️ Ya realizada (${student.nota_meduca ? 'Nota: ' + student.nota_meduca : 'Enviada'})</span>` 
        : `<span class="status-tag pendiente">✅ Disponible</span>`;

      item.innerHTML = `
        <span style="font-size: 1.2rem;">👤</span>
        <div style="flex: 1;">
          <strong>${student.nombre_simple || student.nombre}</strong>
          ${grupoBadge}
        </div>
        ${statusBadge}
      `;

      item.addEventListener('click', () => {
        selectStudent(student);
      });

      dropdown.appendChild(item);
    });

    dropdown.style.display = 'block';
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });

  startBtn.addEventListener('click', () => {
    if (currentStudent && !currentStudent.completado) {
      startTest();
    }
  });
}

function selectStudent(student) {
  const input = document.getElementById('studentNameInput');
  const dropdown = document.getElementById('autocompleteDropdown');
  const startBtn = document.getElementById('startTestBtn');
  const alreadyDoneCard = document.getElementById('alreadyDoneCard');

  input.value = student.nombre;
  dropdown.style.display = 'none';
  currentStudent = student;
  playSound('click');

  if (student.completado) {
    startBtn.disabled = true;
    alreadyDoneCard.innerHTML = `
      <h3>⚠️ Examen Ya Realizado</h3>
      <p>Hola <strong>${student.nombre}</strong>, el sistema registra que ya entregaste esta evaluación de ${currentGrade}° grado.</p>
      <div style="margin-top: 10px; font-weight: 600; color: #7f1d1d; background: #fee2e2; padding: 12px; border-radius: 8px;">
        📅 Fecha: ${student.fecha_completado || 'Recientemente'}<br>
        ⏱️ Tiempo empleado: ${student.duracion || 'Registrado'}<br>
        📊 Calificación: ${student.nota_meduca ? student.nota_meduca + ' / 5.0' : 'Calificada'}
      </div>
      <p style="margin-top: 8px; font-size: 0.95rem; color: #991b1b;">
        * Solo se permite un intento por estudiante. Si requieres asistencia técnica, consulta con tu maestro.
      </p>
    `;
    alreadyDoneCard.style.display = 'block';
  } else {
    alreadyDoneCard.style.display = 'none';
    startBtn.disabled = false;
  }
}

// Randomize Test Sections
function randomizeTest(config) {
  if (!config || !config.secciones) return null;
  const clone = JSON.parse(JSON.stringify(config));

  // Parte A
  if (clone.secciones.parte_a) {
    clone.secciones.parte_a.preguntas = shuffleArray(clone.secciones.parte_a.preguntas);
    clone.secciones.parte_a.banco_palabras = shuffleArray(clone.secciones.parte_a.banco_palabras);
  }

  // Parte B
  if (clone.secciones.parte_b) {
    const shuffledQuestions = shuffleArray(clone.secciones.parte_b.preguntas);
    shuffledQuestions.forEach(q => {
      q.opciones = shuffleArray(q.opciones);
    });
    clone.secciones.parte_b.preguntas = shuffledQuestions;
  }

  // Parte C
  if (clone.secciones.parte_c) {
    clone.secciones.parte_c.preguntas = shuffleArray(clone.secciones.parte_c.preguntas);
  }

  // Parte D
  if (clone.secciones.parte_d) {
    clone.secciones.parte_d.conceptos = shuffleArray(clone.secciones.parte_d.conceptos);
    clone.secciones.parte_d.significados = shuffleArray(clone.secciones.parte_d.significados);
  }

  // Parte E (si existe)
  if (clone.secciones.parte_e) {
    clone.secciones.parte_e.preguntas = shuffleArray(clone.secciones.parte_e.preguntas);
  }

  return clone;
}

// Render Test Sections
function renderTestSections() {
  if (!randomizedConfig) return;
  updateHeaderLabels();

  renderParteA(randomizedConfig.secciones.parte_a);
  renderParteB(randomizedConfig.secciones.parte_b);
  renderParteC(randomizedConfig.secciones.parte_c);
  renderParteD(randomizedConfig.secciones.parte_d);

  const secE = document.getElementById('parteESection');
  if (randomizedConfig.secciones.parte_e) {
    if (secE) secE.style.display = 'block';
    renderParteE(randomizedConfig.secciones.parte_e);
  } else {
    if (secE) secE.style.display = 'none';
  }
}

// RENDER PARTE A (COMPLETA)
function renderParteA(data) {
  const container = document.getElementById('parteAQuestions');
  const chipsContainer = document.getElementById('wordChipsContainer');
  if (!data || !container) return;

  chipsContainer.innerHTML = '';
  (data.banco_palabras || []).forEach(word => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'word-chip';
    chip.textContent = word;
    chip.addEventListener('click', () => {
      playSound('chip');
      insertWordIntoActiveBlank(word);
    });
    chipsContainer.appendChild(chip);
  });

  container.innerHTML = '';
  data.preguntas.forEach((q, idx) => {
    const div = document.createElement('div');
    div.className = 'fill-blank-item';

    if (q.tipo === 'triple') {
      // 3 blanks for item 2
      div.innerHTML = `
        <span class="q-num">${idx + 1}.</span>
        <span>${q.texto_antes}</span>
        <input type="text" class="blank-input" id="input_a2_1" data-qid="a2_1" placeholder="beneficio 1" autocomplete="off">
        <span>${q.texto_medio1 || ','}</span>
        <input type="text" class="blank-input" id="input_a2_2" data-qid="a2_2" placeholder="beneficio 2" autocomplete="off">
        <span>${q.texto_medio2 || 'y'}</span>
        <input type="text" class="blank-input" id="input_a2_3" data-qid="a2_3" placeholder="beneficio 3" autocomplete="off">
        <span>${q.texto_despues || '.'}</span>
      `;
    } else {
      div.innerHTML = `
        <span class="q-num">${idx + 1}.</span>
        <span>${q.texto_antes}</span>
        <input type="text" class="blank-input" id="input_${q.id}" data-qid="${q.id}" placeholder="Escribe aquí" autocomplete="off">
        <span>${q.texto_despues}</span>
      `;
    }

    div.querySelectorAll('input').forEach(input => {
      input.addEventListener('focus', () => { window.lastActiveInput = input; });
      input.addEventListener('input', () => { updateProgress(); });
    });

    container.appendChild(div);
  });
}

function insertWordIntoActiveBlank(word) {
  const active = window.lastActiveInput;
  if (active && document.body.contains(active)) {
    active.value = word;
    active.dispatchEvent(new Event('input'));
    active.focus();
  } else {
    const inputs = document.querySelectorAll('.blank-input');
    for (let input of inputs) {
      if (!input.value.trim()) {
        input.value = word;
        input.dispatchEvent(new Event('input'));
        input.focus();
        window.lastActiveInput = input;
        break;
      }
    }
  }
}

// RENDER PARTE B (SELECCIÓN MÚLTIPLE)
function renderParteB(data) {
  const container = document.getElementById('parteBQuestions');
  if (!data || !container) return;

  container.innerHTML = '';
  data.preguntas.forEach((q, qIdx) => {
    const block = document.createElement('div');
    block.className = 'mcq-question-block';
    block.id = `mcq_block_${q.id}`;
    block.dataset.qid = q.id;

    const letters = ['a', 'b', 'c'];
    let optionsHtml = '';

    q.opciones.forEach((opt, optIdx) => {
      const displayLetter = letters[optIdx].toUpperCase();
      optionsHtml += `
        <div class="mcq-option-card" data-qid="${q.id}" data-optid="${opt.id}">
          <div class="opt-letter">${displayLetter}</div>
          <div style="flex: 1;">${opt.texto}</div>
          <div style="font-size: 1.3rem;">${opt.icono || ''}</div>
        </div>
      `;
    });

    block.innerHTML = `
      <div class="mcq-prompt">
        <span style="color: var(--primary);">${qIdx + 1}.</span>
        <span>${q.enunciado}</span>
      </div>
      <div class="mcq-options-grid">
        ${optionsHtml}
      </div>
    `;

    block.querySelectorAll('.mcq-option-card').forEach(card => {
      card.addEventListener('click', () => {
        playSound('click');
        block.querySelectorAll('.mcq-option-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        block.classList.add('answered');
        block.dataset.selected = card.dataset.optid;
        updateProgress();
      });
    });

    container.appendChild(block);
  });
}

// RENDER PARTE C (VERDADERO O FALSO)
function renderParteC(data) {
  const container = document.getElementById('parteCQuestions');
  if (!data || !container) return;

  container.innerHTML = '';
  data.preguntas.forEach((q, idx) => {
    const item = document.createElement('div');
    item.className = 'tf-item';
    item.id = `tf_item_${q.id}`;
    item.dataset.qid = q.id;

    item.innerHTML = `
      <div class="tf-text">
        <span style="color: var(--primary); font-weight: 800; margin-right: 6px;">${idx + 1}.</span>
        <span>${q.enunciado}</span>
      </div>
      <div class="tf-buttons">
        <button type="button" class="tf-btn v-btn" data-qid="${q.id}" data-val="V">
          <span>✅</span> Verdadero (V)
        </button>
        <button type="button" class="tf-btn f-btn" data-qid="${q.id}" data-val="F">
          <span>❌</span> Falso (F)
        </button>
      </div>
    `;

    const vBtn = item.querySelector('.v-btn');
    const fBtn = item.querySelector('.f-btn');

    vBtn.addEventListener('click', () => {
      playSound('click');
      vBtn.classList.add('selected');
      fBtn.classList.remove('selected');
      item.classList.add('answered');
      item.dataset.selected = 'V';
      updateProgress();
    });

    fBtn.addEventListener('click', () => {
      playSound('click');
      fBtn.classList.add('selected');
      vBtn.classList.remove('selected');
      item.classList.add('answered');
      item.dataset.selected = 'F';
      updateProgress();
    });

    container.appendChild(item);
  });
}

// RENDER PARTE D (RELACIONA)
function renderParteD(data) {
  const container = document.getElementById('parteDQuestions');
  if (!data || !container) return;

  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'matching-container';

  const leftCol = document.createElement('div');
  leftCol.className = 'matching-card';
  leftCol.innerHTML = `<h4><span>📌</span> Beneficios</h4>`;

  data.conceptos.forEach((c, idx) => {
    const matchRow = document.createElement('div');
    matchRow.className = 'match-item';
    matchRow.id = `match_row_${c.id}`;

    let selectOptions = `<option value="">Selecciona...</option>`;
    (data.significados || []).forEach(s => {
      selectOptions += `<option value="${s.letra}">${s.letra}. ${s.definicion.substring(0, 26)}...</option>`;
    });

    matchRow.innerHTML = `
      <div class="match-item-left">
        <span style="color: var(--primary); font-weight: 800;">${idx + 1}.</span>
        <span>${c.termino}</span>
      </div>
      <select class="match-select" id="select_${c.id}" data-qid="${c.id}">
        ${selectOptions}
      </select>
    `;

    const sel = matchRow.querySelector('select');
    sel.addEventListener('change', () => {
      playSound('click');
      updateProgress();
    });

    leftCol.appendChild(matchRow);
  });

  const rightCol = document.createElement('div');
  rightCol.className = 'matching-card';
  rightCol.innerHTML = `<h4><span>📖</span> Ejemplos</h4>`;

  (data.significados || []).forEach(s => {
    const defRow = document.createElement('div');
    defRow.className = 'significado-item';
    defRow.innerHTML = `
      <div class="significado-letter">${s.letra}</div>
      <div style="font-weight: 600;">${s.definicion}</div>
    `;
    rightCol.appendChild(defRow);
  });

  grid.appendChild(leftCol);
  grid.appendChild(rightCol);
  container.appendChild(grid);
}

// RENDER PARTE E (RESPUESTA CORTA - 4TO GRADO)
function renderParteE(data) {
  const container = document.getElementById('parteEQuestions');
  if (!data || !container) return;

  container.innerHTML = '';
  data.preguntas.forEach((q, idx) => {
    const block = document.createElement('div');
    block.className = 'short-answer-block';
    block.id = `short_block_${q.id}`;
    block.dataset.qid = q.id;

    block.innerHTML = `
      <div class="short-answer-prompt">
        <span style="color: var(--primary);">${idx + 1}.</span>
        <span>${q.enunciado}</span>
      </div>
      <textarea class="short-answer-textarea" id="textarea_${q.id}" data-qid="${q.id}" placeholder="Escribe aquí tu respuesta con tus propias palabras..."></textarea>
    `;

    const ta = block.querySelector('textarea');
    ta.addEventListener('input', () => {
      if (ta.value.trim().length > 0) {
        block.classList.add('answered');
      } else {
        block.classList.remove('answered');
      }
      updateProgress();
    });

    container.appendChild(block);
  });
}

// Update Progress Bar
function updateProgress() {
  let answered = 0;
  const total = rawTestConfig?.puntos_totales || (currentGrade === 4 ? 24 : 19);

  // Parte A
  document.querySelectorAll('.blank-input').forEach(input => {
    if (input.value.trim().length > 0) answered++;
  });

  // Parte B
  document.querySelectorAll('.mcq-question-block').forEach(block => {
    if (block.dataset.selected) answered++;
  });

  // Parte C
  document.querySelectorAll('.tf-item').forEach(item => {
    if (item.dataset.selected) answered++;
  });

  // Parte D
  document.querySelectorAll('.match-select').forEach(sel => {
    if (sel.value) answered++;
  });

  // Parte E
  document.querySelectorAll('.short-answer-textarea').forEach(ta => {
    if (ta.value.trim().length > 0) answered++;
  });

  const pct = Math.min(100, Math.round((answered / total) * 100));
  document.getElementById('progressFill').style.width = `${pct}%`;
  document.getElementById('progressLabel').textContent = `${answered} de ${total} reactivos respondidos`;
}

// Start Test
function startTest() {
  playSound('chip');

  randomizedConfig = randomizeTest(rawTestConfig);
  renderTestSections();

  document.getElementById('loginSection').style.display = 'none';
  document.getElementById('testContentSection').style.display = 'block';
  document.getElementById('stickyHeader').style.display = 'flex';

  document.getElementById('activeStudentName').textContent = currentStudent.nombre_simple || currentStudent.nombre;

  testStartTime = new Date();
  elapsedSeconds = 0;
  timerInterval = setInterval(() => {
    elapsedSeconds++;
    document.getElementById('liveTimer').textContent = formatTime(elapsedSeconds);
  }, 1000);

  window.onbeforeunload = () => "Tienes una prueba evaluativa en curso. Si sales ahora, podrías perder tus respuestas.";
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Event Listeners
function setupEventListeners() {
  const soundBtn = document.getElementById('soundToggleBtn');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      soundBtn.innerHTML = soundEnabled ? '<span>🔊</span> Sonido: ON' : '<span>🔇</span> Sonido: OFF';
    });
  }

  const submitBtn = document.getElementById('submitTestBtn');
  if (submitBtn) {
    submitBtn.addEventListener('click', confirmAndSubmitTest);
  }

  const closeModalBtn = document.getElementById('closeModalBtn');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      window.location.reload();
    });
  }
}

// Evaluate Offline (Client-Side)
function evaluateTestOffline(responses, durationSec) {
  const cfg = rawTestConfig;
  let puntosObtenidos = 0;
  const evaluacionDetallada = {
    parte_a: { puntos: 0, items: [] },
    parte_b: { puntos: 0, items: [] },
    parte_c: { puntos: 0, items: [] },
    parte_d: { puntos: 0, items: [] },
    parte_e: { puntos: 0, items: [] }
  };

  // Parte A
  const pA = cfg.secciones.parte_a.preguntas;
  pA.forEach(q => {
    if (q.tipo === 'triple') {
      const r1 = cleanText(responses.parte_a['a2_1']);
      const r2 = cleanText(responses.parte_a['a2_2']);
      const r3 = cleanText(responses.parte_a['a2_3']);
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
        id: q.id,
        numero: q.numero,
        respuesta_dada: `${r1 || '_'}, ${r2 || '_'}, ${r3 || '_'}`,
        es_correcta: matchCount === 3,
        respuesta_esperada: 'económicos, nutritivos, comunitarios',
        puntos: matchCount
      });
    } else {
      const answer = cleanText(responses.parte_a[q.id]);
      const validas = (q.respuestas_validas || []).map(cleanText);
      const esCorrecta = validas.includes(answer);
      const pts = esCorrecta ? q.puntos : 0;
      puntosObtenidos += pts;
      evaluacionDetallada.parte_a.puntos += pts;
      evaluacionDetallada.parte_a.items.push({
        id: q.id,
        numero: q.numero,
        respuesta_dada: responses.parte_a[q.id] || '(En blanco)',
        es_correcta: esCorrecta,
        respuesta_esperada: q.respuestas_validas ? q.respuestas_validas[0] : '',
        puntos: pts
      });
    }
  });

  // Parte B
  cfg.secciones.parte_b.preguntas.forEach(q => {
    const answer = (responses.parte_b[q.id] || '').toLowerCase();
    const esCorrecta = answer === (q.respuesta_correcta || '').toLowerCase();
    const pts = esCorrecta ? q.puntos : 0;
    puntosObtenidos += pts;
    evaluacionDetallada.parte_b.puntos += pts;
    evaluacionDetallada.parte_b.items.push({
      id: q.id,
      numero: q.numero,
      respuesta_dada: answer || '(Sin responder)',
      es_correcta: esCorrecta,
      respuesta_esperada: q.respuesta_correcta,
      puntos: pts
    });
  });

  // Parte C
  cfg.secciones.parte_c.preguntas.forEach(q => {
    const answer = (responses.parte_c[q.id] || '').toUpperCase();
    const esCorrecta = answer === (q.respuesta_correcta || '').toUpperCase();
    const pts = esCorrecta ? q.puntos : 0;
    puntosObtenidos += pts;
    evaluacionDetallada.parte_c.puntos += pts;
    evaluacionDetallada.parte_c.items.push({
      id: q.id,
      numero: q.numero,
      respuesta_dada: answer || '(Sin responder)',
      es_correcta: esCorrecta,
      respuesta_esperada: q.respuesta_correcta,
      puntos: pts
    });
  });

  // Parte D
  cfg.secciones.parte_d.conceptos.forEach(c => {
    const answer = (responses.parte_d[c.id] || '').toUpperCase();
    const esCorrecta = answer === (c.respuesta_correcta || '').toUpperCase();
    const pts = esCorrecta ? 1 : 0;
    puntosObtenidos += pts;
    evaluacionDetallada.parte_d.puntos += pts;
    evaluacionDetallada.parte_d.items.push({
      id: c.id,
      numero: c.numero,
      termino: c.termino,
      respuesta_dada: answer || '(Sin asignar)',
      es_correcta: esCorrecta,
      respuesta_esperada: c.respuesta_correcta,
      puntos: pts
    });
  });

  // Parte E (si aplica)
  if (cfg.secciones?.parte_e?.preguntas) {
    cfg.secciones.parte_e.preguntas.forEach(q => {
      const resp = responses.parte_e ? responses.parte_e[q.id] : '';
      const textNorm = cleanText(resp);
      const keywords = q.palabras_clave || [];
      const hasKw = keywords.some(kw => textNorm.includes(cleanText(kw)));
      const esCorrecta = textNorm.length >= 4 && (hasKw || textNorm.length >= 8);
      const pts = esCorrecta ? 1 : 0;
      puntosObtenidos += pts;
      evaluacionDetallada.parte_e.puntos += pts;
      evaluacionDetallada.parte_e.items.push({
        id: q.id,
        numero: q.numero,
        enunciado: q.enunciado,
        respuesta_dada: resp || '(En blanco)',
        es_correcta: esCorrecta,
        puntos: pts
      });
    });
  }

  const totalPts = cfg.puntos_totales || (currentGrade === 4 ? 24 : 19);
  const notaMeduca = Number((1.0 + 4.0 * (puntosObtenidos / totalPts)).toFixed(1));
  const porcentaje = Math.round((puntosObtenidos / totalPts) * 100);

  let desempeno = 'Excelente';
  if (notaMeduca < 3.0) desempeno = 'Necesita Reforzar';
  else if (notaMeduca < 4.0) desempeno = 'Regular / Aprobado';
  else if (notaMeduca < 4.5) desempeno = 'Bueno';

  return {
    id: 'res-off-' + Date.now(),
    grado: currentGrade,
    estudiante_id: currentStudent.id,
    estudiante_nombre: currentStudent.nombre,
    grupo: currentStudent.grupo || `${currentGrade}A`,
    iniciado_at: testStartTime.toISOString(),
    completado_at: new Date().toLocaleString('es-PA'),
    completado_timestamp: Date.now(),
    duracion_segundos: durationSec,
    duracion_formato: formatTime(durationSec) + ' min',
    puntos_obtenidos: puntosObtenidos,
    puntos_totales: totalPts,
    porcentaje: porcentaje,
    nota_meduca: notaMeduca,
    desempeno: desempeno,
    detalles: evaluacionDetallada,
    origen: 'offline_local'
  };
}

// Confirm and Submit
async function confirmAndSubmitTest() {
  const total = rawTestConfig?.puntos_totales || (currentGrade === 4 ? 24 : 19);

  let answered = 0;
  document.querySelectorAll('.blank-input').forEach(i => { if (i.value.trim()) answered++; });
  document.querySelectorAll('.mcq-question-block').forEach(b => { if (b.dataset.selected) answered++; });
  document.querySelectorAll('.tf-item').forEach(t => { if (t.dataset.selected) answered++; });
  document.querySelectorAll('.match-select').forEach(s => { if (s.value) answered++; });
  document.querySelectorAll('.short-answer-textarea').forEach(ta => { if (ta.value.trim()) answered++; });

  if (answered < total) {
    const faltantes = total - answered;
    const confirmSend = confirm(`Aún tienes ${faltantes} reactivo(s) sin responder.\n\n¿Estás seguro de que deseas entregar la prueba ahora?`);
    if (!confirmSend) return;
  } else {
    const confirmSend = confirm(`¿Estás listo(a) para entregar tu prueba evaluativa de ${currentGrade}° grado?`);
    if (!confirmSend) return;
  }

  const submitBtn = document.getElementById('submitTestBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Enviando y calificando...';

  clearInterval(timerInterval);
  window.onbeforeunload = null;

  const responses = {
    parte_a: {},
    parte_b: {},
    parte_c: {},
    parte_d: {},
    parte_e: {}
  };

  document.querySelectorAll('.blank-input').forEach(input => {
    responses.parte_a[input.dataset.qid] = input.value.trim();
  });

  document.querySelectorAll('.mcq-question-block').forEach(block => {
    responses.parte_b[block.dataset.qid] = block.dataset.selected || '';
  });

  document.querySelectorAll('.tf-item').forEach(item => {
    responses.parte_c[item.dataset.qid] = item.dataset.selected || '';
  });

  document.querySelectorAll('.match-select').forEach(sel => {
    responses.parte_d[sel.dataset.qid] = sel.value || '';
  });

  document.querySelectorAll('.short-answer-textarea').forEach(ta => {
    responses.parte_e[ta.dataset.qid] = ta.value.trim();
  });

  const payload = {
    grado: currentGrade,
    estudiante_id: currentStudent.id,
    estudiante_nombre: currentStudent.nombre,
    grupo: currentStudent.grupo || `${currentGrade}A`,
    respuestas: responses,
    duracion_segundos: elapsedSeconds,
    iniciado_at: testStartTime.toISOString()
  };

  let finalResultado = null;

  try {
    const res = await fetch('/api/evaluar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      finalResultado = data.resultado;
    } else {
      const errData = await res.json().catch(() => ({}));
      if (errData.error === 'UNICO_INTENTO_PERMITIDO') {
        alert(errData.mensaje);
        window.location.reload();
        return;
      }
      throw new Error('Servidor no disponible');
    }
  } catch (err) {
    console.log('Evaluando en modo offline / GitHub Pages...');
    finalResultado = evaluateTestOffline(responses, elapsedSeconds);
  }

  saveLocalResult(finalResultado);
  showResultModal(finalResultado);
}

// Display Result Modal
function showResultModal(resultado) {
  playSound('success');
  startConfetti();

  const modal = document.getElementById('resultModal');
  const badge = document.getElementById('modalResultBadge');
  const notaVal = document.getElementById('modalNotaVal');
  const puntosVal = document.getElementById('modalPuntosVal');
  const timeVal = document.getElementById('modalTimeVal');
  const studentVal = document.getElementById('modalStudentName');

  studentVal.textContent = resultado.estudiante_nombre;
  notaVal.textContent = Number(resultado.nota_meduca).toFixed(1);
  puntosVal.textContent = `${resultado.puntos_obtenidos} / ${resultado.puntos_totales}`;
  timeVal.textContent = resultado.duracion_formato;

  if (resultado.nota_meduca >= 4.5) {
    badge.textContent = '⭐ ¡Excelente Trabajo!';
    badge.style.background = '#dcfce7';
    badge.style.color = '#15803d';
  } else if (resultado.nota_meduca >= 4.0) {
    badge.textContent = '👍 ¡Muy Buen Desempeño!';
    badge.style.background = '#dbeafe';
    badge.style.color = '#1e40af';
  } else if (resultado.nota_meduca >= 3.0) {
    badge.textContent = '✔️ Aprobado Satisfactoriamente';
    badge.style.background = '#fef3c7';
    badge.style.color = '#92400e';
  } else {
    badge.textContent = '🌱 Sigue Practicando';
    badge.style.background = '#fee2e2';
    badge.style.color = '#991b1b';
  }

  modal.classList.add('active');
}

// Canvas Confetti
function startConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = [];
  const colors = ['#22c55e', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444', '#10b981'];

  for (let i = 0; i < 150; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      size: Math.random() * 9 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      speedY: Math.random() * 4 + 2,
      speedX: Math.random() * 4 - 2,
      rotation: Math.random() * 360,
      rotationSpeed: Math.random() * 6 - 3
    });
  }

  let duration = 0;
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.y += p.speedY;
      p.x += p.speedX;
      p.rotation += p.rotationSpeed;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
      ctx.restore();

      if (p.y > canvas.height) {
        p.y = -10;
        p.x = Math.random() * canvas.width;
      }
    });

    duration++;
    if (duration < 360) {
      requestAnimationFrame(render);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  render();
}
