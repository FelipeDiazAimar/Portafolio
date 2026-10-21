'use client';

// Sección Contacto: "el mensaje se escribe deslizando". Arrastrar un slide
// escribe el mensaje letra por letra (con cadencia humana) y arrastrar hacia
// atrás lo borra. Al completar, el texto se vuelve burbuja de WhatsApp (✓✓) o
// lo levanta el avioncito que nace de la manija del email.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CORREO, MENSAJE_NERVIOSO, MENSAJES, NUMERO_WHATSAPP } from '@/data/contacto.js';
import { indiceDeProgreso, pesosAcumulados } from '@/lib/contacto/cadencia.js';
import useEmbudo from '@/hooks/useEmbudo.js';
import { estadoPorHora, horaArgentina, urlCorreo, urlWhatsApp } from '@/lib/contacto/enlaces.js';
import { medirHuecosTitulo } from '@/lib/contacto/huecosTitulo.js';
import { crearRutaAvion, crearRutaPorLetras, fraccionRecorrida } from '@/lib/contacto/rutaAvion.js';
import Credencial from './Credencial.jsx';
import FondoLuz from './FondoLuz.jsx';
import SlideDestino, { AVION } from './SlideDestino.jsx';
import styles from './Contacto.module.css';

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const SACUDIDAS_NERVIOSO = 6;
const COLORES_AVION = ['#ffffff', '#dfe6f3', '#9aa6bb'];
const easeOutBack = (t) => 1 + 2.6 * (t - 1) ** 3 + 1.6 * (t - 1) ** 2;
const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

