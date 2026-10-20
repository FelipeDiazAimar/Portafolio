'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Body, Engine } from 'matter-js';
import {
  ALTO_ESCOBA,
  colocarSinImpulso,
  crearMundo,
  destruirMundo,
  liberarCuerpo,
  moverCuerpo,
  sacarDeEscena,
} from './mundoFisico.js';
import { crearGrabadora, leerCelda } from './grabadora.js';
import { desplazamientoEscoba, dibujarStickman, estaEmpujando } from './stickman.js';
import styles from './ColapsoFisico.module.css';

const PASO_MS = 1000 / 60;
// Radio alrededor del cursor dentro del cual una celda se desprende. Algo
// mayor que el radio del cuerpo del cursor, así se suelta justo antes de que
// el cursor la alcance y el empujón la encuentra ya cayendo.
//
// El mismo radio decide cuándo la LETRA entera pasa a verse en ASCII: son un
// único valor y no dos, porque con un radio de conversión más amplio se
// alcanzaban celdas de letras vecinas y esas letras se convertían sin que
// llegara a romperse nada de ellas.
const RADIO_ACCION_PX = 26;
const UMBRAL_QUIETUD = 0.85;
// Cuánto hay que dejar de romper cosas nuevas para que se considere terminada
// la interacción y entre el stickman.
const ESPERA_TRAS_ULTIMA_ROTURA_MS = 1500;
// Si el mouse entró al nombre pero no llegó a romper nada, el efecto se cierra
// solo en vez de quedar montado ocupando un rAF.
const TIEMPO_SIN_ROMPER_NADA_MS = 6000;
// Cuadros de caminata: a 60fps son ~27 s de punta a punta.
const CUADROS_PRESUPUESTO_CAMINATA = 1600;
const VELOCIDAD_STICKMAN_MINIMA_PX = 0.9;
// Cuántos px avanza el stickman por cada ciclo completo de barrido.
const DISTANCIA_POR_BARRIDO_PX = 90;
const MARGEN_FIN_BARRIDO_PX = 120;
const X_INICIAL_STICKMAN = -60;
const HOLGURA_SALIDA_PX = 80;
// Fotos que consume el rebobinado por cuadro. Menos de 1 lo hace más lento
// que la simulación original; las posiciones intermedias se interpolan entre
// foto y foto, así bajar la velocidad no lo vuelve un pase de diapositivas.
const PASO_REBOBINADO = 0.6;
// Ventana entre que el stickman sale de pantalla y arranca la reconstrucción.
// Si durante ese lapso el mouse rompe algo, vuelve a entrar; si no, se
// rebobina y ya no aparece más.
const ESPERA_ANTES_DE_REBOBINAR_MS = 2500;
// Demora extra antes de que el stickman entre por primera vez en toda la
// sesión (no en cada colapso: ColapsoFisico se remonta entero en cada uno,
// así que la marca vive a nivel de módulo, fuera del componente).
const DEMORA_EXTRA_PRIMERA_APARICION_MS = 2500;
let yaAparecioStickman = false;

// --- Modo 'resortes' (sin stickman) ---------------------------------------
// Cada carácter caído vuelve a su sitio tirado por un resorte subamortiguado:
// pasa un poco de largo y se asienta. Constantes en unidades por cuadro.
const RIGIDEZ_RESORTE = 0.014;
const AMORTIGUACION_RESORTE = 0.13;
// Los caracteres no salen todos a la vez: arrancan en una ola de izquierda a
// derecha, con un poco de azar para que no se vea mecánico.
const OLA_RESORTES_MS = 650;
const AZAR_RESORTES_MS = 260;
const TOLERANCIA_POSICION_PX = 0.35;
const TOLERANCIA_VELOCIDAD = 0.04;
const TOPE_RESORTES_MS = 5000;
const DOS_PI = Math.PI * 2;

