/* ===================================================
   LÓGICA DEL PANEL DOCENTE - ADMINISTRACIÓN Y REPORTES
   Soporte Multi-Grado, Códigos QR, Firebase Auth y Enlaces Directos
   =================================================== */

let allResults = [];
let allAuthorizations = [];
let allStudents = [];
let serverResultsCache = [];
let serverAuthorizationsCache = [];
let cloudItemsCache = [];
let serverInfo = null;
let firestoreUnsubscribe = null;
let hasCloudError = false;
let cloudErrorMessage = '';

const TEACHER_PIN = '0476';

const LESSONS_DATA = [
  {
    grado: 3,
    codigo: "Lección 3.3.1",
    titulo: "El huerto escolar, la salud y la nutrición",
    icono: "🌿",
    slug: "tercer_grado.html",
    jsonPath: "./data/prueba_3ro.json",
    puntos: 19,
    color: "#15803d",
    badgeBg: "#dcfce7",
    badgeColor: "#166534",
    softBg: "#f0fdf4",
    gradoTexto: "Tercer Grado (3°)"
  },
  {
    grado: 4,
    codigo: "Lección 4.3.1",
    titulo: "Beneficios e importancia del huerto escolar",
    icono: "🥕",
    slug: "cuarto_grado.html",
    jsonPath: "./data/prueba_4to.json",
    puntos: 24,
    color: "#ea580c",
    badgeBg: "#ffedd5",
    badgeColor: "#c2410c",
    softBg: "#fff7ed",
    gradoTexto: "Cuarto Grado (4°)"
  },
  {
    grado: 5,
    codigo: "Lección 5.3.1",
    titulo: "Métodos modernos de producción",
    icono: "🌽",
    slug: "quinto_grado.html",
    jsonPath: "./data/prueba_5to.json",
    puntos: 31,
    color: "#1e40af",
    badgeBg: "#dbeafe",
    badgeColor: "#1e40af",
    softBg: "#eff6ff",
    gradoTexto: "Quinto Grado (5°)"
  },
  {
    grado: 6,
    codigo: "Lección 6.3.1",
    titulo: "Destino de la producción agrícola",
    icono: "🍅",
    slug: "sexto_grado.html",
    jsonPath: "./data/prueba_6to.json",
    puntos: 32,
    color: "#7c3aed",
    badgeBg: "#ede9fe",
    badgeColor: "#5b21b6",
    softBg: "#f5f3ff",
    gradoTexto: "Sexto Grado (6°)"
  }
];

const testSpecsCache = new Map();
let catalogData = null;
let activeAreaFilter = 'todas';
let showOnlyEnabledTests = false;
let enabledTestsMap = {};

function cleanStudentName(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,;:!?¿¡"']/g, '')
    .replace(/\s+/g, ' ');
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Código determinista de 6 caracteres para desbloquear un intento en dispositivo local del estudiante
function computeRetakeCode(studentId, grado) {
  const input = `${String(studentId || '').trim()}|${Number(grado) || 3}|MEDUCA_AGRI_2026`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = (Math.imul(h2 ^ ch, 0x85ebca6b) + i) >>> 0;
  }
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let combined = (BigInt(h1) << 32n) | BigInt(h2);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += alphabet[Number(combined % BigInt(alphabet.length))];
    combined /= BigInt(alphabet.length);
  }
  return code;
}

document.addEventListener('DOMContentLoaded', async () => {
  const initialGradeParam = new URLSearchParams(window.location.search).get('grado');
  const gradeSelect = document.getElementById('gradeFilterSelect');
  if (gradeSelect && ['3', '4', '5', '6', 'todos'].includes(String(initialGradeParam))) {
    gradeSelect.value = String(initialGradeParam);
  }

  if (window.MEDUCA_CATALOGO) {
    catalogData = await window.MEDUCA_CATALOGO.loadCatalog();
    enabledTestsMap = window.MEDUCA_CATALOGO.readEnabledMap(catalogData);
  }

  setupLockScreen();
  await loadServerInfo();
  setupDocenteEvents();
  setupQrModalEvents();
  setupExamPreviewModal();
  if (['3', '4', '5', '6'].includes(String(initialGradeParam))) {
    selectDocenteGrade(String(initialGradeParam), false);
  } else {
    showGradesOverviewView(false);
  }
  initAuthAndData();
});

function isTeacherUnlockedLocally() {
  return sessionStorage.getItem('meduca_docente_auth') === TEACHER_PIN;
}

function updateAuthUI(user, unauthorizedEmail) {
  const lockScreen = document.getElementById('teacherLockScreen');
  const dashboardContent = document.getElementById('docenteDashboardContent');
  const authBadge = document.getElementById('teacherAuthBadge');
  const banner = document.getElementById('cloudStatusBanner');
  const bannerMsg = document.getElementById('cloudStatusMessage');
  const googleAuthErr = document.getElementById('googleAuthError');

  if (unauthorizedEmail && googleAuthErr) {
    googleAuthErr.textContent = `Acceso denegado: la cuenta "${unauthorizedEmail}" no está autorizada. Inicia sesión con civanp004@gmail.com.`;
    googleAuthErr.style.display = 'block';
  }

  if (user) {
    if (lockScreen) lockScreen.style.display = 'none';
    if (dashboardContent) dashboardContent.style.display = 'block';
    if (googleAuthErr) googleAuthErr.style.display = 'none';
    if (window.MEDUCA_NAV) window.MEDUCA_NAV.setTeacherStatus(user.email);
    if (authBadge) {
      authBadge.innerHTML = `🟢 Conectado: ${escapeHtml(user.email)}`;
      authBadge.style.background = 'rgba(34, 197, 94, 0.25)';
    }
    if (banner && !hasCloudError) banner.style.display = 'none';
  } else {
    const localUnlocked = isTeacherUnlockedLocally();
    if (window.MEDUCA_NAV) window.MEDUCA_NAV.setTeacherStatus(null);
    if (lockScreen) {
      lockScreen.style.display = localUnlocked ? 'none' : 'flex';
    }
    if (dashboardContent) {
      dashboardContent.style.display = localUnlocked ? 'block' : 'none';
    }
    if (authBadge) {
      authBadge.innerHTML = localUnlocked
        ? '🟡 Modo Local (Sin sesión Google)'
        : '🔒 Sesión requerida';
      authBadge.style.background = 'rgba(255, 255, 255, 0.16)';
    }
    if (banner && localUnlocked) {
      banner.style.display = 'flex';
      if (bannerMsg) {
        bannerMsg.textContent = cloudErrorMessage || 'Estás en modo local. Inicia sesión con Google (civanp004@gmail.com) para cargar los resultados guardados en Firebase.';
      }
    }
  }
}

function initAuthAndData() {
  if (window.MEDUCA_FIREBASE && window.MEDUCA_FIREBASE.onAuthStateChanged) {
    window.MEDUCA_FIREBASE.onAuthStateChanged(async ({ user, unauthorizedEmail }) => {
      updateAuthUI(user, unauthorizedEmail);
      if (user) {
        await loadData();
        setupFirestoreRealtimeListener();
      } else {
        stopFirestoreRealtimeListener();
        if (isTeacherUnlockedLocally()) {
          await loadData();
        }
      }
    });
  } else {
    updateAuthUI(null, null);
    if (isTeacherUnlockedLocally()) {
      loadData();
    }
  }
}

