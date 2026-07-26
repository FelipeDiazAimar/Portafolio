'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Engine } from 'matter-js';
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
const RADIO_ROTURA_PX = 26;
// Radio, más amplio, con el que la LETRA entera pasa a verse en ASCII. Es
// mayor que el de rotura a propósito: primero se ve la letra convertirse en
// caracteres y recién después se le empiezan a caer los que toca el mouse.
const RADIO_CONVERSION_PX = 48;
const UMBRAL_QUIETUD = 0.85;
// Cuánto hay que dejar de romper cosas nuevas para que se considere terminada
// la interacción y entre el stickman.
const ESPERA_TRAS_ULTIMA_ROTURA_MS = 1500;
// Si el mouse entró al nombre pero no llegó a romper nada, el efecto se cierra
// solo en vez de quedar montado ocupando un rAF.
const TIEMPO_SIN_ROMPER_NADA_MS = 6000;
// Cuadros de caminata: a 60fps son ~27 s de punta a punta.
const CUADROS_PRESUPUESTO_CAMINATA = 1600;
const VELOCIDAD_STICKMAN_MINIMA_PX = 0.5;
// Cuántos px avanza el stickman por cada ciclo completo de barrido.
const DISTANCIA_POR_BARRIDO_PX = 90;
const MARGEN_FIN_BARRIDO_PX = 120;
const X_INICIAL_STICKMAN = -60;
const HOLGURA_SALIDA_PX = 80;
// Se graba uno de cada dos cuadros: con el barrido lento la simulación dura
// demasiado para grabarla entera.
const INTERVALO_GRABACION = 2;
// Fotos que consume el rebobinado por cuadro. Menos de 1 lo hace más lento
// que la simulación original; las posiciones intermedias se interpolan entre
// foto y foto, así bajar la velocidad no lo vuelve un pase de diapositivas.
const PASO_REBOBINADO = 0.6;
// Pausa entre que el stickman sale de pantalla y arranca la reconstrucción.
const ESPERA_ANTES_DE_REBOBINAR_MS = 1500;

