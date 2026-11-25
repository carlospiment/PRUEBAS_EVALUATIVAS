// Configuración de Firebase para MEDUCA Evaluaciones Agrícolas
const firebaseConfig = {
  apiKey: "AIzaSyAsO8zV1JFOjrG1GkrQwHsM9OUkfplzPQo",
  authDomain: "meduca-evaluaciones-agricolas.firebaseapp.com",
  projectId: "meduca-evaluaciones-agricolas",
  storageBucket: "meduca-evaluaciones-agricolas.firebasestorage.app",
  messagingSenderId: "726296226333",
  appId: "1:726296226333:web:7306752c93b8b0b540f4f4",
  measurementId: "G-5GQQ9WX2HP"
};

// Lista blanca de correos autorizados por firestore.rules para leer/gestionar resultados
const AUTHORIZED_TEACHER_EMAILS = ['civanp004@gmail.com'];

let firestoreDb = null;
let firebaseAuth = null;

try {
  if (typeof firebase !== 'undefined' && firebase.initializeApp) {
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    firestoreDb = firebase.firestore();
    if (typeof firebase.auth === 'function') {
      firebaseAuth = firebase.auth();
      if (firebase.auth.Auth && firebase.auth.Auth.Persistence) {
        firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
      }
      firebaseAuth.getRedirectResult().catch((err) => {
        console.warn('Redirect auth result:', err);
      });
    }
    console.log('🔥 Cloud Firestore conectado exitosamente.');
  }
} catch (err) {
  console.warn('Firebase no inicializado:', err);
}

function isAuthorizedEmail(email) {
  return Boolean(email && AUTHORIZED_TEACHER_EMAILS.includes(String(email).toLowerCase().trim()));
}

function isAuthorizedUser(user) {
  return Boolean(user && isAuthorizedEmail(user.email));
}

function generateUniqueResultId(grado, studentName) {
  const cleanSlug = (studentName || 'est').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_');
  const rand = Math.random().toString(36).substring(2, 7);
  return `${grado || 'g'}_${cleanSlug}_${Date.now()}_${rand}`;
}

