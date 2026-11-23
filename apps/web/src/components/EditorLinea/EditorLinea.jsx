'use client';

// Editor de la línea del sitio (sólo con `?editarLinea` en la URL). Se scrollea normal y:
//   - clic: agrega un punto al final del tramo elegido
//   - Shift + clic: lo inserta en el segmento más cercano
//   - arrastrar un punto: lo mueve; clic derecho sobre un punto: lo borra
//   - D: activa/desactiva el dibujo (desactivado se puede usar la página normal)
//   - Ctrl+Z: deshace
// La línea se redibuja en vivo. "Guardar en el proyecto" escribe src/data/lineaPuntos.json (sólo en
// desarrollo). Los extremos que empalman con las partes fijas los pone el código.
import { useCallback, useEffect, useRef, useState } from 'react';
import { arribasSecciones, aPagina, dePagina, editando, guardarPuntosLocal, puntosLinea, TRAMOS_EDITABLES } from '@/lib/lineaEditable.js';
import styles from './EditorLinea.module.css';

const AYUDA = {
  hero: 'Desde el hero hasta el borde de Sobre mí (ahí empalma sola con la línea del reel).',
  a: 'Desde el final de Proyectos hasta el pasillo (termina sola en la punta de la línea del piso).',
  c: 'Desde el borde de abajo de Títulos hasta el footer (termina sola en el punto de "Gracias por pasar.").',
};

