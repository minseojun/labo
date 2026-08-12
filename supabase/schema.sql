-- ============================================================================
-- LABO — Supabase 스키마 + RLS 정책
-- Supabase 대시보드 → SQL Editor 에 이 파일 전체를 붙여넣고 Run 하세요.
-- (한 번만 실행하면 됩니다. 기존 Firestore 데이터 구조를 그대로 관계형으로 옮겼어요.)
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. labs — 연구실
-- ----------------------------------------------------------------------------
create table labs (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  code             text not null unique,
  prof_name        text not null,
  enabled_modules  text[] not null default '{}',
  disabled_tabs    text[] not null default '{}',
  created_at       timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. profiles — 유저 프로필 (auth.users 1:1). 본인만 읽고 쓸 수 있음 (Firestore users/{uid}와 동일)
--    hidden_modules: 랩이 켠 모듈 중 "내 탭바에는 안 보이게" 개인적으로 숨긴 목록.
--    랩 단위 설정(labs.enabled_modules)과 별개로, 순전히 본인 화면 취향만 담음
-- ----------------------------------------------------------------------------
create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  name            text not null,
  email           text not null,
  role            text not null,
  lab_id          uuid references labs(id) on delete set null,
  avatar          text,
  hidden_modules  text[] not null default '{}',
  created_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. lab_members — 랩 안에서 공개되는 멤버 정보 (다른 멤버도 읽을 수 있음)
-- ----------------------------------------------------------------------------
create table lab_members (
  lab_id      uuid not null references labs(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  role        text not null,
  avatar      text,
  joined_at   timestamptz not null default now(),
  primary key (lab_id, user_id)
);

-- ----------------------------------------------------------------------------
-- 4. schedules — 일정 + 잡무 (type: lab / mine / task)
--    user_id/visible: 개인(mine) 일정의 소유자와 공개 여부. 공용(lab)/잡무(task)는
--    이 두 컬럼을 쓰지 않고 예전처럼 랩 전체에 공유됨(RLS 정책 참고)
-- ----------------------------------------------------------------------------
create table schedules (
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

-- ----------------------------------------------------------------------------
-- 5. equipment — 장비 + 사용 로그
--    in_use_since: 지금 in-use로 바뀐 시각. "사용 종료를 깜빡함"을 감지해서
--    본인에게 리마인더를 띄우고, 목록에 "n시간째 사용중"을 보여주는 데 씀
-- ----------------------------------------------------------------------------
create table equipment (
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

create table equipment_comments (
  id            uuid primary key default gen_random_uuid(),
  equipment_id  uuid not null references equipment(id) on delete cascade,
  lab_id        uuid not null references labs(id) on delete cascade,
  author        text not null,
  role          text,
  text          text not null,
  created_at    timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 6. supplies — 소모품 재고 + 변경 이력
-- ----------------------------------------------------------------------------
create table supplies (
  id          uuid primary key default gen_random_uuid(),
  lab_id      uuid not null references labs(id) on delete cascade,
  name        text not null,
  spec        text,
  status      text not null default 'green' check (status in ('green', 'yellow', 'red')),
  history     jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 7. notices — 공지사항 + 댓글
-- ----------------------------------------------------------------------------
create table notices (
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

create table notice_comments (
  id          uuid primary key default gen_random_uuid(),
  notice_id   uuid not null references notices(id) on delete cascade,
  lab_id      uuid not null references labs(id) on delete cascade,
  author      text not null,
  avatar      text,
  role        text,
  text        text not null,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 8. hazard_incidents — 위험물 이력 (Wet Lab 모듈: 유출/노출/화상 등 안전 사고 기록)
-- ----------------------------------------------------------------------------
create table hazard_incidents (
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

-- ----------------------------------------------------------------------------
-- 9. todos — 개인 할일 (본인만 접근)
-- ----------------------------------------------------------------------------
create table todos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  text        text not null,
  done        boolean not null default false,
  done_date   text,
  created_at  timestamptz not null default now()
);

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
-- 13.5 timers — 실험 타이머. 본인 소유(user_id)로만 접근하는 개인 데이터라,
--      랩원끼리 공유하지 않고 "내 타이머가 내 기기들 사이에서 안 사라지게"만 함
-- ----------------------------------------------------------------------------
create table timers (
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
-- 헬퍼 함수 — Firestore rules의 isMember()/memberRole()/isProfessor()와 동일한 역할
-- security definer로 만들어서 RLS 정책 안에서 재귀 없이 안전하게 lab_members를 조회함
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

-- 장비/공지 하위 댓글에서 lab_id를 안 넘겨도 되게, 부모 row에서 lab_id를 끌어오는 헬퍼
create or replace function equipment_lab_id(eq_id uuid)
returns uuid language sql security definer stable as $$
  select lab_id from equipment where id = eq_id;
$$;

create or replace function notice_lab_id(n_id uuid)
returns uuid language sql security definer stable as $$
  select lab_id from notices where id = n_id;
$$;

-- 회원가입 중(=아직 lab_members에 속하지 않은 상태)에도 초대코드로 랩을 찾을 수 있게 하는
-- RPC. labs 테이블 전체를 노출하지 않고 code가 정확히 일치하는 랩의 id/name만 돌려줌
create or replace function lookup_lab_by_code(p_code text)
returns table(id uuid, name text) language sql security definer stable as $$
  select id, name from labs where code = p_code;
$$;
grant execute on function lookup_lab_by_code(text) to anon, authenticated;

-- 모듈 켜고 끄기는 교수 전용이 아니라 랩 멤버 전체가 할 수 있어야 해서(labs 테이블
-- 자체의 update 권한은 이름/초대코드 같은 다른 필드도 있어 여전히 교수 전용으로 둠),
-- enabled_modules/disabled_tabs 이 두 컬럼만 딱 집어 바꿀 수 있는 전용 RPC를 둠.
-- UPDATE가 조건에 안 맞아 0행을 바꾸면(랩 멤버가 아니거나 잘못된 lab_id) 에러 없이
-- 조용히 아무 일도 안 하는 게 기본 SQL 동작이라 — 클라이언트는 "성공"으로 착각하고
-- 새로고침하면 안 바뀐 게 드러나는 문제가 있었음. FOUND로 명시적으로 예외를 던짐
create or replace function set_lab_enabled_modules(target_lab_id uuid, new_modules text[])
returns void language plpgsql security definer as $$
begin
  update labs set enabled_modules = new_modules
  where id = target_lab_id and is_lab_member(target_lab_id);
  if not found then
    raise exception 'lab not found or not a member of this lab';
  end if;
end;
$$;
grant execute on function set_lab_enabled_modules(uuid, text[]) to authenticated;

create or replace function set_lab_disabled_tabs(target_lab_id uuid, new_tabs text[])
returns void language plpgsql security definer as $$
begin
  update labs set disabled_tabs = new_tabs
  where id = target_lab_id and is_lab_member(target_lab_id);
  if not found then
    raise exception 'lab not found or not a member of this lab';
  end if;
end;
$$;
grant execute on function set_lab_disabled_tabs(uuid, text[]) to authenticated;

-- ============================================================================
-- RLS 활성화
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

-- ----------------------------------------------------------------------------
-- labs: 인증된 사용자는 조회 가능(가입 시 초대코드 조회 필요), 생성은 누구나(신규 랩),
--       수정/삭제는 교수만
-- ----------------------------------------------------------------------------
create policy "labs_select" on labs for select
  using (auth.role() = 'authenticated');
create policy "labs_insert" on labs for insert
  with check (auth.role() = 'authenticated');
create policy "labs_update" on labs for update
  using (is_professor(id));
create policy "labs_delete" on labs for delete
  using (is_professor(id));

-- ----------------------------------------------------------------------------
-- profiles: 본인만 읽기/쓰기
-- ----------------------------------------------------------------------------
create policy "profiles_select_own" on profiles for select
  using (auth.uid() = id);
create policy "profiles_insert_own" on profiles for insert
  with check (auth.uid() = id);
create policy "profiles_update_own" on profiles for update
  using (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- lab_members: 같은 랩 멤버는 조회 가능, 본인 row는 본인이 생성,
--              수정은 본인 또는 교수, 삭제(강퇴)는 교수만
-- ----------------------------------------------------------------------------
create policy "members_select" on lab_members for select
  using (is_lab_member(lab_id));
create policy "members_insert_self" on lab_members for insert
  with check (auth.uid() = user_id);
create policy "members_update" on lab_members for update
  using (auth.uid() = user_id or is_professor(lab_id));
create policy "members_delete" on lab_members for delete
  using (is_professor(lab_id));

-- ----------------------------------------------------------------------------
-- schedules: 공용(lab)/잡무(task)는 랩 멤버 전부 CRUD 가능. 개인(mine)은
--            기본적으로 본인만 보고 고칠 수 있고, visible=true면 랩 전체에
--            보이기만 함(수정/삭제는 여전히 본인 또는 정정 목적의 교수만)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- equipment: 생성/삭제는 교수만, 조회/사용상태 변경은 멤버 전체
-- ----------------------------------------------------------------------------
create policy "equipment_select" on equipment for select using (is_lab_member(lab_id));
create policy "equipment_insert" on equipment for insert with check (is_professor(lab_id));
create policy "equipment_update" on equipment for update using (is_lab_member(lab_id));
create policy "equipment_delete" on equipment for delete using (is_professor(lab_id));

create policy "equipment_comments_select" on equipment_comments for select
  using (is_lab_member(equipment_lab_id(equipment_id)));
create policy "equipment_comments_insert" on equipment_comments for insert
  with check (is_lab_member(equipment_lab_id(equipment_id)));
create policy "equipment_comments_delete" on equipment_comments for delete
  using (is_lab_member(equipment_lab_id(equipment_id)) and is_professor(equipment_lab_id(equipment_id)));

-- ----------------------------------------------------------------------------
-- supplies: 생성/수정은 대학원생 이상, 삭제는 교수만, 조회는 멤버 전체
-- ----------------------------------------------------------------------------
create policy "supplies_select" on supplies for select using (is_lab_member(lab_id));
create policy "supplies_insert" on supplies for insert with check (can_edit_supply(lab_id));
create policy "supplies_update" on supplies for update using (can_edit_supply(lab_id));
create policy "supplies_delete" on supplies for delete using (is_professor(lab_id));

-- ----------------------------------------------------------------------------
-- notices: 생성/완료처리는 멤버 전체, 삭제는 교수만
-- ----------------------------------------------------------------------------
create policy "notices_select" on notices for select using (is_lab_member(lab_id));
create policy "notices_insert" on notices for insert with check (is_lab_member(lab_id));
create policy "notices_update" on notices for update using (is_lab_member(lab_id));
create policy "notices_delete" on notices for delete using (is_professor(lab_id));

create policy "notice_comments_select" on notice_comments for select
  using (is_lab_member(notice_lab_id(notice_id)));
create policy "notice_comments_insert" on notice_comments for insert
  with check (is_lab_member(notice_lab_id(notice_id)));
create policy "notice_comments_delete" on notice_comments for delete
  using (is_lab_member(notice_lab_id(notice_id)) and is_professor(notice_lab_id(notice_id)));

-- ----------------------------------------------------------------------------
-- hazard_incidents: 조회/등록/수정은 멤버 전체, 삭제는 교수만
-- ----------------------------------------------------------------------------
create policy "hazard_select" on hazard_incidents for select using (is_lab_member(lab_id));
create policy "hazard_insert" on hazard_incidents for insert with check (is_lab_member(lab_id));
create policy "hazard_update" on hazard_incidents for update using (is_lab_member(lab_id));
create policy "hazard_delete" on hazard_incidents for delete using (is_professor(lab_id));

-- ----------------------------------------------------------------------------
-- todos: 본인만 접근
-- ----------------------------------------------------------------------------
create policy "todos_select_own" on todos for select using (auth.uid() = user_id);
create policy "todos_insert_own" on todos for insert with check (auth.uid() = user_id);
create policy "todos_update_own" on todos for update using (auth.uid() = user_id);
create policy "todos_delete_own" on todos for delete using (auth.uid() = user_id);

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

-- ----------------------------------------------------------------------------
-- timers: 본인만 접근 (schedules의 개인 일정과 달리 공개 옵션 자체가 없음)
-- ----------------------------------------------------------------------------
create policy "timers_select" on timers for select using (user_id = auth.uid());
create policy "timers_insert" on timers for insert with check (user_id = auth.uid());
create policy "timers_update" on timers for update using (user_id = auth.uid());
create policy "timers_delete" on timers for delete using (user_id = auth.uid());

-- ============================================================================
-- 실시간 구독(realtime) 활성화 — 앱이 onSnapshot 대신 postgres_changes로 구독함
-- ============================================================================
alter publication supabase_realtime add table schedules;
alter publication supabase_realtime add table equipment;
alter publication supabase_realtime add table equipment_comments;
alter publication supabase_realtime add table supplies;
alter publication supabase_realtime add table notices;
alter publication supabase_realtime add table notice_comments;
alter publication supabase_realtime add table lab_members;
alter publication supabase_realtime add table hazard_incidents;
alter publication supabase_realtime add table todos;
alter publication supabase_realtime add table gpu_servers;
alter publication supabase_realtime add table gpu_reservations;
alter publication supabase_realtime add table datasets;
alter publication supabase_realtime add table fridge_items;
alter publication supabase_realtime add table onboarding_items;
alter publication supabase_realtime add table onboarding_progress;
alter publication supabase_realtime add table timers;

-- ============================================================================
-- 인덱스
-- ============================================================================
create index idx_schedules_lab   on schedules(lab_id);
create index idx_schedules_user  on schedules(user_id);
create index idx_equipment_lab   on equipment(lab_id);
create index idx_supplies_lab    on supplies(lab_id);
create index idx_notices_lab     on notices(lab_id);
create index idx_eq_comments     on equipment_comments(equipment_id);
create index idx_notice_comments on notice_comments(notice_id);
create index idx_hazard_lab      on hazard_incidents(lab_id);
create index idx_todos_user      on todos(user_id);
create index idx_profiles_lab    on profiles(lab_id);
create index idx_gpu_servers_lab on gpu_servers(lab_id);
create index idx_gpu_res_lab     on gpu_reservations(lab_id);
create index idx_gpu_res_server  on gpu_reservations(server_id);
create index idx_datasets_lab    on datasets(lab_id);
create index idx_fridge_lab      on fridge_items(lab_id);
create index idx_onboard_items_lab on onboarding_items(lab_id);
create index idx_onboard_prog_lab  on onboarding_progress(lab_id);
create index idx_onboard_prog_user on onboarding_progress(user_id);
create index idx_timers_user       on timers(user_id);
