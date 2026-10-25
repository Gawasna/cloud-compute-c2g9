import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'CloudStock | Quản lý kho', description: 'Hệ thống quản lý kho trên nền tảng đám mây' };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="vi"><body>{children}</body></html>}
