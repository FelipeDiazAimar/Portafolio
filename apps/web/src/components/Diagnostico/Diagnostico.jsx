'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './Diagnostico.module.css';

// Diagnóstico de cierres en el celular (Safari mata la página por memoria y no deja consola ni rastro).
//
// Sólo se activa con ?debug=1 en la URL (queda guardado en el teléfono; ?debug=0 lo apaga), así que los
// visitantes no lo ven ni lo pagan. Activo, guarda en localStorage —que sobrevive al cierre— un registro
// circular con: un "latido" por segundo (sección a la vista, scroll, cantidad de elementos, canvas y sus
// píxeles, cuadros por segundo, si hay un proyecto abierto), errores, pérdidas de contexto WebGL y cambios
// de visibilidad. Al abrir de nuevo, si la sesión anterior no se cerró limpia (no hubo pagehide), lo
// anota: es la marca de un cierre por memoria. El panel permite copiar el registro y pegarlo.
const CLAVE_LOG = 'diag-log';
const CLAVE_VIVA = 'diag-viva';
const CLAVE_ACTIVO = 'diag-activo';
const MAX_ENTRADAS = 500;

const leer = (clave) => {
  try {
    return window.localStorage.getItem(clave);
  } catch {
    return null;
  }
};
const escribir = (clave, valor) => {
  try {
    if (valor === null) window.localStorage.removeItem(clave);
    else window.localStorage.setItem(clave, valor);
  } catch {
    /* sin almacenamiento: no hay registro */
  }
};

function cargarLog() {
  try {
    return JSON.parse(leer(CLAVE_LOG) || '[]');
  } catch {
    return [];
  }
}

const SECCIONES = ['inicio', 'sobre-mi', 'proyectos', 'experiencia', 'habilidades', 'contacto'];

function seccionActual() {
  const mitad = window.innerHeight / 2;
  for (const id of SECCIONES) {
    const el = document.getElementById(id);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.top <= mitad && r.bottom > mitad) return id;
  }
  return '?';
}

function pixelesDeCanvas() {
  let total = 0;
  const lista = [];
  document.querySelectorAll('canvas').forEach((c) => {
    total += c.width * c.height;
    lista.push(`${c.width}x${c.height}`);
  });
  return { total, lista };
}

