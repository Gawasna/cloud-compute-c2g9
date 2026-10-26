import React from 'react';
import {
  type Page,
  type Role,
  PAGE_NAMES,
  ROLE_NAMES,
} from './Sidebar';

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
  const getSubtext = (r: Role) => {
    switch (r) {
      case 'admin':
        return 'Theo dõi và quản lý toàn diện hoạt động kho của bạn.';
      case 'staff':
        return 'Tiếp nhận, kiểm tra và ghi nhận hàng hóa ra vào kho.';
      case 'viewer':
      default:
        return 'Theo dõi các chỉ số và báo cáo phân tích hàng tồn kho.';
    }
  };

  const getPageHeading = (p: Page) => {
    if (p === 'dashboard') {
      return 'Xin chào, chào mừng trở lại!';
    }
    return PAGE_NAMES[p];
  };

  return (
    <header className="topbar">
      <div>
        <div className="eyebrow">
          HỆ THỐNG QUẢN LÝ TỒN KHO / {PAGE_NAMES[currentPage]?.toUpperCase()}
        </div>
        <h1>{getPageHeading(currentPage)}</h1>
        <p>{getSubtext(role)}</p>
      </div>

      <div className="top-actions">
        <div className="role-box">
          <span>Vai trò</span>
          <strong>{ROLE_NAMES[role]}</strong>
        </div>

        <button
          type="button"
          className="logout-btn"
          onClick={onLogout}
        >
          Đăng xuất
        </button>

        <div className="bell" title="Cảnh báo tồn kho" aria-label="Cảnh báo tồn kho">
          ♧{lowStockCount > 0 && <i>{lowStockCount}</i>}
        </div>
      </div>
    </header>
  );
}
