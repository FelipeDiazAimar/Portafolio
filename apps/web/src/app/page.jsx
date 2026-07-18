import Link from 'next/link';
import { Button } from '@portafolio/ui';

export default function HomePage() {
  return (
    <section>
      <h1>Felipe Diaz Aimar</h1>
      <p>Desarrollador fullstack — React, Next.js, Node/Express.</p>
      <Link href="/proyectos">
        <Button>Ver proyectos</Button>
      </Link>
    </section>
  );
}