export default function EditorLinea() {
  const [activo, setActivo] = useState(false);
  const [puntos, setPuntos] = useState(null);
  const [tramo, setTramo] = useState('hero');
  const [dibujar, setDibujar] = useState(true);
  const [aviso, setAviso] = useState('');
  const [, setCuadro] = useState(0);
  const historia = useRef([]);
  const arrastre = useRef(null);
  const pendiente = useRef(0);

  useEffect(() => {
    if (!editando()) return;
    setActivo(true);
    setPuntos(puntosLinea());
  }, []);

  // redibujar los puntos al scrollear (están en coordenadas de página)
  useEffect(() => {
    if (!activo) return undefined;
    let raf = 0;
    const tick = () => {
      setCuadro((n) => (n + 1) % 1e6);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [activo]);

  const cambiar = useCallback((nuevos, guardarHistoria = true) => {
    setPuntos((viejos) => {
      if (guardarHistoria && viejos) historia.current = [...historia.current.slice(-60), viejos];
      return nuevos;
    });
    cancelAnimationFrame(pendiente.current);
    pendiente.current = requestAnimationFrame(() => guardarPuntosLocal(nuevos));
  }, []);

  const deshacer = useCallback(() => {
    const previo = historia.current.pop();
    if (previo) cambiar(previo, false);
  }, [cambiar]);

  useEffect(() => {
    if (!activo) return undefined;
    const tecla = (e) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'd' || e.key === 'D') setDibujar((v) => !v);
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        deshacer();
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [activo, deshacer]);

  if (!activo || !puntos) return null;

  const arribas = arribasSecciones();
  const lista = puntos[tramo] ?? [];
  const enPantalla = lista.map((p) => {
    const [x, y] = aPagina(p, arribas);
    return [x, y - window.scrollY];
  });

  const aPunto = (e) => dePagina(e.clientX, e.clientY + window.scrollY, arribasSecciones());

  const clicCapa = (e) => {
    if (e.button !== 0 || arrastre.current) return;
    const nuevo = aPunto(e);
    const sig = [...lista];
    if (e.shiftKey && enPantalla.length > 1) {
      // en el segmento más cercano
      let mejor = 0;
      let dist = Infinity;
      for (let i = 0; i < enPantalla.length - 1; i += 1) {
        const [ax, ay] = enPantalla[i];
        const [bx, by] = enPantalla[i + 1];
        const dx = bx - ax;
        const dy = by - ay;
        const t = Math.max(0, Math.min(1, ((e.clientX - ax) * dx + (e.clientY - ay) * dy) / (dx * dx + dy * dy || 1)));
        const d = Math.hypot(ax + dx * t - e.clientX, ay + dy * t - e.clientY);
        if (d < dist) {
          dist = d;
          mejor = i + 1;
        }
      }
      sig.splice(mejor, 0, nuevo);
    } else {
      sig.push(nuevo);
    }
    cambiar({ ...puntos, [tramo]: sig });
  };

  const bajarPunto = (i) => (e) => {
    e.stopPropagation();
    if (e.button === 2) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastre.current = { i, movio: false, base: puntos };
  };
  const moverPunto = (i) => (e) => {
    const a = arrastre.current;
    if (!a || a.i !== i) return;
    const sig = [...(puntos[tramo] ?? [])];
    sig[i] = aPunto(e);
    if (!a.movio) historia.current = [...historia.current.slice(-60), a.base];
    a.movio = true;
    cambiar({ ...puntos, [tramo]: sig }, false);
  };
  const soltarPunto = (e) => {
    e.stopPropagation();
    // que el clic que sigue no agregue un punto
    setTimeout(() => {
      arrastre.current = null;
    }, 0);
  };
  const borrarPunto = (i) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    cambiar({ ...puntos, [tramo]: lista.filter((_, k) => k !== i) });
  };

  const guardar = async () => {
    setAviso('Guardando…');
    try {
      const r = await fetch('/editor-linea/guardar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(puntos) });
      const j = await r.json();
      setAviso(j.ok ? 'Guardado en src/data/lineaPuntos.json' : `No se pudo: ${j.error}`);
    } catch {
      setAviso('No se pudo guardar (¿está corriendo el dev server?)');
    }
  };
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(puntos, null, 2));
      setAviso('JSON copiado');
    } catch {
      setAviso('No se pudo copiar');
    }
  };

  const camino = enPantalla.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

  return (
    <>
      {dibujar && <div className={styles.capa} onClick={clicCapa} onContextMenu={(e) => e.preventDefault()} />}
      <svg className={styles.puntos} aria-hidden="true">
        <path d={camino} className={styles.guia} />
        {enPantalla.map(([x, y], i) => (
          <g key={i}>
            <circle
              cx={x}
              cy={y}
              r={9}
              className={styles.punto}
              style={{ pointerEvents: dibujar ? 'auto' : 'none' }}
              onPointerDown={bajarPunto(i)}
              onPointerMove={moverPunto(i)}
              onPointerUp={soltarPunto}
              onClick={(e) => e.stopPropagation()}
              onContextMenu={borrarPunto(i)}
            />
            <text x={x + 12} y={y - 10} className={styles.numero}>
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
      <div className={styles.panel}>
        <strong>Editor de la línea</strong>
        <div className={styles.tramos}>
          {TRAMOS_EDITABLES.map((t) => (
            <button key={t.id} type="button" className={t.id === tramo ? styles.elegido : ''} onClick={() => setTramo(t.id)}>
              {t.nombre} <small>({(puntos[t.id] ?? []).length})</small>
            </button>
          ))}
        </div>
        <p className={styles.ayuda}>{AYUDA[tramo]}</p>
        <p className={styles.ayuda}>
          Clic: agregar al final · Shift+clic: insertar en el medio · arrastrar: mover · clic derecho: borrar · D: {dibujar ? 'pausar dibujo' : 'volver a dibujar'} · Ctrl+Z: deshacer. Sin puntos, el tramo usa el recorrido de siempre.
        </p>
        <div className={styles.botones}>
          <button type="button" onClick={() => setDibujar((v) => !v)}>{dibujar ? 'Pausar (D)' : 'Dibujar (D)'}</button>
          <button type="button" onClick={deshacer}>Deshacer</button>
          <button type="button" onClick={() => cambiar({ ...puntos, [tramo]: [] })}>Vaciar tramo</button>
          <button type="button" onClick={copiar}>Copiar JSON</button>
          <button type="button" className={styles.principal} onClick={guardar}>Guardar en el proyecto</button>
        </div>
        {aviso && <p className={styles.aviso}>{aviso}</p>}
      </div>
    </>
  );
}
