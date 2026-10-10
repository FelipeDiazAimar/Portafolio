// Guion de la pantalla de la notebook del origen, como función pura del tiempo
// `t` (segundos desde que la escena está activa). El dibujo real vive en
// `dibujarPantalla.js`; acá sólo se decide QUÉ se ve en cada instante.
export const LINEAS = [
  { comando: 'whoami', salida: 'quien repara y mejora' },
  { comando: 'beep', salida: 'beep beep beep' },
];
export const CARACTERES_POR_SEGUNDO = 12;

const PAUSA_TRAS_COMANDO = 0.5;
const PAUSA_TRAS_SALIDA = 0.7;
// Cuánto dura "hundida" una tecla después de escribirse su letra.
const VENTANA_TECLA = 0.09;

const T_ARRANQUE = 0.8;
const T_ESCRITORIO = 3.8;
const T_APERTURA = 5.0;
const T_COMANDOS = 5.8;

function construirHorario() {
  let inicio = T_COMANDOS;
  return LINEAS.map((linea) => {
    const salidaEn = inicio + linea.comando.length / CARACTERES_POR_SEGUNDO + PAUSA_TRAS_COMANDO;
    const entrada = { ...linea, inicio, salidaEn };
    inicio = salidaEn + PAUSA_TRAS_SALIDA;
    return entrada;
  });
}

const HORARIO = construirHorario();
export const DURACION_TOTAL = HORARIO[HORARIO.length - 1].salidaEn + PAUSA_TRAS_SALIDA;

export function estadoPantalla(t) {
  if (t < T_ARRANQUE) {
    return { fase: 'apagada', progreso: 0, apertura: 0, lineas: [], cursorVisible: false };
  }
  if (t < T_ESCRITORIO) {
    return {
      fase: 'arranque',
      progreso: (t - T_ARRANQUE) / (T_ESCRITORIO - T_ARRANQUE),
      apertura: 0,
      lineas: [],
      cursorVisible: false,
    };
  }
  if (t < T_APERTURA) {
    return { fase: 'escritorio', progreso: 1, apertura: 0, lineas: [], cursorVisible: false };
  }

  const apertura = Math.min(1, (t - T_APERTURA) / (T_COMANDOS - T_APERTURA));
  const lineas = [];
  for (const entrada of HORARIO) {
    if (t < entrada.inicio) break;
    const escritos = Math.min(
      entrada.comando.length,
      Math.floor((t - entrada.inicio) * CARACTERES_POR_SEGUNDO)
    );
    lineas.push(`> ${entrada.comando.slice(0, escritos)}`);
    if (t >= entrada.salidaEn) lineas.push(entrada.salida);
  }
  return {
    fase: 'terminal',
    progreso: 1,
    apertura,
    lineas,
    cursorVisible: Math.floor(t * 2) % 2 === 0,
  };
}

// Índice de la tecla que está hundida en el instante `t`, o -1. La tecla de
// cada letra sale de su código, así "escribir" siempre mueve las mismas teclas.
export function teclaPresionada(t, totalTeclas) {
  for (const entrada of HORARIO) {
    for (let k = 0; k < entrada.comando.length; k += 1) {
      const instante = entrada.inicio + (k + 1) / CARACTERES_POR_SEGUNDO;
      if (t >= instante && t < instante + VENTANA_TECLA) {
        return (entrada.comando.charCodeAt(k) * 7 + k) % totalTeclas;
      }
    }
  }
  return -1;
}
