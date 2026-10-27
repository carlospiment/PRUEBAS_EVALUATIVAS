/* ===================================================
   LÓGICA DEL ESTUDIANTE - PRUEBA SUMATIVA 3ER GRADO
   =================================================== */

// Global state
let testConfig = null;
let allStudents = [];
let currentStudent = null;
let testStartTime = null;
let timerInterval = null;
let elapsedSeconds = 0;
let soundEnabled = true;

// Web Audio API Sound Synthesizer
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
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'success') {
      // Fanfare chord
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C, E, G, C
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
    console.warn('Audio not available:', e);
  }
}

// Format seconds into MM:SS
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Normalizer
function cleanText(str) {
  if (!str) return '';
  return str.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  await loadStudents();
  setupAutocomplete();
  setupEventListeners();
});

// Load test configuration from server
async function loadConfig() {
  try {
    const res = await fetch('/api/prueba');
    testConfig = await res.json();
    renderTestSections();
  } catch (err) {
    console.error('Error cargando configuración de la prueba:', err);
  }
}

// Load registered students
async function loadStudents() {
  try {
    const res = await fetch('/api/estudiantes');
    allStudents = await res.json();
  } catch (err) {
    console.error('Error cargando lista de estudiantes:', err);
  }
}

// Setup Student Autocomplete Input
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

    const matches = allStudents.filter(s => cleanText(s.nombre).includes(query));

    if (matches.length === 0) {
      dropdown.innerHTML = `<div class="autocomplete-item" style="color: #6b7280; font-style: italic;">No se encontró ningún estudiante con ese nombre</div>`;
      dropdown.style.display = 'block';
      return;
    }

    matches.forEach(student => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      
      const statusBadge = student.completado 
        ? `<span class="status-tag completado">⚠️ Ya realizada (${student.nota_meduca ? 'Nota: ' + student.nota_meduca : 'Enviada'})</span>` 
        : `<span class="status-tag pendiente">✅ Disponible</span>`;

      item.innerHTML = `
        <span style="font-size: 1.2rem;">👤</span>
        <span>${student.nombre}</span>
        ${statusBadge}
      `;

      item.addEventListener('click', () => {
        selectStudent(student);
      });

      dropdown.appendChild(item);
    });

    dropdown.style.display = 'block';
  });

  // Hide dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });

  // Start button click
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
      <p>Hola <strong>${student.nombre}</strong>, nuestro sistema registra que ya entregaste esta prueba evaluativa.</p>
      <div style="margin-top: 10px; font-weight: 600; color: #7f1d1d; background: #fee2e2; padding: 10px; border-radius: 8px;">
        📅 Fecha: ${student.fecha_completado || 'Recientemente'}<br>
        ⏱️ Tiempo empleado: ${student.duracion || 'Registrado'}<br>
        📊 Calificación obtenida: ${student.nota_meduca ? student.nota_meduca + ' / 5.0' : 'Calificada'}
      </div>
      <p style="margin-top: 8px; font-size: 0.95rem; color: #991b1b;">
        * Por normativa de la evaluación, solo se permite realizar la prueba una sola vez. Si crees que se trata de un error, por favor consulta con tu maestro(a).
      </p>
    `;
    alreadyDoneCard.style.display = 'block';
  } else {
    alreadyDoneCard.style.display = 'none';
    startBtn.disabled = false;
  }
}

// Render Test Sections
function renderTestSections() {
  if (!testConfig) return;

  // Header Title
  document.getElementById('testTitle').textContent = testConfig.titulo || 'Prueba Sumativa de Agricultura';
  document.getElementById('testTopic').textContent = testConfig.tema || 'El huerto escolar, la salud y la nutrición';
  document.getElementById('testGrade').textContent = testConfig.grado || 'Tercer Grado de Educación Primaria';

  // Render Parte A: Completa
  renderParteA(testConfig.secciones.parte_a);

  // Render Parte B: Selección Múltiple
  renderParteB(testConfig.secciones.parte_b);

  // Render Parte C: Verdadero o Falso
  renderParteC(testConfig.secciones.parte_c);

  // Render Parte D: Relaciona
  renderParteD(testConfig.secciones.parte_d);
}

// RENDER PARTE A
function renderParteA(data) {
  const container = document.getElementById('parteAQuestions');
  const chipsContainer = document.getElementById('wordChipsContainer');
  if (!data || !container) return;

  // Word Bank
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

  // Questions
  container.innerHTML = '';
  data.preguntas.forEach(q => {
    const div = document.createElement('div');
    div.className = 'fill-blank-item';
    div.innerHTML = `
      <span class="q-num">${q.numero}.</span>
      <span>${q.texto_antes}</span>
      <input type="text" class="blank-input" id="input_${q.id}" data-qid="${q.id}" placeholder="Escribe aquí" autocomplete="off" spellcheck="false">
      <span>${q.texto_despues}</span>
    `;

    const input = div.querySelector('input');
    input.addEventListener('focus', () => {
      window.lastActiveInput = input;
    });
    input.addEventListener('input', () => {
      updateProgress();
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
    // Find first empty input
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

// RENDER PARTE B
function renderParteB(data) {
  const container = document.getElementById('parteBQuestions');
  if (!data || !container) return;

  container.innerHTML = '';
  data.preguntas.forEach(q => {
    const block = document.createElement('div');
    block.className = 'mcq-question-block';
    block.id = `mcq_block_${q.id}`;

    let optionsHtml = '';
    q.opciones.forEach(opt => {
      optionsHtml += `
        <div class="mcq-option-card" data-qid="${q.id}" data-optid="${opt.id}">
          <div class="opt-letter">${opt.id.toUpperCase()}</div>
          <div style="flex: 1;">${opt.texto}</div>
          <div style="font-size: 1.3rem;">${opt.icono || ''}</div>
        </div>
      `;
    });

    block.innerHTML = `
      <div class="mcq-prompt">
        <span style="color: var(--primary);">${q.numero}.</span>
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

