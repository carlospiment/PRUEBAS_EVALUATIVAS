/* ===================================================
   CATÁLOGO CURRICULAR DE AGRICULTURA (OBSIDIAN -> APP)
   Ordenamiento automático por Grado -> Área (1..4) -> Lección
   y gestión de pruebas habilitadas ("clip de selección")
   =================================================== */

(function () {
  const ENABLED_STORAGE_KEY = 'meduca_enabled_tests_v1';

  const FALLBACK_CATALOG = {
    version: '2026-11-25',
    areas: [
      { numero: 1, id: 'area-1', nombre: 'Jardín y especies vegetales', icono: '🌺', color: '#db2777', softBg: '#fdf2f8' },
      { numero: 2, id: 'area-2', nombre: 'Tecnología práctica y funcional', icono: '🛠️', color: '#0284c7', softBg: '#e0f2fe' },
      { numero: 3, id: 'area-3', nombre: 'Producción de alimentos para consumo humano', icono: '🥬', color: '#15803d', softBg: '#dcfce7' },
      { numero: 4, id: 'area-4', nombre: 'Ambiente y Agricultura Sostenible', icono: '🌎', color: '#0d9488', softBg: '#ccfbf1' }
    ],
    grados: [
      { grado: 3, nombre: 'Tercer Grado', icono: '🌿', color: '#15803d', badgeBg: '#dcfce7', badgeColor: '#166534', softBg: '#f0fdf4' },
      { grado: 4, nombre: 'Cuarto Grado', icono: '🥕', color: '#ea580c', badgeBg: '#ffedd5', badgeColor: '#c2410c', softBg: '#fff7ed' },
      { grado: 5, nombre: 'Quinto Grado', icono: '🌽', color: '#1e40af', badgeBg: '#dbeafe', badgeColor: '#1e40af', softBg: '#eff6ff' },
      { grado: 6, nombre: 'Sexto Grado', icono: '🍅', color: '#7c3aed', badgeBg: '#ede9fe', badgeColor: '#5b21b6', softBg: '#f5f3ff' }
    ],
    lecciones_programa: {},
    pruebas: [
      {
        id: 'eval-agri-3-3-1',
        grado: 3,
        area: 3,
        leccion: '3.3.1',
        codigo: 'Lección 3.3.1',
        titulo: 'El huerto escolar, la salud y la nutrición',
        puntos: 19,
        slug: 'tercer_grado.html',
        jsonPath: './data/prueba_3ro.json',
        habilitada_por_defecto: true
      },
      {
        id: 'eval-agri-4-3-1',
        grado: 4,
        area: 3,
        leccion: '4.3.1',
        codigo: 'Lección 4.3.1',
        titulo: 'Beneficios e importancia del huerto escolar',
        puntos: 24,
        slug: 'cuarto_grado.html',
        jsonPath: './data/prueba_4to.json',
        habilitada_por_defecto: true
      },
      {
        id: 'eval-agri-5-3-1',
        grado: 5,
        area: 3,
        leccion: '5.3.1',
        codigo: 'Lección 5.3.1',
        titulo: 'Métodos modernos de producción',
        puntos: 31,
        slug: 'quinto_grado.html',
        jsonPath: './data/prueba_5to.json',
        habilitada_por_defecto: true
      },
      {
        id: 'eval-agri-6-3-1',
        grado: 6,
        area: 3,
        leccion: '6.3.1',
        codigo: 'Lección 6.3.1',
        titulo: 'Destino de la producción agrícola',
        puntos: 32,
        slug: 'sexto_grado.html',
        jsonPath: './data/prueba_6to.json',
        habilitada_por_defecto: true
      }
    ]
  };

  let cachedCatalog = null;

  function parseLessonTuple(leccionStr) {
    const parts = String(leccionStr || '').match(/\d+/g);
    if (!parts) return [999, 999, 999];
    return parts.map((n) => parseInt(n, 10) || 0);
  }

  function compareLessonTuples(aStr, bStr) {
    const a = parseLessonTuple(aStr);
    const b = parseLessonTuple(bStr);
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const av = a[i] ?? 0;
      const bv = b[i] ?? 0;
      if (av !== bv) return av - bv;
    }
    return 0;
  }

  function sortTests(pruebas) {
    return [...(pruebas || [])].sort((a, b) => {
      const gDiff = (Number(a.grado) || 0) - (Number(b.grado) || 0);
      if (gDiff !== 0) return gDiff;
      const aDiff = (Number(a.area) || 0) - (Number(b.area) || 0);
      if (aDiff !== 0) return aDiff;
      const lDiff = compareLessonTuples(a.leccion || a.codigo, b.leccion || b.codigo);
      if (lDiff !== 0) return lDiff;
      return String(a.titulo || '').localeCompare(String(b.titulo || ''), 'es');
    });
  }

  function enrichCatalog(raw) {
    const base = raw && Array.isArray(raw.pruebas) ? raw : FALLBACK_CATALOG;
    const areas = [...(base.areas || FALLBACK_CATALOG.areas)].sort((a, b) => a.numero - b.numero);
    const grados = [...(base.grados || FALLBACK_CATALOG.grados)].sort((a, b) => a.grado - b.grado);
    const areaMap = new Map(areas.map((a) => [Number(a.numero), a]));
    const gradeMap = new Map(grados.map((g) => [Number(g.grado), g]));

    const sortedTests = sortTests(base.pruebas).map((t) => {
      const areaMeta = areaMap.get(Number(t.area)) || areas[2];
      const gradeMeta = gradeMap.get(Number(t.grado)) || grados[0];
      return {
        ...t,
        grado: Number(t.grado),
        area: Number(t.area),
        areaNombre: areaMeta?.nombre || `Área ${t.area}`,
        areaIcono: areaMeta?.icono || '📘',
        areaColor: areaMeta?.color || '#15803d',
        gradoTexto: gradeMeta?.nombre || `${t.grado}° Grado`,
        icono: t.icono || gradeMeta?.icono || '📝',
        color: t.color || gradeMeta?.color || '#15803d',
        badgeBg: gradeMeta?.badgeBg || '#dcfce7',
        badgeColor: gradeMeta?.badgeColor || '#166534',
        softBg: gradeMeta?.softBg || '#f0fdf4'
      };
    });

    return {
      ...base,
      areas,
      grados,
      pruebas: sortedTests
    };
  }

  async function loadCatalog(forceRefresh = false) {
    if (cachedCatalog && !forceRefresh) return cachedCatalog;
    try {
      const res = await fetch('./data/catalogo_pruebas.json');
      if (res.ok) {
        const json = await res.json();
        cachedCatalog = enrichCatalog(json);
        return cachedCatalog;
      }
    } catch {}
    cachedCatalog = enrichCatalog(FALLBACK_CATALOG);
    return cachedCatalog;
  }

  function getAreasForGrade(catalog, gradeFilter = 'todos') {
    const cat = catalog || enrichCatalog(FALLBACK_CATALOG);
    const gNum = gradeFilter === 'todos' ? null : Number(gradeFilter);
    const matchingTests = gNum
      ? cat.pruebas.filter((p) => Number(p.grado) === gNum)
      : cat.pruebas;

    return cat.areas.map((area) => {
      const areaTests = sortTests(matchingTests.filter((p) => Number(p.area) === Number(area.numero)));
      const programLessons = gNum && cat.lecciones_programa?.[String(gNum)]?.[String(area.numero)]
        ? cat.lecciones_programa[String(gNum)][String(area.numero)]
        : [];
      return {
        ...area,
        pruebas: areaTests,
        disponible: areaTests.length > 0,
        leccionesPrograma: programLessons
      };
    });
  }

  function readLocalEnabledMap(catalog) {
    const cat = catalog || cachedCatalog || enrichCatalog(FALLBACK_CATALOG);
    const defaults = {};
    cat.pruebas.forEach((p) => {
      defaults[p.id] = p.habilitada_por_defecto !== false;
    });
    try {
      const raw = localStorage.getItem(ENABLED_STORAGE_KEY);
      if (!raw) return defaults;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return { ...defaults, ...parsed };
      }
    } catch {}
    return defaults;
  }

  function writeLocalEnabledMap(map) {
    try {
      localStorage.setItem(ENABLED_STORAGE_KEY, JSON.stringify(map || {}));
    } catch {}
  }

  function isTestEnabled(testId, catalog) {
    const map = readLocalEnabledMap(catalog);
    return map[testId] !== false;
  }

  async function setTestEnabled(testId, enabled, catalog) {
    const map = readLocalEnabledMap(catalog);
    map[testId] = Boolean(enabled);
    writeLocalEnabledMap(map);
    if (
      window.MEDUCA_FIREBASE &&
      window.MEDUCA_FIREBASE.saveEnabledTestsConfig &&
      window.MEDUCA_FIREBASE.isTeacherAuthenticated &&
      window.MEDUCA_FIREBASE.isTeacherAuthenticated()
    ) {
      await window.MEDUCA_FIREBASE.saveEnabledTestsConfig(map);
    }
    return map;
  }

  function syncEnabledFromCloudItems(cloudItems, catalog) {
    if (!Array.isArray(cloudItems)) return readLocalEnabledMap(catalog);
    const cfg = cloudItems.find((item) => item && (item.id === '__config_pruebas_activas__' || item.tipo === 'config_pruebas_activas'));
    if (cfg && cfg.habilitadas && typeof cfg.habilitadas === 'object') {
      const merged = { ...readLocalEnabledMap(catalog), ...cfg.habilitadas };
      writeLocalEnabledMap(merged);
      return merged;
    }
    return readLocalEnabledMap(catalog);
  }

  window.MEDUCA_CATALOGO = {
    loadCatalog,
    sortTests,
    getAreasForGrade,
    readEnabledMap: readLocalEnabledMap,
    isTestEnabled,
    setTestEnabled,
    syncEnabledFromCloudItems
  };
})();
