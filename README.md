# 🌾 Sistema de Pruebas Evaluativas - MEDUCA (Tercer Grado)

Aplicación web interactiva para la aplicación y calificación de la **Prueba Sumativa de Agricultura (Lección 3.3.1: El huerto escolar, la salud y la nutrición)**.

---

## 🌟 Características Principales

1. **Interfaz adaptada para 3er Grado de Primaria**:
   - Diseño visual claro, con tipografía grande, colores de naturaleza y elementos amigables.
   - **Banco de palabras interactivo**: los niños pueden escribir o hacer clic sobre las palabras del banco para colocarlas automáticamente en los espacios en blanco.
   - Botones táctiles grandes para selección múltiple y verdadero/falso.
   - Efectos de sonido suaves (conmutables con botón) y animación festiva de confeti al terminar.

2. **Autocompletado de Nombre del Estudiante**:
   - Al empezar a escribir su nombre en la pantalla de bienvenida, se despliega una lista interactiva con autocompletar.
   - Se muestra si el estudiante está disponible o si ya realizó la prueba.

3. **Regla Estricta de Único Intento**:
   - Una vez que un estudiante entrega su evaluación, el sistema bloquea cualquier intento posterior con ese mismo nombre.
   - Si intenta ingresar de nuevo, se le muestra la fecha, el tiempo que tardó y su calificación previa.
   - El docente dispone de una opción en su panel para **reiniciar el intento** de un estudiante si ocurrió alguna falla técnica o desconexión.

4. **Registro Preciso del Tiempo**:
   - El cronómetro inicia en el momento exacto en que el estudiante pulsa **"🚀 Comenzar Prueba"**.
   - Se registra el tiempo total empleado (minutos y segundos) tanto en el resultado individual como en el reporte del docente.

5. **Calificación Automática Oficial MEDUCA**:
   - Total de reactivos: **19 puntos** distribuidos en 4 secciones:
     - **Parte A (Completa)**: 5 puntos
     - **Parte B (Selección Múltiple)**: 4 puntos
     - **Parte C (Verdadero o Falso)**: 6 puntos
     - **Parte D (Relaciona)**: 4 puntos
   - Escala oficial panameña: **1.0 a 5.0**.
   - Evaluación inteligente y tolerante para 3er grado (ignora mayúsculas/minúsculas, tildes y artículos como "el", "la", "los").

6. **Panel Docente (`/docente.html`)**:
   - Monitoreo en tiempo real de pruebas realizadas y pendientes.
   - Promedio general de calificaciones y tiempo promedio del salón.
   - **Gestor de Estudiantes**: Permite pegar o editar la lista oficial de estudiantes y guardarla con un clic.
   - **Visualizador detallado**: Permite ver exactamente qué respondió cada niño en cada ítem.
   - **Exportación a Excel / CSV**: Descarga en 1 clic de todas las notas listas para el registro.
   - **Direcciones IP de Red Local**: Para que los estudiantes abran la prueba desde tablets o celulares conectados a la misma red Wi-Fi.

---

## 🚀 Cómo Iniciar la Aplicación

### Opción 1: Doble clic en Windows
Haz doble clic sobre el archivo:
```
iniciar_servidor.bat
```

### Opción 2: Desde la terminal
```bash
npm start
```
o
```bash
node server.js
```

---

## 🔗 Enlaces de Acceso

- **Estudiantes (en esta computadora)**: [http://localhost:3000](http://localhost:3000)
- **Estudiantes (en Tablets / Celulares en el aula)**: `http://<IP-DE-TU-PC>:3000`  
  *(La dirección exacta se muestra en la pantalla de la consola y en el panel docente, por ejemplo: `http://192.168.40.75:3000`)*
- **Panel Docente**: [http://localhost:3000/docente.html](http://localhost:3000/docente.html)

---

## 📁 Estructura del Proyecto

```
PRUEBAS_EVALUATIVAS/
├── server.js              # Servidor Node.js + Express con APIs de evaluación
├── package.json           # Dependencias y scripts
├── iniciar_servidor.bat   # Acceso directo para ejecutar en Windows
├── data/
│   ├── estudiantes.json   # Lista de estudiantes (se actualiza desde el panel o a mano)
│   ├── prueba_config.json # Preguntas, respuestas y ponderaciones
│   └── resultados.json    # Historial de evaluaciones entregadas y notas
└── public/
    ├── index.html         # Portal de evaluación del estudiante
    ├── docente.html       # Panel de administración y resultados
    ├── css/
    │   └── style.css      # Estilos lúdicos y accesibles
    └── js/
        ├── app.js         # Lógica interactiva del estudiante y cronómetro
        └── docente.js     # Lógica del panel docente y reportes
```
