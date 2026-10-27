const fs = require('fs');
const path = require('path');

const srcPath = 'C:/Users/Alex/OneDrive/MEDUCA/AGENTES/AGENTE_LIBRETA_CALIFICACIONES/data/initial_data.js';
const content = fs.readFileSync(srcPath, 'utf8');
const jsonStr = content.replace(/^export\s+const\s+initialData\s*=\s*/, '').replace(/;\s*$/, '');
const data = JSON.parse(jsonStr);

const list = [];
['3A', '3B', '3C', '4A', '4B', '4C', '5A', '5B', '5C'].forEach(gKey => {
  const grp = data.groups[gKey];
  if (!grp || !grp.students) return;
  const gradoNum = parseInt(gKey.charAt(0), 10);
  const letra = gKey.slice(-1);
  const grupoLabel = gradoNum + '°' + letra;

  grp.students.forEach(st => {
    const apellidos = (st.apellidos || '').trim();
    const nombres = (st.nombres || '').trim();
    const nombreNormal = (nombres + ' ' + apellidos).trim();
    list.push({
      id: st.id,
      num: st.num,
      grado: gradoNum,
      grupo: gKey,
      grupo_label: grupoLabel,
      apellidos: apellidos,
      nombres: nombres,
      nombre: nombreNormal + ' (' + grupoLabel + ')',
      nombre_simple: nombreNormal,
      estado: st.estado || 'Activo'
    });
  });
});

console.log('Total estudiantes 3ro, 4to y 5to:', list.length);
console.log('3er Grado:', list.filter(s => s.grado === 3).length);
console.log('4to Grado:', list.filter(s => s.grado === 4).length);
console.log('5to Grado:', list.filter(s => s.grado === 5).length);
fs.writeFileSync(path.join(__dirname, 'data', 'estudiantes.json'), JSON.stringify(list, null, 2), 'utf8');
console.log('Guardado exitosamente en data/estudiantes.json');
