-- ============================================================================
-- LABO — 도메인 모듈 4종 추가 마이그레이션
-- (GPU 서버 예약, 데이터셋 관리, 냉장/냉동고 재고맵, 온보딩 체크리스트)
--
-- 몇 번을 실행해도 안전하게(idempotent) 만들어둔 파일이에요 — 이미 일부가
-- 만들어져 있어도, 하나도 없어도 그냥 이 파일 전체를 다시 붙여넣고 Run 하면 돼요.
--
-- Supabase 대시보드 → SQL Editor → New query → 이 파일 전체를 붙여넣고 Run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 10. gpu_servers / gpu_reservations — Dry Lab 모듈: GPU 서버 예약
-- ----------------------------------------------------------------------------
create table if not exists gpu_servers (
  id          uuid primary key default gen_random_uuid(),
  lab_id      uuid not null references labs(id) on delete cascade,
  name        text not null,
  spec        text,
  created_at  timestamptz not null default now()
);

create table if not exists gpu_reservations (
  id          uuid primary key default gen_random_uuid(),
  lab_id      uuid not null references labs(id) on delete cascade,
  server_id   uuid not null references gpu_servers(id) on delete cascade,
  user_name   text not null,
  start_at    timestamptz not null,
  end_at      timestamptz not null,
  memo        text,
  created_at  timestamptz not null default now(),
  check (end_at > start_at)
);