function setupLockScreen() {
  const lockScreen = document.getElementById('teacherLockScreen');
  const pinInput = document.getElementById('lockPinInput');
  const pinError = document.getElementById('lockPinError');
  const submitBtn = document.getElementById('submitLockPinBtn');
  const logoutBtn = document.getElementById('logoutDocenteBtn');
  const googleBtn = document.getElementById('googleSignInBtn');
  const googleBtnText = document.getElementById('googleSignInBtnText');
  const googleAuthErr = document.getElementById('googleAuthError');
  const bannerGoogleBtn = document.getElementById('bannerGoogleSignInBtn');
  const togglePinBtn = document.getElementById('toggleOfflinePinBtn');
  const offlinePinSec = document.getElementById('offlinePinSection');

  const triggerGoogleLogin = async (btnEl, labelEl) => {
    if (!window.MEDUCA_FIREBASE || !window.MEDUCA_FIREBASE.signInWithGoogle) return;
    if (googleAuthErr) googleAuthErr.style.display = 'none';
    if (btnEl) btnEl.disabled = true;
    if (labelEl) labelEl.textContent = 'Conectando con Google...';

    const res = await window.MEDUCA_FIREBASE.signInWithGoogle();
    if (btnEl) btnEl.disabled = false;
    if (labelEl) labelEl.textContent = 'Continuar con Google';

    if (!res.ok) {
      if (googleAuthErr) {
        googleAuthErr.textContent = res.message || 'No se pudo iniciar sesión con Google.';
        googleAuthErr.style.display = 'block';
      } else {
        alert(res.message || 'No se pudo iniciar sesión con Google.');
      }
    }
  };

  if (googleBtn) {
    googleBtn.addEventListener('click', () => triggerGoogleLogin(googleBtn, googleBtnText));
  }
  if (bannerGoogleBtn) {
    bannerGoogleBtn.addEventListener('click', () => triggerGoogleLogin(bannerGoogleBtn, null));
  }

  if (togglePinBtn && offlinePinSec) {
    togglePinBtn.addEventListener('click', () => {
      const open = offlinePinSec.style.display !== 'none';
      offlinePinSec.style.display = open ? 'none' : 'block';
      if (!open && pinInput) setTimeout(() => pinInput.focus(), 100);
    });
  }

  const unlockWithPin = async () => {
    if (!pinInput) return;
    if (pinInput.value.trim() === TEACHER_PIN) {
      sessionStorage.setItem('meduca_docente_auth', TEACHER_PIN);
      if (pinError) pinError.style.display = 'none';
      if (lockScreen) lockScreen.style.display = 'none';
      updateAuthUI(window.MEDUCA_FIREBASE?.getCurrentUser?.() || null, null);
      await loadData();
    } else {
      if (pinError) pinError.style.display = 'block';
      pinInput.value = '';
      pinInput.focus();
    }
  };

  if (submitBtn) submitBtn.addEventListener('click', unlockWithPin);
  if (pinInput) {
    pinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        unlockWithPin();
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      sessionStorage.removeItem('meduca_docente_auth');
      stopFirestoreRealtimeListener();
      if (window.MEDUCA_FIREBASE && window.MEDUCA_FIREBASE.signOut) {
        await window.MEDUCA_FIREBASE.signOut();
      }
      cloudItemsCache = [];
      allResults = [];
      calculateAndRenderStats();
      renderTable();
      if (pinInput) pinInput.value = '';
      if (pinError) pinError.style.display = 'none';
      if (googleAuthErr) googleAuthErr.style.display = 'none';
      updateAuthUI(null, null);
      window.location.href = './index.html';
    });
  }
}

async function loadServerInfo() {
  try {
    const res = await fetch('/api/servidor-info');
    if (res.ok) {
      serverInfo = await res.json();
    }
  } catch {}
}

function getActiveTestsCatalogList() {
  return catalogData?.pruebas || LESSONS_DATA;
}

