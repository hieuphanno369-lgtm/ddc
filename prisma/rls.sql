-- RLS (Row Level Security) — Supabase/Postgres
-- TODO: RLS chưa enforce — file này mới là template, chưa apply lên DB thật. Apply khi deploy Supabase.
-- Áp dụng SAU `prisma migrate deploy`: mở Supabase SQL editor chạy file này.
--
-- LƯU Ý QUAN TRỌNG (next-auth vs Supabase RLS):
--   App dùng next-auth (Google OAuth) → JWT KHÔNG phải Supabase auth.jwt().
--   => Khuyến nghị: app connect bằng SERVICE-ROLE key (bypass RLS), RBAC chính
--      ở app layer (src/server/actions.ts: requireRole / requireProject).
--   => RLS ở đây là lớp phòng thủ thứ 2 cho kết nối trực tiếp DB.
--   => Policy dưới dùng auth.jwt() làm template; khi tích hợp Supabase Auth thì thay
--      auth.jwt()->>'role' bằng claim thật. Xem docs/DEPLOY.md.

-- Helper: role của user hiện tại (từ JWT claim 'role')
create or replace function public.current_user_role() returns text
language sql stable as $$
  select coalesce(current_setting('request.jwt.claims', true)::json->>'role', 'viewer');
$$;

-- ===== Enable RLS toàn bộ =====
alter table "dim_customer"               enable row level security;
alter table "dim_team_kd"                enable row level security;
alter table "dim_factory"                enable row level security;
alter table "dim_currency"               enable row level security;
alter table "dim_exchange_rate"          enable row level security;
alter table "dim_project"                enable row level security;
alter table "dim_project_alias"          enable row level security;
alter table "project_sap_codes"          enable row level security;
alter table "project_assignments"        enable row level security;
alter table "user_roles"                 enable row level security;
alter table "fact_progress_monthly"      enable row level security;
alter table "fact_value_chain_progress"  enable row level security;
alter table "fact_financial"             enable row level security;
alter table "fact_volume"                enable row level security;
alter table "alert_log"                  enable row level security;
alter table "audit_log"                  enable row level security;
alter table "sap_queue"                  enable row level security;
alter table "password_reset_token"       enable row level security;
alter table "auth_throttle"              enable row level security;

-- ===== Read: mọi user đã đăng nhập đọc được (dashboard) =====
create policy "read_dim_project" on "dim_project" for select using (current_user_role() is not null);
create policy "read_fact_progress" on "fact_progress_monthly" for select using (current_user_role() is not null);
create policy "read_fact_financial" on "fact_financial" for select using (current_user_role() is not null);
create policy "read_fact_volume" on "fact_volume" for select using (current_user_role() is not null);
create policy "read_dim_customer" on "dim_customer" for select using (current_user_role() is not null);
create policy "read_dim_team_kd" on "dim_team_kd" for select using (current_user_role() is not null);
create policy "read_dim_factory" on "dim_factory" for select using (current_user_role() is not null);
create policy "read_dim_currency" on "dim_currency" for select using (current_user_role() is not null);
create policy "read_dim_exchange_rate" on "dim_exchange_rate" for select using (current_user_role() is not null);

-- ===== Write: admin full; data-entry chỉ project mình PIC (qua project_assignments) =====
-- Mẫu cho dim_project + fact_progress_monthly. Lặp pattern cho các fact/bảng còn lại khi cần.
create policy "write_dim_project_admin" on "dim_project"
  for all using (current_user_role() = 'admin') with check (current_user_role() = 'admin');

create policy "write_fact_admin" on "fact_progress_monthly"
  for all using (current_user_role() = 'admin') with check (current_user_role() = 'admin');

-- data-entry: chỉ được ghi fact của project mình là PIC
create policy "write_fact_data_entry_own" on "fact_progress_monthly"
  for update using (
    current_user_role() = 'data-entry'
    and exists (
      select 1 from "project_assignments" pa
      where pa."projectId" = "fact_progress_monthly"."projectId"
        and pa."userEmail" = current_setting('request.jwt.claims', true)::json->>'email'
    )
  );
