// Configuración de Firebase para MEDUCA Evaluaciones Agrícolas
const firebaseConfig = {
  apiKey: "AIzaSyAsO8zV1JF0jrG1GkrQwHsM9OUkfplzPQo",
  authDomain: "meduca-evaluaciones-agricolas.firebaseapp.com",
  projectId: "meduca-evaluaciones-agricolas",
  storageBucket: "meduca-evaluaciones-agricolas.firebasestorage.app",
  messagingSenderId: "726296226333",
  appId: "1:726296226333:web:7306752c93b8b0b540f4f4",
  measurementId: "G-5GQQ9WX2HP"
};

let firestoreDb = null;

try {
  if (typeof firebase !== 'undefined' && firebase.initializeApp) {
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    firestoreDb = firebase.firestore();
    console.log('🔥 Cloud Firestore conectado exitosamente.');
  }
} catch (err) {
  console.warn('Firebase no inicializado:', err);
}

// Helpers globales para el sistema de pruebas MEDUCA
window.MEDUCA_FIREBASE = {
  get db() {
    return firestoreDb;
  },
  isAvailable() {
    return firestoreDb !== null;
  },

  // Guardar un resultado en la nube
  async saveResult(resultado) {
    if (!firestoreDb) return false;
    try {
      const docId = resultado.id || `${resultado.grado || 'g'}_${(resultado.estudiante_nombre || 'est').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_')}_${Date.now()}`;
      await firestoreDb.collection('resultados_evaluaciones').doc(docId).set({
        ...resultado,
        activo: true,
        sincronizado_cloud_at: new Date().toISOString()
      }, { merge: true });

      // Si había una autorización activa para este estudiante, desactivarla (ya completó la nueva oportunidad)
      const cleanName = (resultado.estudiante_nombre || '').toLowerCase().trim();
      const snap = await firestoreDb.collection('resultados_evaluaciones')
        .where('tipo', '==', 'autorizacion_reintento')
        .where('activo', '==', true)
        .get();

      const batch = firestoreDb.batch();
      snap.forEach(doc => {
        const d = doc.data();
        if (d.estudiante_nombre && d.estudiante_nombre.toLowerCase().trim() === cleanName) {
          batch.update(doc.ref, {
            activo: false,
            utilizado_at: new Date().toLocaleString('es-PA'),
            resultado_id: docId
          });
        }
      });
      await batch.commit();

      console.log('☁️ Resultado guardado en Firestore y autorizaciones actualizadas:', docId);
      return true;
    } catch (e) {
      console.error('Error enviando resultado a Firestore:', e);
      return false;
    }
  },

  // Obtener todos los resultados guardados en Firestore
  async getResults() {
    if (!firestoreDb) return [];
    try {
      const snap = await firestoreDb.collection('resultados_evaluaciones').get();
      const list = [];
      snap.forEach(doc => {
        list.push({ id: doc.id, ...doc.data() });
      });
      return list;
    } catch (e) {
      console.warn('Error obteniendo resultados de Firestore:', e);
      return [];
    }
  },

  // Escuchar resultados en tiempo real (para el panel docente)
  listenResults(onUpdate) {
    if (!firestoreDb) return () => {};
    try {
      return firestoreDb.collection('resultados_evaluaciones').onSnapshot((snap) => {
        const list = [];
        snap.forEach(doc => {
          list.push({ id: doc.id, ...doc.data() });
        });
        onUpdate(list);
      }, (err) => {
        console.warn('Error en listener de Firestore:', err);
      });
    } catch (e) {
      console.warn('No se pudo activar el listener de Firestore:', e);
      return () => {};
    }
  },

  // Registrar permanentemente la autorización de una nueva oportunidad en la base de datos
  async authorizeRetake(studentName, grado, motivo = 'Oportunidad concedida por el docente desde el panel') {
    if (!firestoreDb) return false;
    try {
      const now = new Date();
      const fechaStr = now.toLocaleString('es-PA');
      const authId = `auth_${grado}_${(studentName || 'est').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '_')}_${Date.now()}`;
      
      // 1. Guardar documento formal de autorización en la base de datos
      await firestoreDb.collection('resultados_evaluaciones').doc(authId).set({
        tipo: 'autorizacion_reintento',
        estudiante_nombre: studentName,
        grado: Number(grado),
        autorizado_at: fechaStr,
        autorizado_iso: now.toISOString(),
        autorizado_timestamp: Date.now(),
        autorizado_por: 'Docente (Panel)',
        motivo: motivo,
        activo: true
      });

      // 2. Archivar cualquier evaluación previa para ese estudiante en la base de datos
      const snap = await firestoreDb.collection('resultados_evaluaciones')
        .where('estudiante_nombre', '==', studentName)
        .get();

      const batch = firestoreDb.batch();
      snap.forEach(doc => {
        if (doc.id !== authId && doc.data().tipo !== 'autorizacion_reintento') {
          batch.update(doc.ref, {
            estado: 'reintento_autorizado',
            activo: false,
            archivado_por_reintento: true,
            reintento_autorizado_at: fechaStr,
            reintento_autorizado_timestamp: Date.now()
          });
        }
      });
      await batch.commit();

      console.log(`✅ Oportunidad registrada en base de datos para: ${studentName} (${fechaStr})`);
      return true;
    } catch (e) {
      console.error('Error registrando autorización en Firestore:', e);
      return false;
    }
  },

  // Eliminar o reiniciar intento de un estudiante en Firestore
  async deleteResult(resultId, studentName) {
    if (!firestoreDb) return false;
    try {
      if (resultId) {
        await firestoreDb.collection('resultados_evaluaciones').doc(resultId).delete().catch(() => {});
      }
      if (studentName) {
        const snap = await firestoreDb.collection('resultados_evaluaciones')
          .where('estudiante_nombre', '==', studentName)
          .get();
        const batch = firestoreDb.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
      console.log('☁️ Intento eliminado de Firestore');
      return true;
    } catch (e) {
      console.error('Error al reiniciar en Firestore:', e);
      return false;
    }
  }
};