function showGradesOverviewView(shouldScroll = true) {
  const overviewEl = document.getElementById('gradesOverviewSection');
  const detailEl = document.getElementById('gradeDetailSection');
  const gradeSelect = document.getElementById('gradeFilterSelect');
  if (gradeSelect) gradeSelect.value = 'todos';
  activeAreaFilter = 'todas';
  updateGroupFilterOptions();
  renderDocenteVerticalGrades();
  renderEnabledQuickBar();
  if (overviewEl) overviewEl.style.display = 'block';
  if (detailEl) detailEl.style.display = 'none';
  if (shouldScroll) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function selectDocenteGrade(gradeVal, shouldScroll = true) {
  const gradeSelect = document.getElementById('gradeFilterSelect');
  const overviewEl = document.getElementById('gradesOverviewSection');
  const detailEl = document.getElementById('gradeDetailSection');
  const selectedTitleEl = document.getElementById('selectedGradeTitle');
  const nextVal = ['3', '4', '5', '6', 'todos'].includes(String(gradeVal)) ? String(gradeVal) : 'todos';
  if (gradeSelect) {
    gradeSelect.value = nextVal;
  }
  activeAreaFilter = 'todas';
  if (overviewEl) overviewEl.style.display = 'none';
  if (detailEl) detailEl.style.display = 'block';
  if (selectedTitleEl) {
    const gMeta = (catalogData?.grados || LESSONS_DATA).find((g) => String(g.grado) === nextVal);
    selectedTitleEl.textContent = nextVal === 'todos'
      ? 'Todos los Grados (3° a 6°) — Actividades y Resultados'
      : `${gMeta?.icono || ''} ${gMeta?.nombre || gMeta?.gradoTexto || (nextVal + '° Grado')} — Actividades y Resultados`;
  }
  updateGroupFilterOptions();
  renderDocenteVerticalGrades();
  renderEnabledQuickBar();
  renderDocenteAreasBar();
  renderLessonsQrSection();
  calculateAndRenderStats();
  renderTable();
  if (shouldScroll) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function selectDocenteArea(areaVal, shouldScroll = false) {
  const nextArea = ['1', '2', '3', '4', 'todas'].includes(String(areaVal)) ? String(areaVal) : 'todas';
  activeAreaFilter = nextArea;
  renderDocenteAreasBar();
  renderLessonsQrSection();
  if (shouldScroll) {
    const target = document.getElementById('deployedTestsTitle') || document.getElementById('lessonsLinksContainer');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function renderDocenteAreasBar() {
  const bar = document.getElementById('docenteAreasFilterBar');
  if (!bar) return;

  const activeGrade = document.getElementById('gradeFilterSelect')?.value || 'todos';
  const areas = window.MEDUCA_CATALOGO
    ? window.MEDUCA_CATALOGO.getAreasForGrade(catalogData, activeGrade)
    : [];

  const totalCount = areas.reduce((acc, a) => acc + a.pruebas.length, 0);
  const allBtn = `
    <button
      type="button"
      class="docente-area-chip-btn ${activeAreaFilter === 'todas' ? 'is-selected' : ''}"
      data-area-choice="todas"
      aria-pressed="${activeAreaFilter === 'todas' ? 'true' : 'false'}"
      style="--area-color: #1e3a8a; --area-soft: #dbeafe;"
    >
      <span aria-hidden="true">📚</span>
      <span>Todas las áreas (${totalCount})</span>
    </button>
  `;

  const areaBtns = areas.map((area) => {
    const isSelected = area.disponible && String(area.numero) === String(activeAreaFilter);
    return `
      <button
        type="button"
        class="docente-area-chip-btn ${isSelected ? 'is-selected' : ''}"
        data-area-choice="${area.numero}"
        ${area.disponible ? '' : 'disabled aria-disabled="true"'}
        aria-pressed="${isSelected ? 'true' : 'false'}"
        style="--area-color: ${area.color}; --area-soft: ${area.softBg};"
      >
        <span aria-hidden="true">${area.icono}</span>
        <span>Área ${area.numero}: ${escapeHtml(area.nombre)} (${area.disponible ? area.pruebas.length : 'Sin pruebas'})</span>
      </button>
    `;
  }).join('');

  bar.innerHTML = allBtn + areaBtns;
}

window.MEDUCA_DOCENTE_NAV = {
  selectGrade: selectDocenteGrade,
  selectArea: selectDocenteArea
};

async function handleTestClipToggle(testId, isChecked) {
  if (!testId || !window.MEDUCA_CATALOGO) return;
  enabledTestsMap = await window.MEDUCA_CATALOGO.setTestEnabled(testId, isChecked, catalogData);
  renderEnabledQuickBar();
  renderDocenteAreasBar();
  renderLessonsQrSection();
}

function renderTestClipCheckboxHtml(test, idPrefix) {
  const checked = enabledTestsMap[test.id] !== false;
  const inputId = `${idPrefix}_${test.id}`;
  return `
    <label class="test-clip-label ${checked ? 'is-enabled' : ''}" for="${escapeHtml(inputId)}">
      <input
        type="checkbox"
        id="${escapeHtml(inputId)}"
        class="test-clip-checkbox visually-hidden-fallback"
        data-clip-test-id="${escapeHtml(test.id)}"
        ${checked ? 'checked' : ''}
      >
      <span class="test-clip-text">${checked ? 'Habilitada para aplicar' : 'Habilitar prueba'}</span>
    </label>
  `;
}

function renderEnabledQuickBar() {
  const listEl = document.getElementById('enabledTestsQuickList');
  const countEl = document.getElementById('enabledTestsCount');
  if (!listEl) return;

  const allTests = getActiveTestsCatalogList();
  const enabledTests = allTests.filter((t) => enabledTestsMap[t.id] !== false);
  if (countEl) countEl.textContent = String(enabledTests.length);

  if (enabledTests.length === 0) {
    listEl.innerHTML = '<p style="color:#64748b;font-size:0.9rem;padding:8px 4px;margin:0;">No hay pruebas marcadas con el clip de selección. Activa una casilla abajo para fijarla aquí y agilizar su aplicación.</p>';
    return;
  }

  const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
  listEl.innerHTML = enabledTests.map((t) => {
    const fullUrl = baseUrl + t.slug;
    return `
      <div class="deployed-test-row quick-enabled-row" style="--grade-accent: ${t.color};">
        <div style="flex: 1; min-width: 220px;">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px;">
            <span aria-hidden="true" style="font-size: 1.35rem;">${t.icono}</span>
            <span class="lesson-qr-tag" style="background:${t.badgeBg}; color:${t.badgeColor}; margin:0;">
              ${escapeHtml(t.gradoTexto)} • Área ${t.area || 3} • ${escapeHtml(t.codigo)}
            </span>
          </div>
          <div style="font-family:'Outfit',sans-serif;font-weight:800;color:#0f172a;font-size:1.02rem;">
            ${escapeHtml(t.titulo)}
          </div>
          <div style="font-size: 0.8rem; color: #475569; margin-top: 2px;">
            ${escapeHtml(t.areaIcono || '🥬')} ${escapeHtml(t.areaNombre || '')} • ${t.puntos} pts • <a href="${escapeHtml(fullUrl)}" target="_blank" style="color:#1e3a8a;">Enlace directo</a>
          </div>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
          ${renderTestClipCheckboxHtml(t, 'quick_clip')}
          <button type="button" class="btn-secondary btn-preview-exam" data-exam-id="${escapeHtml(t.id)}" data-exam-grade="${t.grado}" style="background:#fff;border-color:${t.color};color:${t.color};">
            <span aria-hidden="true">👁️</span> Preguntas
          </button>
          <button type="button" class="btn-qr-action" data-qr-id="${escapeHtml(t.id)}" data-qr-grade="${t.grado}" style="background:${t.color};">
            <span aria-hidden="true">📷</span> QR
          </button>
          <a href="./${escapeHtml(t.slug)}" target="_blank" class="btn-secondary">
            <span aria-hidden="true">🚀</span> Abrir
          </a>
        </div>
      </div>
    `;
  }).join('');
}

function renderDocenteVerticalGrades() {
  const container = document.getElementById('docenteGradesVertical');
  if (!container) return;

  const activeGrade = document.getElementById('gradeFilterSelect')?.value || 'todos';
  const showAllBtn = document.getElementById('showAllGradesBtn');
  if (showAllBtn) {
    const isAll = activeGrade === 'todos';
    showAllBtn.style.background = isAll ? '#1e3a8a' : '';
    showAllBtn.style.color = isAll ? '#ffffff' : '';
    showAllBtn.style.borderColor = isAll ? '#1e3a8a' : '';
    showAllBtn.setAttribute('aria-pressed', isAll ? 'true' : 'false');
  }

  const allRows = getStudentRows();
  const gradesList = catalogData?.grados || LESSONS_DATA;
  const testsCatalog = getActiveTestsCatalogList();

  container.innerHTML = gradesList.map((gMeta) => {
    const gNum = Number(gMeta.grado);
    const gradeRows = allRows.filter((item) => Number(item.student.grado) === gNum);
    const completed = gradeRows.filter((item) => Boolean(item.result));
    const avg = completed.length > 0
      ? (completed.reduce((acc, it) => acc + (Number(it.result.nota_meduca) || 1.0), 0) / completed.length).toFixed(2)
      : '-';
    const gradeTests = testsCatalog.filter((t) => Number(t.grado) === gNum);
    const activeAreasCount = new Set(gradeTests.map((t) => Number(t.area || 3))).size;
    const isSelected = String(gNum) === String(activeGrade);

    return `
      <button
        type="button"
        class="docente-grade-btn ${isSelected ? 'is-active' : ''}"
        data-grade-choice="${gNum}"
        aria-pressed="${isSelected ? 'true' : 'false'}"
        style="--grade-accent: ${gMeta.color}; --grade-soft: ${gMeta.softBg};"
      >
        <div class="docente-grade-meta">
          <span style="font-size: 2.1rem; line-height: 1;" aria-hidden="true">${gMeta.icono}</span>
          <div>
            <span class="lesson-qr-tag" style="background: ${gMeta.badgeBg}; color: ${gMeta.badgeColor};">
              ${escapeHtml(gMeta.nombre || gMeta.gradoTexto)} • ${activeAreasCount} de 4 áreas con pruebas
            </span>
            <div style="font-family: 'Outfit', sans-serif; font-size: 1.04rem; font-weight: 800; color: #0f172a;">
              ${gradeTests.length} prueba${gradeTests.length === 1 ? '' : 's'} creada${gradeTests.length === 1 ? '' : 's'} (${gradeTests.map((t) => escapeHtml(t.codigo)).join(', ')})
            </div>
          </div>
        </div>
        <div class="docente-grade-stats">
          <span class="grade-metric-chip">✅ ${completed.length} / ${gradeRows.length} realizadas</span>
          <span class="grade-metric-chip">⭐ Prom: ${avg}</span>
          <span class="grade-metric-chip" style="background: ${isSelected ? gMeta.color : '#eff6ff'}; color: ${isSelected ? '#ffffff' : '#1e40af'}; border-color: ${gMeta.color};">
            ${isSelected ? '✓ Seleccionado' : 'Ver áreas y pruebas'}
          </span>
        </div>
      </button>
    `;
  }).join('');
}

// Render deployed tests grouped by the 4 Agricultural Program areas (ordered by grade/area/lesson)
function renderLessonsQrSection() {
  const container = document.getElementById('lessonsLinksContainer');
  const headingSpan = document.getElementById('deployedTestsHeadingText');
  const resetAreaBtn = document.getElementById('resetAreaFilterBtn');
  const btnAll = document.getElementById('filterAllCreatedBtn');
  const btnEnabled = document.getElementById('filterEnabledOnlyBtn');
  if (!container) return;

  if (btnAll && btnEnabled) {
    btnAll.setAttribute('aria-pressed', showOnlyEnabledTests ? 'false' : 'true');
    btnAll.style.background = !showOnlyEnabledTests ? '#1e3a8a' : '';
    btnAll.style.color = !showOnlyEnabledTests ? '#ffffff' : '';
    btnEnabled.setAttribute('aria-pressed', showOnlyEnabledTests ? 'true' : 'false');
    btnEnabled.style.background = showOnlyEnabledTests ? '#15803d' : '';
    btnEnabled.style.color = showOnlyEnabledTests ? '#ffffff' : '';
  }

  const activeGrade = document.getElementById('gradeFilterSelect')?.value || 'todos';
  if (resetAreaBtn) {
    resetAreaBtn.style.display = activeAreaFilter !== 'todas' ? 'inline-flex' : 'none';
  }

  const areas = window.MEDUCA_CATALOGO
    ? window.MEDUCA_CATALOGO.getAreasForGrade(catalogData, activeGrade)
    : [{ numero: 3, nombre: 'Producción de alimentos para consumo humano', icono: '🥬', color: '#15803d', softBg: '#dcfce7', pruebas: LESSONS_DATA, disponible: true, leccionesPrograma: [] }];

  const visibleAreas = activeAreaFilter === 'todas'
    ? areas
    : areas.filter((a) => String(a.numero) === String(activeAreaFilter));

  if (headingSpan) {
    const gradeLabel = activeGrade === 'todos' ? 'Todos los Grados (3° a 6°)' : `${activeGrade}° Grado`;
    const areaLabel = activeAreaFilter === 'todas'
      ? '4 Áreas del Programa'
      : `Área ${activeAreaFilter}: ${visibleAreas[0]?.nombre || ''}`;
    headingSpan.textContent = `${gradeLabel} — ${areaLabel}`;
  }

  const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);

  container.innerHTML = visibleAreas.map((area) => {
    const testsInArea = showOnlyEnabledTests
      ? area.pruebas.filter((p) => enabledTestsMap[p.id] !== false)
      : area.pruebas;

    if (!area.disponible) {
      const programHint = area.leccionesPrograma && area.leccionesPrograma.length > 0
        ? `Temas del programa (Obsidian): ${area.leccionesPrograma.join(' · ')}`
        : 'Disponible automáticamente al crear una prueba evaluativa para esta área.';
      return `
        <div class="area-group-card is-locked">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:1.5rem;opacity:0.65;" aria-hidden="true">${area.icono}</span>
              <div>
                <h3 style="font-size:1.05rem;color:#475569;margin:0;">Área ${area.numero}: ${escapeHtml(area.nombre)}</h3>
                <p style="font-size:0.82rem;color:#64748b;margin:2px 0 0 0;">${escapeHtml(programHint)}</p>
              </div>
            </div>
            <span class="grade-metric-chip" style="background:#f1f5f9;color:#64748b;">🔒 No disponible (0 pruebas creadas)</span>
          </div>
        </div>
      `;
    }

    const cardsHtml = testsInArea.length === 0
      ? '<p style="font-size:0.88rem;color:#64748b;margin:8px 0 0 0;">Ninguna prueba habilitada en esta área con el filtro actual.</p>'
      : `<div class="deployed-tests-list" style="margin-top:10px;">
          ${testsInArea.map((lesson) => {
            const fullUrl = baseUrl + lesson.slug;
            return `
              <div class="deployed-test-row" style="--grade-accent: ${lesson.color};">
                <div style="flex: 1; min-width: 240px;">
                  <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 4px;">
                    <span style="font-size: 1.5rem;" aria-hidden="true">${lesson.icono}</span>
                    <span class="lesson-qr-tag" style="background: ${lesson.badgeBg}; color: ${lesson.badgeColor}; margin: 0;">
                      ${escapeHtml(lesson.gradoTexto)} • ${escapeHtml(lesson.codigo)} • ${lesson.puntos} pts
                    </span>
                  </div>
                  <h4 style="font-size: 1.08rem; color: #0f172a; margin-bottom: 4px;">
                    ${escapeHtml(lesson.titulo)}
                  </h4>
                  <div style="font-size: 0.82rem; color: #475569; word-break: break-all;">
                    🔗 <span style="font-family: monospace; color: #1e3a8a;">${escapeHtml(fullUrl)}</span>
                  </div>
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
                  ${renderTestClipCheckboxHtml(lesson, 'area_clip')}
                  <button type="button" class="btn-secondary btn-preview-exam" data-exam-id="${escapeHtml(lesson.id)}" data-exam-grade="${lesson.grado}" style="background: #ffffff; border-color: ${lesson.color}; color: ${lesson.color};">
                    <span aria-hidden="true">👁️</span> Ver Preguntas Puestas
                  </button>
                  <button type="button" class="btn-qr-action" data-qr-id="${escapeHtml(lesson.id)}" data-qr-grade="${lesson.grado}" style="background: ${lesson.color};">
                    <span aria-hidden="true">📷</span> Ver QR
                  </button>
                  <a href="./${escapeHtml(lesson.slug)}" target="_blank" class="btn-secondary">
                    <span aria-hidden="true">🚀</span> Abrir Prueba
                  </a>
                </div>
              </div>
            `;
          }).join('')}
        </div>`;

    return `
      <div class="area-group-card" style="--area-color: ${area.color}; --area-soft: ${area.softBg};">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.6rem;" aria-hidden="true">${area.icono}</span>
            <div>
              <h3 style="font-size:1.1rem;color:#0f172a;margin:0;">Área ${area.numero}: ${escapeHtml(area.nombre)}</h3>
              <p style="font-size:0.83rem;color:#475569;margin:2px 0 0 0;">Ordenadas automáticamente por grado y lección</p>
            </div>
          </div>
          <span class="grade-metric-chip" style="background:${area.softBg};color:${area.color};border-color:${area.color};">
            ✅ ${area.pruebas.length} prueba${area.pruebas.length === 1 ? '' : 's'} disponible${area.pruebas.length === 1 ? '' : 's'}
          </span>
        </div>
        ${cardsHtml}
      </div>
    `;
  }).join('');
}

async function openExamPreviewModal(testIdOrGrade) {
  const testsCatalog = getActiveTestsCatalogList();
  const lesson = testsCatalog.find((l) => l.id === testIdOrGrade || String(l.grado) === String(testIdOrGrade));
  if (!lesson) return;

  const modal = document.getElementById('examPreviewModal');
  const badge = document.getElementById('examPreviewBadge');
  const title = document.getElementById('examPreviewTitle');
  const meta = document.getElementById('examPreviewMeta');
  const body = document.getElementById('examPreviewBody');
  if (!modal || !body) return;

  if (badge) {
    badge.textContent = `${lesson.gradoTexto} • ${lesson.codigo}`;
    badge.style.background = lesson.badgeBg;
    badge.style.color = lesson.badgeColor;
  }
  if (title) title.textContent = `${lesson.icono} ${lesson.titulo}`;
  if (meta) meta.textContent = `Cargando reactivos de ${lesson.codigo}...`;
  body.innerHTML = '<p style="color:#64748b;">Cargando preguntas de la prueba...</p>';
  modal.classList.add('active');

  try {
    let spec = testSpecsCache.get(lesson.grado);
    if (!spec) {
      const res = await fetch(lesson.jsonPath);
      if (!res.ok) throw new Error('No se pudo cargar el archivo de la prueba.');
      spec = await res.json();
      testSpecsCache.set(lesson.grado, spec);
    }

    if (meta) {
      meta.textContent = `${spec.area || ''} • Puntaje total: ${spec.puntos_totales || lesson.puntos} puntos`;
    }

    const s = spec.secciones || {};
    const blocks = [];

    if (s.parte_a) {
      const itemsHtml = (s.parte_a.preguntas || []).map((q) => {
        const sentence = q.texto_antes !== undefined
          ? `${escapeHtml(q.texto_antes)} <u>[_____]</u> ${escapeHtml(q.texto_despues || '')}`
          : escapeHtml(q.enunciado || '');
        const ans = Array.isArray(q.respuestas_validas)
          ? q.respuestas_validas.join(' / ')
          : (q.respuesta_correcta || '');
        return `<li style="padding: 6px 0; border-bottom: 1px solid #f1f5f9;"><strong>${q.numero}.</strong> ${sentence} <span style="color:#15803d;font-weight:700;">(Resp: ${escapeHtml(ans)})</span></li>`;
      }).join('');
      blocks.push(`<div style="margin-bottom:16px;"><h4 style="color:${lesson.color};margin-bottom:6px;">${escapeHtml(s.parte_a.titulo)}</h4><ul style="list-style:none;padding-left:0;">${itemsHtml}</ul></div>`);
    }

    if (s.parte_b) {
      const itemsHtml = (s.parte_b.preguntas || []).map((q) => {
        const opts = (q.opciones || []).map((o) => `${escapeHtml(o.id)}) ${escapeHtml(o.texto)}`).join(' · ');
        return `<li style="padding: 6px 0; border-bottom: 1px solid #f1f5f9;"><strong>${q.numero}.</strong> ${escapeHtml(q.enunciado)}<div style="font-size:0.86rem;color:#475569;margin-top:2px;">${opts} — <strong style="color:#15803d;">Correcta: ${escapeHtml(String(q.respuesta_correcta || '').toUpperCase())}</strong></div></li>`;
      }).join('');
      blocks.push(`<div style="margin-bottom:16px;"><h4 style="color:${lesson.color};margin-bottom:6px;">${escapeHtml(s.parte_b.titulo)}</h4><ul style="list-style:none;padding-left:0;">${itemsHtml}</ul></div>`);
    }

    if (s.parte_c) {
      const itemsHtml = (s.parte_c.preguntas || []).map((q) =>
        `<li style="padding: 6px 0; border-bottom: 1px solid #f1f5f9;"><strong>${q.numero}.</strong> ${escapeHtml(q.enunciado)} <strong style="color:#15803d;">(${escapeHtml(q.respuesta_correcta)})</strong></li>`
      ).join('');
      blocks.push(`<div style="margin-bottom:16px;"><h4 style="color:${lesson.color};margin-bottom:6px;">${escapeHtml(s.parte_c.titulo)}</h4><ul style="list-style:none;padding-left:0;">${itemsHtml}</ul></div>`);
    }

    if (s.parte_d) {
      const meaningsMap = new Map((s.parte_d.significados || []).map((m) => [m.letra, m.definicion]));
      const itemsHtml = (s.parte_d.conceptos || []).map((c) =>
        `<li style="padding: 6px 0; border-bottom: 1px solid #f1f5f9;"><strong>${c.numero}. ${escapeHtml(c.termino)}</strong>: <strong style="color:#15803d;">${escapeHtml(c.respuesta_correcta)} (${escapeHtml(meaningsMap.get(c.respuesta_correcta) || '')})</strong></li>`
      ).join('');
      blocks.push(`<div style="margin-bottom:16px;"><h4 style="color:${lesson.color};margin-bottom:6px;">${escapeHtml(s.parte_d.titulo)}</h4><ul style="list-style:none;padding-left:0;">${itemsHtml}</ul></div>`);
    }

    if (s.parte_e) {
      const itemsHtml = (s.parte_e.preguntas || []).map((q) => {
        const extra = q.respuesta_correcta
          ? `<strong style="color:#15803d;">(Correcta: ${escapeHtml(q.respuesta_correcta)})</strong>`
          : `<span style="color:#64748b;font-size:0.85rem;">(Palabras clave: ${escapeHtml((q.palabras_clave || []).slice(0, 5).join(', '))})</span>`;
        return `<li style="padding: 6px 0; border-bottom: 1px solid #f1f5f9;"><strong>${q.numero}.</strong> ${escapeHtml(q.enunciado)} ${extra}</li>`;
      }).join('');
      blocks.push(`<div style="margin-bottom:12px;"><h4 style="color:${lesson.color};margin-bottom:6px;">${escapeHtml(s.parte_e.titulo)}</h4><ul style="list-style:none;padding-left:0;">${itemsHtml}</ul></div>`);
    }

    body.innerHTML = blocks.join('') || '<p>No se encontraron secciones en esta prueba.</p>';
  } catch (err) {
    body.innerHTML = `<p style="color:#b91c1c;">No se pudieron cargar las preguntas de esta prueba (${escapeHtml(err.message)}).</p>`;
  }
}

function setupExamPreviewModal() {
  const modal = document.getElementById('examPreviewModal');
  const closeBtn = document.getElementById('closeExamPreviewModal');
  if (closeBtn && modal) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  }
}

// Open QR Modal and generate QR code
function openQrModal(testIdOrGrade) {
  const testsCatalog = getActiveTestsCatalogList();
  const lesson = testsCatalog.find((l) => l.id === testIdOrGrade || String(l.grado) === String(testIdOrGrade));
  if (!lesson) return;

  const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
  const fullUrl = baseUrl + lesson.slug;

  const modal = document.getElementById('qrModal');
  const badge = document.getElementById('qrModalBadge');
  const title = document.getElementById('qrModalTitle');
  const subtitle = document.getElementById('qrModalSubtitle');
  const linkText = document.getElementById('qrModalLinkText');
  const openLink = document.getElementById('openQrLinkBtn');
  const qrBox = document.getElementById('qrCodeContainer');

  badge.textContent = `${lesson.gradoTexto} • ${lesson.codigo}`;
  badge.style.background = lesson.badgeBg;
  badge.style.color = lesson.badgeColor;

  title.textContent = `${lesson.icono} ${lesson.codigo}: ${lesson.titulo}`;
  subtitle.textContent = `Escanea este código con la tablet o celular para abrir la evaluación`;

  linkText.textContent = fullUrl;
  linkText.href = fullUrl;
  openLink.href = fullUrl;

  qrBox.innerHTML = '';

  if (typeof QRCode !== 'undefined') {
    new QRCode(qrBox, {
      text: fullUrl,
      width: 230,
      height: 230,
      colorDark: lesson.color,
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });
  } else {
    qrBox.innerHTML = `<p style="color: #ef4444;">Librería QR no disponible</p>`;
  }

  modal.classList.add('active');
}

function setupQrModalEvents() {
  const closeBtn = document.getElementById('closeQrModalBtn');
  const modal = document.getElementById('qrModal');
  const copyBtn = document.getElementById('copyQrLinkBtn');

  if (closeBtn) {
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('active');
    });
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const link = document.getElementById('qrModalLinkText').textContent.trim();
      try {
        await navigator.clipboard.writeText(link);
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '<span>✅</span> ¡Enlace Copiado!';
        copyBtn.style.background = '#15803d';
        setTimeout(() => {
          copyBtn.innerHTML = originalText;
          copyBtn.style.background = '';
        }, 2200);
      } catch {
        alert('Enlace: ' + link);
      }
    });
  }
}