-- ----------------------------------------------------------------------------
-- 11. datasets — Dry Lab 모듈: 공유 데이터셋 경로/버전 기록
-- ----------------------------------------------------------------------------
create table if not exists datasets (
  id           uuid primary key default gen_random_uuid(),
  lab_id       uuid not null references labs(id) on delete cascade,
  name         text not null,
  path         text not null,
  version      text not null default 'v1',
  description  text,
  owner        text not null,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 12. fridge_items — Wet Lab 모듈: 냉장/냉동고 재고맵
-- ----------------------------------------------------------------------------
create table if not exists fridge_items (
  id          uuid primary key default gen_random_uuid(),
  lab_id      uuid not null references labs(id) on delete cascade,
  fridge_name text not null,
  location    text,
  item_name   text not null,
  quantity    text,
  expires_at  date,
  owner       text not null,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 13. onboarding_items / onboarding_progress — Lab Ops 모듈: 신입 온보딩 체크리스트
-- ----------------------------------------------------------------------------
create table if not exists onboarding_items (
  id          uuid primary key default gen_random_uuid(),
  lab_id      uuid not null references labs(id) on delete cascade,
  title       text not null,
  description text,
  created_at  timestamptz not null default now()
);

create table if not exists onboarding_progress (
  id          uuid primary key default gen_random_uuid(),
  lab_id      uuid not null references labs(id) on delete cascade,
  item_id     uuid not null references onboarding_items(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  done        boolean not null default false,
  done_at     timestamptz,
  created_at  timestamptz not null default now(),
  unique (item_id, user_id)
);

-- ============================================================================
-- RLS 활성화 (이미 켜져 있어도 에러 없이 통과함)
-- ============================================================================
alter table gpu_servers enable row level security;
alter table gpu_reservations enable row level security;
alter table datasets enable row level security;
alter table fridge_items enable row level security;
alter table onboarding_items enable row level security;
alter table onboarding_progress enable row level security;

-- ----------------------------------------------------------------------------
-- 정책들 — 이미 있으면 지우고 새로 만들어서 몇 번을 실행해도 안전하게 함
-- ----------------------------------------------------------------------------
drop policy if exists "gpu_servers_select" on gpu_servers;
drop policy if exists "gpu_servers_insert" on gpu_servers;
drop policy if exists "gpu_servers_delete" on gpu_servers;
create policy "gpu_servers_select" on gpu_servers for select using (is_lab_member(lab_id));
create policy "gpu_servers_insert" on gpu_servers for insert with check (is_professor(lab_id));
create policy "gpu_servers_delete" on gpu_servers for delete using (is_professor(lab_id));

drop policy if exists "gpu_reservations_select" on gpu_reservations;
drop policy if exists "gpu_reservations_insert" on gpu_reservations;
drop policy if exists "gpu_reservations_delete" on gpu_reservations;
create policy "gpu_reservations_select" on gpu_reservations for select using (is_lab_member(lab_id));
create policy "gpu_reservations_insert" on gpu_reservations for insert with check (is_lab_member(lab_id));
create policy "gpu_reservations_delete" on gpu_reservations for delete
  using (is_lab_member(lab_id) and (user_name = (select name from profiles where id = auth.uid()) or is_professor(lab_id)));

drop policy if exists "datasets_select" on datasets;
drop policy if exists "datasets_insert" on datasets;
drop policy if exists "datasets_delete" on datasets;
create policy "datasets_select" on datasets for select using (is_lab_member(lab_id));
create policy "datasets_insert" on datasets for insert with check (is_lab_member(lab_id));
create policy "datasets_delete" on datasets for delete
  using (is_lab_member(lab_id) and (owner = (select name from profiles where id = auth.uid()) or is_professor(lab_id)));

drop policy if exists "fridge_items_select" on fridge_items;
drop policy if exists "fridge_items_insert" on fridge_items;
drop policy if exists "fridge_items_delete" on fridge_items;
create policy "fridge_items_select" on fridge_items for select using (is_lab_member(lab_id));
create policy "fridge_items_insert" on fridge_items for insert with check (is_lab_member(lab_id));
create policy "fridge_items_delete" on fridge_items for delete
  using (is_lab_member(lab_id) and (owner = (select name from profiles where id = auth.uid()) or is_professor(lab_id)));

drop policy if exists "onboarding_items_select" on onboarding_items;
drop policy if exists "onboarding_items_insert" on onboarding_items;
drop policy if exists "onboarding_items_delete" on onboarding_items;
create policy "onboarding_items_select" on onboarding_items for select using (is_lab_member(lab_id));
create policy "onboarding_items_insert" on onboarding_items for insert with check (is_professor(lab_id));
create policy "onboarding_items_delete" on onboarding_items for delete using (is_professor(lab_id));

drop policy if exists "onboarding_progress_select" on onboarding_progress;
drop policy if exists "onboarding_progress_insert" on onboarding_progress;
drop policy if exists "onboarding_progress_update" on onboarding_progress;
create policy "onboarding_progress_select" on onboarding_progress for select using (is_lab_member(lab_id));
create policy "onboarding_progress_insert" on onboarding_progress for insert
  with check (is_lab_member(lab_id) and user_id = auth.uid());
create policy "onboarding_progress_update" on onboarding_progress for update
  using (user_id = auth.uid() or is_professor(lab_id));

-- ============================================================================
-- 실시간 구독(realtime) 활성화 — 이미 등록돼 있으면 건너뜀
-- ============================================================================
do $$
declare
  t text;
begin
  foreach t in array array['gpu_servers','gpu_reservations','datasets','fridge_items','onboarding_items','onboarding_progress']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;

-- ============================================================================
-- 인덱스
-- ============================================================================
create index if not exists idx_gpu_servers_lab   on gpu_servers(lab_id);
create index if not exists idx_gpu_res_lab       on gpu_reservations(lab_id);
create index if not exists idx_gpu_res_server    on gpu_reservations(server_id);
create index if not exists idx_datasets_lab      on datasets(lab_id);
create index if not exists idx_fridge_lab        on fridge_items(lab_id);
create index if not exists idx_onboard_items_lab on onboarding_items(lab_id);
create index if not exists idx_onboard_prog_lab  on onboarding_progress(lab_id);
create index if not exists idx_onboard_prog_user on onboarding_progress(user_id);
