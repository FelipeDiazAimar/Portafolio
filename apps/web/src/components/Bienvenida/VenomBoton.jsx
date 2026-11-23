'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './VenomBoton.module.css';

// Venom button original (exteestudio/venom-button, MIT © 2026 exteestudio), servido desde
// /venom/boton.html: copia del original con canvas transparente y un puente postMessage.
// El iframe no recibe punteros (pointer-events: none): se le reenvían desde la ventana, así los
// tentáculos reaccionan al cursor aunque esté fuera del marco.
export default function VenomBoton({ children, texto, onClick, pausado = false, saliendo = false }) {
  const [marco, setMarco] = useState(null);
  const [montado, setMontado] = useState(false);
  const refCaja = useRef(null);
  const refSobre = useRef(false);
  const refClick = useRef(onClick);
  const [sinGl, setSinGl] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    refClick.current = onClick;
  }, [onClick]);

  useEffect(() => {
    if (!marco) return undefined;
    const estilo = document.createElement('style');
    estilo.textContent = ':root[data-venom-mano], :root[data-venom-mano] * { cursor: none !important; }';
    document.head.appendChild(estilo);

    const enviar = (msg) => {
      marco.contentWindow?.postMessage(msg, '*');
    };
    // El iframe cubre toda la portada: el cursor 3D del original vive en toda la Bienvenida. Se le
    // pasa dónde está el botón (su centro, en px de ventana) para que la píldora quede en su lugar.
    const reenviar = (type) => (e) => {
      const r = marco.getBoundingClientRect();
      enviar({ venom: 'ptr', type, x: e.clientX - r.left, y: e.clientY - r.top, pointerType: e.pointerType });
    };
    let ultima = '';
    const ubicar = () => {
      const c = refCaja.current?.getBoundingClientRect();
      const m = marco.getBoundingClientRect();
      if (!c || c.width < 2) return;
      const x = Math.round(c.left - m.left + c.width / 2);
      const y = Math.round(c.top - m.top + c.height / 2);
      const clave = `${x},${y}`;
      if (clave === ultima) return;
      ultima = clave;
      enviar({ venom: 'pos', x, y });
    };
    const alMover = reenviar('pointermove');
    const alBajar = (e) => {
      // un toque no mueve antes de bajar: se avisa la posición para que sepa si cayó sobre la píldora
      alMover(e);
      reenviar('pointerdown')(e);
    };
    const alSubir = reenviar('pointerup');
    function salirDeZona() {
      refSobre.current = false;
      enviar({ venom: 'ptr', type: 'leave' });
    }
    const alSalir = salirDeZona;
    const alClic = () => {
      if (refSobre.current) refClick.current?.();
    };

    const alMensaje = (e) => {
      if (e.source !== marco.contentWindow) return;
      const d = e.data;
      if (!d || typeof d !== 'object') return;
      if (d.venom === 'over') {
        refSobre.current = !!d.on;
      } else if (d.venom === 'engaged') {
        // el original dibuja su propia mano 3D: se oculta el cursor del sistema mientras agarra
        document.documentElement.toggleAttribute('data-venom-mano', !!d.on);
      } else if (d.venom === 'nogl') {
        setSinGl(true);
      }
    };

    // el aviso 'nogl' puede llegar antes de que este listener exista: se mira también el documento (mismo origen)
    const revisarGl = () => {
      if (marco.contentDocument?.body?.classList.contains('no-gl')) setSinGl(true);
    };
    marco.addEventListener('load', revisarGl);
    const alCargar = () => {
      ultima = '';
      ubicar();
    };
    marco.addEventListener('load', alCargar);
    window.addEventListener('resize', ubicar);
    const reloj = setInterval(ubicar, 250);
    revisarGl();
    window.addEventListener('message', alMensaje);
    window.addEventListener('pointermove', alMover, { passive: true });
    window.addEventListener('pointerdown', alBajar, { passive: true });
    window.addEventListener('pointerup', alSubir, { passive: true });
    window.addEventListener('click', alClic);
    document.documentElement.addEventListener('pointerleave', alSalir);
    return () => {
      marco.removeEventListener('load', revisarGl);
      marco.removeEventListener('load', alCargar);
      window.removeEventListener('resize', ubicar);
      clearInterval(reloj);
      window.removeEventListener('message', alMensaje);
      window.removeEventListener('pointermove', alMover);
      window.removeEventListener('pointerdown', alBajar);
      window.removeEventListener('pointerup', alSubir);
      window.removeEventListener('click', alClic);
      document.documentElement.removeEventListener('pointerleave', alSalir);
      document.documentElement.removeAttribute('data-venom-mano');
      estilo.remove();
    };
  }, [marco]);

  return (
    <span ref={refCaja} className={`${styles.caja} ${pausado ? styles.cajaPausada : ''}`}>
      {!sinGl &&
        montado &&
        createPortal(
          <iframe
            ref={setMarco}
            className={`${styles.marco} ${saliendo ? styles.marcoSaliendo : ''}`}
            src={`/venom/boton.html?label=${encodeURIComponent(texto || '')}`}
            title="Venom button"
            aria-hidden="true"
            tabIndex={-1}
            loading="eager"
          />,
          document.body,
        )}
      {/* botón real: teclado, lectores de pantalla y respaldo sin WebGL2 */}
      <button type="button" className={`${styles.boton} ${sinGl ? styles.botonVisible : ''}`} onClick={onClick}>
        <span className={styles.etiqueta}>{children}</span>
      </button>
    </span>
  );
}