function getLocalResults(grade) {
  try {
    if (grade) {
      const raw = localStorage.getItem(`meduca_agri_eval_${grade}to_grado`);
      return raw ? JSON.parse(raw) : [];
    }
    const r3 = JSON.parse(localStorage.getItem('meduca_agri_eval_3to_grado') || '[]');
    const r4 = JSON.parse(localStorage.getItem('meduca_agri_eval_4to_grado') || '[]');
    const r5 = JSON.parse(localStorage.getItem('meduca_agri_eval_5to_grado') || '[]');
    const r6 = JSON.parse(localStorage.getItem('meduca_agri_eval_6to_grado') || '[]');
    const rOld = JSON.parse(localStorage.getItem('meduca_agri_eval_3er_grado') || '[]');
    return [...r3, ...r4, ...r5, ...r6, ...rOld];
  } catch {
    return [];
  }
}

function isEvaluationActive(r) {
  return !r.tipo &&
    r.estado !== 'reintento_autorizado' &&
    r.estado !== 'duplicado_ignorado' &&
    r.estado !== 'archivado_docente' &&
    !r.archivado_por_reintento &&
    r.activo !== false;
}

function rebuildCombinedState() {
  const localResults = getLocalResults();
  const cloudEvaluations = cloudItemsCache.filter(isEvaluationActive);
  const cloudAuthorizations = cloudItemsCache.filter(r => r.tipo === 'autorizacion_reintento');

  allAuthorizations = [...cloudAuthorizations, ...serverAuthorizationsCache];

  const combinedMap = new Map();
  serverResultsCache.forEach(r => {
    if (isEvaluationActive(r)) {
      combinedMap.set((r.grado || '3') + '_' + (r.id || r.estudiante_nombre), r);
    }
  });

  localResults.forEach(r => {
    if (isEvaluationActive(r)) {
      const key = (r.grado || '3') + '_' + (r.id || r.estudiante_nombre);
      if (!combinedMap.has(key)) combinedMap.set(key, r);
    }
  });

  cloudEvaluations.forEach(r => {
    const key = (r.grado || '3') + '_' + (r.id || r.estudiante_nombre);
    combinedMap.set(key, r);
  });

  // Si hay una autorización activa para un estudiante EN ESE GRADO, remover resultado viejo no posterior
  allAuthorizations.forEach(auth => {
    if (auth.activo) {
      const authName = cleanStudentName(auth.estudiante_nombre);
      const authGrade = auth.grado ? Number(auth.grado) : null;
      const authTs = Number(auth.autorizado_timestamp) || 0;
      for (const [k, v] of combinedMap.entries()) {
        const resGrade = Number(v.grado || 3);
        const resTs = Number(v.completado_timestamp) || 0;
        if (
          cleanStudentName(v.estudiante_nombre) === authName &&
          (!authGrade || resGrade === authGrade) &&
          resTs <= authTs
        ) {
          combinedMap.delete(k);
        }
      }
    }
  });

  if (window.MEDUCA_CATALOGO) {
    enabledTestsMap = window.MEDUCA_CATALOGO.syncEnabledFromCloudItems(cloudItemsCache, catalogData);
  }
  allResults = Array.from(combinedMap.values());
  renderDocenteVerticalGrades();
  renderEnabledQuickBar();
  renderDocenteAreasBar();
  renderLessonsQrSection();
  calculateAndRenderStats();
  renderTable();
}

