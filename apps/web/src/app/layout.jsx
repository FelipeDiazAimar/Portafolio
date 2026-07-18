import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import Bienvenida from '@/components/Bienvenida/Bienvenida.jsx';
import Header from '@/components/Header/Header.jsx';
import ThemeToggle from '@/components/ThemeToggle/ThemeToggle.jsx';
import HeroInmersivo from '@/components/HeroInmersivo/HeroInmersivo.jsx';
import BarraScroll from '@/components/BarraScroll/BarraScroll.jsx';
import { ProveedorPortfolio } from '@/contexto/ProveedorPortfolio.jsx';
import '../styles/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

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
})();`;

function resolveLocale(acceptLanguageHeader) {
  const firstTag = acceptLanguageHeader?.split(',')[0]?.trim().toLowerCase();
  return firstTag?.startsWith('en') ? 'en' : 'es';
}

export default async function RootLayout({ children }) {
  const headerList = await headers();
  const locale = resolveLocale(headerList.get('accept-language'));

  return (
    <html lang={locale} suppressHydrationWarning className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ProveedorPortfolio>
          <Bienvenida locale={locale} />
          <BarraScroll />
          <ThemeToggle />
          <Header />
          <HeroInmersivo />
          <main>{children}</main>
        </ProveedorPortfolio>
      </body>
    </html>
  );
}
