import type { ReactNode } from "react";

/**
 * Baseline layout components and contracts.
 * Provides structural containers and navigational shells for App Router pages.
 */
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
