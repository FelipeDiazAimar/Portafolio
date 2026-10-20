'use client';

// Reseña del footer: "¿Qué tal estuvo el portafolio?" con un Jelly Slider.
// La física corre en JS (fisicaGelatina.js) y el render es un shader WebGL2
// (shaderGelatina.js). No guarda nada: es solo para jugar.
import { useEffect, useRef, useState } from 'react';
import { Gelatina, suavizarCurva } from './fisicaGelatina.js';
import { FRAGMENT, PUNTOS_CURVA, VERTEX } from './shaderGelatina.js';
import styles from './GelatinaResena.module.css';

const AZUL_ELECTRICO = [0.12, 0.48, 1];
const LUZ = normalizar([0.19, -0.24, 0.75]);
const SUAVIZADO_PUNTERO = 0.08; // el MOUSE_SMOOTHING del original

function normalizar(v) {
  const largo = Math.hypot(...v) || 1;
  return v.map((c) => c / largo);
}
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const porcentajeDe = (x) => Math.round(Math.min(100, Math.max(0, ((x - Gelatina.MIN_X) / (Gelatina.MAX_X - Gelatina.MIN_X)) * 100)));

function fraseDe(nota) {
  if (nota >= 96) return '¡100 %! Me hiciste el día ✦';
  if (nota >= 75) return '¡Qué bueno que te guste! Gracias.';
  if (nota >= 45) return 'Gracias por la sinceridad, voy por más.';
  if (nota >= 15) return 'Uh… contame qué mejorarías.';
  return 'Auch. Escribime y lo arreglamos.';
}

// Color de fondo real detrás del lienzo (el primer ancestro con fondo opaco):
// la superficie de la gelatina se calibra a ese color y no deja ningún borde.
function fondoDetras(nodo) {
  for (let n = nodo; n; n = n.parentElement) {
    const color = getComputedStyle(n).backgroundColor;
    const m = color.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    if (m && (m[4] === undefined || Number(m[4]) > 0.95)) return [m[1], m[2], m[3]].map((c) => Number(c) / 255);
  }
  return [0.969, 0.973, 0.98];
}

function compilar(gl, tipo, fuente) {
  const shader = gl.createShader(tipo);
  gl.shaderSource(shader, fuente);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}

