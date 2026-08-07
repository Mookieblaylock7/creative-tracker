import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MY FILM PEOPLE',
  description: 'Track upcoming projects from your favorite film people.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
