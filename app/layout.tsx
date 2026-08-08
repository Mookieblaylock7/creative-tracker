import type { Metadata } from 'next';
import './globals.css';

export const metadata = {
  metadataBase: new URL("https://myfilmpeople.app"),
  title: "My Film People | Industry Tracker",
  description: "Track upcoming movies, TV shows, and docs from your favorite film industry directors, writers, actors, and producers.",
  openGraph: {
    title: "My Film People",
    description: "Track upcoming movies, TV shows, and docs from your favorite film industry directors, writers, actors, and producers.",
    url: "https://myfilmpeople.app",
    siteName: "My Film People",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "My Film People",
    description: "Track upcoming movies, TV shows, and docs from your favorite film industry creatives.",
  },
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
