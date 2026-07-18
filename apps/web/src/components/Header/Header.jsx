import Link from 'next/link';
import { GlassSurface } from '@portafolio/ui';
import styles from './Header.module.css';

const LINKS = [
  { href: '/sobre-mi', label: 'Sobre mi' },
  { href: '/proyectos', label: 'Proyectos' },
  { href: '/experiencia', label: 'Experiencia' },
  { href: '/habilidades', label: 'Habilidades' },
  { href: '/contacto', label: 'Contáctame' },
];

export default function Header() {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.logo}>Felipe Diaz Aimar</Link>
      <GlassSurface
        width="auto"
        height={48}
        borderRadius={100}
        className={styles.pill}
        opacity={0.9}
        brightness={45}
        blur={14}
        backgroundOpacity={0.12}
        saturation={1.4}
        distortionScale={-140}
        redOffset={0}
        greenOffset={6}
        blueOffset={14}
        displace={0.2}
      >
        <nav className={styles.nav}>
          <ul className={styles.list}>
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={styles.link}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </GlassSurface>
    </header>
  );
}
