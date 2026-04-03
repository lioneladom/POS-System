create table if not exists users (
  id uuid primary key,
  name text not null,
  username text not null unique,
  role text not null check (role in ('admin', 'manager', 'cashier')),
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key,
  name text not null,
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  loyalty_points integer not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists customers_default_unique
  on customers (is_default)
  where is_default = true;

create table if not exists products (
  id uuid primary key,
  name text not null,
  category text not null,
  supplier text not null,
  price numeric(10, 2) not null check (price > 0),
  barcode text not null unique,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists inventory (
  product_id uuid primary key references products (id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  low_stock_threshold integer not null default 6 check (low_stock_threshold >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists sales (
  id uuid primary key,
  sale_code text not null unique,
  cashier_id uuid not null references users (id),
  customer_id uuid references customers (id),
  subtotal numeric(12, 2) not null,
  discount_rate numeric(5, 2) not null default 0,
  discount_amount numeric(12, 2) not null default 0,
  tax_rate numeric(6, 4) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null,
  payment_method text not null check (payment_method in ('cash', 'mobile_money', 'card', 'split')),
  amount_tendered numeric(12, 2) not null,
  change_due numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists sale_items (
  id uuid primary key,
  sale_id uuid not null references sales (id) on delete cascade,
  product_id uuid references products (id),
  product_name text not null,
  barcode text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null,
  line_total numeric(12, 2) not null
);

create table if not exists payments (
  id uuid primary key,
  sale_id uuid not null unique references sales (id) on delete cascade,
  method text not null check (method in ('cash', 'mobile_money', 'card', 'split')),
  amount numeric(12, 2) not null,
  amount_tendered numeric(12, 2) not null,
  change_due numeric(12, 2) not null default 0,
  provider text,
  provider_reference text,
  provider_status text,
  provider_channel text,
  provider_paid_at timestamptz,
  provider_payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists inventory_logs (
  id uuid primary key,
  product_id uuid not null references products (id) on delete cascade,
  user_id uuid not null references users (id),
  action_type text not null check (action_type in ('sale', 'restock', 'adjustment', 'create')),
  quantity_change integer not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists user_sessions (
  id uuid primary key,
  user_id uuid not null references users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = current_schema()
      and table_name = 'products'
      and column_name = 'stock_quantity'
  ) then
    insert into inventory (product_id, quantity, low_stock_threshold)
    select p.id, greatest(coalesce(p.stock_quantity, 0), 0), 6
    from products p
    left join inventory i on i.product_id = p.id
    where i.product_id is null;
  end if;
end $$;

alter table if exists payments add column if not exists provider text;
alter table if exists payments add column if not exists provider_reference text;
alter table if exists payments add column if not exists provider_status text;
alter table if exists payments add column if not exists provider_channel text;
alter table if exists payments add column if not exists provider_paid_at timestamptz;
alter table if exists payments add column if not exists provider_payload jsonb;

create index if not exists inventory_quantity_idx on inventory (quantity asc);
create index if not exists sales_cashier_created_at_idx on sales (cashier_id, created_at desc);
create index if not exists sales_customer_created_at_idx on sales (customer_id, created_at desc);
create index if not exists sale_items_sale_id_idx on sale_items (sale_id);
create index if not exists sale_items_product_id_idx on sale_items (product_id);
create unique index if not exists payments_provider_reference_unique
  on payments (provider_reference)
  where provider_reference is not null;
create index if not exists inventory_logs_product_created_at_idx on inventory_logs (product_id, created_at desc);
create index if not exists inventory_logs_user_created_at_idx on inventory_logs (user_id, created_at desc);
create index if not exists user_sessions_expires_at_idx on user_sessions (expires_at);
