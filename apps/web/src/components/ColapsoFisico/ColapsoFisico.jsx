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
const RADIO_ROTURA_PX = 30;
const UMBRAL_QUIETUD = 0.85;
// Cuánto hay que dejar de romper cosas nuevas para que se considere terminada
// la interacción y entre el stickman.
const ESPERA_TRAS_ULTIMA_ROTURA_MS = 1500;
// Si el mouse entró al nombre pero no llegó a romper nada, el efecto se cierra
// solo en vez de quedar montado ocupando un rAF.
const TIEMPO_SIN_ROMPER_NADA_MS = 6000;
// Cuadros de caminata. Es el doble que antes a propósito: el barrido tenía que
// ser mucho más lento.
const CUADROS_PRESUPUESTO_CAMINATA = 1000;
const VELOCIDAD_STICKMAN_MINIMA_PX = 0.8;
// Cuántos px avanza el stickman por cada ciclo completo de barrido.
const DISTANCIA_POR_BARRIDO_PX = 90;
const MARGEN_FIN_BARRIDO_PX = 120;
const X_INICIAL_STICKMAN = -60;
const HOLGURA_SALIDA_PX = 80;
// Se graba uno de cada dos cuadros: con el barrido lento la simulación dura
// demasiado para grabarla entera. El rebobinado avanza una foto por cuadro, o
// sea que sale al doble de velocidad — que es justo el efecto de rebobinar.
const INTERVALO_GRABACION = 2;
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
          // deja de ser tipografía limpia y pasa a ser un carácter suelto.
          rota: false,
        });
      });
    });

    if (celdas.length === 0) {
      refAlTerminar.current();
      return undefined;
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
        if (celda.rota) continue;
        const dx = raton.x - celda.x;
        const dy = raton.y - celda.y;
        if (dx * dx + dy * dy > RADIO_ROTURA_PX * RADIO_ROTURA_PX) continue;
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
        fase = 'espera';
        momentoSalida = ahora;
        sacarDeEscena(cuerpoEscoba);
        escobaApoyada = false;
        return false;
      }
      if (fase === 'espera' && ahora - momentoSalida > ESPERA_ANTES_DE_REBOBINAR_MS) {
        empezarRebobinado();
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

    // Mientras el efecto corre, el nombre lo dibuja ESTE canvas y no el DOM:
    // es la única forma de irle abriendo huecos celda por celda.
    function dibujarTextoLimpio(color) {
      ctx.save();
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      campo.lineasLimpias.forEach((linea) => {
        ctx.font = linea.fuente;
        if ('letterSpacing' in ctx) ctx.letterSpacing = linea.espaciado;
        ctx.fillText(
          linea.texto,
          origenX + campo.textoIzquierda + linea.x,
          origenY + campo.textoArriba + linea.lineaBase
        );
      });
      ctx.restore();
    }

    // Recorta del texto limpio la celda de cada carácter ya roto. El hueco
    // queda fijo en la posición original aunque el carácter ya se haya caído:
    // por eso la letra se ve mordida justo por donde pasó el mouse.
    //
    // El hueco cubre TODO el paso de la columna (ancho de carácter +
    // separación), no sólo el ancho del carácter: la grilla ASCII deja aire
    // entre columnas pero el texto limpio es continuo, así que recortando
    // sólo el carácter quedaban tiras verticales de texto sin borrar en cada
    // separación. El sangrado extra evita costuras de un píxel por redondeo.
    const SANGRADO_HUECO_PX = 0.5;
    const huecoAncho = campo.paso + SANGRADO_HUECO_PX * 2;
    const huecoAlto = campo.tamanoCelda + SANGRADO_HUECO_PX * 2;
    const huecoOffsetX = anchoCaracter / 2 + campo.separacion / 2 + SANGRADO_HUECO_PX;
    const huecoOffsetY = campo.tamanoCelda / 2 + SANGRADO_HUECO_PX;

    function abrirHuecos() {
      for (let i = 0; i < celdas.length; i += 1) {
        const celda = celdas[i];
        if (!celda.rota) continue;
        ctx.clearRect(celda.x - huecoOffsetX, celda.y - huecoOffsetY, huecoAncho, huecoAlto);
      }
    }

    // `posicionDe` devuelve dónde va cada carácter roto: del motor en vivo o
    // de una foto grabada, según la fase.
    function dibujarCaracteresRotos(color, posicionDe) {
      ctx.save();
      ctx.font = fuenteAscii;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < celdas.length; i += 1) {
        if (!celdas[i].rota) continue;
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
      dibujarTextoLimpio(color);
      abrirHuecos();
      dibujarCaracteresRotos(color, posicionDe);
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
    function dibujarDesdeFoto(foto) {
      const color = abrirCuadro();
      dibujarNombre(color, (i) => leerCelda(foto, i));
    }

    // --- Bucle único -----------------------------------------------------
    function terminar() {
      if (terminado) return;
      terminado = true;
      refAlTerminar.current();
    }

    function cuadro(ahora) {
      if (fase === 'rebobinado') {
        const foto = grabadora.leerCuadro(indiceRebobinado);
        if (!foto) return terminar();
        dibujarDesdeFoto(foto);
        indiceRebobinado -= 1;
        if (indiceRebobinado < 0) return terminar();
      } else {
        moverCuerpo(cuerpoCursor, raton.x, raton.y);
        if (fase === 'rompiendo') romperCercanas(ahora);
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
