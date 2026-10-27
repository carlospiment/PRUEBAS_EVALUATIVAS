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
        sincronizado_cloud_at: new Date().toISOString()
      }, { merge: true });
      console.log('☁️ Resultado guardado en Firestore:', docId);
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
