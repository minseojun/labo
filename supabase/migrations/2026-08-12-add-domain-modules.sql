-- ============================================================================
-- LABO — 도메인 모듈 4종 추가 마이그레이션
-- (GPU 서버 예약, 데이터셋 관리, 냉장/냉동고 재고맵, 온보딩 체크리스트)
--
-- 이미 supabase/schema.sql을 한 번 실행해서 기존 테이블(labs, schedules, ...)이
-- 있는 프로젝트에 새 테이블만 추가하기 위한 파일이에요. schema.sql 전체를 다시
-- 실행하면 기존 테이블이 이미 있어서 에러가 나니, 이 파일만 실행하면 됩니다.
--
-- Supabase 대시보드 → SQL Editor → New query → 이 파일 전체를 붙여넣고 Run.
-- (한 번만 실행하면 됩니다)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 10. gpu_servers / gpu_reservations — Dry Lab 모듈: GPU 서버 예약
-- ----------------------------------------------------------------------------
create table gpu_servers (
  id          uuid primary key default gen_random_uuid(),
  lab_id      uuid not null references labs(id) on delete cascade,
  name        text not null,
  spec        text,
  created_at  timestamptz not null default now()
);

create table gpu_reservations (
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
create table datasets (
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
create table fridge_items (
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
create table onboarding_items (
  id          uuid primary key default gen_random_uuid(),
  lab_id      uuid not null references labs(id) on delete cascade,
  title       text not null,
  description text,
  created_at  timestamptz not null default now()
);

create table onboarding_progress (
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
-- RLS 활성화
-- ============================================================================
alter table gpu_servers enable row level security;
alter table gpu_reservations enable row level security;
alter table datasets enable row level security;
alter table fridge_items enable row level security;
alter table onboarding_items enable row level security;
alter table onboarding_progress enable row level security;

-- ----------------------------------------------------------------------------
-- gpu_servers: 생성/삭제는 교수만, 조회는 멤버 전체
-- ----------------------------------------------------------------------------
create policy "gpu_servers_select" on gpu_servers for select using (is_lab_member(lab_id));
create policy "gpu_servers_insert" on gpu_servers for insert with check (is_professor(lab_id));
create policy "gpu_servers_delete" on gpu_servers for delete using (is_professor(lab_id));

-- ----------------------------------------------------------------------------
-- gpu_reservations: 조회/예약은 멤버 전체, 취소는 예약한 본인 또는 교수만
-- ----------------------------------------------------------------------------
create policy "gpu_reservations_select" on gpu_reservations for select using (is_lab_member(lab_id));
create policy "gpu_reservations_insert" on gpu_reservations for insert with check (is_lab_member(lab_id));
create policy "gpu_reservations_delete" on gpu_reservations for delete
  using (is_lab_member(lab_id) and (user_name = (select name from profiles where id = auth.uid()) or is_professor(lab_id)));

-- ----------------------------------------------------------------------------
-- datasets: 조회/등록은 멤버 전체, 삭제는 등록자 본인 또는 교수만
-- ----------------------------------------------------------------------------
create policy "datasets_select" on datasets for select using (is_lab_member(lab_id));
create policy "datasets_insert" on datasets for insert with check (is_lab_member(lab_id));
create policy "datasets_delete" on datasets for delete
  using (is_lab_member(lab_id) and (owner = (select name from profiles where id = auth.uid()) or is_professor(lab_id)));

-- ----------------------------------------------------------------------------
-- fridge_items: 조회/등록은 멤버 전체, 삭제는 등록자 본인 또는 교수만
-- ----------------------------------------------------------------------------
create policy "fridge_items_select" on fridge_items for select using (is_lab_member(lab_id));
create policy "fridge_items_insert" on fridge_items for insert with check (is_lab_member(lab_id));
create policy "fridge_items_delete" on fridge_items for delete
  using (is_lab_member(lab_id) and (owner = (select name from profiles where id = auth.uid()) or is_professor(lab_id)));

-- ----------------------------------------------------------------------------
-- onboarding_items: 조회는 멤버 전체, 생성/삭제(템플릿 관리)는 교수만
-- ----------------------------------------------------------------------------
create policy "onboarding_items_select" on onboarding_items for select using (is_lab_member(lab_id));
create policy "onboarding_items_insert" on onboarding_items for insert with check (is_professor(lab_id));
create policy "onboarding_items_delete" on onboarding_items for delete using (is_professor(lab_id));

-- ----------------------------------------------------------------------------
-- onboarding_progress: 조회는 멤버 전체(교수가 진행률을 보려면 필요),
--                       기록/수정은 본인 것만(교수는 본인 것 + 정정 목적으로 전체 가능)
-- ----------------------------------------------------------------------------
create policy "onboarding_progress_select" on onboarding_progress for select using (is_lab_member(lab_id));
create policy "onboarding_progress_insert" on onboarding_progress for insert
  with check (is_lab_member(lab_id) and user_id = auth.uid());
create policy "onboarding_progress_update" on onboarding_progress for update
  using (user_id = auth.uid() or is_professor(lab_id));

-- ============================================================================
-- 실시간 구독(realtime) 활성화
-- ============================================================================
alter publication supabase_realtime add table gpu_servers;
alter publication supabase_realtime add table gpu_reservations;
alter publication supabase_realtime add table datasets;
alter publication supabase_realtime add table fridge_items;
alter publication supabase_realtime add table onboarding_items;
alter publication supabase_realtime add table onboarding_progress;

-- ============================================================================
-- 인덱스
-- ============================================================================
create index idx_gpu_servers_lab   on gpu_servers(lab_id);
create index idx_gpu_res_lab       on gpu_reservations(lab_id);
create index idx_gpu_res_server    on gpu_reservations(server_id);
create index idx_datasets_lab      on datasets(lab_id);
create index idx_fridge_lab        on fridge_items(lab_id);
create index idx_onboard_items_lab on onboarding_items(lab_id);
create index idx_onboard_prog_lab  on onboarding_progress(lab_id);
create index idx_onboard_prog_user on onboarding_progress(user_id);