export default function ColapsoFisico({
  campo,
  refContenedor,
  posicionInicialRaton,
  // 'resortes': los caracteres vuelven solos a su sitio, sin personaje.
  // 'stickman': entra un muñeco que barre y después se rebobina todo.
  modo = 'stickman',
  // 'raton': el cursor rompe lo que toca. 'tactil': un toque suelta todo de
  // golpe, y después el dedo empuja dentro de una zona acotada.
  modoEntrada = 'raton',
  // Rectángulo de página (left, top, width, height) que cubre el overlay. Sin
  // él, el overlay es el primer 100vh del documento, que es el hero.
  region = null,
  visible = true,
  alConvertirLetra,
  alTerminar,
}) {
  const refLienzo = useRef(null);
  // Dedo apoyado sobre la zona de empuje (coordenadas de página). Lo escriben
  // los manejadores del JSX y lo lee el bucle, por eso va en una ref.
  const refDedo = useRef({ activo: false, nuevo: false, x: 0, y: 0 });
  // Rectángulo (relativo al overlay) donde el dedo puede empujar letras.
  const [zonaEmpuje, setZonaEmpuje] = useState(null);
  // Los callbacks pueden cambiar de identidad entre renders; se leen por ref
  // para que el efecto no se reinicie (reiniciarlo destruiría la simulación).
  const refAlTerminar = useRef(alTerminar);
  refAlTerminar.current = alTerminar;
  const refAlConvertirLetra = useRef(alConvertirLetra);
  refAlConvertirLetra.current = alConvertirLetra;

  useEffect(() => {
    const lienzo = refLienzo.current;
    const contenedor = refContenedor.current;
    if (!lienzo || !contenedor) return undefined;

    const overlay = lienzo.parentElement;
    const ancho = overlay.clientWidth;
    const alto = overlay.clientHeight;
    const suelo = alto;

    // La caminata tiene que entrar SIEMPRE en el presupuesto de grabación: a
    // velocidad fija, en un viewport ancho el stickman todavía está barriendo
    // cuando la grabadora se llena, y el rebobinado corta a mitad de la barrida.
    const recorridoStickman = ancho + HOLGURA_SALIDA_PX - X_INICIAL_STICKMAN;
    const velocidadStickman = Math.max(
      VELOCIDAD_STICKMAN_MINIMA_PX,
      recorridoStickman / CUADROS_PRESUPUESTO_CAMINATA
    );

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    lienzo.width = ancho * dpr;
    lienzo.height = alto * dpr;
    const ctx = lienzo.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // --- Grilla -> celdas en coordenadas de página -----------------------
    // Analítico y no midiendo cada <span>: cientos de getBoundingClientRect
    // serían cientos de reflows forzados justo en el cuadro del disparo.
    // El overlay no siempre arranca en (0,0) de la página: el del footer
    // cubre sólo el footer. Todo se expresa relativo a su esquina.
    const tactil = modoEntrada === 'tactil';
    const desfaseX = region ? region.left : 0;
    const desfaseY = region ? region.top : 0;
    const rect = contenedor.getBoundingClientRect();
    const origenX = rect.left + window.scrollX - desfaseX;
    const origenY = rect.top + window.scrollY - desfaseY;
    const anchoCaracter = campo.paso - campo.separacion;

    const celdas = [];
    campo.columnas.forEach((columna, c) => {
      columna.forEach((celda, i) => {
        if (!celda.esNombre) return;
        celdas.push({
          caracter: celda.caracter,
          x: origenX + campo.izquierda + c * campo.paso + anchoCaracter / 2,
          y: origenY + campo.arriba + i * campo.tamanoCelda + campo.tamanoCelda / 2,
          // Se enciende cuando el mouse pasa por encima: recién ahí la celda
          // se suelta y cae.
          rota: false,
          letra: -1,
          // Posición dentro de la grabación. -1 mientras sigue colgada: sólo
          // se graban los caracteres rotos, que son los únicos que se mueven.
          ranura: -1,
        });
      });
    });

    if (celdas.length === 0) {
      refAlTerminar.current();
      return undefined;
    }

    // --- Letras -----------------------------------------------------------
    // La unidad de conversión a ASCII es la LETRA, no la celda: apenas el
    // mouse roza una letra, esa letra entera deja de dibujarse como
    // tipografía y pasa a verse como su nube de caracteres. Si no, el glifo
    // limpio seguía asomando por detrás de los caracteres y no se entendía.
    const letras = [];
    campo.lineasLimpias.forEach((linea) => {
      linea.letras.forEach((letra) => {
        letras.push({
          caracter: letra.caracter,
          fuente: linea.fuente,
          espaciado: linea.espaciado,
          baseline: origenY + campo.textoArriba + linea.lineaBase,
          x0: origenX + campo.textoIzquierda + letra.x,
          x1: origenX + campo.textoIzquierda + letra.x + letra.ancho,
          y0: origenY + campo.textoArriba + linea.bordeArriba,
          y1: origenY + campo.textoArriba + linea.bordeAbajo,
        });
      });
    });

    const letraConvertida = new Array(letras.length).fill(false);

    // Zona donde el dedo puede empujar: la columna del nombre con un margen,
    // extendida hasta el piso, porque las letras caen y hay que poder alcanzarlas.
    // Es lo único que bloquea el scroll mientras dura el efecto (en táctil son
    // unos pocos segundos).
    if (tactil && letras.length > 0) {
      const margen = 28;
      const izquierda = Math.min(...letras.map((l) => l.x0)) - margen;
      const derecha = Math.max(...letras.map((l) => l.x1)) + margen;
      const arriba = Math.min(...letras.map((l) => l.y0)) - margen;
      const abajo = alto;
      setZonaEmpuje({
        left: izquierda,
        top: arriba,
        width: derecha - izquierda,
        height: abajo - arriba,
      });
    }

    celdas.forEach((celda) => {
      for (let l = 0; l < letras.length; l += 1) {
        const letra = letras[l];
        if (celda.x < letra.x0 || celda.x >= letra.x1) continue;
        if (celda.y < letra.y0 || celda.y >= letra.y1) continue;
        celda.letra = l;
        return;
      }
    });

    // Una celda fuera de toda caja de letra (bordes del muestreo) no tiene
    // glifo limpio que ocultar: se dibuja sola en cuanto se rompe.
    function celdaVisibleComoAscii(celda) {
      return celda.letra >= 0 ? letraConvertida[celda.letra] : celda.rota;
    }

    // --- Mundo, grabadora y estado local --------------------------------
    const { motor, cuerposDeCaracteres, cuerpoCursor, cuerpoEscoba } = crearMundo({
      ancho,
      alto,
      celdas,
      anchoCaracter,
      altoCaracter: campo.tamanoCelda,
    });
    const grabadora = crearGrabadora();
    // Cuerpos ya sueltos, en el orden en que se rompieron. Ese orden ES la
    // ranura con la que cada uno se guarda y se lee de la grabación.
    const cuerposRotos = [];
    // Estado de cada resorte, indexado igual que `celdas`. Sólo se llena al
    // empezar la fase 'resortes'.
    const resortes = [];
    let momentoInicioResortes = 0;

    const fuenteAscii = `${campo.tamanoCelda}px monospace`;

    const raton = {
      x: posicionInicialRaton.x - desfaseX,
      y: posicionInicialRaton.y - desfaseY,
    };
    const stickman = { x: X_INICIAL_STICKMAN, paso: 0 };
    let fase = 'rompiendo';
    let indiceRebobinado = 0;
    let bucle = 0;
    // 0 hasta que se cumplen las condiciones normales de entrada; desde ahí
    // se cuenta la demora extra de la primera aparición.
    let momentoListoParaBarrer = 0;
    let terminado = false;
    let rotas = 0;
    let escobaApoyada = false;
    let momentoUltimaRotura = 0;
    let momentoSalida = 0;
    const inicio = performance.now();

    function alMoverse(evento) {
      raton.x = evento.clientX + window.scrollX - desfaseX;
      raton.y = evento.clientY + window.scrollY - desfaseY;
    }
    if (!tactil) window.addEventListener('mousemove', alMoverse, { passive: true });

    // --- Rotura localizada ----------------------------------------------
    // Se mide contra la posición ORIGINAL de la celda, que es la zona de la
    // letra por la que pasa el mouse. Lo que no se toca queda colgado.
    function romperCercanas(ahora) {
      for (let i = 0; i < celdas.length; i += 1) {
        const celda = celdas[i];
        const dx = raton.x - celda.x;
        const dy = raton.y - celda.y;
        const distancia2 = dx * dx + dy * dy;
        if (distancia2 > RADIO_ACCION_PX * RADIO_ACCION_PX) continue;

        // La letra entera pasa a verse como caracteres…
        if (celda.letra >= 0 && !letraConvertida[celda.letra]) {
          letraConvertida[celda.letra] = true;
          refAlConvertirLetra.current?.(celda.letra);
        }

        // …y se desprende la celda que el mouse tocó.
        if (celda.rota) continue;
        celda.rota = true;
        celda.ranura = cuerposRotos.length;
        cuerposRotos.push(cuerposDeCaracteres[i]);
        liberarCuerpo(cuerposDeCaracteres[i]);
        rotas += 1;
        momentoUltimaRotura = ahora;
      }
    }

    // Sólo cuentan las celdas que efectivamente se soltaron: las que siguen
    // colgadas están quietas por definición y falsearían la fracción.
    function fraccionRotasQuietas() {
      if (rotas === 0) return 0;
      let quietas = 0;
      for (let i = 0; i < celdas.length; i += 1) {
        if (!celdas[i].rota) continue;
        if (cuerposDeCaracteres[i].speed < 0.4) quietas += 1;
      }
      return quietas / rotas;
    }

    // --- Simulación ------------------------------------------------------
    function actualizarStickman() {
      if (fase !== 'barrido' && fase !== 'salida') return;
      stickman.x += velocidadStickman;
      stickman.paso += velocidadStickman / DISTANCIA_POR_BARRIDO_PX;

      // La escoba sólo empuja en el trazo de ida; en el retorno se levanta.
      // Si siguiera apoyada al volver arrastraría de vuelta lo que juntó.
      const apoyar = fase === 'barrido' && estaEmpujando(stickman.paso);
      if (!apoyar) {
        if (escobaApoyada) {
          sacarDeEscena(cuerpoEscoba);
          escobaApoyada = false;
        }
        return;
      }

      const x = stickman.x + desplazamientoEscoba(stickman.paso, true);
      const y = suelo - ALTO_ESCOBA / 2;
      if (escobaApoyada) {
        moverCuerpo(cuerpoEscoba, x, y);
      } else {
        // Vuelve del estacionamiento (-9999): con `moverCuerpo` ese salto
        // entraría al solver como miles de px/paso y dispararía lo que toque.
        colocarSinImpulso(cuerpoEscoba, x, y);
        escobaApoyada = true;
      }
    }

    // Lo manda de nuevo al arranque. La escoba se estaciona sí o sí: si
    // quedara apoyada, el teleport del stickman la movería de una punta a la
    // otra con `moverCuerpo` y ese salto entra al solver como un impulso
    // enorme, disparando todo lo que toque.
    function reiniciarPasada() {
      stickman.x = X_INICIAL_STICKMAN;
      fase = 'barrido';
      sacarDeEscena(cuerpoEscoba);
      escobaApoyada = false;
    }

    function empezarResortes(ahora) {
      fase = 'resortes';
      momentoInicioResortes = ahora;
      sacarDeEscena(cuerpoCursor);
      let minX = Infinity;
      let maxX = -Infinity;
      for (let i = 0; i < celdas.length; i += 1) {
        minX = Math.min(minX, celdas[i].x);
        maxX = Math.max(maxX, celdas[i].x);
      }
      const extension = Math.max(1, maxX - minX);
      for (let i = 0; i < celdas.length; i += 1) {
        const celda = celdas[i];
        if (!celda.rota) continue;
        const cuerpo = cuerposDeCaracteres[i];
        // Ángulo llevado a (-π, π]: el carácter gira por el camino corto.
        let angulo = cuerpo.angle % DOS_PI;
        if (angulo > Math.PI) angulo -= DOS_PI;
        if (angulo < -Math.PI) angulo += DOS_PI;
        resortes[i] = {
          x: cuerpo.position.x,
          y: cuerpo.position.y,
          angulo,
          vx: 0,
          vy: 0,
          va: 0,
          demora:
            ((celda.x - minX) / extension) * OLA_RESORTES_MS + Math.random() * AZAR_RESORTES_MS,
        };
      }
    }

    // Un paso de todos los resortes. Devuelve true cuando ya están todos en
    // su sitio y quietos.
    function avanzarResortes(ahora) {
      const transcurrido = ahora - momentoInicioResortes;
      let todosAsentados = true;
      for (let i = 0; i < celdas.length; i += 1) {
        const resorte = resortes[i];
        if (!resorte) continue;
        const celda = celdas[i];
        if (transcurrido < resorte.demora) {
          todosAsentados = false;
          continue;
        }
        resorte.vx += (celda.x - resorte.x) * RIGIDEZ_RESORTE - resorte.vx * AMORTIGUACION_RESORTE;
        resorte.vy += (celda.y - resorte.y) * RIGIDEZ_RESORTE - resorte.vy * AMORTIGUACION_RESORTE;
        resorte.va += -resorte.angulo * RIGIDEZ_RESORTE - resorte.va * AMORTIGUACION_RESORTE;
        resorte.x += resorte.vx;
        resorte.y += resorte.vy;
        resorte.angulo += resorte.va;

        const quieto =
          Math.abs(celda.x - resorte.x) < TOLERANCIA_POSICION_PX &&
          Math.abs(celda.y - resorte.y) < TOLERANCIA_POSICION_PX &&
          Math.abs(resorte.vx) < TOLERANCIA_VELOCIDAD &&
          Math.abs(resorte.vy) < TOLERANCIA_VELOCIDAD &&
          Math.abs(resorte.angulo) < 0.02;
        if (!quieto) todosAsentados = false;
      }
      return todosAsentados || transcurrido > TOPE_RESORTES_MS;
    }

    function empezarRebobinado() {
      fase = 'rebobinado';
      indiceRebobinado = grabadora.cantidad - 1;
      sacarDeEscena(cuerpoEscoba);
      sacarDeEscena(cuerpoCursor);
    }

    // Devuelve true si el efecto terminó y el bucle no debe seguir.
    function evaluarTransicion(ahora) {
      if (fase === 'rompiendo') {
        if (rotas === 0) {
          // Entró al nombre pero no rompió nada: se cierra solo.
          if (ahora - inicio > TIEMPO_SIN_ROMPER_NADA_MS) {
            terminar();
            return true;
          }
          return false;
        }
        const listo =
          ahora - momentoUltimaRotura > ESPERA_TRAS_ULTIMA_ROTURA_MS &&
          fraccionRotasQuietas() > UMBRAL_QUIETUD;
        if (!listo) return false;

        if (modo === 'resortes') {
          empezarResortes(ahora);
          return false;
        }

        // La primera vez que el stickman aparece en toda la sesión, se suma
        // una demora extra antes de dejarlo entrar. Las veces siguientes
        // (mismo colapso con otra pasada, o un colapso nuevo) no la pagan.
        if (yaAparecioStickman) {
          fase = 'barrido';
          return false;
        }
        if (momentoListoParaBarrer === 0) momentoListoParaBarrer = ahora;
        if (ahora - momentoListoParaBarrer < DEMORA_EXTRA_PRIMERA_APARICION_MS) return false;
        yaAparecioStickman = true;
        fase = 'barrido';
        return false;
      }
      if (fase === 'barrido' && stickman.x > ancho - MARGEN_FIN_BARRIDO_PX) {
        fase = 'salida';
        return false;
      }
      // Al salir siempre se abre la ventana de espera: es ahí, y sólo ahí,
      // donde se decide si vuelve o si se rebobina.
      if (fase === 'salida' && stickman.x > ancho + HOLGURA_SALIDA_PX) {
        fase = 'espera';
        momentoSalida = ahora;
        sacarDeEscena(cuerpoEscoba);
        escobaApoyada = false;
        return false;
      }
      if (fase === 'espera') {
        // Romper algo durante la ventana lo hace volver a entrar. Que la
        // condición sea "hubo una rotura nueva" —y no "quedaron restos sin
        // barrer"— es lo que garantiza que esto termine: cada pasada de más
        // exige una acción del mouse, así que no puede quedarse en un ciclo
        // de pasadas persiguiendo un carácter que no logra empujar.
        if (momentoUltimaRotura > momentoSalida) {
          reiniciarPasada();
          return false;
        }
        if (ahora - momentoSalida > ESPERA_ANTES_DE_REBOBINAR_MS) empezarRebobinado();
      }
      return false;
    }

    // --- Dibujo ----------------------------------------------------------
    // Color leído por cuadro (no una sola vez al montar): el ThemeToggle
    // cambia data-theme en cualquier momento y body tiene transition de
    // color, así que fijarlo en el montaje dejaría los caracteres con el
    // color viejo, potencialmente invisibles contra el fondo nuevo. Se toma del
    // contenedor y no del body: el footer tiene fondo propio (blanco) con texto
    // oscuro aunque el sitio esté en tema oscuro.
    function abrirCuadro() {
      ctx.clearRect(0, 0, ancho, alto);
      return getComputedStyle(refContenedor.current ?? document.body).color;
    }

    // Mientras el efecto corre, el nombre lo dibuja ESTE canvas y no el DOM.
    // Se pinta letra por letra y se saltean las ya convertidas: así la
    // tipografía limpia desaparece de golpe para esa letra y no queda
    // asomando por detrás de sus caracteres.
    function dibujarLetrasIntactas(color) {
      ctx.save();
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      for (let l = 0; l < letras.length; l += 1) {
        if (letraConvertida[l]) continue;
        const letra = letras[l];
        ctx.font = letra.fuente;
        if ('letterSpacing' in ctx) ctx.letterSpacing = letra.espaciado;
        ctx.fillText(letra.caracter, letra.x0, letra.baseline);
      }
      ctx.restore();
    }

    // Los caracteres de las letras ya convertidas. Los que todavía no se
    // rompieron siguen quietos en su celda —el cuerpo estático devuelve su
    // posición original—, los rotos van donde los dejó la física.
    // `posicionDe` los resuelve del motor en vivo o de una foto grabada.
    function dibujarCaracteres(color, posicionDe) {
      ctx.save();
      ctx.font = fuenteAscii;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < celdas.length; i += 1) {
        if (!celdaVisibleComoAscii(celdas[i])) continue;
        const posicion = posicionDe(i);
        ctx.save();
        ctx.translate(posicion.x, posicion.y);
        ctx.rotate(posicion.angulo);
        ctx.fillText(celdas[i].caracter, 0, 0);
        ctx.restore();
      }
      ctx.restore();
    }

    function dibujarNombre(color, posicionDe) {
      dibujarLetrasIntactas(color);
      dibujarCaracteres(color, posicionDe);
    }

    function dibujarDesdeMotor() {
      const color = abrirCuadro();
      dibujarNombre(color, (i) => {
        const cuerpo = cuerposDeCaracteres[i];
        return { x: cuerpo.position.x, y: cuerpo.position.y, angulo: cuerpo.angle };
      });
      if (fase === 'barrido' || fase === 'salida') {
        dibujarStickman(
          ctx,
          { x: stickman.x, suelo, paso: stickman.paso, barriendo: fase === 'barrido' },
          color
        );
      }
    }

    function dibujarDesdeResortes() {
      const color = abrirCuadro();
      dibujarNombre(color, (i) => {
        const resorte = resortes[i];
        // Sin resorte = nunca se rompió: sigue en su sitio original.
        if (!resorte) return { x: celdas[i].x, y: celdas[i].y, angulo: 0 };
        return { x: resorte.x, y: resorte.y, angulo: resorte.angulo };
      });
    }

    // El stickman no se dibuja acá: una vez que se fue, se fue. No vuelve
    // caminando hacia atrás como parte de la reconstrucción.
    //
    // Se interpola entre dos fotos consecutivas para poder rebobinar a menos
    // de una foto por cuadro sin que se vea a los saltos.
    function dibujarDesdeFotos(fotoA, fotoB, mezcla) {
      const color = abrirCuadro();
      dibujarNombre(color, (i) => {
        const celda = celdas[i];
        const a = leerCelda(fotoA, celda.ranura);
        // Sin dato en esa foto = todavía no se había roto: seguía colgada.
        if (!a) return { x: celda.x, y: celda.y, angulo: 0 };
        if (mezcla === 0) return a;
        const b = leerCelda(fotoB, celda.ranura) || a;
        return {
          x: a.x + (b.x - a.x) * mezcla,
          y: a.y + (b.y - a.y) * mezcla,
          angulo: a.angulo + (b.angulo - a.angulo) * mezcla,
        };
      });
    }

    // --- Bucle único -----------------------------------------------------
    function terminar() {
      if (terminado) return;
      terminado = true;
      refAlTerminar.current();
    }

    function cuadro(ahora) {
      if (fase === 'resortes') {
        // Los resortes mandan sobre la física: ya no hay simulación.
        if (avanzarResortes(ahora)) {
          // El último cuadro, con todo en su sitio, llega a verse antes de
          // devolverle el lugar al texto del DOM.
          dibujarDesdeResortes();
          return terminar();
        }
        dibujarDesdeResortes();
      } else if (fase === 'rebobinado') {
        const indice = Math.max(0, indiceRebobinado);
        const base = Math.floor(indice);
        const fotoA = grabadora.leerCuadro(base);
        if (!fotoA) return terminar();
        dibujarDesdeFotos(fotoA, grabadora.leerCuadro(base + 1) || fotoA, indice - base);
        // El corte va DESPUÉS de dibujar, así la foto 0 —el nombre intacto—
        // llega a verse antes de devolverle el lugar al texto del DOM.
        if (indiceRebobinado <= 0) return terminar();
        indiceRebobinado -= PASO_REBOBINADO;
      } else {
        if (tactil) {
          // El cursor sólo existe mientras el dedo está apoyado en la zona.
          const dedo = refDedo.current;
          if (dedo.activo) {
            const dedoX = dedo.x - desfaseX;
            const dedoY = dedo.y - desfaseY;
            if (dedo.nuevo) {
              colocarSinImpulso(cuerpoCursor, dedoX, dedoY);
              dedo.nuevo = false;
            } else {
              moverCuerpo(cuerpoCursor, dedoX, dedoY);
            }
            // Mientras el dedo juega no se da por terminada la interacción.
            momentoUltimaRotura = ahora;
          } else {
            sacarDeEscena(cuerpoCursor);
          }
        } else {
          moverCuerpo(cuerpoCursor, raton.x, raton.y);
        }
        // Se puede seguir rompiendo en cualquier momento antes del
        // rebobinado, no sólo al principio: romper mientras barre lo hace
        // dar otra pasada.
        if (!tactil) romperCercanas(ahora);
        actualizarStickman();
        // Delta fijo: con delta variable la simulación se desestabiliza al
        // caer un cuadro y la grabación deja de ser reproducible.
        Engine.update(motor, PASO_MS);

        // Durante la espera previa al rebobinado no se graba: si no, la
        // reconstrucción arrancaría con un tramo congelado. El intervalo lo
        // maneja la propia grabadora.
        if (modo === 'stickman' && fase !== 'espera') grabadora.grabarCuadro(cuerposRotos);

        if (evaluarTransicion(ahora)) return undefined;
        dibujarDesdeMotor();
      }
      bucle = requestAnimationFrame(cuadro);
      return undefined;
    }

    // El cursor nace estacionado en (-9999,-9999); reubicarlo con
    // `moverCuerpo` (con impulso) en el primer cuadro entraría al solver como
    // un salto de ~14.000 px/paso. Se lo coloca sin impulso ANTES del cuadro 0.
    if (!tactil) colocarSinImpulso(cuerpoCursor, raton.x, raton.y);

    // Cuadro 0 = el nombre intacto, sin ninguna celda rota. Es el último
    // fotograma del rebobinado, o sea a lo que vuelve el nombre.
    if (modo === 'stickman') grabadora.grabarCuadro(cuerposDeCaracteres);

    // Táctil: no hay cursor que vaya rompiendo, así que se suelta TODO de golpe,
    // con un empujón hacia arriba y a los costados para que se note. Va después
    // del cuadro 0 de la grabación, que tiene que ser el nombre intacto.
    if (tactil) {
      for (let i = 0; i < celdas.length; i += 1) {
        const celda = celdas[i];
        celda.rota = true;
        celda.ranura = cuerposRotos.length;
        cuerposRotos.push(cuerposDeCaracteres[i]);
        liberarCuerpo(cuerposDeCaracteres[i]);
        Body.setVelocity(cuerposDeCaracteres[i], {
          x: (Math.random() - 0.5) * 7,
          y: -(2.5 + Math.random() * 5.5),
        });
        Body.setAngularVelocity(cuerposDeCaracteres[i], (Math.random() - 0.5) * 0.4);
      }
      rotas = celdas.length;
      for (let l = 0; l < letras.length; l += 1) {
        if (letraConvertida[l]) continue;
        letraConvertida[l] = true;
        refAlConvertirLetra.current?.(l);
      }
      momentoUltimaRotura = inicio;
    }

    bucle = requestAnimationFrame(cuadro);

    return () => {
      cancelAnimationFrame(bucle);
      window.removeEventListener('mousemove', alMoverse);
      grabadora.liberar();
      destruirMundo(motor);
    };
    // posicionInicialRaton se lee una sola vez al montar, a propósito: no
    // debe reiniciar la simulación si cambia.
    //
    // `campo` como dependencia es seguro SÓLO porque el intervalo que
    // resortea caracteres corre únicamente en la fase 'onda', y el colapso
    // se dispara en 'desvanecido': mientras este componente vive, `campo`
    // no se reemplaza. Si eso cambiara, cada tick del titileo destruiría y
    // recrearía la simulación — el mismo bug que ya rompió dos veces la
    // cadena de fases de NombreAscii.
    //
    // `visible` tampoco entra acá a propósito: sólo controla la opacidad del
    // overlay (abajo, en el JSX). La simulación —y su grabación— tienen que
    // seguir corriendo debajo aunque la capa esté desvanecida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campo, refContenedor]);

  return createPortal(
    <div
      className={`${styles.overlay} ${visible ? '' : styles.oculto}`}
      style={
        region
          ? { left: region.left, top: region.top, width: region.width, height: region.height }
          : undefined
      }
      aria-hidden="true"
    >
      <canvas ref={refLienzo} className={styles.lienzo} />
      {zonaEmpuje && (
        <div
          className={styles.zonaEmpuje}
          style={zonaEmpuje}
          onPointerDown={(evento) => {
            evento.currentTarget.setPointerCapture(evento.pointerId);
            refDedo.current = {
              activo: true,
              nuevo: true,
              x: evento.clientX + window.scrollX,
              y: evento.clientY + window.scrollY,
            };
          }}
          onPointerMove={(evento) => {
            if (!refDedo.current.activo) return;
            refDedo.current.x = evento.clientX + window.scrollX;
            refDedo.current.y = evento.clientY + window.scrollY;
          }}
          onPointerUp={() => {
            refDedo.current.activo = false;
          }}
          onPointerCancel={() => {
            refDedo.current.activo = false;
          }}
        />
      )}
    </div>,
    document.body
  );
}
