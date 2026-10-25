-- CloudStock schema. Apply AFTER original two baseline migrations.
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '',
 role text not null default 'viewer' check (role in ('admin','staff','viewer')),
 created_at timestamptz not null default now()
);
create table if not exists public.categories (
 id uuid primary key default gen_random_uuid(),
 name text not null unique,
 created_at timestamptz not null default now()
);
create table if not exists public.units (
 id uuid primary key default gen_random_uuid(),
 name text not null unique,
 symbol text not null,
 created_at timestamptz not null default now()
);
create table if not exists public.products (
 id uuid primary key default gen_random_uuid(),
 name varchar(160) not null,
 sku varchar(40) not null unique,
 category_id uuid not null references public.categories(id) on delete restrict,
 unit_id uuid not null references public.units(id) on delete restrict,
 cost_price numeric(15,2) not null default 0 check (cost_price>=0),
 stock_quantity integer not null default 0 check (stock_quantity>=0),
 minimum_stock integer not null default 10 check (minimum_stock>=0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 deleted_at timestamptz
);
create index if not exists products_active_idx on public.products(deleted_at,category_id);
create table if not exists public.stock_movements (
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.products(id) on delete restrict,
 type text not null check(type in ('IN','OUT')),
 quantity integer not null check(quantity>0),
 balance_after integer not null check(balance_after>=0),
 note varchar(500),
 performed_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now()
);
create index if not exists stock_movements_recent_idx on public.stock_movements(created_at desc);
create index if not exists stock_movements_product_idx on public.stock_movements(product_id,created_at desc);
-- Access tables through the authenticated NestJS API only. Its pooled DB role is trusted.
-- These policies allow Supabase Auth users to read only their own profile.
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.units enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;
create policy "profile_self_read" on public.profiles for select to authenticated using(id=auth.uid());
-- No direct client access to inventory tables. Use backend API with JWT role verification.
revoke all on public.categories, public.units, public.products, public.stock_movements from anon,authenticated;
insert into public.categories(name) values ('Điện tử'),('Thời trang'),('Gia dụng'),('Văn phòng phẩm') on conflict(name) do nothing;
insert into public.units(name,symbol) values ('Cái','cái'),('Quyển','quyển'),('Ram','ram') on conflict(name) do nothing;
-- After creating a Supabase Auth account, grant its initial admin role explicitly:
-- insert into public.profiles(id,display_name,role) values ('AUTH-USER-UUID','Tên admin','admin');
-- Never automatically make the first unauthenticated visitor an admin.
