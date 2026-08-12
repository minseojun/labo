-- ============================================================================
-- LABO — 베이스라인 스키마 (Supabase CLI 마이그레이션 파이프라인 도입)
--
-- 이 파일부터는 손으로 SQL Editor에 붙여넣는 대신 Supabase CLI로 관리합니다:
--   supabase link --project-ref <프로젝트 ref>
--   supabase db push
-- CLI는 어떤 마이그레이션이 이미 적용됐는지 원격 DB에 직접 기록해서 추적하기
-- 때문에, "이거 실행했었나?"를 사람이 기억하지 않아도 됩니다. 자세한 건
-- README의 "Supabase 연동" 섹션 참고.
--
-- 이 파일은 지금까지 SQL Editor에 손으로 붙여넣어온 schema.sql +
-- migrations/002~003 + 2026-08-12 마이그레이션 5개의 최종 결과물을 하나로
-- 합친 베이스라인이에요. 전부 idempotent하게 썼기 때문에:
--   - 완전히 새 프로젝트(테이블이 하나도 없음)에 돌려도 되고
--   - 이미 위 파일들을 손으로 일부/전부 실행해둔 기존 프로젝트에 돌려도
--     안전합니다(이미 있는 건 건드리지 않고, 없는 것만 채움).
-- 앞으로의 스키마 변경은 이 파일을 고치지 말고 새 마이그레이션 파일을
-- 추가하는 방식으로 진행하세요 (supabase migration new <이름>).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 테이블 — create table if not exists는 "테이블이 존재하면 통째로 건너뜀"이라
-- 컬럼 하나하나를 다 챙겨 적어도, 이미 있는 테이블의 부분적으로 빠진 컬럼까지
-- 채워주진 않음. 그래서 최초 생성 이후에 추가된 컬럼들은 아래에 별도
-- alter table ... add column if not exists로 한 번 더 명시함
-- ----------------------------------------------------------------------------

create table if not exists labs (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  code             text not null unique,
  prof_name        text not null,
  enabled_modules  text[] not null default '{}',
  disabled_tabs    text[] not null default '{}',
  created_at       timestamptz not null default now()
);
alter table labs add column if not exists enabled_modules text[] not null default '{}';
alter table labs add column if not exists disabled_tabs text[] not null default '{}';

create table if not exists profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  name            text not null,
  email           text not null,
  role            text not null,
  lab_id          uuid references labs(id) on delete set null,
  avatar          text,
  hidden_modules  text[] not null default '{}',
  created_at      timestamptz not null default now()
);
alter table profiles add column if not exists hidden_modules text[] not null default '{}';

