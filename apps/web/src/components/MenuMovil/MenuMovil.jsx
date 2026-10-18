'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ListaLineas from '@/components/ListaLineas/ListaLineas.jsx';
import useTema from '@/hooks/useTema.js';
import InterruptorTema from './InterruptorTema.jsx';
import { irASeccion } from '@/lib/teletransporte.js';
import styles from './MenuMovil.module.css';

// Mismo punto de corte que oculta las píldoras del header (Header.module.css).
const CONSULTA_ESCRITORIO = '(min-width: 769px)';

// Botón de hamburguesa + panel lateral derecho con la navegación. Es hijo del
// grid del <header>, así que queda centrado con el logo por estructura y no por
// números mágicos. Sólo existe en pantallas angostas (en las anchas están las
// píldoras de vidrio).
export default function MenuMovil({ enlaces }) {
  const [abierto, setAbierto] = useState(false);
  const refBoton = useRef(null);
  const refPanel = useRef(null);
  const { tema, alternar } = useTema();
  // Pantalla baja: ítems más chicos y juntos para que el panel entre sin scroll.
  const [compacto, setCompacto] = useState(false);
  useEffect(() => {
    const consulta = window.matchMedia('(max-height: 620px)');
    const leer = () => setCompacto(consulta.matches);
    leer();
    consulta.addEventListener('change', leer);
    return () => consulta.removeEventListener('change', leer);
  }, []);

  const cerrar = useCallback((devolverFoco = true) => {
    setAbierto(false);
    if (devolverFoco) refBoton.current?.focus();
  }, []);

  // Con el panel abierto: la página de atrás no se desplaza (sólo lo hace el
  // panel, si su contenido no entra), la barra de scroll pasa a la izquierda
  // (BarraScroll lee este atributo), y Escape cierra.
  useEffect(() => {
    if (!abierto) return undefined;

    // Se bloquea <html> y no <body>: <html> tiene su propio overflow, así que
    // con `body { overflow: hidden }` el visor seguía desplazándose.
    const raiz = document.documentElement;
    const overflowPrevio = raiz.style.overflow;
    const paddingPrevio = raiz.style.paddingRight;
    // Si el navegador reserva ancho para una barra de scroll clásica, al
    // bloquear el scroll ese ancho se libera y todo se corre (queda un hueco o la
    // página salta). Se lo devolvemos como padding para que nada se mueva.
    const anchoBarra = window.innerWidth - raiz.clientWidth;
    raiz.style.overflow = 'hidden';
    if (anchoBarra > 0) raiz.style.paddingRight = `${anchoBarra}px`;
    raiz.dataset.menuAbierto = 'true';

    function alPresionarTecla(evento) {
      if (evento.key === 'Escape') cerrar();
    }
    document.addEventListener('keydown', alPresionarTecla);

    // Si la pantalla se agranda con el panel abierto (girar la tablet), se
    // cierra: el botón desaparece y quedaría un panel sin forma de cerrarlo.
    const consulta = window.matchMedia(CONSULTA_ESCRITORIO);
    function alCambiarAncho(evento) {
      if (evento.matches) cerrar(false);
    }
    consulta.addEventListener('change', alCambiarAncho);

    // Foco en el primer enlace, ya con el panel entrando.
    const temporizador = setTimeout(() => refPanel.current?.querySelector('a')?.focus(), 80);

    return () => {
      raiz.style.overflow = overflowPrevio;
      raiz.style.paddingRight = paddingPrevio;
      delete raiz.dataset.menuAbierto;
      document.removeEventListener('keydown', alPresionarTecla);
      consulta.removeEventListener('change', alCambiarAncho);
      clearTimeout(temporizador);
    };
  }, [abierto, cerrar]);

  function alElegir(indice, item, evento) {
    evento.preventDefault();
    setAbierto(false);
    // Recién en el cuadro siguiente: con `overflow: hidden` todavía puesto el scroll no se mueve.
    requestAnimationFrame(() => irASeccion(item.href.replace(/^#/, '')));
  }

  return (
    <div className={styles.raiz}>
      <button
        ref={refBoton}
        type="button"
        className={`${styles.boton} ${abierto ? styles.abierto : ''}`}
        aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={abierto}
        aria-controls="menu-movil"
        onClick={() => setAbierto((valor) => !valor)}
      >
        <span className={styles.icono} aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </span>
      </button>

      {/* Captura el toque fuera del panel para cerrarlo. Es transparente: el
          efecto de fondo vive en el panel. */}
      <div
        className={`${styles.fondo} ${abierto ? styles.fondoVisible : ''}`}
        onClick={() => cerrar()}
        aria-hidden="true"
      />

      <aside
        id="menu-movil"
        ref={refPanel}
        className={`${styles.panel} ${abierto ? styles.panelAbierto : ''}`}
        aria-label="Navegación"
        inert={!abierto}
      >
        {/* Capa de fondo: blur mínimo de la página + degradé del color de fondo
            desde la derecha. No lleva caja ni borde. */}
        <div className={styles.capaFondo} aria-hidden="true" />

        {/* Lo único que se desplaza si el contenido no entra. */}
        <div
          id="menu-movil-contenido"
          className={styles.contenido}
          onClick={(evento) => {
            // Tocar el espacio vacío del panel (no un enlace ni el interruptor) cierra.
            if (evento.target === evento.currentTarget) cerrar();
          }}
        >
          <ListaLineas
            alineacion="derecha"
            items={enlaces.map((enlace) => ({ label: enlace.label, href: enlace.href }))}
            colorAcento="var(--color-accent)"
            colorTexto="var(--color-fg)"
            colorMarcador="var(--color-muted)"
            largoMarcador={34}
            desplazamientoMaximo={18}
            radioProximidad={90}
            separacionItems={compacto ? 14 : 26}
            tamanoFuente={compacto ? 1.2 : 1.45}
            suavizado={110}
            alElegir={alElegir}
          />

          <InterruptorTema tema={tema} alAlternar={alternar} />
        </div>
      </aside>
    </div>
  );
}