// RENDER PARTE C
function renderParteC(data) {
  const container = document.getElementById('parteCQuestions');
  if (!data || !container) return;

  container.innerHTML = '';
  data.preguntas.forEach(q => {
    const item = document.createElement('div');
    item.className = 'tf-item';
    item.id = `tf_item_${q.id}`;

    item.innerHTML = `
      <div class="tf-text">
        <span style="color: var(--primary); font-weight: 800; margin-right: 6px;">${q.numero}.</span>
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

// RENDER PARTE D
function renderParteD(data) {
  const container = document.getElementById('parteDQuestions');
  if (!data || !container) return;

  container.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'matching-container';

  // Left column: Concepts to match
  const leftCol = document.createElement('div');
  leftCol.className = 'matching-card';
  leftCol.innerHTML = `<h4><span>📌</span> Conceptos</h4>`;

  data.conceptos.forEach(c => {
    const matchRow = document.createElement('div');
    matchRow.className = 'match-item';
    matchRow.id = `match_row_${c.id}`;

    let selectOptions = `<option value="">Selecciona...</option>`;
    (data.significados || []).forEach(s => {
      selectOptions += `<option value="${s.letra}">${s.letra}. ${s.definicion.substring(0, 24)}...</option>`;
    });

    matchRow.innerHTML = `
      <div class="match-item-left">
        <span style="color: var(--primary); font-weight: 800;">${c.numero}.</span>
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

  // Right column: Significado descriptions reference
  const rightCol = document.createElement('div');
  rightCol.className = 'matching-card';
  rightCol.innerHTML = `<h4><span>📖</span> Significados</h4>`;

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

// Update Progress Bar
function updateProgress() {
  let answered = 0;
  const total = 19;

  // Parte A (5)
  document.querySelectorAll('.blank-input').forEach(input => {
    if (input.value.trim().length > 0) answered++;
  });

  // Parte B (4)
  document.querySelectorAll('.mcq-question-block').forEach(block => {
    if (block.dataset.selected) answered++;
  });

  // Parte C (6)
  document.querySelectorAll('.tf-item').forEach(item => {
    if (item.dataset.selected) answered++;
  });

  // Parte D (4)
  document.querySelectorAll('.match-select').forEach(sel => {
    if (sel.value) answered++;
  });

  const pct = Math.round((answered / total) * 100);
  document.getElementById('progressFill').style.width = `${pct}%`;
  document.getElementById('progressLabel').textContent = `${answered} de ${total} preguntas respondidas`;
}

// Start Test Action
function startTest() {
  playSound('chip');
  document.getElementById('loginSection').style.display = 'none';
  document.getElementById('testContentSection').style.display = 'block';
  document.getElementById('stickyHeader').style.display = 'flex';

  // Fill student name
  document.getElementById('activeStudentName').textContent = currentStudent.nombre;

  // Start stopwatch
  testStartTime = new Date();
  elapsedSeconds = 0;
  timerInterval = setInterval(() => {
    elapsedSeconds++;
    document.getElementById('liveTimer').textContent = formatTime(elapsedSeconds);
  }, 1000);

  // Prevent accidental back/close
  window.onbeforeunload = () => "Tienes una prueba evaluativa en curso. Si sales ahora, podrías perder tus respuestas.";

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Event Listeners
function setupEventListeners() {
  // Sound toggle button
  const soundBtn = document.getElementById('soundToggleBtn');
  if (soundBtn) {
    soundBtn.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      soundBtn.innerHTML = soundEnabled ? '<span>🔊</span> Sonido: ON' : '<span>🔇</span> Sonido: OFF';
    });
  }

  // Submit test button
  const submitBtn = document.getElementById('submitTestBtn');
  if (submitBtn) {
    submitBtn.addEventListener('click', confirmAndSubmitTest);
  }

  // Close result modal button
  const closeModalBtn = document.getElementById('closeModalBtn');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      window.location.reload();
    });
  }
}

