'use client';

import React, { useEffect, useMemo, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { logout, type Identity } from '@/lib/auth/client';
import {
  apiRequest,
  type ApiProduct,
  type ApiCategory,
  type ApiUnit,
  type ApiMovement,
  type ApiDashboard,
} from '@/lib/api/cloudstock';

import { AppShell, type Page, type Role, ROLE_PERMISSIONS } from '@/components/layout';
import { Toast } from '@/components/ui';
import UserManagement from '@/components/UserManagement';

import {
  type Product,
  type MovementTx,
  mapProductFromApi,
  mapMovementFromApi,
} from './dashboard/types';

import OverviewTab from './dashboard/OverviewTab';
import ProductsTab from './dashboard/ProductsTab';
import CategoriesTab from './dashboard/CategoriesTab';
import StockMovementTab from './dashboard/StockMovementTab';
import TransactionsTab from './dashboard/TransactionsTab';
import ReportsTab from './dashboard/ReportsTab';
import ProductModal from './dashboard/ProductModal';
import StockModal from './dashboard/StockModal';

export interface DashboardProps {
  identity: Identity;
}

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  admin: 'Quản trị viên',
  staff: 'Nhân viên kho',
  viewer: 'Người xem báo cáo',
};

function DashboardContent({ identity }: DashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const role: Role = identity.role;
  const allowedPages = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer;

  // Single Source of Truth for active tab derived directly from URL searchParams
  const tabParam = searchParams.get('tab') as Page | null;
  const page: Page = (tabParam && allowedPages.includes(tabParam)) ? tabParam : 'dashboard';

  const handleSelectPage = (nextPage: Page) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextPage === 'dashboard') {
      params.delete('tab');
    } else {
      params.set('tab', nextPage);
    }
    const query = params.toString();
    router.replace(query ? `?${query}` : '/', { scroll: false });
  };

  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<MovementTx[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [units, setUnits] = useState<ApiUnit[]>([]);
  const [dashboardStats, setDashboardStats] = useState<ApiDashboard | null>(null);

  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const [modalType, setModalType] = useState<'product' | 'stock' | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [stockInitialSku, setStockInitialSku] = useState('');

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    const timer = setTimeout(() => {
      setToastMessage('');
    }, 3200);
    return () => clearTimeout(timer);
  }, []);

  const refreshData = useCallback(async () => {
    setDataError('');
    try {
      const [list, cats, measure, stats, moves] = await Promise.all([
        apiRequest<{ items: ApiProduct[]; total: number }>('/products?limit=100'),
        apiRequest<ApiCategory[]>('/categories'),
        apiRequest<ApiUnit[]>('/units'),
        apiRequest<ApiDashboard>('/dashboard'),
        role === 'viewer'
          ? Promise.resolve([] as ApiMovement[])
          : apiRequest<ApiMovement[]>('/movements?limit=100'),
      ]);

      setProducts(list.items.map(mapProductFromApi));
      setCategories(cats);
      setUnits(measure);
      setDashboardStats(stats);
      setTransactions(
        moves.map((m) => mapMovementFromApi(m, ROLE_DISPLAY_NAMES))
      );

      if (list.total > list.items.length) {
        setDataError(
          `Đang hiển thị ${list.items.length}/${list.total} sản phẩm. Cần bổ sung phân trang để xem toàn bộ danh mục.`
        );
      }
    } catch (err) {
      setDataError(
        err instanceof Error
          ? err.message
          : 'Không thể tải dữ liệu hệ thống. Vui lòng thử lại.'
      );
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest<{ items: ApiProduct[]; total: number }>('/products?limit=100'),
      apiRequest<ApiCategory[]>('/categories'),
      apiRequest<ApiUnit[]>('/units'),
      apiRequest<ApiDashboard>('/dashboard'),
      role === 'viewer'
        ? Promise.resolve([] as ApiMovement[])
        : apiRequest<ApiMovement[]>('/movements?limit=100'),
    ])
      .then(([list, cats, measure, stats, moves]) => {
        if (!active) return;
        setProducts(list.items.map(mapProductFromApi));
        setCategories(cats);
        setUnits(measure);
        setDashboardStats(stats);
        setTransactions(
          moves.map((m) => mapMovementFromApi(m, ROLE_DISPLAY_NAMES))
        );
        if (list.total > list.items.length) {
          setDataError(
            `Đang hiển thị ${list.items.length}/${list.total} sản phẩm. Cần bổ sung phân trang để xem toàn bộ danh mục.`
          );
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setDataError(
          err instanceof Error
            ? err.message
            : 'Không thể tải dữ liệu hệ thống. Vui lòng thử lại.'
        );
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [role]);

  const lowStockCount = useMemo(() => {
    return products.filter((p) => p.stock < p.minimum).length;
  }, [products]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // Ignored
    } finally {
      router.replace('/login');
    }
  };

  // Product CRUD
  const handleOpenAddProduct = () => {
    setEditProduct(null);
    setModalType('product');
  };

  const handleOpenEditProduct = (prod: Product) => {
    setEditProduct(prod);
    setModalType('product');
  };

  const handleDeleteProduct = async (prod: Product) => {
    if (role !== 'admin') return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa sản phẩm "${prod.name}" (${prod.sku})?`)) {
      return;
    }

    try {
      await apiRequest(`/products/${prod.id}`, { method: 'DELETE' });
      await refreshData();
      showToast('Đã xóa sản phẩm thành công.');
    } catch (err) {
      setDataError(
        err instanceof Error ? err.message : 'Không thể xóa sản phẩm đã chọn.'
      );
    }
  };

  const handleSaveProduct = async (data: {
    name: string;
    sku: string;
    categoryId: string;
    unitId: string;
    costPrice: number;
    minimumStock: number;
    initialStock: number;
    editId?: string;
  }) => {
    if (role !== 'admin') return;

    const isEdit = Boolean(data.editId);
    await apiRequest(`/products${isEdit ? `/${data.editId}` : ''}`, {
      method: isEdit ? 'PATCH' : 'POST',
      body: JSON.stringify({
        name: data.name,
        sku: data.sku,
        categoryId: data.categoryId,
        unitId: data.unitId,
        costPrice: data.costPrice,
        minimumStock: data.minimumStock,
      }),
    });

    await refreshData();
    showToast(isEdit ? 'Đã cập nhật sản phẩm thành công.' : 'Đã thêm sản phẩm thành công.');
  };

  // Stock Movement
  const handleOpenStockTicket = (sku?: string) => {
    setStockInitialSku(sku || products[0]?.sku || '');
    setModalType('stock');
  };

  const handleSaveStockTicket = async (data: {
    productId: string;
    type: 'IN' | 'OUT';
    quantity: number;
    note: string;
  }) => {
    if (role === 'viewer') return;

    await apiRequest('/movements', {
      method: 'POST',
      body: JSON.stringify({
        productId: data.productId,
        type: data.type,
        quantity: data.quantity,
        note: data.note,
      }),
    });

    await refreshData();
    showToast('Đã lưu phiếu nhập / xuất kho thành công.');
  };

  return (
    <AppShell
      currentPage={page}
      onSelectPage={handleSelectPage}
      role={role}
      userEmail={identity.email}
      lowStockCount={lowStockCount}
      onLogout={handleLogout}
    >
      {dataError && (
        <div className="form-error" role="alert" style={{ marginBottom: 16 }}>
          {dataError}{' '}
          <button
            type="button"
            className="small-btn"
            onClick={() => void refreshData()}
          >
            Tải lại
          </button>
        </div>
      )}

      {page === 'dashboard' && (
        <OverviewTab
          role={role}
          loading={loading}
          products={products}
          dashboardStats={dashboardStats}
          onNavigateTab={(tab) => handleSelectPage(tab)}
        />
      )}

      {page === 'products' && (
        <ProductsTab
          role={role}
          products={products}
          onAddProduct={handleOpenAddProduct}
          onEditProduct={handleOpenEditProduct}
          onDeleteProduct={handleDeleteProduct}
          onCreateStockTicket={handleOpenStockTicket}
        />
      )}

      {page === 'categories' && (
        <CategoriesTab categories={categories} products={products} />
      )}

      {page === 'stock' && (
        <StockMovementTab
          products={products}
          onCreateTicket={() => handleOpenStockTicket()}
        />
      )}

      {page === 'transactions' && (
        <TransactionsTab
          transactions={transactions}
          onCreateTicket={role !== 'viewer' ? () => handleOpenStockTicket() : undefined}
        />
      )}

      {page === 'reports' && (
        <ReportsTab products={products} dashboardStats={dashboardStats} />
      )}

      {page === 'users' && role === 'admin' && (
        <UserManagement ownId={identity.id} />
      )}

      <ProductModal
        key={modalType === 'product' ? editProduct?.id || 'new-prod' : 'closed-prod'}
        isOpen={modalType === 'product'}
        onClose={() => setModalType(null)}
        onSave={handleSaveProduct}
        categories={categories}
        units={units}
        editProduct={editProduct}
      />

      <StockModal
        key={modalType === 'stock' ? stockInitialSku || 'default-stock' : 'closed-stock'}
        isOpen={modalType === 'stock'}
        onClose={() => setModalType(null)}
        onSave={handleSaveStockTicket}
        products={products}
        initialSku={stockInitialSku}
      />

      <Toast message={toastMessage} onClose={() => setToastMessage('')} />
    </AppShell>
  );
}

export default function Dashboard(props: DashboardProps) {
  return (
    <Suspense fallback={<div className="panel" style={{ padding: 24 }}>Đang nạp không gian làm việc…</div>}>
      <DashboardContent {...props} />
    </Suspense>
  );
}