// Helpers globales para el sistema de pruebas MEDUCA
window.MEDUCA_FIREBASE = {
  get db() {
    return firestoreDb;
  },
  get auth() {
    return firebaseAuth;
  },
  authorizedEmails: [...AUTHORIZED_TEACHER_EMAILS],

  isAvailable() {
    return firestoreDb !== null;
  },

  isAuthAvailable() {
    return firebaseAuth !== null;
  },

  getCurrentUser() {
    const user = firebaseAuth ? firebaseAuth.currentUser : null;
    return isAuthorizedUser(user) ? user : null;
  },

  isTeacherAuthenticated() {
    return this.getCurrentUser() !== null;
  },

  // Escuchar cambios de sesión en el panel docente
  onAuthStateChanged(callback) {
    if (!firebaseAuth) {
      if (typeof callback === 'function') callback({ user: null, unauthorizedEmail: null });
      return () => {};
    }
    return firebaseAuth.onAuthStateChanged(async (user) => {
      if (user && !isAuthorizedUser(user)) {
        const badEmail = user.email || '(desconocido)';
        try {
          await firebaseAuth.signOut();
        } catch {}
        if (typeof callback === 'function') callback({ user: null, unauthorizedEmail: badEmail });
        return;
      }
      if (typeof callback === 'function') callback({ user: user || null, unauthorizedEmail: null });
    });
  },

  // Iniciar sesión con Google (solo panel docente)
  async signInWithGoogle() {
    if (!firebaseAuth || typeof firebase === 'undefined' || !firebase.auth?.GoogleAuthProvider) {
      return { ok: false, code: 'auth-unavailable', message: 'El módulo de autenticación de Firebase no está cargado.' };
    }
    if (!navigator.onLine) {
      return { ok: false, code: 'offline', message: 'Sin conexión a internet. Conéctate brevemente para iniciar sesión con Google.' };
    }
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const res = await firebaseAuth.signInWithPopup(provider);
      const user = res.user;
      if (!isAuthorizedUser(user)) {
        const attemptedEmail = user?.email || '';
        await firebaseAuth.signOut().catch(() => {});
        return {
          ok: false,
          code: 'unauthorized-email',
          message: `Acceso denegado: la cuenta "${attemptedEmail}" no está autorizada. Usa ${AUTHORIZED_TEACHER_EMAILS[0]}.`
        };
      }
      return { ok: true, user };
    } catch (err) {
      console.error('Error en signInWithGoogle:', err);
      const code = err?.code || 'unknown';
      if (code === 'auth/popup-blocked') {
        try {
          const provider = new firebase.auth.GoogleAuthProvider();
          provider.setCustomParameters({ prompt: 'select_account' });
          await firebaseAuth.signInWithRedirect(provider);
          return { ok: true, redirecting: true };
        } catch (redirErr) {
          return { ok: false, code: redirErr?.code || code, message: 'El navegador bloqueó la ventana emergente de Google. Permite ventanas emergentes e inténtalo de nuevo.' };
        }
      }
      let message = 'No se pudo iniciar sesión con Google.';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        message = 'Se cerró la ventana de inicio de sesión antes de completar el acceso.';
      } else if (code === 'auth/unauthorized-domain') {
        message = 'Este dominio no está autorizado en Firebase Console > Authentication > Authorized domains.';
      } else if (code === 'auth/network-request-failed') {
        message = 'Error de red al conectar con Google. Revisa tu conexión a internet.';
      } else if (code === 'auth/invalid-api-key') {
        message = 'Clave API de Firebase inválida.';
      } else if (err?.message) {
        message = err.message;
      }
      return { ok: false, code, message };
    }
  },

  async signOut() {
    if (!firebaseAuth) return true;
    try {
      await firebaseAuth.signOut();
      return true;
    } catch (e) {
      console.warn('Error al cerrar sesión:', e);
      return false;
    }
  },

  // Guardar un resultado en la nube (los estudiantes crean documentos sin necesidad de login)
  async saveResult(resultado) {
    if (!firestoreDb) return false;
    try {
      const cleanPayload = { ...resultado };
      delete cleanPayload.sincronizado_nube;

      const docId = cleanPayload.id || generateUniqueResultId(cleanPayload.grado, cleanPayload.estudiante_nombre);
      cleanPayload.id = docId;
      cleanPayload.activo = true;
      cleanPayload.sincronizado_cloud_at = new Date().toISOString();

      await firestoreDb.collection('resultados_evaluaciones').doc(docId).set(cleanPayload);

      // Desactivar autorización previa solo si el contexto actual tiene permisos de lectura/actualización
      if (this.isTeacherAuthenticated()) {
        try {
          const cleanName = (cleanPayload.estudiante_nombre || '').toLowerCase().trim();
          const gradeNum = Number(cleanPayload.grado || 3);
          const snap = await firestoreDb.collection('resultados_evaluaciones')
            .where('tipo', '==', 'autorizacion_reintento')
            .where('activo', '==', true)
            .get();

          const batch = firestoreDb.batch();
          let updates = 0;
          snap.forEach(doc => {
            const d = doc.data();
            const sameGrade = !d.grado || Number(d.grado) === gradeNum;
            if (sameGrade && d.estudiante_nombre && d.estudiante_nombre.toLowerCase().trim() === cleanName) {
              batch.update(doc.ref, {
                activo: false,
                utilizado_at: new Date().toLocaleString('es-PA'),
                resultado_id: docId
              });
              updates++;
            }
          });
          if (updates > 0) await batch.commit();
        } catch (authCleanupErr) {
          console.warn('No se pudo desactivar autorización de reintento:', authCleanupErr?.code || authCleanupErr);
        }
      }

      console.log('☁️ Resultado guardado en Firestore:', docId);
      return true;
    } catch (e) {
      console.error('Error enviando resultado a Firestore:', e);
      return false;
    }
  },

  // Obtener resultados con estado explícito (evita confundir PERMISSION_DENIED con lista vacía)
  async getResultsDetailed() {
    if (!firestoreDb) {
      return { ok: false, code: 'unavailable', message: 'Firestore no disponible', items: [] };
    }
    try {
      const snap = await firestoreDb.collection('resultados_evaluaciones').get();
      const list = [];
      snap.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      return { ok: true, code: null, message: '', items: list };
    } catch (e) {
      console.warn('Error obteniendo resultados de Firestore:', e);
      return {
        ok: false,
        code: e?.code || 'unknown',
        message: e?.message || 'Error al consultar Firestore',
        items: []
      };
    }
  },

  // Compatibilidad retroactiva
  async getResults() {
    const res = await this.getResultsDetailed();
    return res.items;
  },

  // Escuchar resultados en tiempo real (para el panel docente autenticado)
  listenResults(onUpdate, onError) {
    if (!firestoreDb) return () => {};
    try {
      return firestoreDb.collection('resultados_evaluaciones').onSnapshot((snap) => {
        const list = [];
        snap.forEach(doc => {
          list.push({ id: doc.id, ...doc.data() });
        });
        if (typeof onUpdate === 'function') onUpdate(list);
      }, (err) => {
        console.warn('Error en listener de Firestore:', err);
        if (typeof onError === 'function') onError(err);
      });
    } catch (e) {
      console.warn('No se pudo activar el listener de Firestore:', e);
      if (typeof onError === 'function') onError(e);
      return () => {};
    }
  },

  // Registrar permanentemente la autorización de una nueva oportunidad en la base de datos
  async authorizeRetake(studentName, grado, motivo = 'Oportunidad concedida por el docente desde el panel') {
    if (!firestoreDb) {
      return { ok: false, code: 'unavailable', message: 'Firestore no está disponible.' };
    }
    if (!this.isTeacherAuthenticated()) {
      return { ok: false, code: 'auth-required', message: 'Inicia sesión con Google (civanp004@gmail.com) para autorizar reintentos en Firebase.' };
    }
    try {
      const now = new Date();
      const fechaStr = now.toLocaleString('es-PA', { timeZone: 'America/Panama' });
      const gradeNum = Number(grado) || 3;
      const authId = `auth_${gradeNum}_${(studentName || 'est').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_')}_${Date.now()}`;

      // 1. Guardar documento formal de autorización en la base de datos
      await firestoreDb.collection('resultados_evaluaciones').doc(authId).set({
        tipo: 'autorizacion_reintento',
        estudiante_nombre: studentName,
        grado: gradeNum,
        autorizado_at: fechaStr,
        autorizado_iso: now.toISOString(),
        autorizado_timestamp: Date.now(),
        autorizado_por: this.getCurrentUser()?.email || 'Docente (Panel)',
        motivo: motivo,
        activo: true
      });

      // 2. Archivar evaluaciones previas de ese estudiante en ESE grado únicamente
      const snap = await firestoreDb.collection('resultados_evaluaciones')
        .where('estudiante_nombre', '==', studentName)
        .get();

      const batch = firestoreDb.batch();
      let updates = 0;
      snap.forEach(doc => {
        const d = doc.data();
        const docGrade = Number(d.grado || 3);
        if (doc.id !== authId && d.tipo !== 'autorizacion_reintento' && docGrade === gradeNum) {
          batch.update(doc.ref, {
            estado: 'reintento_autorizado',
            activo: false,
            archivado_por_reintento: true,
            reintento_autorizado_at: fechaStr,
            reintento_autorizado_timestamp: Date.now()
          });
          updates++;
        }
      });
      if (updates > 0) await batch.commit();

      console.log(`✅ Oportunidad registrada en base de datos para: ${studentName} (${gradeNum}°)`);
      return { ok: true, authId };
    } catch (e) {
      console.error('Error registrando autorización en Firestore:', e);
      return { ok: false, code: e?.code || 'unknown', message: e?.message || 'Error al autorizar reintento en Firestore.' };
    }
  },

  // Archivar un intento específico (útil para limpiar entregas duplicadas sin perder auditoría)
  async archiveResult(resultId, motivo = 'Archivado por el docente (registro duplicado)') {
    if (!firestoreDb) return { ok: false, code: 'unavailable', message: 'Firestore no está disponible.' };
    if (!this.isTeacherAuthenticated()) {
      return { ok: false, code: 'auth-required', message: 'Inicia sesión con Google para archivar registros.' };
    }
    try {
      const now = new Date();
      await firestoreDb.collection('resultados_evaluaciones').doc(resultId).update({
        estado: 'archivado_docente',
        activo: false,
        archivado_por_reintento: true,
        archivado_motivo: motivo,
        archivado_at: now.toLocaleString('es-PA', { timeZone: 'America/Panama' }),
        archivado_timestamp: Date.now()
      });
      return { ok: true };
    } catch (e) {
      console.error('Error archivando resultado en Firestore:', e);
      return { ok: false, code: e?.code || 'unknown', message: e?.message || 'Error al archivar en Firestore.' };
    }
  },

  // Eliminar o reiniciar intento de un estudiante en Firestore (filtrado por grado)
  async deleteResult(resultId, studentName, grado) {
    if (!firestoreDb) return false;
    if (!this.isTeacherAuthenticated()) return false;
    try {
      if (resultId) {
        await firestoreDb.collection('resultados_evaluaciones').doc(resultId).delete().catch(() => {});
      }
      if (studentName) {
        const snap = await firestoreDb.collection('resultados_evaluaciones')
          .where('estudiante_nombre', '==', studentName)
          .get();
        const batch = firestoreDb.batch();
        const gradeNum = grado ? Number(grado) : null;
        snap.forEach(doc => {
          const d = doc.data();
          if (!gradeNum || Number(d.grado || 3) === gradeNum) {
            batch.delete(doc.ref);
          }
        });
        await batch.commit();
      }
      console.log('☁️ Intento eliminado de Firestore');
      return true;
    } catch (e) {
      console.error('Error al reiniciar en Firestore:', e);
      return false;
    }
  },

  // Guardar configuración de pruebas habilitadas por el docente ("clips de selección")
  async saveEnabledTestsConfig(habilitadasMap) {
    if (!firestoreDb || !this.isTeacherAuthenticated()) return false;
    try {
      await firestoreDb.collection('resultados_evaluaciones').doc('__config_pruebas_activas__').set({
        tipo: 'config_pruebas_activas',
        habilitadas: habilitadasMap || {},
        updated_at: new Date().toISOString(),
        actualizado_por: this.getCurrentUser()?.email || 'civanp004@gmail.com'
      });
      return true;
    } catch (e) {
      console.warn('No se pudo sincronizar selección de pruebas activas en Firestore:', e);
      return false;
    }
  }
};
