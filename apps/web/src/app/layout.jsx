import { Inter, Source_Serif_4 } from 'next/font/google';
import { headers } from 'next/headers';
import Bienvenida from '@/components/Bienvenida/Bienvenida.jsx';
import Header from '@/components/Header/Header.jsx';
import ThemeToggle from '@/components/ThemeToggle/ThemeToggle.jsx';
import HeroInmersivo from '@/components/HeroInmersivo/HeroInmersivo.jsx';
import PiePagina from '@/components/PiePagina/PiePagina.jsx';
import BarraScroll from '@/components/BarraScroll/BarraScroll.jsx';
import Teletransporte from '@/components/Teletransporte/Teletransporte.jsx';
import { ProveedorPortfolio } from '@/contexto/ProveedorPortfolio.jsx';
import '../styles/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const serif = Source_Serif_4({ subsets: ['latin'], variable: '--font-serif', display: 'swap' });

// viewport-fit=cover: la página se extiende bajo el notch y las barras del navegador (sin franjas
// negras arriba y abajo en el iPhone); los bordes se cuidan con env(safe-area-inset-*) donde hace falta.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata = {
  title: 'Felipe Diaz Aimar — Portfolio',
  description: 'Portfolio profesional de desarrollo fullstack.',
};

const THEME_INIT_SCRIPT = `(function() {
  try {
    var stored = window.localStorage.getItem('theme');
    if (stored === 'light' || stored === 'dark') {
      document.documentElement.setAttribute('data-theme', stored);
    }
  } catch (e) {}
  // Color de la barra de estado / del navegador = fondo de la página, y sigue al cambiar de tema.
  try {
    var el = document.documentElement;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      document.head.appendChild(meta);
    }
    var aplicar = function() {
      var t = el.getAttribute('data-theme');
      if (t !== 'light' && t !== 'dark') t = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      meta.setAttribute('content', t === 'light' ? '#f5f6f8' : '#0b0d12');
    };
    aplicar();
    new MutationObserver(aplicar).observe(el, { attributes: true, attributeFilter: ['data-theme'] });
  } catch (e) {}
})();`;

// En una recarga el navegador debe restaurar el scroll solo (la sección Sobre
// mí retoma su hito). Corre antes de hidratar: el valor 'manual' de la visita
// anterior persiste y hay que devolverlo a 'auto' a tiempo.
const SCROLL_INIT_SCRIPT = `(function() {
  try {
    var nav = performance.getEntriesByType('navigation')[0];
    if (nav && nav.type === 'reload' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'auto';
    }
  } catch (e) {}
})();`;

function resolveLocale(acceptLanguageHeader) {
  const firstTag = acceptLanguageHeader?.split(',')[0]?.trim().toLowerCase();
  return firstTag?.startsWith('en') ? 'en' : 'es';
}

export default async function RootLayout({ children }) {
  const headerList = await headers();
  const locale = resolveLocale(headerList.get('accept-language'));

  return (
    <html lang={locale} suppressHydrationWarning className={`${inter.variable} ${serif.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: SCROLL_INIT_SCRIPT }} />
      </head>
      <body>
        <ProveedorPortfolio>
          <Bienvenida locale={locale} />
          <BarraScroll />
          <Teletransporte />
          <ThemeToggle />
          <Header />
          <HeroInmersivo />
          <main>{children}</main>
          <PiePagina />
        </ProveedorPortfolio>
      </body>
    </html>
  );
}
