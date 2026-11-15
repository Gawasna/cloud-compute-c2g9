import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://cloudstock.vercel.app'),
  title: 'CloudStock | Inventory Management',
  description: 'Cloud-based inventory management system',
  openGraph: {
    title: 'CloudStock | Cloud-Based Inventory Management System',
    description: 'Enterprise cloud inventory management platform with real-time tracking and automated stock alerts',
    siteName: 'CloudStock',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CloudStock | Inventory Management',
    description: 'Enterprise cloud inventory management platform with real-time tracking and automated stock alerts',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
