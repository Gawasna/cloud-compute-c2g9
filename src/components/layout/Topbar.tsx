'use client';

import React from 'react';
import {
  type Page,
  type Role,
  PAGE_NAMES,
  ROLE_NAMES,
} from './Sidebar';
import { BellIcon } from '@/components/ui/Icons';
import { useI18n, LanguageSwitcher } from '@/lib/i18n';

export interface TopbarProps {
  currentPage: Page;
  role: Role;
  lowStockCount?: number;
  onLogout: () => void;
}

export default function Topbar({
  currentPage,
  role,
  lowStockCount = 0,
  onLogout,
}: TopbarProps) {
  const { t } = useI18n();

  const getSubtext = (r: Role) => {
    return t.topbar.subtext[r] || t.topbar.subtext.viewer;
  };

  const getPageHeading = (p: Page) => {
    if (p === 'dashboard') {
      return t.topbar.welcomeGreeting;
    }
    return t.navigation[p] || PAGE_NAMES[p];
  };

  const pageNavName = (t.navigation[currentPage] || PAGE_NAMES[currentPage] || '').toUpperCase();

  return (
    <header className="topbar">
      <div>
        <div className="eyebrow">
          {t.topbar.systemTitle} / {pageNavName}
        </div>
        <h1>{getPageHeading(currentPage)}</h1>
        <p>{getSubtext(role)}</p>
      </div>

      <div className="top-actions">
        <LanguageSwitcher />

        <div className="role-box">
          <span>{t.topbar.roleLabel}</span>
          <strong>{t.roles[role] || ROLE_NAMES[role]}</strong>
        </div>

        <button
          type="button"
          className="logout-btn"
          onClick={onLogout}
        >
          {t.common.logout}
        </button>

        <div className="bell" title={t.topbar.alertTooltip} aria-label={t.topbar.alertTooltip}>
          <BellIcon size={18} />
          {lowStockCount > 0 && <i>{lowStockCount}</i>}
        </div>
      </div>
    </header>
  );
}
