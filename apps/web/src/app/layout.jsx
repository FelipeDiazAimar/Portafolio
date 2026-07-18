import { headers } from 'next/headers';
import Bienvenida from '@/components/Bienvenida/Bienvenida.jsx';
import Header from '@/components/Header/Header.jsx';
import '../styles/globals.css';

export const metadata = {
  title: 'Felipe Diaz Aimar — Portfolio',
  description: 'Portfolio profesional de desarrollo fullstack.',
};

function resolveLocale(acceptLanguageHeader) {
  const firstTag = acceptLanguageHeader?.split(',')[0]?.trim().toLowerCase();
  return firstTag?.startsWith('en') ? 'en' : 'es';
}

export default async function RootLayout({ children }) {
  const headerList = await headers();
  const locale = resolveLocale(headerList.get('accept-language'));

  return (
    <html lang={locale}>
      <body>
        <Bienvenida locale={locale} />
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
