/* ===================================================
   NAVEGACIÓN VERTICAL LATERAL Y CAJÓN RESPONSIVO - MEDUCA
   Sidebar fijo en escritorio (>= 900px) y Drawer táctil en móvil (< 900px)
   Agrupa por Grado -> las 4 Áreas del Programa de Agricultura
   =================================================== */

(function () {
  const NAV_GRADES = [
    {
      grado: 3,
      pageKey: 'grade-3',
      title: 'Tercer Grado (3°)',
      subtitle: 'Huerto, salud y entorno',
      icon: '🌿',
      href: './tercer_grado.html',
      accent: '#15803d',
      softBg: '#dcfce7'
    },
    {
      grado: 4,
      pageKey: 'grade-4',
      title: 'Cuarto Grado (4°)',
      subtitle: 'Beneficios y suelo',
      icon: '🥕',
      href: './cuarto_grado.html',
      accent: '#c2410c',
      softBg: '#ffedd5'
    },
    {
      grado: 5,
      pageKey: 'grade-5',
      title: 'Quinto Grado (5°)',
      subtitle: 'Métodos modernos y suelos',
      icon: '🌽',
      href: './quinto_grado.html',
      accent: '#1e40af',
      softBg: '#dbeafe'
    },
    {
      grado: 6,
      pageKey: 'grade-6',
      title: 'Sexto Grado (6°)',
      subtitle: 'Destino, mecánica y orgánico',
      icon: '🍅',
      href: './sexto_grado.html',
      accent: '#6d28d9',
      softBg: '#ede9fe'
    }
  ];

  function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function detectCurrentPageKey() {
    if (document.body?.dataset?.page) return document.body.dataset.page;
    const g = document.body?.dataset?.grade;
    if (g) return `grade-${g}`;
    const p = window.location.pathname.toLowerCase();
    if (p.includes('docente')) return 'docente';
    if (p.includes('tercer')) return 'grade-3';
    if (p.includes('cuarto')) return 'grade-4';
    if (p.includes('quinto')) return 'grade-5';
    if (p.includes('sexto')) return 'grade-6';
    return 'home';
  }

  function buildNavMarkup(currentKey) {
    const isDocente = currentKey === 'docente';

    if (isDocente) {
      return `
        <header class="mobile-topbar">
          <button
            type="button"
            id="drawerOpenBtn"
            class="menu-toggle-btn"
            aria-controls="appNavDrawer"
            aria-expanded="false"
          >
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
            <span>Grados y Áreas</span>
          </button>
          <a href="./index.html" class="mobile-brand-link" data-nav-guard="true">
            <span aria-hidden="true">🌱</span>
            <span>Agricultura • MEDUCA</span>
          </a>
          <a href="./index.html" class="mobile-docente-shortcut" data-nav-guard="true">
            <span aria-hidden="true">🏠</span>
            <span>Inicio</span>
          </a>
        </header>

        <div class="Drawer app-nav-drawer" id="appNavDrawer" aria-label="Menú lateral de grados y áreas">
          <div class="Drawer-scroller">
            <aside class="Drawer-sheet app-sidebar-sheet">
              <div class="sidebar-top-bar">
                <div class="sidebar-brand">
                  <div class="sidebar-brand-logo" aria-hidden="true">🌱</div>
                  <div>
                    <div class="sidebar-brand-title">Agricultura</div>
                    <div class="sidebar-brand-sub">MEDUCA • 3° a 6° Grado</div>
                  </div>
                </div>
                <button type="button" id="drawerCloseBtn" class="drawer-close-btn" aria-label="Cerrar menú" autofocus>
                  ✕
                </button>
              </div>

              <nav class="sidebar-nav" aria-label="Principal">
                <div class="nav-section-group">
                  <ul class="nav-vertical-list" role="list">
                    <li>
                      <a href="./index.html" class="nav-item-link" data-nav-guard="true">
                        <span class="nav-item-icon" aria-hidden="true">🏠</span>
                        <span class="nav-item-text">
                          <strong>Vista de Inicio</strong>
                          <small>Cambiar acceso o cuenta</small>
                        </span>
                      </a>
                    </li>
                    <li>
                      <button type="button" class="nav-item-btn nav-docente-grade-btn is-selected" data-docente-grade="todos" aria-pressed="true" style="--nav-accent: #1e40af; --nav-soft: #dbeafe;">
                        <span class="nav-item-icon" aria-hidden="true">📊</span>
                        <span class="nav-item-text">
                          <strong>Todos los Grados</strong>
                          <small>Resumen general (3° a 6°)</small>
                        </span>
                      </button>
                    </li>
                  </ul>
                </div>

                <div class="nav-section-group" id="navDocenteGradesGroup">
                  <div class="nav-section-label">1. Selecciona un Grado</div>
                  <ul class="nav-vertical-list" role="list">
                    ${NAV_GRADES.map((g) => `
                      <li>
                        <button
                          type="button"
                          class="nav-item-btn nav-docente-grade-btn"
                          data-docente-grade="${g.grado}"
                          aria-pressed="false"
                          style="--nav-accent: ${g.accent}; --nav-soft: ${g.softBg};"
                        >
                          <span class="nav-item-icon" aria-hidden="true">${g.icon}</span>
                          <span class="nav-item-text">
                            <strong>${g.title}</strong>
                            <small>${g.subtitle}</small>
                          </span>
                        </button>
                      </li>
                    `).join('')}
                  </ul>
                </div>

                <div class="nav-section-group" id="navAreasSection">
                  <div class="nav-section-label" id="navAreasLabel">2. 4 Áreas del Programa</div>
                  <div id="navAreasContainer" class="nav-areas-list">
                    <p style="font-size:0.8rem;color:#64748b;padding:4px 8px;">Cargando áreas del programa...</p>
                  </div>
                </div>
              </nav>

              <div class="sidebar-footer-card" id="sidebarTeacherStatus">
                <div class="sidebar-footer-title">👩‍🏫 Panel Docente</div>
                <p class="sidebar-footer-desc">Áreas activas según pruebas creadas.</p>
              </div>
            </aside>
          </div>
        </div>
      `;
    }

    return `
      <header class="mobile-topbar">
        <button
          type="button"
          id="drawerOpenBtn"
          class="menu-toggle-btn"
          aria-controls="appNavDrawer"
          aria-expanded="false"
        >
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
          <span>Menú</span>
        </button>
        <a href="./index.html" class="mobile-brand-link" data-nav-guard="true">
          <span aria-hidden="true">🌱</span>
          <span>Agricultura • MEDUCA</span>
        </a>
        <a href="./docente.html" class="mobile-docente-shortcut" data-nav-guard="true">
          <span aria-hidden="true">🧑‍🏫</span>
          <span>Docente</span>
        </a>
      </header>

      <div class="Drawer app-nav-drawer" id="appNavDrawer" aria-label="Menú de navegación">
        <div class="Drawer-scroller">
          <aside class="Drawer-sheet app-sidebar-sheet">
            <div class="sidebar-top-bar">
              <div class="sidebar-brand">
                <div class="sidebar-brand-logo" aria-hidden="true">🌱</div>
                <div>
                  <div class="sidebar-brand-title">Evaluaciones</div>
                  <div class="sidebar-brand-sub">Agricultura • MEDUCA</div>
                </div>
              </div>
              <button type="button" id="drawerCloseBtn" class="drawer-close-btn" aria-label="Cerrar menú" autofocus>
                ✕
              </button>
            </div>

            <nav class="sidebar-nav" aria-label="Principal">
              <div class="nav-section-group">
                <div class="nav-section-label">Navegación</div>
                <ul class="nav-vertical-list" role="list">
                  <li>
                    <a href="./index.html" class="nav-item-link" data-nav-guard="true">
                      <span class="nav-item-icon" aria-hidden="true">🏠</span>
                      <span class="nav-item-text">
                        <strong>Vista de Inicio</strong>
                        <small>Acceso docente y portal</small>
                      </span>
                    </a>
                  </li>
                  <li>
                    <a href="./docente.html" class="nav-item-link nav-item-docente" data-nav-guard="true">
                      <span class="nav-item-icon" aria-hidden="true">🧑‍🏫</span>
                      <span class="nav-item-text">
                        <strong>Panel Docente (Gmail)</strong>
                        <small>Áreas, grados y notas</small>
                      </span>
                    </a>
                  </li>
                </ul>
              </div>

              <div class="nav-section-group">
                <div class="nav-section-label">Pruebas por Grado</div>
                <ul class="nav-vertical-list" role="list">
                  ${NAV_GRADES.map((g) => `
                    <li>
                      <a
                        href="${g.href}"
                        class="nav-item-link"
                        data-nav-guard="true"
                        style="--nav-accent: ${g.accent}; --nav-soft: ${g.softBg};"
                        ${currentKey === g.pageKey ? 'aria-current="page"' : ''}
                      >
                        <span class="nav-item-icon" aria-hidden="true">${g.icon}</span>
                        <span class="nav-item-text">
                          <strong>${g.title}</strong>
                          <small>${g.subtitle}</small>
                        </span>
                      </a>
                    </li>
                  `).join('')}
                </ul>
              </div>
            </nav>

            <div class="sidebar-footer-card" id="sidebarTeacherStatus">
              <div class="sidebar-footer-title">🎓 Modo Estudiante</div>
              <p class="sidebar-footer-desc">Los alumnos ingresan sin cuenta de Google.</p>
            </div>
          </aside>
        </div>
      </div>
    `;
  }

  let closeDrawerFn = null;
  let isWideFn = () => false;

  function initNavigationShell() {
    const shell = document.getElementById('appShell');
    const mount = document.getElementById('appNavMount');
    const mainEl = document.getElementById('mainContent');
    if (!shell || !mount || !mainEl) return;

    const currentKey = detectCurrentPageKey();
    mount.innerHTML = buildNavMarkup(currentKey);

    const drawer = document.getElementById('appNavDrawer');
    const openBtn = document.getElementById('drawerOpenBtn');
    const closeBtn = document.getElementById('drawerCloseBtn');
    const scroller = drawer?.querySelector('.Drawer-scroller');
    const sheet = drawer?.querySelector('.Drawer-sheet');
    if (!drawer || !openBtn || !closeBtn || !scroller || !sheet) return;

    const supportsPopover = typeof drawer.showPopover === 'function' && Object.hasOwn(HTMLElement.prototype, 'popover');
    const mqDesktop = window.matchMedia('(min-width: 900px)');
    isWideFn = () => mqDesktop.matches;
    let isDrawerOpen = false;
    let observer = null;

    function syncResponsiveMode() {
      if (mqDesktop.matches) {
        if (isDrawerOpen) {
          isDrawerOpen = false;
          if (supportsPopover) {
            try { drawer.hidePopover(); } catch {}
          }
        }
        drawer.removeAttribute('popover');
        drawer.removeAttribute('role');
        drawer.removeAttribute('aria-modal');
        drawer.classList.remove('is-fallback-open');
        mainEl.inert = false;
        openBtn.setAttribute('aria-expanded', 'false');
      } else {
        if (supportsPopover) {
          drawer.setAttribute('popover', 'manual');
        }
        drawer.setAttribute('role', 'dialog');
        if (!isDrawerOpen) {
          drawer.removeAttribute('aria-modal');
          mainEl.inert = false;
        }
      }
    }

    async function openDrawer() {
      if (mqDesktop.matches || isDrawerOpen) return;
      isDrawerOpen = true;
      if (supportsPopover) {
        try { drawer.showPopover(); } catch {}
      } else {
        drawer.classList.add('is-fallback-open');
      }
      mainEl.inert = true;
      drawer.setAttribute('aria-modal', 'true');
      openBtn.setAttribute('aria-expanded', 'true');

      if (!CSS.supports('scroll-initial-target', 'nearest')) {
        scroller.scrollTo({ left: scroller.offsetWidth, behavior: 'instant' });
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      }
      scroller.scrollTo({ left: 0, behavior: 'auto' });
      closeBtn.focus({ preventScroll: true });
    }

    function onDrawerClosed() {
      if (!isDrawerOpen) return;
      isDrawerOpen = false;
      if (supportsPopover) {
        try { drawer.hidePopover(); } catch {}
      } else {
        drawer.classList.remove('is-fallback-open');
      }
      mainEl.inert = false;
      drawer.removeAttribute('aria-modal');
      openBtn.setAttribute('aria-expanded', 'false');
      openBtn.focus({ preventScroll: true });
    }

    function closeDrawer() {
      if (!isDrawerOpen || mqDesktop.matches) return;
      const closedLeft = scroller.offsetWidth;
      if (scroller.scrollLeft >= closedLeft - 4) {
        onDrawerClosed();
        return;
      }
      scroller.scrollTo({ left: closedLeft, behavior: 'auto' });
    }
    closeDrawerFn = closeDrawer;

    function onDrawerOpened() {
      if (!mqDesktop.matches) {
        openBtn.setAttribute('aria-expanded', 'true');
      }
    }

    if ('IntersectionObserver' in window) {
      const setupObserver = () => {
        if (observer) observer.disconnect();
        const threshold = Math.min(0.5, 1 / Math.max(window.innerWidth, 320));
        observer = new IntersectionObserver(
          (entries) => {
            if (mqDesktop.matches || !isDrawerOpen) return;
            const entry = entries[entries.length - 1];
            if (entry.intersectionRatio < threshold) onDrawerClosed();
            else if (entry.intersectionRatio >= 0.99) onDrawerOpened();
          },
          { root: drawer, threshold: [threshold, 1] }
        );
        observer.observe(sheet);
      };
      setupObserver();
      window.addEventListener('resize', setupObserver);
    }

    if (!CSS.supports('animation-timeline: scroll()')) {
      scroller.addEventListener('scroll', () => {
        if (mqDesktop.matches || !sheet.offsetWidth) return;
        const ratio = Math.max(0, Math.min(1, 1 - scroller.scrollLeft / sheet.offsetWidth));
        drawer.style.setProperty('--drawer-backdrop', String(ratio));
      }, { passive: true });
    }

    openBtn.addEventListener('click', openDrawer);
    closeBtn.addEventListener('click', closeDrawer);

    drawer.addEventListener('click', (event) => {
      if (!mqDesktop.matches && !sheet.contains(event.target)) {
        closeDrawer();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isDrawerOpen && !mqDesktop.matches) {
        event.preventDefault();
        closeDrawer();
      }
    });

    mqDesktop.addEventListener('change', syncResponsiveMode);
    syncResponsiveMode();

    mount.addEventListener('click', (event) => {
      const guardedLink = event.target.closest('a[data-nav-guard="true"]');
      if (guardedLink && window.__MEDUCA_TEST_IN_PROGRESS) {
        const leave = confirm('Tienes una evaluación en curso. ¿Seguro que deseas salir sin enviar tus respuestas?');
        if (!leave) {
          event.preventDefault();
          return;
        }
        window.onbeforeunload = null;
        window.__MEDUCA_TEST_IN_PROGRESS = false;
      }

      const docenteGradeBtn = event.target.closest('.nav-docente-grade-btn');
      if (docenteGradeBtn) {
        const gVal = docenteGradeBtn.dataset.docenteGrade || 'todos';
        if (window.MEDUCA_DOCENTE_NAV && typeof window.MEDUCA_DOCENTE_NAV.selectGrade === 'function') {
          window.MEDUCA_DOCENTE_NAV.selectGrade(gVal, true);
        }
        if (!mqDesktop.matches) closeDrawer();
        return;
      }

      const areaBtn = event.target.closest('.nav-area-btn');
      if (areaBtn) {
        if (areaBtn.disabled || areaBtn.getAttribute('aria-disabled') === 'true') {
          return;
        }
        const areaNum = areaBtn.dataset.docenteArea || 'todas';
        if (window.MEDUCA_DOCENTE_NAV && typeof window.MEDUCA_DOCENTE_NAV.selectArea === 'function') {
          window.MEDUCA_DOCENTE_NAV.selectArea(areaNum, true);
        }
        if (!mqDesktop.matches) closeDrawer();
      }
    });
  }

  window.MEDUCA_NAV = {
    syncDocenteActiveGrade(gradeVal) {
      const target = String(gradeVal || 'todos');
      document.querySelectorAll('.nav-docente-grade-btn').forEach((btn) => {
        const active = btn.dataset.docenteGrade === target;
        btn.classList.toggle('is-selected', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    },
    renderDocenteAreas(catalog, activeGrade, activeArea, enabledMap) {
      const container = document.getElementById('navAreasContainer');
      const labelEl = document.getElementById('navAreasLabel');
      if (!container || !window.MEDUCA_CATALOGO) return;

      const gradeText = activeGrade === 'todos' ? 'Todos los grados' : `${activeGrade}° Grado`;
      if (labelEl) {
        labelEl.textContent = `2. Áreas de Agricultura (${gradeText})`;
      }

      const areas = window.MEDUCA_CATALOGO.getAreasForGrade(catalog, activeGrade);
      const selArea = String(activeArea || 'todas');

      const allAreasBtn = `
        <button
          type="button"
          class="nav-item-btn nav-area-btn nav-area-all ${selArea === 'todas' ? 'is-selected' : ''}"
          data-docente-area="todas"
          aria-pressed="${selArea === 'todas' ? 'true' : 'false'}"
          style="--nav-accent: #1e3a8a; --nav-soft: #dbeafe;"
        >
          <span class="nav-item-icon" aria-hidden="true">📚</span>
          <span class="nav-item-text">
            <strong>Todas las áreas activas</strong>
            <small>Ver pruebas disponibles (${areas.reduce((acc, a) => acc + a.pruebas.length, 0)})</small>
          </span>
        </button>
      `;

      const areaCards = areas.map((area) => {
        const isAvailable = area.disponible;
        const isSelected = isAvailable && String(area.numero) === selArea;
        const testsHtml = isAvailable
          ? `<ul class="nav-area-tests-sublist" role="list">
              ${area.pruebas.map((p) => {
                const enabled = !enabledMap || enabledMap[p.id] !== false;
                return `
                  <li class="nav-area-test-pill">
                    <span aria-hidden="true">${enabled ? '☑️' : '⬜'}</span>
                    <span>${escapeHtml(p.codigo)} (${p.grado}°)</span>
                  </li>
                `;
              }).join('')}
            </ul>`
          : '';

        return `
          <div class="nav-area-group ${isAvailable ? 'is-available' : 'is-locked'}">
            <button
              type="button"
              class="nav-item-btn nav-area-btn ${isSelected ? 'is-selected' : ''}"
              data-docente-area="${area.numero}"
              ${isAvailable ? '' : 'disabled aria-disabled="true"'}
              aria-pressed="${isSelected ? 'true' : 'false'}"
              style="--nav-accent: ${area.color}; --nav-soft: ${area.softBg};"
            >
              <span class="nav-item-icon" aria-hidden="true">${area.icono}</span>
              <span class="nav-item-text">
                <strong>Área ${area.numero}: ${escapeHtml(area.nombre)}</strong>
                <small>${isAvailable
                  ? `✅ ${area.pruebas.length} prueba${area.pruebas.length === 1 ? '' : 's'} creada${area.pruebas.length === 1 ? '' : 's'}`
                  : '🔒 Sin pruebas creadas aún'}</small>
              </span>
            </button>
            ${testsHtml}
          </div>
        `;
      }).join('');

      container.innerHTML = allAreasBtn + areaCards;
    },
    setTeacherStatus(email) {
      const box = document.getElementById('sidebarTeacherStatus');
      if (!box) return;
      if (email) {
        box.innerHTML = `
          <div class="sidebar-footer-title" style="color:#15803d;">🟢 Sesión Docente</div>
          <p class="sidebar-footer-desc" style="word-break:break-word;">${escapeHtml(email)}</p>
        `;
      } else if (document.body?.dataset?.page === 'docente') {
        box.innerHTML = `
          <div class="sidebar-footer-title">👩‍🏫 Panel Docente</div>
          <p class="sidebar-footer-desc">Inicia sesión para habilitar y gestionar pruebas.</p>
        `;
      } else {
        box.innerHTML = `
          <div class="sidebar-footer-title">🎓 Modo Estudiante</div>
          <p class="sidebar-footer-desc">Los alumnos ingresan sin cuenta de Google.</p>
        `;
      }
    },
    closeIfMobile() {
      if (!isWideFn() && typeof closeDrawerFn === 'function') closeDrawerFn();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavigationShell);
  } else {
    initNavigationShell();
  }
})();
