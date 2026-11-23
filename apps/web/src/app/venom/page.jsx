// Original tal cual: exteestudio/venom-button (MIT © 2026 exteestudio).
// Se sirve en iframe para no modificar ni una línea del original.
// Demo viva: https://exteestudio.github.io/venom-button/
// Repo: https://github.com/exteestudio/venom-button
// Si vendoreás copia local en public/venom/index.html, el iframe la usa automáticamente.
import styles from './page.module.css';

const REMOTA = 'https://exteestudio.github.io/venom-button/';
const LOCAL = '/venom/index.html';

export const metadata = {
  title: 'Venom button — original exteestudio',
  description: 'Symbiote goo button original (MIT) embebido tal cual, sin modificaciones.',
};

export default function VenomPage() {
  // Copia local vendoreada en public/venom (tal cual, MIT).
  const src = LOCAL;
  return (
    <div className={styles.pagina}>
      <div className={styles.barra}>
        <a href="/">← Volver</a>
        <span>
          Original <strong>exteestudio/venom-button</strong> tal cual (MIT © 2026 exteestudio).
        </span>
        <small>
          <a href="https://github.com/exteestudio/venom-button" target="_blank" rel="noopener noreferrer">
            repo
          </a>
          {' · '}
          <a href={LOCAL} target="_blank" rel="noopener noreferrer">
            copia local
          </a>
        </small>
      </div>
      <iframe className={styles.marco} src={src} title="Venom button original exteestudio" allow="autoplay; fullscreen" />
    </div>
  );
}
