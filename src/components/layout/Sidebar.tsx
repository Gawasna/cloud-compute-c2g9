import React from 'react';

export type Role = 'admin' | 'staff' | 'viewer';
export type Page =
  | 'dashboard'
  | 'products'
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
  dashboard: 'Tổng quan',
  products: 'Sản phẩm',
  categories: 'Danh mục',
  stock: 'Nhập / xuất kho',
  transactions: 'Lịch sử giao dịch',
  reports: 'Báo cáo',
  users: 'Người dùng',
};

export const ROLE_PERMISSIONS: Record<Role, Page[]> = {
  admin: [
    'dashboard',
    'products',
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
  admin: 'Quản trị viên',
  staff: 'Nhân viên kho',
  viewer: 'Người xem báo cáo',
};

export const PAGE_ICONS: Record<Page, string> = {
  dashboard: '◫',
  products: '◈',
  categories: '▦',
  stock: '⇅',
  transactions: '☷',
  reports: '▥',
  users: '♙',
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
        return 'K';
      case 'viewer':
      default:
        return 'B';
    }
  };

  const getRoleTitle = (r: Role) => {
    switch (r) {
      case 'admin':
        return 'Quản trị hệ thống';
      case 'staff':
        return 'Nhân viên kho';
      case 'viewer':
      default:
        return 'Bộ phận báo cáo';
    }
  };

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-icon">▥</span>
        <span>
          Cloud<span className="brand-accent">Stock</span>
        </span>
      </div>

      <div className="sidebar-caption">QUẢN LÝ KHO</div>

      <nav>
        {allowedPages.map((pageKey) => {
          const isActive = currentPage === pageKey;
          const showCount = pageKey === 'products' && lowStockCount > 0;
          return (
            <button
              key={pageKey}
              type="button"
              className={`nav-item ${isActive ? 'active' : ''}`.trim()}
              onClick={() => onSelectPage(pageKey)}
            >
              <span className="nav-icon">{PAGE_ICONS[pageKey]}</span>
              {PAGE_NAMES[pageKey]}
              {showCount && <span className="nav-count">{lowStockCount}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <div className="demo-flag">● HỆ THỐNG ĐANG HOẠT ĐỘNG</div>
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
