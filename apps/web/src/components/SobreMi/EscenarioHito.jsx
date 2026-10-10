import styles from './EscenarioHito.module.css';

const RAMPA = ' .:-=+*#%@';
const COLUMNAS = 34;
const FILAS = 14;

// MARCADOR DE POSICIÓN del modelo 3D (sub-proyecto 2): un bloque de caracteres
// con forma de mancha, distinto por hito. Es determinista (misma semilla →
// mismo bloque) para que el render del servidor y el del cliente coincidan.
// Se evita Math.hypot: no garantiza el mismo resultado bit a bit entre motores.
function generarBloque(semilla) {
  let estado = semilla * 9301 + 49297;
  const siguiente = () => {
    estado = (estado * 9301 + 49297) % 233280;
    return estado / 233280;
  };

  const lineas = [];
  for (let fila = 0; fila < FILAS; fila += 1) {
    let linea = '';
    for (let columna = 0; columna < COLUMNAS; columna += 1) {
      const dx = (columna / (COLUMNAS - 1)) * 2 - 1;
      const dy = (fila / (FILAS - 1)) * 2 - 1;
      const forma = 1 - Math.min(1, Math.sqrt(dx * dx + dy * 1.4 * (dy * 1.4)));
      const valor = forma * 0.8 + siguiente() * 0.35;
      linea += RAMPA[Math.min(RAMPA.length - 1, Math.floor(valor * RAMPA.length))];
    }
    lineas.push(linea);
  }
  return lineas.join('\n');
}

export default function EscenarioHito({ hito, desarmado }) {
  return (
    <div className={`${styles.escenario} ${desarmado ? styles.desarmado : ''}`} aria-hidden="true">
      <pre className={styles.bloque}>{generarBloque(hito.id + 1)}</pre>
    </div>
  );
}
