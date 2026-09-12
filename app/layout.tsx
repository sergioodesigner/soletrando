import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Aprender Letras & Matemática - Educativo Infantil e Juvenil',
  description: 'Aplicativo educativo com fases de letras, soletração e matemática para crianças de 3 a 5, 6 a 8, 9 a 11 e 12 a 14 anos.',
  openGraph: {
    title: 'Aprender Letras & Matemática - Educativo Infantil e Juvenil',
    description: 'Aplicativo educativo com fases de letras, soletração e matemática para crianças de 3 a 5, 6 a 8, 9 a 11 e 12 a 14 anos.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aprender Letras & Matemática - Educativo Infantil e Juvenil',
    description: 'Aplicativo educativo com fases de letras, soletração e matemática para crianças de 3 a 5, 6 a 8, 9 a 11 e 12 a 14 anos.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
