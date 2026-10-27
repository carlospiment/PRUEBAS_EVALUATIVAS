# 🌱 Sistema de Pruebas Evaluativas de Agricultura - MEDUCA
### *Educación Primaria: 3°, 4°, 5° y 6° Grado*

Aplicación web interactiva, progresiva (**PWA**) y **offline-first** diseñada para la aplicación, monitoreo y calificación sumativa de las pruebas de Agricultura del Ministerio de Educación de Panamá (**MEDUCA**).

---

## 🌐 Acceso en Línea (GitHub Pages)

El sistema está desplegado y disponible para ser utilizado en computadoras, tabletas y teléfonos celulares:

| Nivel / Grado | Lección Evaluada | Puntaje | Enlace Directo |
| :--- | :--- | :---: | :--- |
| **🥕 3er Grado** | **Lección 3.3.1:** El huerto escolar, la salud y la nutrición | **19 pts** | [Abrir Prueba 3°](https://carlospiment.github.io/PRUEBAS_EVALUATIVAS/tercer_grado.html) |
| **🌽 4to Grado** | **Lección 4.3.1:** Beneficios e importancia del huerto escolar | **24 pts** | [Abrir Prueba 4°](https://carlospiment.github.io/PRUEBAS_EVALUATIVAS/cuarto_grado.html) |
| **🥬 5to Grado** | **Lección 5.3.1:** Métodos modernos de producción y labores | **31 pts** | [Abrir Prueba 5°](https://carlospiment.github.io/PRUEBAS_EVALUATIVAS/quinto_grado.html) |
| **🍅 6to Grado** | **Lección 6.3.1:** Destino de la producción agrícola | **32 pts** | [Abrir Prueba 6°](https://carlospiment.github.io/PRUEBAS_EVALUATIVAS/sexto_grado.html) |
| **🏠 Portal Principal** | Selector general de grado para estudiantes | — | [Ir al Portal](https://carlospiment.github.io/PRUEBAS_EVALUATIVAS/) |
| **🔒 Panel Docente** | Monitoreo, estadísticas, exportación y códigos QR | *(PIN: `0476`)* | [Acceder al Panel](https://carlospiment.github.io/PRUEBAS_EVALUATIVAS/docente.html) |

---

## 🌟 Características Principales

### 1. Evaluaciones Específicas por Grado
- **Páginas independientes:** Cada grado cuenta con su propia URL aislada para evitar confusiones de los alumnos.
- **Identidad visual lúdica:** Paletas de colores y mascotas distintivas para cada nivel (🥕 3°, 🌽 4°, 🥬 5°, 🍅 6°).
- **Tipología de reactivos adaptados:**
  - **Parte A (Completa):** Banco de palabras interactivo seleccionable con un clic o escritura directa.
  - **Parte B (Selección Múltiple):** Opciones táctiles grandes de una sola selección.
  - **Parte C (Verdadero o Falso):** Botones directos y claros de **V** y **F**.
  - **Parte D (Relaciona):** Asociación interactiva de conceptos con definiciones numeradas.
  - **Parte E (Respuesta corta / Clasificación):**
    - En 4° y 5°: Respuestas cortas asistidas con tolerancia semántica y palabras clave.
    - En 6°: Clasificación interactiva entre **Consumo Escolar (E)** y **Consumo Familiar (F)** mediante botones táctiles.
- **Botón final:** Etiquetado de forma clara y directa como **"Entregar"**.

### 2. Autocompletado con Lista Oficial (330 Estudiantes)
- Registro oficial precargado con los salones:
  - **3er Grado:** 3°A, 3°B, 3°C (86 estudiantes)
  - **4to Grado:** 4°A, 4°B, 4°C (71 estudiantes)
  - **5to Grado:** 5°A, 5°B, 5°C (96 estudiantes)
  - **6to Grado:** 6°A, 6°B, 6°C (77 estudiantes)
- Al escribir el nombre o apellido, el sistema sugiere automáticamente al estudiante y filtra por su salón.

### 3. Regla Estricta de Único Intento y Reinicio Controlado
- Bloquea entregas duplicadas para evitar que un estudiante repita la prueba sin autorización.
- Muestra comprobante con fecha, calificación obtenida y tiempo empleado si intenta entrar de nuevo.
- El docente puede **reiniciar el intento** de cualquier alumno desde su panel en caso de problemas técnicos.

### 4. Calificación Oficial Automática MEDUCA (1.0 a 5.0)
- Cálculo instantáneo aplicando la fórmula de escala oficial panameña según el puntaje máximo de cada grado:
  $$\text{Nota} = 1.0 + \frac{4.0 \times \text{Puntos Obtenidos}}{\text{Puntos Totales}}$$
- Retroalimentación formativa y animación festiva de confeti al completar la entrega.

### 5. Panel Docente Protegido con PIN (`0476`)
- **Acceso seguro:** Requiere clave de acceso numérico tanto desde el pie de página como por acceso directo.
- **Códigos QR integrados:** Permite proyectar o imprimir el código QR y enlace directo de cada grado.
- **Métricas y estadísticas dinámicas:** Filtra por grado (`Todos`, `3°`, `4°`, `5°`, `6°`) y por sección (`A`, `B`, `C`), calculando en tiempo real:
  - Total de estudiantes matriculados en la sección o grado.
  - Evaluaciones entregadas y pendientes.
  - Promedio general de calificaciones y tiempo promedio de realización.
- **Exportación a CSV / Excel:** Descarga de reportes detallados con un solo clic.

### 6. Funcionamiento 100% Offline (PWA)
- Equipado con **Service Worker** (`sw.js`) que cachea todos los recursos, permitiendo que la prueba funcione incluso si se cae la conexión a internet en el aula.

---

## 🚀 Uso en Servidor Local (Intranet de Aula sin Internet)

Para aulas con red Wi-Fi local sin salida a internet:

### Opción 1: Ejecución directa en Windows
Haz doble clic sobre el archivo:
```cmd
iniciar_servidor.bat
```

### Opción 2: Desde la terminal
```bash
npm install
npm start
```

### Conexión de dispositivos en el aula:
- **Computadora principal / Servidor:** `http://localhost:3000`
- **Tablets o teléfonos de estudiantes:** `http://<IP-LOCAL-DEL-DOCENTE>:3000`  
  *(La IP se muestra automáticamente en la consola y dentro del panel docente)*.

---

## 📁 Estructura del Proyecto

```text
PRUEBAS_EVALUATIVAS/
├── index.html             # Portal principal con acceso por grado y panel docente
├── tercer_grado.html      # Evaluación interactiva de 3er Grado (19 pts)
├── cuarto_grado.html      # Evaluación interactiva de 4to Grado (24 pts)
├── quinto_grado.html      # Evaluación interactiva de 5to Grado (31 pts)
├── sexto_grado.html       # Evaluación interactiva de 6to Grado (32 pts)
├── docente.html           # Panel de control docente (protegido con PIN 0476)
├── server.js              # Servidor Node.js / Express con API REST de evaluación
├── sw.js                  # Service Worker PWA para almacenamiento en caché offline
├── iniciar_servidor.bat   # Script de arranque en un clic para Windows
├── package.json           # Dependencias y scripts del proyecto
├── css/
│   └── style.css          # Estilos responsivos, accesibles y tematizados por grado
├── js/
│   ├── app.js             # Lógica de la prueba, autocompletado y temporizador
│   └── docente.js         # Lógica de estadísticas, filtros, QR y exportación CSV
└── data/
    ├── estudiantes.json   # Base de datos oficial de los 330 estudiantes
    ├── prueba_config.json # Configuración de 3er Grado (Lección 3.3.1)
    ├── prueba_4to.json    # Configuración de 4to Grado (Lección 4.3.1)
    ├── prueba_5to.json    # Configuración de 5to Grado (Lección 5.3.1)
    ├── prueba_6to.json    # Configuración de 6to Grado (Lección 6.3.1)
    └── resultados.json    # Registro persistente de notas y entregas
```

---

## 🛡️ Licencia y Créditos
Desarrollado para el seguimiento pedagógico y formativo de las clases de Agricultura en Educación Básica General — **MEDUCA Panamá**.