export default function Diagnostico() {
  const [activo, setActivo] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [lineas, setLineas] = useState([]);
  const [aviso, setAviso] = useState('');
  const refLog = useRef([]);
  const refT0 = useRef(0);

  const anotar = useCallback((tipo, texto) => {
    const entrada = { t: Math.round((performance.now() - refT0.current) / 100) / 10, h: new Date().toISOString().slice(11, 19), tipo, texto };
    refLog.current.push(entrada);
    if (refLog.current.length > MAX_ENTRADAS) refLog.current.splice(0, refLog.current.length - MAX_ENTRADAS);
    escribir(CLAVE_LOG, JSON.stringify(refLog.current));
  }, []);

  // ?debug=1 / ?debug=0
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('debug');
    if (p === '1') escribir(CLAVE_ACTIVO, '1');
    if (p === '0') {
      escribir(CLAVE_ACTIVO, null);
      escribir(CLAVE_LOG, null);
      escribir(CLAVE_VIVA, null);
    }
    setActivo(leer(CLAVE_ACTIVO) === '1');
  }, []);

  useEffect(() => {
    if (!activo) return undefined;
    refT0.current = performance.now();
    const previo = cargarLog();
    refLog.current = previo;
    const quedoViva = leer(CLAVE_VIVA);
    const ultimaVisible = [...previo].reverse().find((e) => e.tipo === 'latido');
    anotar('inicio', `NUEVA SESIÓN · ${navigator.userAgent} · pantalla ${window.screen.width}x${window.screen.height} · ventana ${window.innerWidth}x${window.innerHeight} · dpr ${window.devicePixelRatio}`);
    if (quedoViva) {
      anotar(
        'CIERRE',
        `La sesión anterior NO se cerró limpia (no hubo pagehide): ${ultimaVisible ? `último latido → ${ultimaVisible.texto}` : 'sin latidos'}. Si estaba visible, es un cierre por memoria del navegador.`
      );
      setAbierto(true);
    }
    escribir(CLAVE_VIVA, '1');

    const alError = (e) => anotar('error', `${e.message} @ ${(e.filename || '').split('/').pop()}:${e.lineno}`);
    const alRechazo = (e) => anotar('rechazo', String(e.reason?.message || e.reason));
    const alPerderContexto = (e) => anotar('WEBGL', `contexto perdido en canvas ${e.target?.width}x${e.target?.height}`);
    const alRecuperar = (e) => anotar('webgl', `contexto recuperado en canvas ${e.target?.width}x${e.target?.height}`);
    const alVisibilidad = () => anotar('visibilidad', document.visibilityState);
    const alSalir = (e) => {
      anotar('pagehide', e.persisted ? 'a caché (persisted)' : 'salida limpia');
      escribir(CLAVE_VIVA, null);
    };
    const alVolver = (e) => {
      if (e.persisted) {
        escribir(CLAVE_VIVA, '1');
        anotar('pageshow', 'volvió de caché');
      }
    };
    const alRedimensionar = () => anotar('resize', `${window.innerWidth}x${window.innerHeight}`);
    window.addEventListener('error', alError);
    window.addEventListener('unhandledrejection', alRechazo);
    window.addEventListener('webglcontextlost', alPerderContexto, true);
    window.addEventListener('webglcontextrestored', alRecuperar, true);
    document.addEventListener('visibilitychange', alVisibilidad);
    window.addEventListener('pagehide', alSalir);
    window.addEventListener('pageshow', alVolver);
    window.addEventListener('resize', alRedimensionar);

    // console.error / warn también al registro
    const originales = { error: console.error, warn: console.warn };
    ['error', 'warn'].forEach((n) => {
      console[n] = (...a) => {
        try {
          anotar(`console.${n}`, a.map((x) => (x instanceof Error ? x.message : typeof x === 'string' ? x : JSON.stringify(x))).join(' ').slice(0, 240));
        } catch {}
        originales[n].apply(console, a);
      };
    });

    // cuadros por segundo y congelamientos
    let cuadros = 0;
    let ultimo = performance.now();
    let raf = 0;
    const contar = (t) => {
      cuadros += 1;
      if (t - ultimo > 600) anotar('congelado', `${Math.round(t - ultimo)} ms sin cuadros`);
      ultimo = t;
      raf = requestAnimationFrame(contar);
    };
    raf = requestAnimationFrame(contar);

    let anterior = '';
    const latido = setInterval(() => {
      const seccion = seccionActual();
      const { total, lista } = pixelesDeCanvas();
      const mem = performance.memory ? ` heap ${Math.round(performance.memory.usedJSHeapSize / 1048576)}MB` : '';
      const texto = `${document.visibilityState === 'visible' ? 'visible' : 'OCULTA'} sec=${seccion} y=${Math.round(window.scrollY)} elementos=${document.getElementsByTagName('*').length} canvas=${lista.length}(${(total / 1e6).toFixed(1)}Mpx) fps=${cuadros}${document.documentElement.hasAttribute('data-proyecto-abierto') ? ' PROYECTO-ABIERTO' : ''}${document.documentElement.hasAttribute('data-rayosx') ? ' rayosx' : ''}${mem}`;
      cuadros = 0;
      if (seccion !== anterior) {
        anotar('seccion', `${anterior || '-'} → ${seccion} · canvas: ${lista.join(', ') || 'ninguno'}`);
        anterior = seccion;
      }
      // en el registro queda un solo latido, el último (es lo que se sabe antes de un cierre): se saca el
      // anterior para no llenar el buffer
      refLog.current = refLog.current.filter((e) => e.tipo !== 'latido');
      anotar('latido', texto);
    }, 1000);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(latido);
      window.removeEventListener('error', alError);
      window.removeEventListener('unhandledrejection', alRechazo);
      window.removeEventListener('webglcontextlost', alPerderContexto, true);
      window.removeEventListener('webglcontextrestored', alRecuperar, true);
      document.removeEventListener('visibilitychange', alVisibilidad);
      window.removeEventListener('pagehide', alSalir);
      window.removeEventListener('pageshow', alVolver);
      window.removeEventListener('resize', alRedimensionar);
      console.error = originales.error;
      console.warn = originales.warn;
    };
  }, [activo, anotar]);

  const refrescar = useCallback(() => setLineas(cargarLog()), []);
  useEffect(() => {
    if (!abierto) return undefined;
    refrescar();
    const id = setInterval(refrescar, 1500);
    return () => clearInterval(id);
  }, [abierto, refrescar]);

  const texto = () => lineas.map((e) => `${e.h} +${e.t}s [${e.tipo}] ${e.texto}`).join('\n');
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto());
      setAviso('Copiado');
    } catch {
      setAviso('No se pudo copiar: mantené apretado el texto y copialo a mano');
    }
    setTimeout(() => setAviso(''), 2500);
  };
  const compartir = async () => {
    try {
      await navigator.share({ title: 'Registro del portafolio', text: texto() });
    } catch {
      /* cancelado */
    }
  };
  const borrar = () => {
    escribir(CLAVE_LOG, '[]');
    refLog.current = [];
    setLineas([]);
  };
  const apagar = () => {
    escribir(CLAVE_ACTIVO, null);
    escribir(CLAVE_LOG, null);
    escribir(CLAVE_VIVA, null);
    window.location.reload();
  };

  if (!activo) return null;
  return (
    <>
      <button type="button" className={styles.boton} onClick={() => setAbierto((v) => !v)} aria-label="Diagnóstico">
        ●
      </button>
      {abierto && (
        <div className={styles.panel} role="dialog" aria-label="Registro de diagnóstico">
          <div className={styles.barra}>
            <strong>Diagnóstico</strong>
            <button type="button" onClick={copiar}>Copiar</button>
            {typeof navigator !== 'undefined' && navigator.share && (
              <button type="button" onClick={compartir}>Compartir</button>
            )}
            <button type="button" onClick={borrar}>Borrar</button>
            <button type="button" onClick={apagar}>Apagar</button>
            <button type="button" onClick={() => setAbierto(false)}>Cerrar</button>
          </div>
          {aviso && <p className={styles.aviso}>{aviso}</p>}
          <pre className={styles.log}>
            {lineas.length ? texto() : 'Sin registros todavía.'}
          </pre>
        </div>
      )}
    </>
  );
}
