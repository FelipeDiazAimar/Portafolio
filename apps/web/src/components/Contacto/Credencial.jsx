'use client';

// Credencial colgante plastificada: cinta elástica + tarjeta rígida con física
// (fisicaCredencial.js). Se arrastra y se lanza; doble clic la da vuelta; un
// clic corto sobre una fila copia ese dato.
import { useEffect, useRef } from 'react';
import { DATOS_CONTACTO } from '@/data/contacto.js';
import { ICONOS_CONTACTO } from './iconos.jsx';
import useCopiar from './useCopiar.js';
import { observarTema, temaActual } from '@/lib/contacto/tema.js';
import { crearCredencial, estiramiento, pasoCredencial, soltar } from './fisicaCredencial.js';
import styles from './Credencial.module.css';

const ANCHO = 290;
const ALTO = 580;
const HOYO = 16;
const TEXTO_CINTA = 'HABLEMOS ✦ FELIPE DÍAZ ✦ ';
// Separación entre letras con la cinta en reposo: el texto está impreso en la tela y se estira con ella.
const PASO_LETRA = 11;
const ANCHO_CINTA = 22;
// La cinta cuelga de una argolla enganchada a una placa atornillada a la pared de la sección.
// Centro de la placa. En pantallas anchas está a la altura del header (a la izquierda de sus botones);
// en las angostas el logo y los botones ocupan esa línea, así que cuelga debajo.
const PLACA_Y_ANCHO = 36;
const PLACA_Y_ANGOSTO = 104;
const ANCHO_PARA_HEADER = 1180;
const ARGOLLA_DY = 17; // centro de la argolla, debajo del centro de la placa
const ENGANCHE_DY = 4; // la cinta nace un poco más abajo del centro de la argolla y queda POR ENCIMA de ella
const RADIO_PLACA = 16;
const RADIO_ARGOLLA = 8.5;

function gradienteMetal(ctx, x0, y0, x1, y1, oscuro) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, oscuro ? '#a3aec3' : '#dfe4ee');
  g.addColorStop(0.5, oscuro ? '#6f788b' : '#a4aebf');
  g.addColorStop(1, oscuro ? '#4b5365' : '#7c869a');
  return g;
}

// Placa redonda atornillada: va DETRÁS de la cinta.
function dibujarPlaca(ctx, x, y, oscuro) {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.32)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = gradienteMetal(ctx, x - RADIO_PLACA, y - RADIO_PLACA, x + RADIO_PLACA, y + RADIO_PLACA, oscuro);
  ctx.beginPath();
  ctx.arc(x, y, RADIO_PLACA, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x, y, RADIO_PLACA - 0.8, Math.PI * 1.05, Math.PI * 1.85);
  ctx.stroke();
  // tornillo
  ctx.fillStyle = oscuro ? '#3b4252' : '#8e98ab';
  ctx.beginPath();
  ctx.arc(x, y - 1, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = oscuro ? '#1d2230' : '#5d667a';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 3, y + 0.6);
  ctx.lineTo(x + 3, y - 2.6);
  ctx.stroke();
}