// Confirm and Submit
async function confirmAndSubmitTest() {
  // Check answered count
  let answered = 0;
  const total = 19;

  document.querySelectorAll('.blank-input').forEach(i => { if (i.value.trim()) answered++; });
  document.querySelectorAll('.mcq-question-block').forEach(b => { if (b.dataset.selected) answered++; });
  document.querySelectorAll('.tf-item').forEach(t => { if (t.dataset.selected) answered++; });
  document.querySelectorAll('.match-select').forEach(s => { if (s.value) answered++; });

  if (answered < total) {
    const faltantes = total - answered;
    const confirmSend = confirm(`Aún tienes ${faltantes} pregunta(s) sin responder.\n\n¿Estás seguro de que deseas entregar la prueba ahora?`);
    if (!confirmSend) return;
  } else {
    const confirmSend = confirm(`¿Estás listo(a) para entregar tu prueba evaluativa?`);
    if (!confirmSend) return;
  }

  // Disable button
  const submitBtn = document.getElementById('submitTestBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Enviando y calificando...';

  // Stop Timer
  clearInterval(timerInterval);
  window.onbeforeunload = null;

  // Gather responses
  const responses = {
    parte_a: {},
    parte_b: {},
    parte_c: {},
    parte_d: {}
  };

  // Parte A
  document.querySelectorAll('.blank-input').forEach(input => {
    responses.parte_a[input.dataset.qid] = input.value.trim();
  });

  // Parte B
  document.querySelectorAll('.mcq-question-block').forEach(block => {
    responses.parte_b[block.id.replace('mcq_block_', '')] = block.dataset.selected || '';
  });

  // Parte C
  document.querySelectorAll('.tf-item').forEach(item => {
    responses.parte_c[item.id.replace('tf_item_', '')] = item.dataset.selected || '';
  });

  // Parte D
  document.querySelectorAll('.match-select').forEach(sel => {
    responses.parte_d[sel.dataset.qid] = sel.value || '';
  });

  const payload = {
    estudiante_id: currentStudent.id,
    estudiante_nombre: currentStudent.nombre,
    respuestas: responses,
    duracion_segundos: elapsedSeconds,
    iniciado_at: testStartTime.toISOString()
  };

  try {
    const res = await fetch('/api/evaluar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.mensaje || 'Error al enviar la prueba');
      submitBtn.disabled = false;
      submitBtn.textContent = '🏁 Entregar Prueba Sumativa';
      return;
    }

    // Success! Show Result Modal
    showResultModal(data.resultado);
  } catch (err) {
    console.error('Error al enviar la prueba:', err);
    alert('Ocurrió un error al enviar tu prueba. Por favor verifica tu conexión y avisa al docente.');
    submitBtn.disabled = false;
    submitBtn.textContent = '🏁 Entregar Prueba Sumativa';
  }
}

// Display Result Modal & Celebration
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
  notaVal.textContent = resultado.nota_meduca.toFixed(1);
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

// Simple Canvas Confetti Animation
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

  let animationFrame;
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
      animationFrame = requestAnimationFrame(render);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  render();
}
