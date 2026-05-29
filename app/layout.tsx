import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Terminal Retro de Foco e Estudos',
  description: 'Aplicativo de produtividade e estudos inspirado em interfaces retro futuristas CRT dos anos 70/80.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
