import type { ReactNode } from 'react';

export interface BaseLayoutProps {
  children: ReactNode;
}

export interface HeaderProps {
  title?: string;
  navigationItems?: Array<{ label: string; href: string }>;
}

export interface FooterProps {
  copyrightYear?: number;
  companyName?: string;
}

export { default as Sidebar, PAGE_NAMES, ROLE_PERMISSIONS, ROLE_NAMES, PAGE_ICONS } from './Sidebar';
export type { SidebarProps, Page, Role } from './Sidebar';

export { default as Topbar } from './Topbar';
export type { TopbarProps } from './Topbar';

export { default as AppShell } from './AppShell';
export type { AppShellProps } from './AppShell';
