const fs = require('fs');
const path = require('path');

const srcPath = 'C:/Users/Alex/OneDrive/MEDUCA/AGENTES/AGENTE_LIBRETA_CALIFICACIONES/data/initial_data.js';
const content = fs.readFileSync(srcPath, 'utf8');
const jsonStr = content.replace(/^export\s+const\s+initialData\s*=\s*/, '').replace(/;\s*$/, '');
const data = JSON.parse(jsonStr);

const list = [];
['3A', '3B', '3C'].forEach(gKey => {
  const grp = data.groups[gKey];
  if (!grp || !grp.students) return;
  grp.students.forEach(st => {
    const apellidos = (st.apellidos || '').trim();
    const nombres = (st.nombres || '').trim();
    const nombreNormal = (nombres + ' ' + apellidos).trim();
    const grupoLabel = gKey === '3A' ? '3°A' : (gKey === '3B' ? '3°B' : '3°C');
    list.push({
      id: st.id,
      num: st.num,
      grupo: gKey,
      grupo_label: grupoLabel,
      apellidos: apellidos,
      nombres: nombres,
      nombre: `${nombreNormal} (${grupoLabel})`,
      nombre_simple: nombreNormal,
      estado: st.estado || 'Activo'
    });
  });
});

console.log('Total estudiantes de 3er grado extraídos:', list.length);
fs.writeFileSync(path.join(__dirname, 'data', 'estudiantes.json'), JSON.stringify(list, null, 2), 'utf8');
console.log('Guardado exitosamente en data/estudiantes.json');
