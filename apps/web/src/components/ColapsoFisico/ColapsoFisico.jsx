'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Engine } from 'matter-js';
import {
  ALTO_ESCOBA,
  crearMundo,
  destruirMundo,
  fraccionQuieta,
  moverCuerpo,
  sacarDeEscena,
} from './mundoFisico.js';
import { crearGrabadora, leerCelda, leerStickman } from './grabadora.js';
import { desplazamientoEscoba, dibujarStickman } from './stickman.js';
import styles from './ColapsoFisico.module.css';

const PASO_MS = 1000 / 60;
const UMBRAL_QUIETUD = 0.85;
const MINIMO_DERRUMBE_MS = 1200;
const CUADROS_PRESUPUESTO_CAMINATA = 520;
const VELOCIDAD_STICKMAN_MINIMA_PX = 2.2;
const MARGEN_FIN_BARRIDO_PX = 120;
const AVANCE_PASO_CAMINATA = 0.18;
const X_INICIAL_STICKMAN = -60;
const HOLGURA_SALIDA_PX = 80;

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

    // La caminata tiene que entrar SIEMPRE en el presupuesto de grabación:
    // a velocidad fija, en un viewport ancho el stickman todavía está barriendo
    // cuando la grabadora se llena, y el rebobinado corta a mitad de la barrida.
    // Se reparte el ancho real en un presupuesto fijo de cuadros y se deja el
    // resto del buffer para el derrumbe.
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

    const fuente = `${campo.tamanoCelda}px monospace`;

    const raton = { ...posicionInicialRaton };
    const stickman = { x: X_INICIAL_STICKMAN, paso: 0 };
    let fase = 'derrumbe';
    let indiceRebobinado = 0;
    let bucle = 0;
    const inicio = performance.now();

    function alMoverse(evento) {
      raton.x = evento.clientX + window.scrollX;
      raton.y = evento.clientY + window.scrollY;
    }
    window.addEventListener('mousemove', alMoverse, { passive: true });

    // --- Simulación ------------------------------------------------------
    function actualizarStickman() {
      if (fase === 'derrumbe') return;
      stickman.x += velocidadStickman;
      stickman.paso += AVANCE_PASO_CAMINATA;
      if (fase === 'barrido') {
        moverCuerpo(
          cuerpoEscoba,
          stickman.x + desplazamientoEscoba(stickman.paso, true),
          suelo - ALTO_ESCOBA / 2
        );
      } else {
        sacarDeEscena(cuerpoEscoba);
      }
    }

    function empezarRebobinado() {
      fase = 'rebobinado';
      indiceRebobinado = grabadora.cantidad - 1;
      sacarDeEscena(cuerpoEscoba);
      sacarDeEscena(cuerpoCursor);
    }

    function evaluarTransicion(ahora) {
      if (fase === 'derrumbe') {
        // El mínimo de tiempo existe porque fraccionQuieta da alto en el
        // primer cuadro, antes de que la gravedad acelere nada.
        const asentado =
          ahora - inicio > MINIMO_DERRUMBE_MS &&
          fraccionQuieta(cuerposDeCaracteres) > UMBRAL_QUIETUD;
        if (asentado) fase = 'barrido';
        return;
      }
      if (fase === 'barrido' && stickman.x > ancho - MARGEN_FIN_BARRIDO_PX) {
        fase = 'salida';
        return;
      }
      if (fase === 'salida' && stickman.x > ancho + HOLGURA_SALIDA_PX) {
        empezarRebobinado();
      }
    }

    // --- Dibujo ----------------------------------------------------------
    // Color leído por cuadro (no una sola vez al montar): el ThemeToggle
    // cambia data-theme en cualquier momento y body tiene transition de
    // color, así que fijarlo en el montaje dejaría los caracteres con el
    // color viejo, potencialmente invisibles contra el fondo nuevo.
    function abrirCuadro() {
      ctx.clearRect(0, 0, ancho, alto);
      ctx.font = fuente;
      const color = getComputedStyle(document.body).color;
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      return color;
    }

    function dibujarCaracter(caracter, x, y, angulo) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angulo);
      ctx.fillText(caracter, 0, 0);
      ctx.restore();
    }

    function dibujarDesdeMotor() {
      const color = abrirCuadro();
      for (let i = 0; i < cuerposDeCaracteres.length; i += 1) {
        const cuerpo = cuerposDeCaracteres[i];
        dibujarCaracter(celdas[i].caracter, cuerpo.position.x, cuerpo.position.y, cuerpo.angle);
      }
      if (fase !== 'derrumbe') {
        dibujarStickman(
          ctx,
          { x: stickman.x, suelo, paso: stickman.paso, barriendo: fase === 'barrido' },
          color
        );
      }
    }

    function dibujarDesdeFoto(foto) {
      const color = abrirCuadro();
      for (let i = 0; i < celdas.length; i += 1) {
        const posicion = leerCelda(foto, i);
        dibujarCaracter(celdas[i].caracter, posicion.x, posicion.y, posicion.angulo);
      }
      // En los cuadros grabados durante el derrumbe el stickman todavía está
      // en su x inicial, fuera de pantalla: dibujarlo siempre es inofensivo.
      const grabado = leerStickman(foto);
      dibujarStickman(ctx, { ...grabado, suelo }, color);
    }

    // --- Bucle único -----------------------------------------------------
    function terminar() {
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
        actualizarStickman();
        // Delta fijo: con delta variable la simulación se desestabiliza al
        // caer un cuadro y la grabación deja de ser reproducible.
        Engine.update(motor, PASO_MS);
        grabadora.grabarCuadro(cuerposDeCaracteres, {
          x: stickman.x,
          paso: stickman.paso,
          barriendo: fase === 'barrido',
        });
        evaluarTransicion(ahora);
        if (grabadora.lleno && fase !== 'rebobinado') empezarRebobinado();
        dibujarDesdeMotor();
      }
      bucle = requestAnimationFrame(cuadro);
      return undefined;
    }

    // Cuadro 0 = la formación intacta. Se graba antes de mover el cursor y antes
    // del primer Engine.update: si no, el último cuadro del rebobinado ya trae un
    // paso de física (y la penetración del cursor sobre los glifos que toca), y el
    // nombre nunca termina de reformarse del todo.
    grabadora.grabarCuadro(cuerposDeCaracteres, {
      x: stickman.x,
      paso: stickman.paso,
      barriendo: false,
    });

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
