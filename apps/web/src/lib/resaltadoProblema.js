// Frases clave de la problemática de cada proyecto: se resaltan con brillo en la tarjeta.
// Van aparte de proyectos.json para que el dato siga siendo texto limpio (lo usan también
// las páginas de cada proyecto). Cada frase tiene que aparecer tal cual en `problema`.
export const FRASES_CLAVE = {
  'mbrf-captura': ['terminales legacy de los 90', 'sin peso automático', 'SAP desfasado'],
  'mbrf-control': ['planillas', 'datalake'],
  neifert: ['WhatsApp e Instagram', 'sin catálogo propio', 'los leads se perdían'],
  'dario-martinez': ['presencia web', 'control de stock', 'papel y planillas'],
  justphones: ['sin catálogo por modelo', 'sin códigos de descuento', 'sin saber cuánto ganaba'],
  algobonito: ['sin tienda propia', 'cobro online', 'a mano'],
  'calida-escencia': ['vender online', 'WhatsApp'],
  asistente: ['un lugar único', 'material confiable'],
  'control-salidas-rrhh': ['en papel', 'quién estaba fuera'],
  'gestor-proyectos-sap': ['planillas sueltas', 'vista única'],
  bibliotech: ['encuentren libros', 'reserven salas de estudio'],
  movii: ['planificar rutas', 'el cliente siga su envío'],
  'crm-inmobiliaria': ['registros separados', 'vista común'],
};

// Rangos [inicio, fin) de las frases clave dentro de `texto`, ordenados y sin solaparse.
export function rangosClave(texto, frases = []) {
  const rangos = [];
  for (const frase of frases) {
    const inicio = texto.indexOf(frase);
    if (inicio >= 0) rangos.push([inicio, inicio + frase.length]);
  }
  rangos.sort((a, b) => a[0] - b[0]);
  return rangos.filter((rango, i) => i === 0 || rango[0] >= rangos[i - 1][1]);
}
