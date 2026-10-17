'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import styles from './EnlacesProyecto.module.css';

const IconoSitio = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.6 2.7 3.9 5.7 3.9 9s-1.3 6.3-3.9 9c-2.6-2.7-3.9-5.7-3.9-9S9.4 5.7 12 3z" />
  </svg>
);

const IconoGithub = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.35 1.08 2.92.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z" />
  </svg>
);

const Flecha = () => (
  <svg className={styles.flecha} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);

// Enlaces del proyecto (la web en vivo y/o sus repos) como una fila de píldoras bajo el
// título: la web, principal, rellena con el acento del proyecto; los repos, de vidrio.
// Entran una tras otra cuando la tarjeta ya llegó al primer plano.
export default function EnlacesProyecto({ proyecto, reducido }) {
  const e = proyecto.enlaces ?? {};
  // Al hacer click, un círculo del color del proyecto nace en el botón y se expande hasta
  // llenar la pantalla, y se disuelve. El link se abre igual, en otra pestaña, al instante.
  const [onda, setOnda] = useState(null);
  useEffect(() => {
    if (!onda) return undefined;
    const id = setTimeout(() => setOnda(null), 1150);
    return () => clearTimeout(id);
  }, [onda]);
  const alClick = (evento) => {
    if (reducido) return;
    setOnda({ x: evento.clientX, y: evento.clientY, clave: Date.now() });
  };
  const items = [];
  if (e.sitio) items.push({ clave: 'sitio', texto: 'Ver sitio', href: e.sitio, Icono: IconoSitio, principal: true });
  if (e.repoFrontend) items.push({ clave: 'front', texto: 'Frontend', href: e.repoFrontend, Icono: IconoGithub });
  if (e.repoBackend) items.push({ clave: 'back', texto: 'Backend', href: e.repoBackend, Icono: IconoGithub });
  if (!e.repoFrontend && !e.repoBackend && e.repo) items.push({ clave: 'repo', texto: 'Código', href: e.repo, Icono: IconoGithub });
  if (items.length === 0) return null;

  return (
    <nav className={styles.fila} aria-label="Enlaces del proyecto">
      {items.map(({ clave, texto, href, Icono, principal }, i) => (
        <motion.a
          key={clave}
          className={principal ? `${styles.enlace} ${styles.principal}` : styles.enlace}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={alClick}
          initial={reducido ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: { delay: (reducido ? 0 : 0.7) + i * 0.09, duration: 0.5, ease: [0.22, 1, 0.36, 1] } }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
        >
          <Icono />
          <span>{texto}</span>
          <Flecha />
        </motion.a>
      ))}
      {typeof document !== 'undefined'
        ? createPortal(
            <AnimatePresence>
              {onda ? (
                <motion.div
                  key={onda.clave}
                  aria-hidden="true"
                  style={{ position: 'fixed', inset: 0, zIndex: 2000, pointerEvents: 'none', background: proyecto.color ?? '#5b8cff' }}
                  initial={{ clipPath: `circle(0px at ${onda.x}px ${onda.y}px)`, opacity: 1 }}
                  animate={{
                    clipPath: `circle(170vmax at ${onda.x}px ${onda.y}px)`,
                    opacity: [1, 1, 0],
                    transition: { clipPath: { duration: 0.65, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 1.1, times: [0, 0.55, 1] } },
                  }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                />
              ) : null}
            </AnimatePresence>,
            document.body
          )
        : null}
    </nav>
  );
}
