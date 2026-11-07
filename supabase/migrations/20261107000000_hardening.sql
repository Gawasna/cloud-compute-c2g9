-- Hardening migration (apply AFTER 20261025000001_user_management.sql).
-- 1) SKU uniqueness must only apply to ACTIVE products, otherwise a soft-deleted product
--    keeps its SKU forever and the SKU can never be re-used.
alter table public.products drop constraint if exists products_sku_key;
create unique index if not exists products_sku_active_uidx
  on public.products (sku) where deleted_at is null;

-- 2) Keep updated_at honest on products regardless of which code path updates the row.
drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
  before update on public.products
  for each row execute function public.handle_updated_at();

-- 3) Stock movements are an append-only ledger: forbid UPDATE/DELETE so history can't be rewritten.
create or replace function public.forbid_stock_movement_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'stock_movements is append-only (% not allowed)', tg_op using errcode = '42501';
end;
$$;
drop trigger if exists stock_movements_append_only on public.stock_movements;
create trigger stock_movements_append_only
  before update or delete on public.stock_movements
  for each row execute function public.forbid_stock_movement_mutation();

-- 4) Case-insensitive search support for the product list.
create index if not exists products_name_lower_idx on public.products (lower(name));
