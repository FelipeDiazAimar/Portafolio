'use client';

// Credencial colgante plastificada: cinta elástica + tarjeta rígida con física
// (fisicaCredencial.js). Se arrastra y se lanza; doble clic la da vuelta; un
// clic corto sobre una fila copia ese dato.
import { useEffect, useRef } from 'react';
import { DATOS_CONTACTO } from '@/data/contacto.js';
import { ICONOS_CONTACTO } from './iconos.jsx';
import useCopiar from './useCopiar.js';
import { alcanceArrastre, crearCredencial, pasoCredencial, soltar } from './fisicaCredencial.js';
import styles from './Credencial.module.css';

const ANCHO = 290;
const ALTO = 580;
const HOYO = 16;
const TEXTO_CINTA = 'HABLEMOS ✦ FELIPE DÍAZ ✦ ';
const PASO_LETRA = 9;

// Curva suave por los puntos medios.
function trazar(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i + 1].x) / 2, (pts[i].y + pts[i + 1].y) / 2);
  }
  ctx.lineTo(pts.at(-1).x, pts.at(-1).y);
}

function escalaPara(ancho) {
  if (ancho < 560) return 0.7;
  if (ancho < 900) return 0.85;
  return 1;
}

export default function Credencial() {
  const refZona = useRef(null);
  const refCinta = useRef(null);
  const refTarjeta = useRef(null);
  const refMovido = useRef(false);
  const { copiar, texto, copiando } = useCopiar();

  useEffect(() => {
    const zona = refZona.current;
    const lienzo = refCinta.current;
    const tarjeta = refTarjeta.current;
    const ctx = lienzo.getContext('2d');
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let fis;
    let escala = 1;
    let ancho = 0;
    let alto = 0;
    let inclinacion = 0;
    let visible = true;

    function medir() {
      const rect = zona.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      escala = escalaPara(window.innerWidth);
      ancho = rect.width;
      alto = Math.max(rect.height, 600);
      // el lienzo sobra 200 px por lado: la cinta puede salirse de la columna al arrastrar
      lienzo.width = (ancho + 400) * dpr;
      lienzo.height = alto * dpr;
      lienzo.style.width = `${ancho + 400}px`;
      lienzo.style.height = `${alto}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 200 * dpr, 0);
      fis = crearCredencial({
        ancla: { x: ancho * 0.5, y: -30 },
        largoCinta: alto * 0.12, // es elástica: con el peso se estira ~8 %
        largoTarjeta: (ALTO - HOYO) * escala,
        impulso: reducido ? 0 : 2.2,
      });
    }

    function pintar() {
      const oscuro = '#14171f';
      ctx.clearRect(-200, 0, ancho + 400, alto);
      const pts = [...fis.cuerda.map((q) => ({ ...q })), { x: fis.P.x, y: fis.P.y - 6 }];
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // sombra
      ctx.save();
      ctx.translate(6, 8);
      ctx.filter = 'blur(6px)';
      trazar(ctx, pts);
      ctx.strokeStyle = 'rgba(20, 40, 90, 0.16)';
      ctx.lineWidth = 26;
      ctx.stroke();
      ctx.restore();
      // tela
      trazar(ctx, pts);
      ctx.strokeStyle = oscuro;
      ctx.lineWidth = 22;
      ctx.stroke();
      // costuras azules en los bordes
      ctx.strokeStyle = '#1f6bff';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.65;
      for (const dx of [-8.5, 8.5]) {
        ctx.save();
        ctx.translate(dx, 0);
        trazar(ctx, pts);
        ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      // texto impreso en la cinta: fijo, se mueve con la tela pero no corre
      ctx.font = '600 9px Inter, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(244, 246, 250, 0.88)';
      ctx.textBaseline = 'middle';
      let acumulado = 4;
      let k = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        while (acumulado < d) {
          const x = a.x + (dx * acumulado) / d;
          const y = a.y + (dy * acumulado) / d;
          if (y > 0) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(Math.atan2(dy, dx));
            ctx.fillText(TEXTO_CINTA[k % TEXTO_CINTA.length], -3, 0);
            ctx.restore();
          }
          k += 1;
          acumulado += PASO_LETRA;
        }
        acumulado -= d;
      }
      // tarjeta
      const angulo = Math.atan2(fis.C.x - fis.P.x, fis.C.y - fis.P.y);
      const inclinX = Math.max(-12, Math.min(12, -(fis.C.y - fis.prevC.y) * 0.6)) + inclinacion;
      tarjeta.style.transform = `translate(${fis.P.x - ANCHO / 2}px, ${fis.P.y - HOYO}px) scale(${escala}) rotate(${-angulo}rad) rotateY(${fis.giro}rad) rotateX(${inclinX}deg)`;
      // el reflejo del plástico se mueve con el giro y el balanceo
      tarjeta.style.setProperty('--brillo', `${(50 + Math.sin(fis.giro) * 70 + angulo * 90).toFixed(1)}%`);
      tarjeta.style.setProperty('--holo', `${((fis.giro * 57 + angulo * 220) % 360).toFixed(0)}deg`);
    }

    let cuadro = 0;
    let anterior = performance.now();
    function bucle(ahora) {
      const dt = Math.min(0.033, (ahora - anterior) / 1000);
      anterior = ahora;
      if (visible) {
        // un clic corto (para copiar una fila) no tira de la tarjeta
        const agarre = fis.agarre;
        if (agarre && !agarre.activo) fis.agarre = null;
        pasoCredencial(fis, dt);
        if (agarre && !agarre.activo) fis.agarre = agarre;
        pintar();
      }
      cuadro = requestAnimationFrame(bucle);
    }

    function enZona(evento) {
      const rect = zona.getBoundingClientRect();
      return { x: evento.clientX - rect.left, y: evento.clientY - rect.top };
    }
    function alBajar(evento) {
      const { x, y } = enZona(evento);
      const t = Math.min(1, Math.max(0, Math.hypot(x - fis.P.x, y - fis.P.y) / fis.largoTarjeta));
      fis.agarre = { x, y, t, inicio: { x, y }, id: evento.pointerId, activo: false };
      refMovido.current = false;
    }
    function alMover(evento) {
      const rect = tarjeta.getBoundingClientRect();
      const cy = rect.top + rect.height / 2;
      const cerca = Math.hypot(evento.clientX - (rect.left + rect.width / 2), evento.clientY - cy) < 340;
      inclinacion = cerca ? Math.max(-6, Math.min(6, (evento.clientY - cy) / 30)) : 0;
      if (!fis.agarre) return;
      const { x, y } = enZona(evento);
      if (!fis.agarre.activo && Math.hypot(x - fis.agarre.inicio.x, y - fis.agarre.inicio.y) > 5) {
        fis.agarre.activo = true;
        refMovido.current = true;
        tarjeta.classList.add(styles.agarrada);
        try {
          tarjeta.setPointerCapture(fis.agarre.id);
        } catch {
          /* el puntero ya se soltó */
        }
      }
      if (fis.agarre.activo) {
        // no se estira más que su alcance elástico (evita el efecto honda)
        const alcance = alcanceArrastre(fis, fis.agarre.t);
        const dx = x - fis.ancla.x;
        const dy = y - fis.ancla.y;
        const d = Math.hypot(dx, dy);
        const k = d > alcance ? alcance / d : 1;
        fis.agarre.x = fis.ancla.x + dx * k;
        fis.agarre.y = fis.ancla.y + dy * k;
      }
    }
    function alSoltar() {
      if (!fis.agarre) return;
      if (fis.agarre.activo) soltar(fis);
      fis.agarre = null;
      tarjeta.classList.remove(styles.agarrada);
    }
    const darVuelta = () => {
      fis.vGiro += 0.55;
    };

    const observador = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    observador.observe(zona);
    medir();
    window.addEventListener('resize', medir);
    tarjeta.addEventListener('pointerdown', alBajar);
    window.addEventListener('pointermove', alMover, { passive: true });
    window.addEventListener('pointerup', alSoltar);
    tarjeta.addEventListener('dblclick', darVuelta);
    cuadro = requestAnimationFrame(bucle);
    return () => {
      cancelAnimationFrame(cuadro);
      observador.disconnect();
      window.removeEventListener('resize', medir);
      tarjeta.removeEventListener('pointerdown', alBajar);
      window.removeEventListener('pointermove', alMover);
      window.removeEventListener('pointerup', alSoltar);
      tarjeta.removeEventListener('dblclick', darVuelta);
    };
  }, []);

  function alCopiar(evento, dato) {
    // tras un arrastre, el clic de soltar no cuenta como copiar
    if (refMovido.current) {
      evento.preventDefault();
      return;
    }
    copiar(dato.id, dato.corto, dato.copiar);
  }

  return (
    <div className={styles.zona} ref={refZona}>
      <canvas ref={refCinta} className={styles.cinta} aria-hidden="true" />
      <div ref={refTarjeta} className={styles.tarjeta} style={{ width: ANCHO, height: ALTO }}>
        <div className={`${styles.cara} ${styles.frente}`}>
          <span className={styles.gancho} aria-hidden="true" />
          <span className={styles.ranura} aria-hidden="true" />
          <div className={styles.papel}>
            <div className={styles.franja}>
              <span>ACCESO · CONTACTO</span>
              <b>✦ 2026</b>
            </div>
            <div className={styles.foto}>
              {/* eslint-disable-next-line @next/next/no-img-element -- PNG sin fondo recortado a mano */}
              <img src="/retrato.png" alt="Felipe Díaz Aimar" draggable={false} />
            </div>
            <div className={styles.nombre}>
              Felipe Díaz
              <br />
              Aimar
            </div>
            <div className={styles.rol}>Desarrollador Full Stack · Ing. en Sistemas (UTN)</div>
            {DATOS_CONTACTO.map((dato) => {
              const Icono = ICONOS_CONTACTO[dato.icono];
              return (
                <button
                  key={dato.id}
                  type="button"
                  className={`${styles.fila} ${copiando(dato.id) ? styles.copiado : ''}`}
                  onClick={(e) => alCopiar(e, dato)}
                  aria-label={`Copiar ${dato.etiqueta}: ${dato.valor}`}
                >
                  <Icono aria-hidden="true" />
                  <small>{dato.id === 'horario' ? 'Horario' : dato.etiqueta}</small>
                  <span>{texto(dato.id, dato.corto)}</span>
                </button>
              );
            })}
          </div>
          <span className={styles.plastico} aria-hidden="true" />
          <span className={styles.brillo} aria-hidden="true" />
          <span className={styles.holo} aria-hidden="true" />
        </div>
        <div className={`${styles.cara} ${styles.dorso}`} aria-hidden="true">
          <span className={styles.gancho} />
          <span className={styles.ranura} />
          <div className={`${styles.papel} ${styles.papelDorso}`}>
            <div className={styles.grande}>
              Hablemos<i>.</i>
            </div>
            <p>Si encontrás esta credencial, devolvésela a su dueño: escaneá y escribile.</p>
            <div className={styles.qr}>
              {/* eslint-disable-next-line @next/next/no-img-element -- SVG estático */}
              <img src="/qr-whatsapp.svg" alt="" />
            </div>
            <span className={styles.qrPie}>WhatsApp · wa.me/5493564690844</span>
          </div>
          <span className={styles.plastico} />
          <span className={styles.brillo} />
          <span className={styles.holo} />
        </div>
      </div>
      <p className={styles.pista}>arrastrala · doble clic para darla vuelta</p>
    </div>
  );
}
