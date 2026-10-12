import { DURACION_TOTAL, RETRASO_PANTALLA } from '../components/SobreMi/Escena3D/pantallaNotebook.js';
import { T_FIN_TILDES } from '../components/SobreMi/Escena3D/cicloMaterias.js';
import { DURACION_CICLO } from '../components/SobreMi/Escena3D/cicloPC.js';
import { T_RED } from '../components/SobreMi/Escena3D/constelacion.js';

// Segundos que el modelo de cada hito tiene que estar a la vista haciendo lo suyo
// (abrirse, tildar las materias, un ciclo de la placa, el recorrido de la planta,
// armarse el grafo…) antes de que la biografía pueda reemplazarlo. Salen de la
// duración real de cada animación.
const SEGUNDOS = {
  0: DURACION_TOTAL + RETRASO_PANTALLA,
  1: 5,
  2: T_FIN_TILDES + 2,
  3: DURACION_CICLO,
  4: 7,
  5: 12,
  6: T_RED[1] + 1,
};
// Lo que tarda en dispersarse la escena anterior y cargar la nueva.
const CAMBIO_DE_ESCENA = 1.5;
const POR_DEFECTO = 7;
const MAXIMO = 14;

// Milisegundos de espera desde que un hito pasa a ser el activo.
export function tiempoModeloMs(idHito) {
  const segundos = Math.min(MAXIMO, (SEGUNDOS[idHito] ?? POR_DEFECTO) + CAMBIO_DE_ESCENA);
  return Math.round(segundos * 1000);
}
