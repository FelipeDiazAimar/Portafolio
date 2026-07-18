import Header from '@/components/Header/Header.jsx';
import '../styles/globals.css';

export const metadata = {
  title: 'Felipe Diaz Aimar — Portfolio',
  description: 'Portfolio profesional de desarrollo fullstack.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
