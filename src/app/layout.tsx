import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://cloudstock.vercel.app'),
  title: 'CloudStock | Quản lý kho',
  description: 'Hệ thống quản lý kho trên nền tảng đám mây',
  openGraph: {
    title: 'CloudStock | Hệ Thống Quản Lý Kho Đám Mây',
    description: 'Hệ thống quản lý kho trên nền tảng đám mây đa chi nhánh & kiểm kê tự động',
    siteName: 'CloudStock',
    type: 'website',
    locale: 'vi_VN',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CloudStock | Quản lý kho đám mây',
    description: 'Hệ thống quản lý kho trên nền tảng đám mây đa chi nhánh & kiểm kê tự động',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