// Argolla que sostiene la cinta. Se dibuja entera detrás de la cinta y la mitad de abajo POR
// ENCIMA: así se ve que la cinta pasa por dentro.
function dibujarArgolla(ctx, x, y, oscuro, sector) {
  ctx.lineCap = 'round';
  ctx.lineWidth = 3.4;
  ctx.strokeStyle = gradienteMetal(ctx, x - RADIO_ARGOLLA, y - RADIO_ARGOLLA, x + RADIO_ARGOLLA, y + RADIO_ARGOLLA, oscuro);
  ctx.beginPath();
  if (sector === 'frente') ctx.arc(x, y, RADIO_ARGOLLA, 0.05, Math.PI - 0.05);
  else ctx.arc(x, y, RADIO_ARGOLLA, 0, Math.PI * 2);
  ctx.stroke();
}

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
    let fis;
    let escala = 1;
    let ancho = 0;
    let alto = 0;
    let placaY = PLACA_Y_ANCHO;
    let inclinacion = 0;
    let inclinacionObjetivo = 0;
    let origenX = 0;
    let visible = true;
    // Colores de la cinta: salen de las variables del tema (se releen cuando cambia).
    const colores = { cinta: '#14171f', texto: '#fff', costura: '#1f6bff', sombra: 'rgba(0,0,0,.3)', oscuro: false };
    function leerColores() {
      const css = getComputedStyle(zona);
      colores.cinta = css.getPropertyValue('--contacto-cinta').trim() || colores.cinta;
      colores.texto = css.getPropertyValue('--contacto-cinta-texto').trim() || colores.texto;
      colores.costura = css.getPropertyValue('--contacto-costura').trim() || colores.costura;
      colores.sombra = css.getPropertyValue('--contacto-sombra').trim() || colores.sombra;
      colores.oscuro = temaActual() === 'dark';
    }
    leerColores();
    const dejarDeObservarTema = observarTema(leerColores);

    function medir() {
      const rect = zona.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      alto = Math.max(rect.height, 600);
      ancho = rect.width;
      origenX = rect.left;
      placaY = window.innerWidth >= ANCHO_PARA_HEADER ? PLACA_Y_ANCHO : PLACA_Y_ANGOSTO;
      const largoCinta = Math.min(96, Math.max(70, alto * 0.1));
      // La credencial se achica en pantallas angostas o bajas para que entre colgando.
      const lugar = (alto - placaY - ARGOLLA_DY - largoCinta * 1.3 - 36) / (ALTO - HOYO);
      escala = Math.max(0.55, Math.min(escalaPara(window.innerWidth), lugar));
      // El lienzo cubre TODA la sección (no sólo la columna): la cinta se puede estirar hasta
      // donde llegue el puntero.
      const anchoLienzo = window.innerWidth;
      lienzo.width = anchoLienzo * dpr;
      lienzo.height = alto * dpr;
      lienzo.style.width = `${anchoLienzo}px`;
      lienzo.style.height = `${alto}px`;
      lienzo.style.left = `${-origenX}px`;
      ctx.setTransform(dpr, 0, 0, dpr, origenX * dpr, 0);
      fis = crearCredencial({
        ancla: { x: ancho * 0.5, y: placaY + ARGOLLA_DY + ENGANCHE_DY },
        largoCinta, // es elástica: con el peso se estira ~20 %
        largoTarjeta: (ALTO - HOYO) * escala,
      });
    }

    function pintar() {
      // se borra TODO el lienzo en píxeles reales (sin transformación) y luego se vuelve a la del dibujo
      const dprLienzo = lienzo.width / window.innerWidth;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, lienzo.width, lienzo.height);
      ctx.setTransform(dprLienzo, 0, 0, dprLienzo, origenX * dprLienzo, 0);
      dibujarPlaca(ctx, fis.ancla.x, placaY, colores.oscuro);
      // placa y argolla van DETRÁS de la cinta: la cinta nunca pasa por debajo de lo que la sujeta
      dibujarArgolla(ctx, fis.ancla.x, fis.ancla.y - ENGANCHE_DY, colores.oscuro, 'completa');
      const pts = [...fis.cuerda.map((q) => ({ ...q })), { x: fis.P.x, y: fis.P.y - 6 }];
      // Una cinta de tela se afina al estirarse (el volumen se conserva a grandes rasgos).
      const estirada = Math.max(1, estiramiento(fis));
      const grosor = Math.max(16, ANCHO_CINTA / Math.sqrt(estirada));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      // tela (con su sombra proyectada; sin ctx.filter, que deja restos en algunos navegadores)
      ctx.save();
      ctx.shadowColor = colores.sombra;
      ctx.shadowBlur = 12;
      ctx.shadowOffsetX = 6;
      ctx.shadowOffsetY = 8;
      trazar(ctx, pts);
      ctx.strokeStyle = colores.cinta;
      ctx.lineWidth = grosor;
      ctx.stroke();
      ctx.restore();
      // costuras en los bordes
      ctx.strokeStyle = colores.costura;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.65;
      for (const dx of [-(grosor / 2 - 2.5), grosor / 2 - 2.5]) {
        ctx.save();
        ctx.translate(dx, 0);
        trazar(ctx, pts);
        ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      // Texto impreso en la tela: las letras se reparten a lo largo del largo REAL de la cinta, con su
      // tamaño y forma de siempre (si se estiraban junto con la tela, al agrandar la cinta quedaban
      // ilegibles). Al estirarla aparecen más letras: el texto se repite.
      ctx.font = '700 10px Inter, system-ui, sans-serif';
      ctx.fillStyle = colores.texto;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      let recorrido = 0;
      let proxima = 6;
      let k = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const largo = Math.hypot(b.x - a.x, b.y - a.y);
        while (proxima <= recorrido + largo) {
          const t = largo ? (proxima - recorrido) / largo : 0;
          const x = a.x + (b.x - a.x) * t;
          const y = a.y + (b.y - a.y) * t;
          if (y > 0) {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x));
            ctx.fillText(TEXTO_CINTA[k % TEXTO_CINTA.length], 0, 0.5);
            ctx.restore();
          }
          proxima += PASO_LETRA;
          k += 1;
        }
        recorrido += largo;
      }
      // tarjeta
      const angulo = Math.atan2(fis.C.x - fis.P.x, fis.C.y - fis.P.y);
      const inclinX = Math.max(-12, Math.min(12, -(fis.C.y - fis.prevC.y) * 0.6)) + inclinacion;
      tarjeta.style.transform = `translate(${fis.P.x - ANCHO / 2}px, ${fis.P.y - HOYO}px) scale(${escala}) rotate(${-angulo}rad) rotateY(${fis.giro}rad) rotateX(${inclinX}deg)`;
      // el reflejo del plástico se mueve con el giro y el balanceo
      tarjeta.style.setProperty('--brillo', `${(50 + Math.sin(fis.giro) * 70 + angulo * 90).toFixed(1)}%`);
      tarjeta.style.setProperty('--holo', `${((fis.giro * 57 + angulo * 220) % 360).toFixed(0)}deg`);
    }

    // Paso de tiempo FIJO: la física da el mismo resultado a 30, 60 o 144 cuadros por segundo. Con un dt
    // variable el peso "pesaba más" en equipos lentos y la cinta colgaba mucho más estirada.
    const PASO_FISICA = 1 / 60;
    const MAX_PASOS_POR_CUADRO = 5;
    let acumulado = 0;
    let cuadro = 0;
    let anterior = performance.now();
    function bucle(ahora) {
      const dt = Math.min(0.25, (ahora - anterior) / 1000);
      anterior = ahora;
      // la inclinación hacia el cursor se acerca de a poco: nunca da tirones
      inclinacion += (inclinacionObjetivo - inclinacion) * Math.min(1, dt * 7);
      if (visible) {
        acumulado += dt;
        let pasos = 0;
        while (acumulado >= PASO_FISICA && pasos < MAX_PASOS_POR_CUADRO) {
          // un clic corto (para copiar una fila) no tira de la tarjeta
          const agarre = fis.agarre;
          if (agarre && !agarre.activo) fis.agarre = null;
          pasoCredencial(fis, PASO_FISICA);
          if (agarre && !agarre.activo) fis.agarre = agarre;
          acumulado -= PASO_FISICA;
          pasos += 1;
        }
        if (pasos === MAX_PASOS_POR_CUADRO) acumulado = 0; // equipo muy lento: no se acumula atraso
        pintar();
      } else {
        acumulado = 0;
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
      inclinacionObjetivo = !fis.agarre && cerca ? Math.max(-6, Math.min(6, (evento.clientY - cy) / 30)) : 0;
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
      // Sin tope: la tarjeta va exactamente adonde esté el puntero y la cinta se estira lo que haga falta.
      if (fis.agarre.activo) {
        fis.agarre.x = x;
        fis.agarre.y = y;
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
    window.addEventListener('pointercancel', alSoltar);
    tarjeta.addEventListener('dblclick', darVuelta);
    cuadro = requestAnimationFrame(bucle);
    return () => {
      cancelAnimationFrame(cuadro);
      observador.disconnect();
      dejarDeObservarTema();
      window.removeEventListener('resize', medir);
      tarjeta.removeEventListener('pointerdown', alBajar);
      window.removeEventListener('pointermove', alMover);
      window.removeEventListener('pointerup', alSoltar);
      window.removeEventListener('pointercancel', alSoltar);
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
      <div
        ref={refTarjeta}
        className={styles.tarjeta}
        style={{ width: ANCHO, height: ALTO }}
        // mantener apretado el QR (o cualquier imagen) no debe "agarrarlo" como un archivo arrastrable
        onDragStart={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
      >
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
              <img src="/qr-whatsapp.svg" alt="" draggable={false} />
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