export default function ColapsoFisico({
  campo,
  refContenedor,
  posicionInicialRaton,
  visible = true,
  alTerminar,
}) {
  const refLienzo = useRef(null);
  // El callback puede cambiar de identidad entre renders; se lee por ref para
  // que el efecto no se reinicie (reiniciarlo destruiría la simulación).
  const refAlTerminar = useRef(alTerminar);
  refAlTerminar.current = alTerminar;

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
    const rect = contenedor.getBoundingClientRect();
    const origenX = rect.left + window.scrollX;
    const origenY = rect.top + window.scrollY;
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
    const grabadora = crearGrabadora(cuerposDeCaracteres.length);

    const fuenteAscii = `${campo.tamanoCelda}px monospace`;

    const raton = { ...posicionInicialRaton };
    const stickman = { x: X_INICIAL_STICKMAN, paso: 0 };
    let fase = 'rompiendo';
    let indiceRebobinado = 0;
    let bucle = 0;
    let terminado = false;
    let rotas = 0;
    let contadorCuadros = 0;
    let escobaApoyada = false;
    let momentoUltimaRotura = 0;
    let momentoSalida = 0;
    const inicio = performance.now();

    function alMoverse(evento) {
      raton.x = evento.clientX + window.scrollX;
      raton.y = evento.clientY + window.scrollY;
    }
    window.addEventListener('mousemove', alMoverse, { passive: true });

    // --- Rotura localizada ----------------------------------------------
    // Se mide contra la posición ORIGINAL de la celda, que es la zona de la
    // letra por la que pasa el mouse. Lo que no se toca queda colgado.
    function romperCercanas(ahora) {
      for (let i = 0; i < celdas.length; i += 1) {
        const celda = celdas[i];
        const dx = raton.x - celda.x;
        const dy = raton.y - celda.y;
        const distancia2 = dx * dx + dy * dy;

        // Primero la letra entera se convierte a ASCII…
        if (celda.letra >= 0 && distancia2 <= RADIO_CONVERSION_PX * RADIO_CONVERSION_PX) {
          letraConvertida[celda.letra] = true;
        }

        // …y sólo se desprenden las celdas que el mouse toca de verdad.
        if (celda.rota) continue;
        if (distancia2 > RADIO_ROTURA_PX * RADIO_ROTURA_PX) continue;
        celda.rota = true;
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

    // ¿Quedó algo roto sin empujar hasta el borde derecho? Es lo que decide
    // si hace falta otra pasada.
    function quedanRestosSinBarrer() {
      const limite = ancho - MARGEN_FIN_BARRIDO_PX;
      for (let i = 0; i < celdas.length; i += 1) {
        if (!celdas[i].rota) continue;
        if (cuerposDeCaracteres[i].position.x < limite) return true;
      }
      return false;
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
        if (listo) fase = 'barrido';
        return false;
      }
      if (fase === 'barrido' && stickman.x > ancho - MARGEN_FIN_BARRIDO_PX) {
        fase = 'salida';
        return false;
      }
      if (fase === 'salida' && stickman.x > ancho + HOLGURA_SALIDA_PX) {
        // Si el mouse siguió rompiendo mientras barría, lo nuevo le quedó
        // atrás: en vez de irse, arranca otra pasada. La válvula de la
        // grabadora es lo que impide que esto se estire para siempre.
        const rompiendoTodavia = ahora - momentoUltimaRotura < ESPERA_TRAS_ULTIMA_ROTURA_MS;
        if (!grabadora.lleno && (rompiendoTodavia || quedanRestosSinBarrer())) {
          reiniciarPasada();
          return false;
        }
        fase = 'espera';
        momentoSalida = ahora;
        sacarDeEscena(cuerpoEscoba);
        escobaApoyada = false;
        return false;
      }
      if (fase === 'espera') {
        // Romper algo durante la pausa lo hace volver en vez de rebobinar.
        if (momentoUltimaRotura > momentoSalida && !grabadora.lleno) {
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
    // color viejo, potencialmente invisibles contra el fondo nuevo.
    function abrirCuadro() {
      ctx.clearRect(0, 0, ancho, alto);
      return getComputedStyle(document.body).color;
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

    // El stickman no se dibuja acá: una vez que se fue, se fue. No vuelve
    // caminando hacia atrás como parte de la reconstrucción.
    //
    // Se interpola entre dos fotos consecutivas para poder rebobinar a menos
    // de una foto por cuadro sin que se vea a los saltos.
    function dibujarDesdeFotos(fotoA, fotoB, mezcla) {
      const color = abrirCuadro();
      dibujarNombre(color, (i) => {
        const a = leerCelda(fotoA, i);
        if (mezcla === 0) return a;
        const b = leerCelda(fotoB, i);
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
      if (fase === 'rebobinado') {
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
        moverCuerpo(cuerpoCursor, raton.x, raton.y);
        // Se puede seguir rompiendo en cualquier momento antes del
        // rebobinado, no sólo al principio: romper mientras barre lo hace
        // dar otra pasada.
        romperCercanas(ahora);
        actualizarStickman();
        // Delta fijo: con delta variable la simulación se desestabiliza al
        // caer un cuadro y la grabación deja de ser reproducible.
        Engine.update(motor, PASO_MS);

        contadorCuadros += 1;
        // Durante la espera previa al rebobinado no se graba: si no, la
        // reconstrucción arrancaría con un tramo congelado.
        if (fase !== 'espera' && contadorCuadros % INTERVALO_GRABACION === 0) {
          grabadora.grabarCuadro(cuerposDeCaracteres);
        }

        if (evaluarTransicion(ahora)) return undefined;
        if (grabadora.lleno && fase !== 'rebobinado') empezarRebobinado();
        dibujarDesdeMotor();
      }
      bucle = requestAnimationFrame(cuadro);
      return undefined;
    }

    // El cursor nace estacionado en (-9999,-9999); reubicarlo con
    // `moverCuerpo` (con impulso) en el primer cuadro entraría al solver como
    // un salto de ~14.000 px/paso. Se lo coloca sin impulso ANTES del cuadro 0.
    colocarSinImpulso(cuerpoCursor, raton.x, raton.y);

    // Cuadro 0 = el nombre intacto, sin ninguna celda rota. Es el último
    // fotograma del rebobinado, o sea a lo que vuelve el nombre.
    grabadora.grabarCuadro(cuerposDeCaracteres);

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
      aria-hidden="true"
    >
      <canvas ref={refLienzo} className={styles.lienzo} />
    </div>,
    document.body
  );
}
