'use client';

import React, { type ReactNode } from 'react';
import Sidebar, { type Page, type Role } from './Sidebar';
import Topbar from './Topbar';
import { I18nProvider, useI18n } from '@/lib/i18n';

export interface AppShellProps {
  currentPage: Page;
  onSelectPage: (page: Page) => void;
  role: Role;
  userEmail?: string;
  lowStockCount?: number;
  onLogout: () => void;
  children: ReactNode;
}

function AppShellInner({
  currentPage,
  onSelectPage,
  role,
  userEmail,
  lowStockCount = 0,
  onLogout,
  children,
}: AppShellProps) {
  const { t } = useI18n();

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

        <footer>{t.footer.copyright}</footer>
      </main>
    </div>
  );
}

export default function AppShell(props: AppShellProps) {
  return (
    <I18nProvider>
      <AppShellInner {...props} />
    </I18nProvider>
  );
}