export default function GelatinaResena() {
  const refLienzo = useRef(null);
  const refNota = useRef(null);
  const [sinWebGL, setSinWebGL] = useState(false);
  const [activa, setActiva] = useState(false);
  const [frase, setFrase] = useState({ texto: '', clave: 0 });

  useEffect(() => {
    const lienzo = refLienzo.current;
    const gl = lienzo?.getContext('webgl2', { antialias: false, alpha: false });
    if (!gl) {
      setSinWebGL(true);
      return undefined;
    }
    let programa;
    try {
      programa = gl.createProgram();
      gl.attachShader(programa, compilar(gl, gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(programa, compilar(gl, gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(programa);
      if (!gl.getProgramParameter(programa, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(programa));
    } catch (error) {
      console.error('[gelatina]', error);
      setSinWebGL(true);
      return undefined;
    }
    gl.useProgram(programa);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const atributo = gl.getAttribLocation(programa, 'a');
    gl.enableVertexAttribArray(atributo);
    gl.vertexAttribPointer(atributo, 2, gl.FLOAT, false, 0, 0);
    const u = Object.fromEntries(
      ['uRes', 'uCam', 'uRight', 'uUp', 'uFwd', 'uTan', 'uPts', 'uBox', 'uJelly', 'uLight', 'uBg', 'uTexto'].map((n) => [n, gl.getUniformLocation(programa, n)])
    );
    const tanMitadFov = Math.tan(Math.PI / 8);
    gl.uniform3fv(u.uJelly, AZUL_ELECTRICO);
    gl.uniform3fv(u.uLight, LUZ);
    gl.uniform1f(u.uTan, tanMitadFov);

    // Porcentaje: se dibuja en un canvas 2D y se sube como textura cuando cambia.
    const lienzoTexto = document.createElement('canvas');
    lienzoTexto.width = 256;
    lienzoTexto.height = 160;
    const ctxTexto = lienzoTexto.getContext('2d');
    const textura = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, textura);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(u.uTexto, 0);
    let porcentajeDibujado = -1;
    function dibujarPorcentaje(valor) {
      if (valor === porcentajeDibujado) return;
      porcentajeDibujado = valor;
      ctxTexto.clearRect(0, 0, 256, 160);
      ctxTexto.fillStyle = '#fff';
      ctxTexto.textAlign = 'right';
      ctxTexto.textBaseline = 'middle';
      ctxTexto.font = '600 104px ui-monospace, "JetBrains Mono", monospace';
      ctxTexto.fillText(String(valor), 196, 84);
      ctxTexto.font = '600 64px ui-monospace, "JetBrains Mono", monospace';
      ctxTexto.fillText('%', 246, 96);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, lienzoTexto);
    }

    // Cámara: misma dirección que el original; la distancia se ajusta al ancho.
    const camara = { pos: [0, 0, 0], derecha: [1, 0, 0], arriba: [0, 1, 0], frente: [0, 0, -1] };
    let aspecto = 2;
    let sucio = true;
    function medir() {
      const rect = lienzo.getBoundingClientRect();
      const escala = Math.min(window.devicePixelRatio || 1, 1.5);
      lienzo.width = Math.max(2, Math.round(rect.width * escala));
      lienzo.height = Math.max(2, Math.round(rect.height * escala));
      gl.viewport(0, 0, lienzo.width, lienzo.height);
      gl.uniform2f(u.uRes, lienzo.width, lienzo.height);
      aspecto = rect.width / Math.max(1, rect.height);
      const dir = normalizar([0.024, 2.7, 1.9]);
      const distancia = Math.max(3.05 / (0.83 * aspecto), 1.7);
      camara.pos = dir.map((c) => c * distancia);
      const objetivo = [0, 0.06, 0.02];
      camara.frente = normalizar(objetivo.map((c, i) => c - camara.pos[i]));
      camara.derecha = normalizar(cruz(camara.frente, [0, 1, 0]));
      camara.arriba = cruz(camara.derecha, camara.frente);
      gl.uniform3fv(u.uCam, camara.pos);
      gl.uniform3fv(u.uRight, camara.derecha);
      gl.uniform3fv(u.uUp, camara.arriba);
      gl.uniform3fv(u.uFwd, camara.frente);
      gl.uniform3fv(u.uBg, fondoDetras(lienzo.parentElement));
      sucio = true;
    }

    const gel = new Gelatina();
    let punteroX = Gelatina.MAX_X;
    let objetivoX = Gelatina.MAX_X;
    let abajo = false;
    let visible = true;
    gel.setDragX(punteroX);
    for (let i = 0; i < 90; i++) gel.update(1 / 60);

    // El rayo del puntero corta el plano de la gelatina: la punta sigue al dedo.
    function xEnMundo(evento) {
      const rect = lienzo.getBoundingClientRect();
      const nx = ((evento.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((evento.clientY - rect.top) / rect.height) * 2 - 1);
      const rayo = normalizar([0, 1, 2].map((k) => camara.frente[k] + nx * tanMitadFov * aspecto * camara.derecha[k] + ny * tanMitadFov * camara.arriba[k]));
      if (Math.abs(rayo[1]) < 1e-4) return objetivoX;
      const s = (0.05 - camara.pos[1]) / rayo[1];
      return Math.min(Gelatina.MAX_X, Math.max(Gelatina.MIN_X, camara.pos[0] + rayo[0] * s));
    }
    const agradecer = () => setFrase((f) => ({ texto: fraseDe(porcentajeDe(objetivoX)), clave: f.clave + 1 }));
    function alBajar(evento) {
      abajo = true;
      lienzo.setPointerCapture(evento.pointerId);
      objetivoX = xEnMundo(evento);
      setActiva(true);
    }
    function alMover(evento) {
      if (abajo) objetivoX = xEnMundo(evento);
    }
    function alSoltar() {
      if (!abajo) return;
      abajo = false;
      setActiva(false);
      agradecer();
    }
    let temporizadorTeclado = 0;
    function alTeclear(evento) {
      const paso = (Gelatina.MAX_X - Gelatina.MIN_X) / 20;
      if (evento.key === 'ArrowRight' || evento.key === 'ArrowUp') objetivoX = Math.min(Gelatina.MAX_X, objetivoX + paso);
      else if (evento.key === 'ArrowLeft' || evento.key === 'ArrowDown') objetivoX = Math.max(Gelatina.MIN_X, objetivoX - paso);
      else if (evento.key === 'Home') objetivoX = Gelatina.MIN_X;
      else if (evento.key === 'End') objetivoX = Gelatina.MAX_X;
      else return;
      evento.preventDefault();
      clearTimeout(temporizadorTeclado);
      temporizadorTeclado = setTimeout(agradecer, 700);
    }
    lienzo.addEventListener('pointerdown', alBajar);
    lienzo.addEventListener('pointermove', alMover);
    lienzo.addEventListener('pointerup', alSoltar);
    lienzo.addEventListener('pointercancel', alSoltar);
    lienzo.addEventListener('keydown', alTeclear);

    const observadorVista = new IntersectionObserver(([entrada]) => {
      visible = entrada.isIntersecting;
      if (visible) sucio = true;
    });
    observadorVista.observe(lienzo);
    const observadorTamano = new ResizeObserver(medir);
    observadorTamano.observe(lienzo);
    medir();
    // El tema cambia el fondo de la página: se vuelve a leer para recalibrar.
    const observadorTema = new MutationObserver(() => {
      gl.uniform3fv(u.uBg, fondoDetras(lienzo.parentElement));
      sucio = true;
    });
    observadorTema.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    const puntos = new Float32Array(PUNTOS_CURVA * 2);
    let anterior = performance.now();
    let quieto = 0;
    let cuadro = 0;
    function dibujar(ahora) {
      const dt = Math.min(0.1, (ahora - anterior) / 1000);
      anterior = ahora;
      punteroX += (objetivoX - punteroX) * SUAVIZADO_PUNTERO;
      gel.setDragX(punteroX);
      const movimiento = gel.update(dt);
      quieto = movimiento > 1e-5 || Math.abs(objetivoX - punteroX) > 1e-4 ? 0 : quieto + 1;
      // En reposo no se redibuja: el shader es caro y la escena no cambia.
      if (visible && (quieto < 3 || sucio)) {
        const piso = gel.baseY + gel.yOffset;
        const curva = suavizarCurva(gel.pos.map((p) => [p[0], Math.max(p[1], piso)]), piso);
        let izq = Infinity;
        let der = -Infinity;
        let abajoY = Infinity;
        let arribaY = -Infinity;
        curva.forEach(([x, y], i) => {
          puntos[i * 2] = x;
          puntos[i * 2 + 1] = y;
          izq = Math.min(izq, x);
          der = Math.max(der, x);
          abajoY = Math.min(abajoY, y);
          arribaY = Math.max(arribaY, y);
        });
        gl.uniform2fv(u.uPts, puntos);
        gl.uniform4f(u.uBox, izq - 0.25, der + 0.25, abajoY - 0.25, arribaY + 0.25);
        const nota = porcentajeDe(gel.targetX);
        dibujarPorcentaje(nota);
        if (refNota.current) refNota.current.textContent = `${nota}%`;
        lienzo.setAttribute('aria-valuenow', String(nota));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        sucio = false;
      }
      cuadro = requestAnimationFrame(dibujar);
    }
    document.fonts?.ready.then(() => {
      porcentajeDibujado = -1;
      sucio = true;
    });
    cuadro = requestAnimationFrame(dibujar);

    return () => {
      cancelAnimationFrame(cuadro);
      clearTimeout(temporizadorTeclado);
      observadorVista.disconnect();
      observadorTamano.disconnect();
      observadorTema.disconnect();
      lienzo.removeEventListener('pointerdown', alBajar);
      lienzo.removeEventListener('pointermove', alMover);
      lienzo.removeEventListener('pointerup', alSoltar);
      lienzo.removeEventListener('pointercancel', alSoltar);
      lienzo.removeEventListener('keydown', alTeclear);
      // Sin loseContext(): en modo estricto el efecto se monta dos veces sobre el
      // mismo canvas y el segundo montaje recibiría un contexto ya perdido.
      gl.deleteProgram(programa);
      gl.deleteBuffer(buffer);
      gl.deleteTexture(textura);
    };
  }, []);

  return (
    <section className={styles.resena} aria-labelledby="titulo-resena">
      <div className={styles.texto}>
        <span className={styles.kicker}>Reseña</span>
        <h3 id="titulo-resena" className={styles.titulo}>¿Qué tal estuvo el portafolio?</h3>
        <p className={styles.bajada}>Arrastrá la gelatina para ponerle nota. No se guarda en ningún lado: es solo para que juegues.</p>
        <div className={styles.nota}>
          <b ref={refNota}>100%</b>
          <span key={frase.clave} className={frase.texto ? styles.frase : undefined}>{frase.texto}</span>
        </div>
      </div>
      <div className={`${styles.caja} ${activa ? styles.activa : ''}`}>
        {sinWebGL ? (
          <p className={styles.falla}>Tu navegador no soporta WebGL2, así que la gelatina no puede renderizarse.</p>
        ) : (
          <canvas
            ref={refLienzo}
            className={styles.lienzo}
            tabIndex={0}
            role="slider"
            aria-label="Nota del portafolio"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={100}
          />
        )}
        <span className={styles.pista} aria-hidden="true">arrastrá ↔</span>
      </div>
    </section>
  );
}
