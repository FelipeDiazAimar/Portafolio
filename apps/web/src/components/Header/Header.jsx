import Link from 'next/link';
import styles from './Header.module.css';

const LINKS = [
  { href: '/', label: 'Inicio' },
  { href: '/proyectos', label: 'Proyectos' },
  { href: '/sobre-mi', label: 'Sobre mí' },
  { href: '/contacto', label: 'Contacto' },
];

export default function Header() {
  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className={styles.link}>
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
