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

export const PAGE_NAMES: Record<Page, string> = {
  dashboard: 'Overview',
  products: 'Products',
  archived: 'Archived Products',
  categories: 'Categories',
  stock: 'Stock In / Out',
  transactions: 'Transaction History',
  reports: 'Reports',
  users: 'User Management',
};

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

export const ROLE_NAMES: Record<Role, string> = {
  admin: 'Administrator',
  staff: 'Warehouse Staff',
  viewer: 'Report Viewer',
};

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
        return 'System Administrator';
      case 'staff':
        return 'Warehouse Staff';
      case 'viewer':
      default:
        return 'Report Viewer';
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

      <div className="sidebar-caption">INVENTORY MANAGEMENT</div>

      <nav>
        {allowedPages.map((pageKey) => {
          const isActive = currentPage === pageKey;
          const showCount = pageKey === 'products' && lowStockCount > 0;
          const IconComponent = PAGE_ICONS[pageKey];
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
              {PAGE_NAMES[pageKey]}
              {showCount && <span className="nav-count">{lowStockCount}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <div className="demo-flag">● SYSTEM ONLINE</div>
        <div className="profile">
          <span className="avatar">{getAvatarChar(role)}</span>
          <div>
            <b>{getRoleTitle(role)}</b>
            <small>{userEmail || ROLE_NAMES[role]}</small>
          </div>
        </div>
      </div>
    </aside>
  );
}
