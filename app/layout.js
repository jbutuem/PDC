import './globals.css';

export const metadata = {
  title: 'Cardápio — Pão da Primavera',
  description: 'Cardápio do salão da Pão da Primavera Boulangerie, no Cambuí, Campinas.',
  openGraph: { title: 'Cardápio — Pão da Primavera', type: 'website' }
};

export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&family=Fraunces:opsz,wght,SOFT@9..144,400;9..144,600;9..144,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
