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
-- ----------------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  email       text not null,
  role        text not null,
  lab_id      uuid references labs(id) on delete set null,
  avatar      text,
  created_at  timestamptz not null default now()
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
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 5. equipment — 장비 + 사용 로그
-- ----------------------------------------------------------------------------
create table equipment (
  id          uuid primary key default gen_random_uuid(),
  lab_id      uuid not null references labs(id) on delete cascade,
  name        text not null,
  code        text not null,
  status      text not null default 'available' check (status in ('available', 'in-use', 'maintenance')),
  last_user   text,
  icon        text,
  logs        jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
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
-- schedules: 랩 멤버는 전부 CRUD 가능 (Firestore rules와 동일)
-- ----------------------------------------------------------------------------
create policy "schedules_select" on schedules for select using (is_lab_member(lab_id));
create policy "schedules_insert" on schedules for insert with check (is_lab_member(lab_id));
create policy "schedules_update" on schedules for update using (is_lab_member(lab_id));
create policy "schedules_delete" on schedules for delete using (is_lab_member(lab_id));

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

-- ============================================================================
-- 인덱스
-- ============================================================================
create index idx_schedules_lab   on schedules(lab_id);
create index idx_equipment_lab   on equipment(lab_id);
create index idx_supplies_lab    on supplies(lab_id);
create index idx_notices_lab     on notices(lab_id);
create index idx_eq_comments     on equipment_comments(equipment_id);
create index idx_notice_comments on notice_comments(notice_id);
create index idx_hazard_lab      on hazard_incidents(lab_id);
create index idx_todos_user      on todos(user_id);
create index idx_profiles_lab    on profiles(lab_id);