async function loadData() {
  try {
    // 1. Cargar lista oficial de estudiantes
    try {
      const resEst = await fetch('/api/estudiantes');
      if (resEst.ok) allStudents = await resEst.json();
      else throw new Error();
    } catch {
      const resStatic = await fetch('./data/estudiantes.json');
      allStudents = await resStatic.json();
    }

    // 2. Cargar resultados de servidor local (si existe)
    serverResultsCache = [];
    serverAuthorizationsCache = [];
    try {
      const resRes = await fetch('/api/resultados');
      if (resRes.ok) {
        const data = await resRes.json();
        serverResultsCache = data.resultados || [];
        serverAuthorizationsCache = data.autorizaciones || [];
      }
    } catch {}

    // 3. Cargar resultados de Firestore (requiere docente autenticado con Google)
    cloudItemsCache = [];
    hasCloudError = false;
    cloudErrorMessage = '';

    const banner = document.getElementById('cloudStatusBanner');
    const bannerMsg = document.getElementById('cloudStatusMessage');

    if (window.MEDUCA_FIREBASE && window.MEDUCA_FIREBASE.isAvailable()) {
      if (window.MEDUCA_FIREBASE.isTeacherAuthenticated()) {
        const cloudInfo = await window.MEDUCA_FIREBASE.getResultsDetailed();
        if (cloudInfo.ok) {
          cloudItemsCache = cloudInfo.items;
          if (banner) banner.style.display = 'none';
        } else {
          hasCloudError = true;
          cloudErrorMessage = cloudInfo.code === 'permission-denied'
            ? 'Tu sesión de Google no tiene permisos para leer Firestore. Verifica que iniciaste sesión con civanp004@gmail.com.'
            : `No se pudieron cargar los resultados de Firebase (${cloudInfo.code}). Mostrando datos locales disponibles.`;
          if (banner && bannerMsg) {
            bannerMsg.textContent = cloudErrorMessage;
            banner.style.display = 'flex';
          }
        }
      } else {
        hasCloudError = true;
        cloudErrorMessage = 'Inicia sesión con Google (civanp004@gmail.com) para cargar los resultados almacenados en Firebase.';
        if (banner && bannerMsg && isTeacherUnlockedLocally()) {
          bannerMsg.textContent = cloudErrorMessage;
          banner.style.display = 'flex';
        }
      }
    }

    rebuildCombinedState();
  } catch (err) {
    console.error('Error cargando datos:', err);
  }
}

function findStudentAttempts(student) {
  const sNameClean = cleanStudentName(student.nombre);
  const matches = allResults.filter(r =>
    ((Number(r.grado) === Number(student.grado)) || (!r.grado && Number(student.grado) === 3)) && (
      (r.estudiante_id && r.estudiante_id === student.id) ||
      (r.estudiante_nombre && cleanStudentName(r.estudiante_nombre) === sNameClean)
    )
  );
  // Conservar orden cronológico ascendente: el primer examen enviado es la calificación oficial (único intento)
  matches.sort((a, b) => (Number(a.completado_timestamp) || 0) - (Number(b.completado_timestamp) || 0));
  return matches;
}

function getStudentRows() {
  return allStudents.map(student => {
    const attempts = findStudentAttempts(student);
    return {
      student,
      result: attempts.length > 0 ? attempts[0] : null,
      attempts
    };
  });
}

