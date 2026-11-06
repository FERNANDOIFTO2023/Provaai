import type { Metadata } from 'next';
import './sala.css';
import './bloub.css';
import './icon-motion.css';

export const metadata: Metadata = {
  applicationName: 'Provaai',
  title: 'Provaai · Provas personalizadas',
  description: 'Turmas e provas individuais para aplicar em sala de aula.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
