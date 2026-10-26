import React, { type ReactNode } from 'react';
import Sidebar, { type Page, type Role } from './Sidebar';
import Topbar from './Topbar';

export interface AppShellProps {
  currentPage: Page;
  onSelectPage: (page: Page) => void;
  role: Role;
  userEmail?: string;
  lowStockCount?: number;
  onLogout: () => void;
  children: ReactNode;
}

export default function AppShell({
  currentPage,
  onSelectPage,
  role,
  userEmail,
  lowStockCount = 0,
  onLogout,
  children,
}: AppShellProps) {
  return (
    <div className="app">
      <Sidebar
        currentPage={currentPage}
        onSelectPage={onSelectPage}
        role={role}
        userEmail={userEmail}
        lowStockCount={lowStockCount}
      />

      <main className="main">
        <Topbar
          currentPage={currentPage}
          role={role}
          lowStockCount={lowStockCount}
          onLogout={onLogout}
        />

        {children}

        <footer>© CloudStock · Hệ thống quản lý kho</footer>
      </main>
    </div>
  );
}