function horaActual() {
  return new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

// Abre WhatsApp en otra pestaña; si el navegador bloquea la ventana, navega en la misma.
function abrirWhatsApp(url) {
  const ventana = window.open(url, '_blank', 'noopener');
  if (!ventana) window.location.href = url;
}

export default function Contacto() {
  const [motivo, setMotivo] = useState('proyecto');
  const [mensaje, setMensaje] = useState(MENSAJES.proyecto.texto);
  const [propio, setPropio] = useState(false);
  const [editando, setEditando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [activo, setActivo] = useState(null);
  const [escribiendo, setEscribiendo] = useState(false);
  const [burbuja, setBurbuja] = useState(null);
  const [verOtro, setVerOtro] = useState(false);
  const [textoOculto, setTextoOculto] = useState(false);
  const [estado, setEstado] = useState(null);
  const [pista, setPista] = useState('o tocá el texto para escribir el tuyo');
  const [vivo, setVivo] = useState('');

  const refEscenario = useRef(null);
  const refSeccion = useRef(null);
  const refTexto = useRef(null);
  const refCursor = useRef(null);
  const refLetras = useRef([]);
  const refIndice = useRef(0);
  const refFondo = useRef(null);
  const refAvion = useRef(null);
  useEmbudo(refSeccion);
  const refSlideWa = useRef(null);
  const refSlideMail = useRef(null);
  const refSlides = { wa: refSlideWa, mail: refSlideMail };
  const refRectTexto = useRef(null);
  const refSacudidas = useRef({ ultimoP: 0, direccion: 0, tiempos: [] });
  const refAnimarTodo = useRef(false);

  const acumulados = useMemo(() => pesosAcumulados(mensaje), [mensaje]);
  const palabras = useMemo(() => mensaje.split(/(\s+)/).filter(Boolean), [mensaje]);

  useEffect(() => {
    setEstado(estadoPorHora(horaArgentina()));
    console.log('%c¿Mirando cómo está hecho?', 'font: 600 18px Inter, sans-serif; color: #1f6bff');
    console.log(`%cEscribime, me caés bien → ${CORREO}`, 'color: #38c6ff');
  }, []);

  const moverCursor = useCallback(() => {
    const escenario = refEscenario.current;
    const cursor = refCursor.current;
    const letras = refLetras.current;
    if (!escenario || !cursor || !letras.length) return;
    let referencia = null;
    let derecha = false;
    for (let i = refIndice.current - 1; i >= 0; i--) {
      if (letras[i]?.dataset.letra) {
        referencia = letras[i];
        derecha = true;
        break;
      }
    }
    if (!referencia) referencia = letras.find((l) => l?.dataset.letra);
    if (!referencia) return;
    // Posición de layout (offsetLeft/Top), no getBoundingClientRect: las letras todavía sin escribir
    // están corridas con un transform y el cursor quedaba más abajo que el texto.
    const altoLinea = referencia.offsetHeight;
    const altoCursor = altoLinea * 0.78;
    cursor.style.height = `${altoCursor}px`;
    cursor.style.left = `${derecha ? referencia.offsetLeft + referencia.offsetWidth + 2 : referencia.offsetLeft - 4}px`;
    cursor.style.top = `${referencia.offsetTop + (altoLinea - altoCursor) / 2}px`;
  }, []);

  const mostrarHasta = useCallback(
    (n, forzar = false) => {
      const letras = refLetras.current;
      const antes = refIndice.current;
      if (n === antes && !forzar) return;
      const desde = forzar ? 0 : Math.min(antes, n);
      const hasta = forzar ? letras.length : Math.max(antes, n);
      for (let i = desde; i < hasta; i++) letras[i]?.classList.toggle(styles.visible, i < n);
      // un toque por palabra en el celular
      if (n > antes && letras[n - 1] && !letras[n - 1].dataset.letra) navigator.vibrate?.(4);
      refIndice.current = n;
      moverCursor();
    },
    [moverCursor]
  );

  // Al cambiar el mensaje se reconstruyen las letras: arrancan ocultas.
  useLayoutEffect(() => {
    refLetras.current = refLetras.current.slice(0, mensaje.length);
    refIndice.current = 0;
    mostrarHasta(0, true);
    if (refAnimarTodo.current) {
      refAnimarTodo.current = false;
      const total = refLetras.current.length;
      const inicio = performance.now();
      const paso = (ahora) => {
        const t = limitar((ahora - inicio) / 900, 0, 1);
        mostrarHasta(Math.round(total * t));
        if (t < 1) requestAnimationFrame(paso);
      };
      requestAnimationFrame(paso);
    }
  }, [mensaje, mostrarHasta]);

  useEffect(() => {
    const alRedimensionar = () => moverCursor();
    window.addEventListener('resize', alRedimensionar);
    return () => window.removeEventListener('resize', alRedimensionar);
  }, [moverCursor]);

  function elegirMotivo(clave) {
    if (ocupado) return;
    setMotivo(clave);
    setPropio(false);
    setMensaje(MENSAJES[clave].texto);
  }

  // --- slides --------------------------------------------------------------
  function alEmpezar(destino) {
    setActivo(destino);
    setEscribiendo(true);
    refSacudidas.current = { ultimoP: 0, direccion: 0, tiempos: [] };
  }

  function alProgreso(p) {
    mostrarHasta(indiceDeProgreso(acumulados, p));
    // easter egg: sacudir la manija adelante y atrás → mensaje nervioso
    const s = refSacudidas.current;
    const delta = p - s.ultimoP;
    s.ultimoP = p;
    const direccion = Math.sign(delta);
    if (Math.abs(delta) > 0.01 && direccion && direccion !== s.direccion) {
      const ahora = performance.now();
      if (s.direccion) s.tiempos.push(ahora);
      s.direccion = direccion;
      s.tiempos = s.tiempos.filter((t) => ahora - t < 1300);
      if (s.tiempos.length >= SACUDIDAS_NERVIOSO && mensaje !== MENSAJE_NERVIOSO) {
        s.tiempos = [];
        setMensaje(MENSAJE_NERVIOSO);
      }
    }
  }

  function alVolver() {
    setEscribiendo(false);
    setActivo(null);
  }

  function alCompletar(destino, velocidad) {
    setOcupado(true);
    setEscribiendo(false);
    setPista('');
    refRectTexto.current = refTexto.current?.getBoundingClientRect() ?? null;
    if (destino === 'wa') finalWhatsApp();
    else finalEmail(velocidad);
  }

  function finalWhatsApp() {
    const url = urlWhatsApp(NUMERO_WHATSAPP, mensaje);
    setTextoOculto(true);
    setBurbuja({ texto: mensaje, hora: horaActual(), fase: 'enviado' });
    setTimeout(() => setBurbuja((b) => b && { ...b, fase: 'doble' }), 380);
    // ≤ 600 ms después del gesto: se ve el ✓✓ y el navegador todavía no bloquea la ventana
    setTimeout(() => {
      setBurbuja((b) => b && { ...b, fase: 'leido' });
      setVivo('Mensaje listo, abriendo WhatsApp');
      abrirWhatsApp(url);
    }, 600);
    setTimeout(() => setVerOtro(true), 1500);
  }

  // FLIP: la burbuja nace del rectángulo del texto escrito.
  useLayoutEffect(() => {
    const nodo = document.getElementById('burbuja-contacto');
    const desde = refRectTexto.current;
    if (!burbuja || burbuja.fase !== 'enviado' || !nodo || !desde) return;
    const hasta = nodo.getBoundingClientRect();
    nodo.style.transition = 'none';
    nodo.style.transform = `translate(${desde.left - hasta.left}px, ${desde.top - hasta.top}px) scale(${desde.width / hasta.width}, ${desde.height / hasta.height})`;
    nodo.getBoundingClientRect();
    nodo.style.transition = 'transform .7s cubic-bezier(.2,.9,.1,1), opacity .4s';
    nodo.style.transform = 'none';
  }, [burbuja]);

  function finalEmail(velocidad) {
    const reducido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const asunto = propio ? 'Hola' : MENSAJES[motivo]?.asunto ?? 'Hola';
    const url = urlCorreo(CORREO, asunto, mensaje);
    const terminar = () => {
      setVivo('Mensaje listo, abriendo tu correo');
      window.location.href = url;
      setVerOtro(true);
    };
    const rect = refSlides.mail.current?.rectIcono();
    const avion = refAvion.current;
    if (reducido || !rect || !avion) {
      setTextoOculto(true);
      terminar();
      return;
    }
    refSlides.mail.current.ocultarIcono(true);
    const inicio = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    // Si el título "Hablemos." se ve en pantalla, el avión hace sus rizos por dentro de la "o" y de la
    // "b" y se achica para entrar en cada hueco. Si no (p. ej. en el celular, con el título más
    // arriba), vuela la ruta de siempre: un rizo y afuera (doble rizo si se suelta con fuerza).
    const huecos = medirHuecosTitulo(document.getElementById('titulo-contacto'));
    const ancho = window.innerWidth;
    const alto = window.innerHeight;
    const porLetras = huecos ? crearRutaPorLetras({ inicio, ancho, alto, letras: huecos }) : null;
    const vueltas = Math.abs(velocidad) > 1.6 ? 2 : 1;
    const ruta = porLetras ?? crearRutaAvion({ inicio, ancho, alto, vueltas });
    const duracion = porLetras ? limitar(ruta.total * 1.5 * ruta.duracionRelativa, 3800, 5600) : vueltas === 2 ? 3800 : 3000;
    // El avión mide ≈ 88 unidades de punta a cola: se achica hasta caber en el hueco de la letra.
    const escalaHueco = huecos ? limitar((huecos[0].radio * 2 * 0.95) / 88, 0.24, 0.62) : 1;

    // Todo lo que cuesta se calcula UNA vez antes de despegar: dentro del cuadro sólo
    // hay cuentas y un transform, sin leer el layout ni tocar React.
    const letras = refLetras.current.map((nodo, indice) => {
      if (!nodo?.dataset.letra) return null;
      const r = nodo.getBoundingClientRect();
      return { nodo, indice, x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    const visibles = letras.filter(Boolean);
    visibles.forEach((letra, k) => {
      letra.retraso = (k / Math.max(1, visibles.length)) * 0.5; // sale de a poco, en orden de lectura
      letra.giro = ((letra.indice % 7) - 3) * 26;
      letra.arco = ((letra.indice % 5) - 2) * 16;
      letra.nodo.classList.add(styles.volando);
    });

    // Una copia del título por ENCIMA del avión: al pasar por la "o" y la "b" se lo ve ir por
    // dentro de la letra (por el hueco), no volar por delante.
    const titulo = document.getElementById('titulo-contacto');
    let copiaTitulo = null;
    if (huecos && titulo) {
      const r = titulo.getBoundingClientRect();
      copiaTitulo = titulo.cloneNode(true);
      copiaTitulo.removeAttribute('id');
      copiaTitulo.setAttribute('aria-hidden', 'true');
      copiaTitulo.classList.add(styles.tituloSobre);
      Object.assign(copiaTitulo.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      document.body.appendChild(copiaTitulo);
    }

    const CARGA_MS = 1300; // el texto viaja al avión y se mete adentro; recién después despega
    const q0 = ruta.enRuta(0);
    const suave = (v) => v * v * (3 - 2 * v);
    let ultimoAgitado = { x: inicio.x, y: inicio.y };
    let terminado = false;
    let t0 = null;
    let textoOcultado = false;
    avion.style.opacity = '1';

    function cargar(c) {
      for (const letra of visibles) {
        const p = limitar((c - letra.retraso) / 0.5, 0, 1);
        const e = suave(p) * p; // arranca despacio y se acelera al acercarse
        const dx = (inicio.x - letra.x) * e;
        const dy = (inicio.y - letra.y) * e + Math.sin(Math.PI * e) * letra.arco;
        const { style } = letra.nodo;
        style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) rotate(${(letra.giro * e).toFixed(0)}deg) scale(${(1 - 0.9 * e).toFixed(3)})`;
        style.opacity = String(1 - limitar((e - 0.82) / 0.18, 0, 1));
      }
      const nacer = easeOutBack(limitar(c / 0.35, 0, 1));
      const latido = 1 + 0.07 * Math.sin(c * 38) * limitar(c * 2, 0, 1); // cada letra que entra lo hace latir
      const escala = (0.3 + 0.7 * nacer) * latido;
      avion.style.transform = `translate3d(${q0.x.toFixed(2)}px, ${q0.y.toFixed(2)}px, 0) rotate(${q0.angulo.toFixed(4)}rad) scale(${escala.toFixed(3)})`;
    }

    function cuadro(ahora) {
      t0 ??= ahora;
      const transcurrido = ahora - t0;
      if (transcurrido < CARGA_MS) {
        cargar(transcurrido / CARGA_MS);
        requestAnimationFrame(cuadro);
        return;
      }
      if (!textoOcultado) {
        textoOcultado = true;
        cargar(1);
        setTextoOculto(true);
      }
      const t = Math.min(1, (transcurrido - CARGA_MS) / duracion);
      const q = ruta.enRuta(ruta.distanciaPara ? ruta.distanciaPara(fraccionRecorrida(t)) : ruta.total * fraccionRecorrida(t));
      const salida = 1 - 0.45 * limitar((t - 0.75) / 0.25, 0, 1);
      const escala = salida * (1 - (1 - escalaHueco) * (q.cercania ?? 0));
      // Se inclina hacia adentro de la curva, como un avión de verdad.
      const alabeo = q.curvatura * 52;
      avion.style.transform = `translate3d(${q.x.toFixed(2)}px, ${q.y.toFixed(2)}px, 0) rotate(${q.angulo.toFixed(4)}rad) perspective(520px) rotateX(${alabeo.toFixed(1)}deg) scale(${escala.toFixed(3)})`;

      // Agita la luz del fondo cada tanto, no en cada cuadro.
      if (Math.hypot(q.x - ultimoAgitado.x, q.y - ultimoAgitado.y) > 18) {
        refFondo.current?.agitar(q.x, q.y);
        ultimoAgitado = { x: q.x, y: q.y };
      }
      if (t < 1) {
        requestAnimationFrame(cuadro);
      } else if (!terminado) {
        terminado = true;
        avion.style.opacity = '0';
        copiaTitulo?.remove();
        terminar();
      }
    }
    requestAnimationFrame(cuadro);
  }

  function otroMensaje() {
    setVerOtro(false);
    setBurbuja(null);
    setTextoOculto(false);
    setOcupado(false);
    setActivo(null);
    refLetras.current.forEach((l) => {
      if (!l) return;
      l.classList.remove(styles.volando);
      l.style.transform = '';
      l.style.opacity = '';
    });
    refSlides.wa.current?.reiniciar();
    refSlides.mail.current?.reiniciar();
    refSlides.mail.current?.ocultarIcono(false);
    setPista('o tocá el texto para escribir el tuyo');
    // el mismo mensaje vuelve a escribirse desde cero
    refIndice.current = 0;
    mostrarHasta(0, true);
  }

  // --- escribir tu propio mensaje ----------------------------------------
  function abrirEditor() {
    if (ocupado || escribiendo || editando) return;
    setEditando(true);
  }
  function cerrarEditor(valor) {
    setEditando(false);
    const limpio = valor.trim().replace(/\s+/g, ' ');
    if (!limpio) return;
    setPropio(true);
    setMensaje(limpio);
    setPista('listo: ahora deslizá para enviarlo');
  }

  // --- easter egg: código Konami → el mensaje se escribe en binario ------
  useEffect(() => {
    let indice = 0;
    function alTeclear(evento) {
      if (evento.target instanceof HTMLTextAreaElement || evento.target.getAttribute?.('role') === 'slider') return;
      indice = evento.key === KONAMI[indice] ? indice + 1 : evento.key === KONAMI[0] ? 1 : 0;
      if (indice < KONAMI.length) return;
      indice = 0;
      const plano = 'Hola Felipe';
      refAnimarTodo.current = true;
      setMensaje([...plano].map((c) => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' '));
      setTimeout(() => {
        refAnimarTodo.current = true;
        setMensaje(`${plano} 👾`);
      }, 1700);
      setTimeout(() => {
        setMensaje((m) => (m === `${plano} 👾` ? MENSAJES.proyecto.texto : m));
      }, 4300);
    }
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, []);

  let indiceLetra = 0;
  return (
    <section id="contacto" ref={refSeccion} className={styles.seccion} aria-labelledby="titulo-contacto">
      <FondoLuz ref={refFondo} />
      <div className={styles.columnaCredencial}>
        <Credencial />
      </div>

      <div className={styles.panel}>
        <h2 id="titulo-contacto" className={styles.titulo}>
          Hablemos<span className={styles.punto}>.</span>
        </h2>
        {estado && (
          <p className={`${styles.estado} ${estado.durmiendo ? styles.duerme : ''}`}>
            <i aria-hidden="true" />
            {estado.texto}
          </p>
        )}

        <div className={styles.chips} role="group" aria-label="Motivo del mensaje">
          {Object.entries(MENSAJES).map(([clave, m]) => (
            <button
              key={clave}
              type="button"
              className={styles.chip}
              aria-pressed={!propio && motivo === clave}
              onClick={() => elegirMotivo(clave)}
            >
              {m.chip}
            </button>
          ))}
        </div>

        <div
          ref={refEscenario}
          className={`${styles.escenario} ${escribiendo ? styles.escribiendo : ''}`}
          onClick={abrirEditor}
        >
          <div className={`${styles.fantasma} ${escribiendo || refIndice.current > 0 ? styles.oculto : ''}`}>
            Deslizá para escribirme.
          </div>
          <div ref={refTexto} className={`${styles.texto} ${textoOculto ? styles.textoOculto : ''}`} aria-hidden="true">
            {palabras.map((trozo, i) => {
              if (/^\s+$/.test(trozo)) {
                const indice = indiceLetra++;
                return (
                  <span key={`e${i}`} ref={(n) => (refLetras.current[indice] = n)}>
                    {' '}
                  </span>
                );
              }
              return (
                <span key={`p${i}`} className={styles.palabra}>
                  {[...trozo].map((caracter, j) => {
                    const indice = indiceLetra++;
                    return (
                      <span
                        key={j}
                        data-letra="1"
                        className={styles.letra}
                        ref={(n) => (refLetras.current[indice] = n)}
                      >
                        {caracter}
                      </span>
                    );
                  })}
                </span>
              );
            })}
          </div>
          <span ref={refCursor} className={`${styles.cursor} ${textoOculto ? styles.textoOculto : ''}`} aria-hidden="true" />
          {editando && (
            <textarea
              className={styles.editor}
              aria-label="Escribí tu propio mensaje"
              maxLength={220}
              defaultValue={propio ? mensaje : ''}
              autoFocus
              onBlur={(e) => cerrarEditor(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
                if (e.key === 'Escape') {
                  e.currentTarget.value = '';
                  e.currentTarget.blur();
                }
              }}
            />
          )}
          {burbuja && (
            <div id="burbuja-contacto" className={styles.burbuja} data-fase={burbuja.fase}>
              <div>{burbuja.texto}</div>
              <div className={styles.meta}>
                <span>{burbuja.hora}</span>
                <svg viewBox="0 0 18 12" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M1 6.5l3 3L10 2" />
                  <path className={styles.segundoTick} d="M6.5 9.5L7.5 10.5 15 2" />
                </svg>
              </div>
            </div>
          )}
        </div>
        <p className={styles.pista}>{pista}</p>
        <p className={styles.soloLectores} aria-live="polite">
          {vivo}
        </p>

        <div className={styles.slides}>
          <SlideDestino
            ref={refSlides.wa}
            destino="wa"
            etiqueta="WhatsApp"
            apagada={activo === 'mail'}
            bloqueada={ocupado || editando}
            alEmpezar={() => alEmpezar('wa')}
            alProgreso={alProgreso}
            alVolver={alVolver}
            alCompletar={(v) => alCompletar('wa', v)}
          />
          <SlideDestino
            ref={refSlides.mail}
            destino="mail"
            etiqueta="Email"
            apagada={activo === 'wa'}
            bloqueada={ocupado || editando}
            alEmpezar={() => alEmpezar('mail')}
            alProgreso={alProgreso}
            alVolver={alVolver}
            alCompletar={(v) => alCompletar('mail', v)}
          />
        </div>
        <button type="button" className={`${styles.otro} ${verOtro ? styles.verOtro : ''}`} onClick={otroMensaje} tabIndex={verOtro ? 0 : -1}>
          ¿Otro mensaje?
        </button>
      </div>

      {/* el avioncito que despega de la manija del email */}
      <svg ref={refAvion} className={styles.avion} viewBox="0 0 100 100" aria-hidden="true">
        {AVION.map((cara, i) => (
          <polygon key={i} points={cara.map((v) => v.join(',')).join(' ')} fill={COLORES_AVION[i]} />
        ))}
      </svg>
    </section>
  );
}