create table if not exists lab_members (
  lab_id      uuid not null references labs(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  role        text not null,
  avatar      text,
  joined_at   timestamptz not null default now(),
  primary key (lab_id, user_id)
);

create table if not exists schedules (
  id           uuid primary key default gen_random_uuid(),
  lab_id       uuid not null references labs(id) on delete cascade,
  name         text not null,
  type         text not null check (type in ('lab', 'mine', 'task')),
  date         text not null,
  start_date   text,
  end_date     text,
  time         text default '',
  assignee     text,
  rotation     text[] default '{}',
  overrides    jsonb default '{}'::jsonb,
  color        text,
  repeat       text default 'none',
  repeat_days  integer,
  note         text,
  done         boolean default false,
  user_id      uuid references auth.users(id) on delete set null,
  visible      boolean not null default false,
  created_at   timestamptz not null default now()
);
alter table schedules add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table schedules add column if not exists visible boolean not null default false;

create table if not exists equipment (
  id            uuid primary key default gen_random_uuid(),
  lab_id        uuid not null references labs(id) on delete cascade,
  name          text not null,
  code          text not null,
  status        text not null default 'available' check (status in ('available', 'in-use', 'maintenance')),
  last_user     text,
  icon          text,
  logs          jsonb not null default '[]'::jsonb,
  in_use_since  timestamptz,
  created_at    timestamptz not null default now()
);
alter table equipment add column if not exists in_use_since timestamptz;

create table if not exists equipment_comments (
  id            uuid primary key default gen_random_uuid(),
  equipment_id  uuid not null references equipment(id) on delete cascade,
  lab_id        uuid not null references labs(id) on delete cascade,
  author        text not null,
  role          text,
  text          text not null,
  created_at    timestamptz not null default now()
);

create table if not exists supplies (
  id          uuid primary key default gen_random_uuid(),
  lab_id      uuid not null references labs(id) on delete cascade,
  name        text not null,
  spec        text,
  status      text not null default 'green' check (status in ('green', 'yellow', 'red')),
  history     jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

create table if not exists notices (
  id          uuid primary key default gen_random_uuid(),
  lab_id      uuid not null references labs(id) on delete cascade,
  author      text not null,
  avatar      text,
  body        text not null,
  pinned      boolean not null default false,
  hidden      boolean not null default false,
  date        text,
  created_at  timestamptz not null default now()
);

create table if not exists notice_comments (
  id          uuid primary key default gen_random_uuid(),
  notice_id   uuid not null references notices(id) on delete cascade,
  lab_id      uuid not null references labs(id) on delete cascade,
  author      text not null,
  avatar      text,
  role        text,
  text        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists hazard_incidents (
  id            uuid primary key default gen_random_uuid(),
  lab_id        uuid not null references labs(id) on delete cascade,
  title         text not null,
  category      text not null check (category in ('spill', 'exposure', 'burn', 'equipment', 'other')),
  severity      text not null default 'low' check (severity in ('low', 'medium', 'high')),
  location      text,
  action_taken  text,
  reporter      text not null,
  occurred_at   text not null,
  created_at    timestamptz not null default now()
);

-- 지금은 앱에서 쓰지 않지만(개인 할일은 schedules.type='mine'으로 대체됨),
-- 과거 마이그레이션 흔적이라 삭제하지 않고 그대로 둠
create table if not exists todos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  text        text not null,
  done        boolean not null default false,
  done_date   text,
  created_at  timestamptz not null default now()
);

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

create table if not exists timers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  lab_id      uuid references labs(id) on delete set null,
  name        text not null,
  duration    integer not null,
  time_left   integer not null,
  equipment   text default '',
  running     boolean not null default false,
  done        boolean not null default false,
  memo        text default '',
  end_at      timestamptz,
  created_at  timestamptz not null default now()
);

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
-- 헬퍼 함수 — create or replace라 이미 있어도 안전하게 다시 정의됨
-- ============================================================================
create or replace function is_lab_member(target_lab_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from lab_members
    where lab_id = target_lab_id and user_id = auth.uid()
  );
$$;

create or replace function member_role(target_lab_id uuid)
returns text language sql security definer stable as $$
  select role from lab_members
  where lab_id = target_lab_id and user_id = auth.uid();
$$;

create or replace function is_professor(target_lab_id uuid)
returns boolean language sql security definer stable as $$
  select member_role(target_lab_id) = '교수';
$$;

create or replace function can_edit_supply(target_lab_id uuid)
returns boolean language sql security definer stable as $$
  select member_role(target_lab_id) in ('대학원생', '교수');
$$;

create or replace function equipment_lab_id(eq_id uuid)
returns uuid language sql security definer stable as $$
  select lab_id from equipment where id = eq_id;
$$;

create or replace function notice_lab_id(n_id uuid)
returns uuid language sql security definer stable as $$
  select lab_id from notices where id = n_id;
$$;

create or replace function lookup_lab_by_code(p_code text)
returns table(id uuid, name text) language sql security definer stable as $$
  select id, name from labs where code = p_code;
$$;
grant execute on function lookup_lab_by_code(text) to anon, authenticated;

-- 지금은 앱에서 쓰지 않음(모듈 켜고 끄기가 랩 전체 설정 → 완전 개인 설정으로
-- 재구조화되면서 profiles.hidden_modules 하나로 대체됨). 과거 흔적이라 그대로 둠
create or replace function set_lab_enabled_modules(target_lab_id uuid, new_modules text[])
returns void language sql security definer as $$
  update labs set enabled_modules = new_modules
  where id = target_lab_id and is_lab_member(target_lab_id);
$$;
grant execute on function set_lab_enabled_modules(uuid, text[]) to authenticated;

create or replace function set_lab_disabled_tabs(target_lab_id uuid, new_tabs text[])
returns void language sql security definer as $$
  update labs set disabled_tabs = new_tabs
  where id = target_lab_id and is_lab_member(target_lab_id);
$$;
grant execute on function set_lab_disabled_tabs(uuid, text[]) to authenticated;

-- ============================================================================
-- RLS 활성화 — 이미 켜져 있어도 다시 실행 가능(에러 안 남)
-- ============================================================================
alter table labs enable row level security;
alter table profiles enable row level security;
alter table lab_members enable row level security;
alter table schedules enable row level security;
alter table equipment enable row level security;
alter table equipment_comments enable row level security;
alter table supplies enable row level security;
alter table notices enable row level security;
alter table notice_comments enable row level security;
alter table hazard_incidents enable row level security;
alter table todos enable row level security;
alter table gpu_servers enable row level security;
alter table gpu_reservations enable row level security;
alter table datasets enable row level security;
alter table fridge_items enable row level security;
alter table onboarding_items enable row level security;
alter table onboarding_progress enable row level security;
alter table timers enable row level security;

-- ============================================================================
-- RLS 정책 — create policy는 if not exists를 지원하지 않아서, 매번
-- drop policy if exists 후 create policy로 재정의(순서를 지켜야 함)
-- ============================================================================
drop policy if exists "labs_select" on labs;
drop policy if exists "labs_insert" on labs;
drop policy if exists "labs_update" on labs;
drop policy if exists "labs_delete" on labs;
create policy "labs_select" on labs for select using (auth.role() = 'authenticated');
create policy "labs_insert" on labs for insert with check (auth.role() = 'authenticated');
create policy "labs_update" on labs for update using (is_professor(id));
create policy "labs_delete" on labs for delete using (is_professor(id));

drop policy if exists "profiles_select_own" on profiles;
drop policy if exists "profiles_insert_own" on profiles;
drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

drop policy if exists "members_select" on lab_members;
drop policy if exists "members_insert_self" on lab_members;
drop policy if exists "members_update" on lab_members;
drop policy if exists "members_delete" on lab_members;
create policy "members_select" on lab_members for select using (is_lab_member(lab_id));
create policy "members_insert_self" on lab_members for insert with check (auth.uid() = user_id);
create policy "members_update" on lab_members for update using (auth.uid() = user_id or is_professor(lab_id));
create policy "members_delete" on lab_members for delete using (is_professor(lab_id));

drop policy if exists "schedules_select" on schedules;
drop policy if exists "schedules_insert" on schedules;
drop policy if exists "schedules_update" on schedules;
drop policy if exists "schedules_delete" on schedules;
create policy "schedules_select" on schedules for select using (
  is_lab_member(lab_id) and (type <> 'mine' or user_id = auth.uid() or visible)
);
create policy "schedules_insert" on schedules for insert with check (
  is_lab_member(lab_id) and (type <> 'mine' or user_id = auth.uid() or is_professor(lab_id))
);
create policy "schedules_update" on schedules for update using (
  is_lab_member(lab_id) and (type <> 'mine' or user_id = auth.uid() or user_id is null or is_professor(lab_id))
);
create policy "schedules_delete" on schedules for delete using (
  is_lab_member(lab_id) and (type <> 'mine' or user_id = auth.uid() or user_id is null or is_professor(lab_id))
);

drop policy if exists "equipment_select" on equipment;
drop policy if exists "equipment_insert" on equipment;
drop policy if exists "equipment_update" on equipment;
drop policy if exists "equipment_delete" on equipment;
create policy "equipment_select" on equipment for select using (is_lab_member(lab_id));
create policy "equipment_insert" on equipment for insert with check (is_professor(lab_id));
create policy "equipment_update" on equipment for update using (is_lab_member(lab_id));
create policy "equipment_delete" on equipment for delete using (is_professor(lab_id));

drop policy if exists "equipment_comments_select" on equipment_comments;
drop policy if exists "equipment_comments_insert" on equipment_comments;
drop policy if exists "equipment_comments_delete" on equipment_comments;
create policy "equipment_comments_select" on equipment_comments for select
  using (is_lab_member(equipment_lab_id(equipment_id)));
create policy "equipment_comments_insert" on equipment_comments for insert
  with check (is_lab_member(equipment_lab_id(equipment_id)));
create policy "equipment_comments_delete" on equipment_comments for delete
  using (is_lab_member(equipment_lab_id(equipment_id)) and is_professor(equipment_lab_id(equipment_id)));

drop policy if exists "supplies_select" on supplies;
drop policy if exists "supplies_insert" on supplies;
drop policy if exists "supplies_update" on supplies;
drop policy if exists "supplies_delete" on supplies;
create policy "supplies_select" on supplies for select using (is_lab_member(lab_id));
create policy "supplies_insert" on supplies for insert with check (can_edit_supply(lab_id));
create policy "supplies_update" on supplies for update using (can_edit_supply(lab_id));
create policy "supplies_delete" on supplies for delete using (is_professor(lab_id));

drop policy if exists "notices_select" on notices;
drop policy if exists "notices_insert" on notices;
drop policy if exists "notices_update" on notices;
drop policy if exists "notices_delete" on notices;
create policy "notices_select" on notices for select using (is_lab_member(lab_id));
create policy "notices_insert" on notices for insert with check (is_lab_member(lab_id));
create policy "notices_update" on notices for update using (is_lab_member(lab_id));
create policy "notices_delete" on notices for delete using (is_professor(lab_id));

drop policy if exists "notice_comments_select" on notice_comments;
drop policy if exists "notice_comments_insert" on notice_comments;
drop policy if exists "notice_comments_delete" on notice_comments;
create policy "notice_comments_select" on notice_comments for select
  using (is_lab_member(notice_lab_id(notice_id)));
create policy "notice_comments_insert" on notice_comments for insert
  with check (is_lab_member(notice_lab_id(notice_id)));
create policy "notice_comments_delete" on notice_comments for delete
  using (is_lab_member(notice_lab_id(notice_id)) and is_professor(notice_lab_id(notice_id)));

drop policy if exists "hazard_select" on hazard_incidents;
drop policy if exists "hazard_insert" on hazard_incidents;
drop policy if exists "hazard_update" on hazard_incidents;
drop policy if exists "hazard_delete" on hazard_incidents;
create policy "hazard_select" on hazard_incidents for select using (is_lab_member(lab_id));
create policy "hazard_insert" on hazard_incidents for insert with check (is_lab_member(lab_id));
create policy "hazard_update" on hazard_incidents for update using (is_lab_member(lab_id));
create policy "hazard_delete" on hazard_incidents for delete using (is_professor(lab_id));

drop policy if exists "todos_select_own" on todos;
drop policy if exists "todos_insert_own" on todos;
drop policy if exists "todos_update_own" on todos;
drop policy if exists "todos_delete_own" on todos;
create policy "todos_select_own" on todos for select using (auth.uid() = user_id);
create policy "todos_insert_own" on todos for insert with check (auth.uid() = user_id);
create policy "todos_update_own" on todos for update using (auth.uid() = user_id);
create policy "todos_delete_own" on todos for delete using (auth.uid() = user_id);

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

drop policy if exists "timers_select" on timers;
drop policy if exists "timers_insert" on timers;
drop policy if exists "timers_update" on timers;
drop policy if exists "timers_delete" on timers;
create policy "timers_select" on timers for select using (user_id = auth.uid());
create policy "timers_insert" on timers for insert with check (user_id = auth.uid());
create policy "timers_update" on timers for update using (user_id = auth.uid());
create policy "timers_delete" on timers for delete using (user_id = auth.uid());

-- ============================================================================
-- 실시간 구독(realtime) — alter publication add table은 이미 추가돼 있으면
-- 에러가 나서, pg_publication_tables를 먼저 확인하고 없을 때만 추가함
-- ============================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'schedules', 'equipment', 'equipment_comments', 'supplies', 'notices',
    'notice_comments', 'lab_members', 'hazard_incidents', 'todos',
    'gpu_servers', 'gpu_reservations', 'datasets', 'fridge_items',
    'onboarding_items', 'onboarding_progress', 'timers'
  ]
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
create index if not exists idx_schedules_lab     on schedules(lab_id);
create index if not exists idx_schedules_user     on schedules(user_id);
create index if not exists idx_equipment_lab      on equipment(lab_id);
create index if not exists idx_supplies_lab       on supplies(lab_id);
create index if not exists idx_notices_lab        on notices(lab_id);
create index if not exists idx_eq_comments        on equipment_comments(equipment_id);
create index if not exists idx_notice_comments    on notice_comments(notice_id);
create index if not exists idx_hazard_lab         on hazard_incidents(lab_id);
create index if not exists idx_todos_user         on todos(user_id);
create index if not exists idx_profiles_lab       on profiles(lab_id);
create index if not exists idx_gpu_servers_lab    on gpu_servers(lab_id);
create index if not exists idx_gpu_res_lab        on gpu_reservations(lab_id);
create index if not exists idx_gpu_res_server     on gpu_reservations(server_id);
create index if not exists idx_datasets_lab       on datasets(lab_id);
create index if not exists idx_fridge_lab         on fridge_items(lab_id);
create index if not exists idx_onboard_items_lab  on onboarding_items(lab_id);
create index if not exists idx_onboard_prog_lab   on onboarding_progress(lab_id);
create index if not exists idx_onboard_prog_user  on onboarding_progress(user_id);
create index if not exists idx_timers_user        on timers(user_id);