function calculateAndRenderStats() {
  const gradeSel = document.getElementById('gradeFilterSelect')?.value || 'todos';
  const groupSel = document.getElementById('groupFilterSelect')?.value || 'todos';

  let rows = getStudentRows();

  if (gradeSel !== 'todos') {
    const gNum = parseInt(gradeSel, 10);
    rows = rows.filter(item => item.student.grado === gNum);
  }

  if (groupSel !== 'todos') {
    rows = rows.filter(item => item.student.grupo === groupSel);
  }

  const totalEst = rows.length;
  const completedRows = rows.filter(item => Boolean(item.result));
  const realizadas = completedRows.length;
  const pendientes = Math.max(0, totalEst - realizadas);

  let sumaNotas = 0;
  let sumaTiempo = 0;

  completedRows.forEach(({ result: r }) => {
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

function getFilteredRows() {
  const search = (document.getElementById('searchInput').value || '').toLowerCase().trim();
  const gradeFilter = document.getElementById('gradeFilterSelect').value;
  const statusFilter = document.getElementById('statusFilter').value;
  const groupFilter = document.getElementById('groupFilterSelect').value;

  return getStudentRows().filter(item => {
    const s = item.student;
    if (gradeFilter !== 'todos' && s.grado !== parseInt(gradeFilter, 10)) return false;

    const matchSearch = (s.nombre || '').toLowerCase().includes(search) ||
                        (s.apellidos || '').toLowerCase().includes(search) ||
                        (s.nombres || '').toLowerCase().includes(search);
    if (!matchSearch) return false;

    if (statusFilter === 'realizadas' && !item.result) return false;
    if (statusFilter === 'pendientes' && item.result) return false;

    if (groupFilter !== 'todos' && s.grupo !== groupFilter) return false;

    return true;
  });
}

function renderTable() {
  const tbody = document.getElementById('resultsTableBody');
  tbody.innerHTML = '';

  const filtered = getFilteredRows();

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 24px; color: #6b7280;">No se encontraron registros con los filtros seleccionados</td></tr>`;
    return;
  }

  filtered.forEach((item, idx) => {
    const tr = document.createElement('tr');
    const { student, result, attempts } = item;
    let gradoBadge = `<span style="background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 999px; font-weight: 800; font-size: 0.78rem;">3er Grado</span>`;
    if (student.grado === 4) {
      gradoBadge = `<span style="background: #ffedd5; color: #c2410c; padding: 2px 8px; border-radius: 999px; font-weight: 800; font-size: 0.78rem;">4° Grado</span>`;
    } else if (student.grado === 5) {
      gradoBadge = `<span style="background: #dbeafe; color: #1e40af; padding: 2px 8px; border-radius: 999px; font-weight: 800; font-size: 0.78rem;">5° Grado</span>`;
    } else if (student.grado === 6) {
      gradoBadge = `<span style="background: #f3e8ff; color: #7c3aed; padding: 2px 8px; border-radius: 999px; font-weight: 800; font-size: 0.78rem;">6° Grado</span>`;
    }

    const sNameClean = cleanStudentName(student.nombre);
    const activeAuth = allAuthorizations.find(a =>
      a.activo &&
      a.estudiante_nombre &&
      cleanStudentName(a.estudiante_nombre) === sNameClean &&
      (!a.grado || Number(a.grado) === Number(student.grado))
    );

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

      const dupBadge = attempts.length > 1
        ? `<div style="margin-top: 4px;"><span style="background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; padding: 2px 7px; border-radius: 999px; font-size: 0.74rem; font-weight: 700;" title="Se muestra únicamente el 1er intento oficial. Haz clic en Ver para revisar envíos extra.">⚠️ ${attempts.length} envíos (1° oficial)</span></div>`
        : '';

      tr.innerHTML = `
        <td style="font-weight: 700; color: #64748b;">${idx + 1}</td>
        <td>${gradoBadge}</td>
        <td>
          <strong>${escapeHtml(student.nombre_simple || student.nombre)}</strong>
          <span class="group-pill">${escapeHtml(student.grupo_label || student.grupo)}</span>
          ${dupBadge}
        </td>
        <td><span style="background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 999px; font-size: 0.82rem; font-weight: 700;">✅ Realizada</span></td>
        <td>${escapeHtml(result.completado_at || '-')}</td>
        <td style="font-family: monospace; font-weight: 700; color: #92400e;">⏱️ ${escapeHtml(result.duracion_formato || '-')}</td>
        <td><strong>${result.puntos_obtenidos}</strong> / ${result.puntos_totales}</td>
        <td>
          <span style="background: ${badgeColor}; color: ${textColor}; padding: 4px 12px; border-radius: 999px; font-weight: 800; font-size: 1.05rem;">
            ${Number(result.nota_meduca).toFixed(1)}
          </span>
        </td>
        <td>
          <button type="button" class="btn-secondary btn-view-detail" data-result-id="${escapeHtml(result.id)}" data-student-id="${escapeHtml(student.id)}" data-grado="${student.grado}" style="margin-right: 6px;">
            👁️ Ver
          </button>
          <button type="button" class="btn-danger btn-reset-attempt" data-result-id="${escapeHtml(result.id)}" data-student-id="${escapeHtml(student.id)}" data-student-name="${escapeHtml(student.nombre)}" data-grado="${student.grado}" title="Autorizar nueva oportunidad y archivar nota">
            🔄 Dar Oportunidad
          </button>
        </td>
      `;
    } else if (activeAuth) {
      const code = computeRetakeCode(student.id, student.grado);
      tr.innerHTML = `
        <td style="font-weight: 700; color: #64748b;">${idx + 1}</td>
        <td>${gradoBadge}</td>
        <td>
          <strong>${escapeHtml(student.nombre_simple || student.nombre)}</strong>
          <span class="group-pill" style="opacity: 0.9;">${escapeHtml(student.grupo_label || student.grupo)}</span>
        </td>
        <td><span style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 4px 10px; border-radius: 999px; font-size: 0.82rem; font-weight: 700;">🔄 Oportunidad Autorizada</span></td>
        <td><span style="color: #2563eb; font-size: 0.82rem; font-weight: 600;" title="Fecha y hora de autorización">📅 ${escapeHtml(activeAuth.autorizado_at)}</span></td>
        <td style="color: #475569; font-size: 0.82rem;">Código tablet: <strong style="font-family: monospace; color: #1d4ed8;">${code}</strong></td>
        <td style="color: #94a3b8;">-</td>
        <td><span style="background: #f1f5f9; color: #475569; padding: 3px 8px; border-radius: 6px; font-size: 0.82rem; font-weight: 600;">Autorizado</span></td>
        <td>
          <button type="button" class="btn-secondary btn-reset-attempt" data-result-id="" data-student-id="${escapeHtml(student.id)}" data-student-name="${escapeHtml(student.nombre)}" data-grado="${student.grado}" title="Actualizar autorización y ver código">
            🔄 Ver Código / Renovar
          </button>
        </td>
      `;
    } else {
      tr.innerHTML = `
        <td style="font-weight: 700; color: #64748b;">${idx + 1}</td>
        <td>${gradoBadge}</td>
        <td>
          <strong>${escapeHtml(student.nombre_simple || student.nombre)}</strong>
          <span class="group-pill" style="opacity: 0.7;">${escapeHtml(student.grupo_label || student.grupo)}</span>
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
  updateGroupFilterOptions();
  document.getElementById('searchInput').addEventListener('input', renderTable);
  document.getElementById('gradeFilterSelect').addEventListener('change', (e) => {
    selectDocenteGrade(e.target.value, false);
  });

  const showAllBtn = document.getElementById('showAllGradesBtn');
  if (showAllBtn) {
    showAllBtn.addEventListener('click', () => selectDocenteGrade('todos', true));
  }

  const backToGradesBtn = document.getElementById('backToGradesBtn');
  if (backToGradesBtn) {
    backToGradesBtn.addEventListener('click', () => showGradesOverviewView(true));
  }

  const verticalGrades = document.getElementById('docenteGradesVertical');
  if (verticalGrades) {
    verticalGrades.addEventListener('click', (e) => {
      const btn = e.target.closest('.docente-grade-btn');
      if (btn) {
        selectDocenteGrade(btn.dataset.gradeChoice, true);
      }
    });
  }

  const areasBar = document.getElementById('docenteAreasFilterBar');
  if (areasBar) {
    areasBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.docente-area-chip-btn');
      if (btn && !btn.disabled) {
        selectDocenteArea(btn.dataset.areaChoice || 'todas', false);
      }
    });
  }

  const deployedBox = document.getElementById('lessonsLinksContainer');
  if (deployedBox) {
    deployedBox.addEventListener('click', (e) => {
      const qrBtn = e.target.closest('.btn-qr-action');
      if (qrBtn) {
        openQrModal(qrBtn.dataset.qrId || Number(qrBtn.dataset.qrGrade));
        return;
      }
      const previewBtn = e.target.closest('.btn-preview-exam');
      if (previewBtn) {
        openExamPreviewModal(previewBtn.dataset.examId || Number(previewBtn.dataset.examGrade));
      }
    });
    deployedBox.addEventListener('change', (e) => {
      const chk = e.target.closest('.test-clip-checkbox');
      if (chk) {
        handleTestClipToggle(chk.dataset.clipTestId, chk.checked);
      }
    });
  }

  const quickListBox = document.getElementById('enabledTestsQuickList');
  if (quickListBox) {
    quickListBox.addEventListener('click', (e) => {
      const qrBtn = e.target.closest('.btn-qr-action');
      if (qrBtn) {
        openQrModal(qrBtn.dataset.qrId || Number(qrBtn.dataset.qrGrade));
        return;
      }
      const previewBtn = e.target.closest('.btn-preview-exam');
      if (previewBtn) {
        openExamPreviewModal(previewBtn.dataset.examId || Number(previewBtn.dataset.examGrade));
      }
    });
    quickListBox.addEventListener('change', (e) => {
      const chk = e.target.closest('.test-clip-checkbox');
      if (chk) {
        handleTestClipToggle(chk.dataset.clipTestId, chk.checked);
      }
    });
  }

  const btnAllCreated = document.getElementById('filterAllCreatedBtn');
  const btnEnabledOnly = document.getElementById('filterEnabledOnlyBtn');
  const btnResetArea = document.getElementById('resetAreaFilterBtn');
  if (btnAllCreated) {
    btnAllCreated.addEventListener('click', () => {
      showOnlyEnabledTests = false;
      renderLessonsQrSection();
    });
  }
  if (btnEnabledOnly) {
    btnEnabledOnly.addEventListener('click', () => {
      showOnlyEnabledTests = true;
      renderLessonsQrSection();
    });
  }
  if (btnResetArea) {
    btnResetArea.addEventListener('click', () => selectDocenteArea('todas', false));
  }
  document.getElementById('statusFilter').addEventListener('change', renderTable);
  document.getElementById('groupFilterSelect').addEventListener('change', () => {
    calculateAndRenderStats();
    renderTable();
  });
  document.getElementById('refreshBtn').addEventListener('click', loadData);
  document.getElementById('exportCsvBtn').addEventListener('click', exportResultsCsv);

  // Delegación segura para botones de la tabla
  document.getElementById('resultsTableBody').addEventListener('click', (e) => {
    const viewBtn = e.target.closest('.btn-view-detail');
    if (viewBtn) {
      viewDetail(viewBtn.dataset.resultId, viewBtn.dataset.studentId, Number(viewBtn.dataset.grado));
      return;
    }
    const resetBtn = e.target.closest('.btn-reset-attempt');
    if (resetBtn) {
      resetAttempt(
        resetBtn.dataset.resultId || null,
        resetBtn.dataset.studentId,
        resetBtn.dataset.studentName,
        Number(resetBtn.dataset.grado)
      );
    }
  });

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
  } else if (g === '5') {
    sel.innerHTML = `
      <option value="todos">Todos los salones de 5°</option>
      <option value="5A">Salón 5°A</option>
      <option value="5B">Salón 5°B</option>
      <option value="5C">Salón 5°C</option>
    `;
  } else if (g === '6') {
    sel.innerHTML = `
      <option value="todos">Todos los salones de 6°</option>
      <option value="6A">Salón 6°A</option>
      <option value="6B">Salón 6°B</option>
      <option value="6C">Salón 6°C</option>
    `;
  } else {
    sel.innerHTML = `
      <option value="todos">Todos los salones (3°, 4°, 5° y 6°)</option>
      <option value="3A">Salón 3°A</option>
      <option value="3B">Salón 3°B</option>
      <option value="3C">Salón 3°C</option>
      <option value="4A">Salón 4°A</option>
      <option value="4B">Salón 4°B</option>
      <option value="4C">Salón 4°C</option>
      <option value="5A">Salón 5°A</option>
      <option value="5B">Salón 5°B</option>
      <option value="5C">Salón 5°C</option>
      <option value="6A">Salón 6°A</option>
      <option value="6B">Salón 6°B</option>
      <option value="6C">Salón 6°C</option>
    `;
  }
}

function csvCell(val) {
  return `"${String(val ?? '').replace(/"/g, '""')}"`;
}

function exportResultsCsv() {
  const targetRows = getFilteredRows().filter(item => Boolean(item.result));

  if (targetRows.length === 0) {
    alert('No hay evaluaciones realizadas con los filtros actuales para exportar.');
    return;
  }

  let csv = '\uFEFF';
  csv += 'N°,Grado,Salón,Estudiante,Fecha y Hora,Tiempo Empleado,Puntos,Total Posible,Nota MEDUCA,Nivel,Parte A,Parte B,Parte C,Parte D,Parte E\n';

  targetRows.forEach(({ student, result: r }, idx) => {
    const ptsA = r.detalles?.parte_a?.puntos ?? '-';
    const ptsB = r.detalles?.parte_b?.puntos ?? '-';
    const ptsC = r.detalles?.parte_c?.puntos ?? '-';
    const ptsD = r.detalles?.parte_d?.puntos ?? '-';
    const ptsE = r.detalles?.parte_e?.puntos ?? '-';
    const grado = r.grado ? `${r.grado}°` : `${student.grado || 3}°`;
    const grupo = r.grupo || student.grupo || '';

    csv += [
      csvCell(idx + 1),
      csvCell(grado),
      csvCell(grupo),
      csvCell(r.estudiante_nombre),
      csvCell(r.completado_at),
      csvCell(r.duracion_formato),
      r.puntos_obtenidos ?? '',
      r.puntos_totales ?? '',
      r.nota_meduca ?? '',
      csvCell(r.desempeno),
      ptsA,
      ptsB,
      ptsC,
      ptsD,
      ptsE
    ].join(',') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Resultados_Evaluaciones_MEDUCA_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function resetAttempt(resultId, studentId, studentName, grado) {
  if (window.MEDUCA_FIREBASE && window.MEDUCA_FIREBASE.isAvailable() && !window.MEDUCA_FIREBASE.isTeacherAuthenticated()) {
    alert('🔐 Primero debes iniciar sesión con Google (civanp004@gmail.com) para autorizar reintentos en Firebase.');
    return;
  }

  const confirmReset = confirm(`¿Estás seguro de que deseas autorizar una NUEVA OPORTUNIDAD a "${studentName}" (${grado}° grado)?\n\n📌 Se registrará en la base de datos con la fecha y hora exacta actual y archivará su nota previa.`);
  if (!confirmReset) return;

  // 1. Limpiar localStorage local del docente si aplica
  try {
    const key = `meduca_agri_eval_${grado}to_grado`;
    const local = JSON.parse(localStorage.getItem(key) || '[]');
    const updated = local.filter(r => r.id !== resultId && cleanStudentName(r.estudiante_nombre) !== cleanStudentName(studentName));
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (e) {
    console.warn(e);
  }

  // 2. Registrar en Firestore con fecha, hora y archivar intento del mismo grado
  if (window.MEDUCA_FIREBASE && window.MEDUCA_FIREBASE.authorizeRetake) {
    const authRes = await window.MEDUCA_FIREBASE.authorizeRetake(studentName, grado);
    if (!authRes.ok) {
      alert(`❌ No se pudo registrar la autorización en Firebase:\n${authRes.message}`);
      return;
    }
  }

  // 3. Registrar en servidor local (si se usa server.js)
  try {
    await fetch('/api/resultados/reiniciar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: resultId, estudiante_nombre: studentName, grado: grado })
    });
  } catch {}

  const unlockCode = computeRetakeCode(studentId, grado);
  const lesson = LESSONS_DATA.find(l => l.grado === Number(grado));
  const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
  const directUnlockUrl = lesson
    ? `${baseUrl}${lesson.slug}?est=${encodeURIComponent(studentId)}&reintento=${encodeURIComponent(unlockCode)}`
    : '';

  alert(
    `✅ Oportunidad autorizada para:\n"${studentName}" (${grado}° grado).\n\n` +
    `🔑 Código de desbloqueo (si el estudiante usa la misma tablet/celular): ${unlockCode}\n` +
    (directUnlockUrl ? `\n🔗 Enlace directo de reintento:\n${directUnlockUrl}` : '')
  );
  await loadData();
}

function viewDetail(resultId, studentId, grado) {
  let res = allResults.find(r => r.id === resultId);
  let student = allStudents.find(s => s.id === studentId && Number(s.grado) === Number(grado));
  let attempts = student ? findStudentAttempts(student) : (res ? [res] : []);
  if (!res && attempts.length > 0) res = attempts[0];
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

  const maxPtsA = (d.parte_a?.items || []).reduce((acc, it) => acc + (it.id === 'a2' && String(it.respuesta_esperada || '').includes(',') ? 3 : 1), 0);
  const maxPtsB = (d.parte_b?.items || []).length;
  const maxPtsC = (d.parte_c?.items || []).length;
  const maxPtsD = (d.parte_d?.items || []).length;
  const maxPtsE = (d.parte_e?.items || []).length;

  // Parte A
  let html = `
    <div style="margin-bottom: 20px;">
      <h4 style="color: #166534; border-bottom: 2px solid #86efac; padding-bottom: 4px; margin-bottom: 10px;">
        Parte A. Completa (${d.parte_a.puntos} de ${maxPtsA || d.parte_a.puntos} pts)
      </h4>
      <ul style="list-style: none; padding-left: 0;">
  `;
  (d.parte_a.items || []).forEach(item => {
    const icon = item.es_correcta ? '✅' : '❌';
    html += `
      <li style="padding: 6px 0; border-bottom: 1px solid #f1f5f9;">
        ${icon} <strong>Ítem ${item.numero}:</strong> Respuesta dada: <em>"${escapeHtml(item.respuesta_dada)}"</em> 
        ${!item.es_correcta ? `<span style="color: #15803d; font-weight: 700;">(Esperada: ${escapeHtml(item.respuesta_esperada)})</span>` : ''}
      </li>
    `;
  });
  html += `</ul></div>`;

  // Parte B
  html += `
    <div style="margin-bottom: 20px;">
      <h4 style="color: #166534; border-bottom: 2px solid #86efac; padding-bottom: 4px; margin-bottom: 10px;">
        Parte B. Selección Múltiple (${d.parte_b.puntos} de ${maxPtsB} pts)
      </h4>
      <ul style="list-style: none; padding-left: 0;">
  `;
  (d.parte_b.items || []).forEach(item => {
    const icon = item.es_correcta ? '✅' : '❌';
    html += `
      <li style="padding: 6px 0; border-bottom: 1px solid #f1f5f9;">
        ${icon} <strong>Pregunta ${item.numero}:</strong> Opción elegida: <strong>${escapeHtml((item.respuesta_dada || '').toUpperCase())}</strong>
        ${!item.es_correcta ? `<span style="color: #15803d; font-weight: 700;">(Correcta: ${escapeHtml((item.respuesta_esperada || '').toUpperCase())})</span>` : ''}
      </li>
    `;
  });
  html += `</ul></div>`;

  // Parte C
  html += `
    <div style="margin-bottom: 20px;">
      <h4 style="color: #166534; border-bottom: 2px solid #86efac; padding-bottom: 4px; margin-bottom: 10px;">
        Parte C. Verdadero o Falso (${d.parte_c.puntos} de ${maxPtsC} pts)
      </h4>
      <ul style="list-style: none; padding-left: 0;">
  `;
  (d.parte_c.items || []).forEach(item => {
    const icon = item.es_correcta ? '✅' : '❌';
    html += `
      <li style="padding: 6px 0; border-bottom: 1px solid #f1f5f9;">
        ${icon} <strong>Ítem ${item.numero}:</strong> Marcó: <strong>${escapeHtml(item.respuesta_dada)}</strong>
        ${!item.es_correcta ? `<span style="color: #15803d; font-weight: 700;">(Correcta: ${escapeHtml(item.respuesta_esperada)})</span>` : ''}
      </li>
    `;
  });
  html += `</ul></div>`;

  // Parte D
  html += `
    <div style="margin-bottom: 20px;">
      <h4 style="color: #166534; border-bottom: 2px solid #86efac; padding-bottom: 4px; margin-bottom: 10px;">
        Parte D. Relaciona (${d.parte_d.puntos} de ${maxPtsD} pts)
      </h4>
      <ul style="list-style: none; padding-left: 0;">
  `;
  (d.parte_d.items || []).forEach(item => {
    const icon = item.es_correcta ? '✅' : '❌';
    html += `
      <li style="padding: 6px 0; border-bottom: 1px solid #f1f5f9;">
        ${icon} <strong>${item.numero}. ${escapeHtml(item.termino)}:</strong> Relacionado con: <strong>${escapeHtml(item.respuesta_dada)}</strong>
        ${!item.es_correcta ? `<span style="color: #15803d; font-weight: 700;">(Correcta: ${escapeHtml(item.respuesta_esperada)})</span>` : ''}
      </li>
    `;
  });
  html += `</ul></div>`;

  // Parte E
  if (d.parte_e?.items && d.parte_e.items.length > 0) {
    const isClasificacion = Number(res.grado) === 6 || Boolean(d.parte_e.items.some(i => i.respuesta_esperada));
    const titleE = isClasificacion
      ? `Parte E. Clasificación (${d.parte_e.puntos} de ${maxPtsE} pts)`
      : `Parte E. Respuesta Corta (${d.parte_e.puntos} de ${maxPtsE} pts)`;

    html += `
      <div style="margin-bottom: 20px;">
        <h4 style="color: #166534; border-bottom: 2px solid #86efac; padding-bottom: 4px; margin-bottom: 10px;">
          ${titleE}
        </h4>
        <ul style="list-style: none; padding-left: 0;">
    `;
    d.parte_e.items.forEach(item => {
      if (isClasificacion) {
        const icon = item.es_correcta ? '✅' : '❌';
        html += `
          <li style="padding: 6px 0; border-bottom: 1px solid #f1f5f9;">
            ${icon} <strong>Ítem ${item.numero} (${escapeHtml(item.enunciado)}):</strong>
            Clasificó: <strong>${escapeHtml(item.respuesta_dada)}</strong>
            ${!item.es_correcta && item.respuesta_esperada ? `<span style="color: #15803d; font-weight: 700;">(Correcta: ${escapeHtml(item.respuesta_esperada)})</span>` : ''}
          </li>
        `;
      } else {
        const icon = item.es_correcta ? '✅' : '⚠️';
        html += `
          <li style="padding: 8px 0; border-bottom: 1px solid #f1f5f9;">
            ${icon} <strong>Pregunta ${item.numero} (${escapeHtml(item.enunciado)}):</strong><br>
            <div style="background: #f8fafc; padding: 8px 12px; border-left: 3px solid #22c55e; margin-top: 4px; font-style: italic;">
              "${escapeHtml(item.respuesta_dada)}"
            </div>
          </li>
        `;
      }
    });
    html += `</ul></div>`;
  }

  // Mostrar envíos duplicados si los hay, permitiendo archivar los sobrantes
  if (attempts.length > 1) {
    html += `
      <div style="margin-top: 16px; padding: 12px 14px; background: #fffbeb; border: 1.5px solid #fcd34d; border-radius: 10px;">
        <h4 style="color: #92400e; margin-bottom: 6px;">⚠️ Envíos duplicados detectados (${attempts.length})</h4>
        <p style="font-size: 0.85rem; color: #78350f; margin-bottom: 10px;">
          Se conserva como calificación oficial el <strong>primer envío</strong>. Los intentos adicionales no autorizados pueden archivarse:
        </p>
        <ul style="list-style: none; padding-left: 0; font-size: 0.88rem;">
          ${attempts.slice(1).map((dup, i) => `
            <li style="display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 6px 0; border-top: 1px dashed #fde68a;">
              <span>Intento extra #${i + 2}: <strong>${dup.completado_at}</strong> — Nota ${Number(dup.nota_meduca).toFixed(1)} (${dup.puntos_obtenidos}/${dup.puntos_totales})</span>
              <button type="button" class="btn-danger btn-archive-dup" data-dup-id="${escapeHtml(dup.id)}" style="padding: 4px 10px; font-size: 0.78rem;">Archivar</button>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  body.innerHTML = html;

  body.querySelectorAll('.btn-archive-dup').forEach(btn => {
    btn.addEventListener('click', async () => {
      const dupId = btn.dataset.dupId;
      if (!confirm('¿Archivar este envío duplicado para conservar únicamente el primer examen?')) return;
      btn.disabled = true;
      btn.textContent = 'Archivando...';
      if (window.MEDUCA_FIREBASE && window.MEDUCA_FIREBASE.archiveResult) {
        const out = await window.MEDUCA_FIREBASE.archiveResult(dupId, 'Segundo intento no autorizado; se conserva primer examen');
        if (out.ok) {
          modal.classList.remove('active');
          await loadData();
        } else {
          alert(out.message || 'No se pudo archivar el duplicado.');
          btn.disabled = false;
          btn.textContent = 'Archivar';
        }
      }
    });
  });

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
    if (!res.ok) throw new Error('Endpoint no disponible');
    const data = await res.json();
    if (data.exito) {
      alert('¡Lista actualizada exitosamente!');
      document.getElementById('rosterModal').classList.remove('active');
      await loadData();
    }
  } catch {
    alert('Nota: En modo estático/GitHub Pages, edita el archivo data/estudiantes.json.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 Guardar Cambios';
  }
}

function stopFirestoreRealtimeListener() {
  if (typeof firestoreUnsubscribe === 'function') {
    try { firestoreUnsubscribe(); } catch {}
    firestoreUnsubscribe = null;
  }
}

function setupFirestoreRealtimeListener() {
  stopFirestoreRealtimeListener();
  if (
    window.MEDUCA_FIREBASE &&
    window.MEDUCA_FIREBASE.listenResults &&
    window.MEDUCA_FIREBASE.isTeacherAuthenticated()
  ) {
    firestoreUnsubscribe = window.MEDUCA_FIREBASE.listenResults((cloudItems) => {
      console.log('⚡ Actualización en tiempo real desde Firestore:', cloudItems.length, 'registros.');
      cloudItemsCache = cloudItems;
      hasCloudError = false;
      const banner = document.getElementById('cloudStatusBanner');
      if (banner) banner.style.display = 'none';
      rebuildCombinedState();
    }, (err) => {
      hasCloudError = true;
      cloudErrorMessage = err?.code === 'permission-denied'
        ? 'Sesión sin permisos para escuchar Firestore. Inicia sesión con civanp004@gmail.com.'
        : 'Se perdió la conexión en tiempo real con Firestore.';
      const banner = document.getElementById('cloudStatusBanner');
      const bannerMsg = document.getElementById('cloudStatusMessage');
      if (banner && bannerMsg) {
        bannerMsg.textContent = cloudErrorMessage;
        banner.style.display = 'flex';
      }
    });
  }
}
