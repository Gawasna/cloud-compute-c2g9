'use client';

import React from 'react';
import {
  LayoutDashboardIcon,
  PackageIcon,
  ArchiveIcon,
  BoxesIcon,
  ArrowLeftRightIcon,
  HistoryIcon,
  FileBarChartIcon,
  UsersIcon,
  type IconProps,
} from '@/components/ui/Icons';
import { useI18n } from '@/lib/i18n';

export type Role = 'admin' | 'staff' | 'viewer';
export type Page =
  | 'dashboard'
  | 'products'
  | 'archived'
  | 'categories'
  | 'stock'
  | 'transactions'
  | 'reports'
  | 'users';

export interface SidebarProps {
  currentPage: Page;
  onSelectPage: (page: Page) => void;
  role: Role;
  userEmail?: string;
  lowStockCount?: number;
}

export const PAGE_NAMES_VI: Record<Page, string> = {
  dashboard: 'Tổng quan',
  products: 'Sản phẩm',
  archived: 'Kho lưu trữ',
  categories: 'Danh mục',
  stock: 'Nhập / Xuất kho',
  transactions: 'Lịch sử giao dịch',
  reports: 'Báo cáo tồn kho',
  users: 'Quản trị người dùng',
};

export const PAGE_NAMES_EN: Record<Page, string> = {
  dashboard: 'Overview',
  products: 'Products',
  archived: 'Archived Products',
  categories: 'Categories',
  stock: 'Stock In / Out',
  transactions: 'Transaction History',
  reports: 'Reports',
  users: 'User Management',
};

export const PAGE_NAMES: Record<Page, string> = PAGE_NAMES_EN;

export const ROLE_PERMISSIONS: Record<Role, Page[]> = {
  admin: [
    'dashboard',
    'products',
    'archived',
    'categories',
    'stock',
    'transactions',
    'reports',
    'users',
  ],
  staff: ['dashboard', 'products', 'stock', 'transactions'],
  viewer: ['dashboard', 'reports'],
};

export const ROLE_NAMES_VI: Record<Role, string> = {
  admin: 'Quản trị viên',
  staff: 'Nhân viên kho',
  viewer: 'Người xem báo cáo',
};

export const ROLE_NAMES_EN: Record<Role, string> = {
  admin: 'Administrator',
  staff: 'Warehouse Staff',
  viewer: 'Report Viewer',
};

export const ROLE_NAMES: Record<Role, string> = ROLE_NAMES_EN;

export const PAGE_ICONS: Record<Page, React.ComponentType<IconProps>> = {
  dashboard: LayoutDashboardIcon,
  products: PackageIcon,
  archived: ArchiveIcon,
  categories: BoxesIcon,
  stock: ArrowLeftRightIcon,
  transactions: HistoryIcon,
  reports: FileBarChartIcon,
  users: UsersIcon,
};

export default function Sidebar({
  currentPage,
  onSelectPage,
  role,
  userEmail,
  lowStockCount = 0,
}: SidebarProps) {
  const allowedPages = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer;
  const { t } = useI18n();

  const getAvatarChar = (r: Role) => {
    switch (r) {
      case 'admin':
        return 'A';
      case 'staff':
        return 'S';
      case 'viewer':
      default:
        return 'V';
    }
  };

  const getRoleTitle = (r: Role) => {
    switch (r) {
      case 'admin':
        return t.roles.adminTitle;
      case 'staff':
        return t.roles.staffTitle;
      case 'viewer':
      default:
        return t.roles.viewerTitle;
    }
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-icon">
          <BoxesIcon size={20} />
        </span>
        <span>
          Cloud<span className="brand-accent">Stock</span>
        </span>
      </div>

      <div className="sidebar-caption">{t.common.brandCaption}</div>

      <nav>
        {allowedPages.map((pageKey) => {
          const isActive = currentPage === pageKey;
          const showCount = pageKey === 'products' && lowStockCount > 0;
          const IconComponent = PAGE_ICONS[pageKey];
          const label = t.navigation[pageKey] || PAGE_NAMES[pageKey];

          return (
            <button
              key={pageKey}
              type="button"
              className={`nav-item ${isActive ? 'active' : ''}`.trim()}
              onClick={() => onSelectPage(pageKey)}
            >
              <span className="nav-icon">
                <IconComponent size={18} />
              </span>
              {label}
              {showCount && <span className="nav-count">{lowStockCount}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <div className="demo-flag">● {t.common.systemOnline}</div>
        <div className="profile">
          <span className="avatar">{getAvatarChar(role)}</span>
          <div>
            <b>{getRoleTitle(role)}</b>
            <small>{userEmail || t.roles[role]}</small>
          </div>
        </div>
      </div>
    </aside>
  );
}
