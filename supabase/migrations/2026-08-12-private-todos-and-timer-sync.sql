-- ============================================================================
-- LABO — 개인 일정 기본 비공개화 + 타이머 서버 동기화
--
-- 1) schedules(type='mine')는 지금까지 랩 멤버 누구나 보고 고칠 수 있었음(라벨만
--    "개인"이었을 뿐 실제로는 공유 데이터였음). 이제 소유자(user_id)를 기록해서
--    기본은 본인만 보이게 하고, 원하면 visible=true로 켜서 팀에 공개할 수 있게 함.
-- 2) timers는 아예 서버 테이블이 없어서 새로고침·기기 변경 시 사라졌음. 본인
--    소유(user_id) 테이블로 새로 만들어서 실시간 동기화되게 함.
--
-- 몇 번을 실행해도 안전해요(idempotent). Supabase 대시보드 → SQL Editor →
-- New query → 이 파일 전체를 붙여넣고 Run.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. schedules — 개인 일정 소유자/공개 여부 컬럼 추가
-- ----------------------------------------------------------------------------
alter table schedules add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table schedules add column if not exists visible boolean not null default false;

-- 기존 개인(mine) 일정은 담당자(assignee) 이름으로 소유자를 역추적해서 채움.
-- 랩 안에서 이름이 겹치거나(동명이인) 이름이 그새 바뀌어서 못 찾은 행은 주인을
-- 특정할 수 없으니, 잘못 숨겨서 원래 주인이 못 보게 되는 것보단 안전하게
-- 예전처럼 랩 전체에 보이는 상태(visible=true)로 남겨둠
update schedules s
set user_id = lm.user_id
from lab_members lm
where s.type = 'mine' and s.user_id is null
  and lm.lab_id = s.lab_id and lm.name = s.assignee
  and 1 = (select count(*) from lab_members lm2 where lm2.lab_id = s.lab_id and lm2.name = s.assignee);

update schedules set visible = true where type = 'mine' and user_id is null;

-- ----------------------------------------------------------------------------
-- 2. schedules RLS — 공용/잡무(lab, task)는 그대로 전체 공유, 개인(mine)만
--    소유자 전용(+ visible=true면 랩 전체 공개, 교수는 정정 목적으로 수정/삭제 가능)
-- ----------------------------------------------------------------------------
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

create index if not exists idx_schedules_user on schedules(user_id);

-- ----------------------------------------------------------------------------
-- 3. timers — 실험 타이머, 본인 소유(user_id)로만 접근. 랩원끼리 공유하는
--    데이터가 아니라 "내 타이머가 내 기기들 사이에서 안 사라지게" 하는 용도라
--    schedules와 달리 공개 옵션은 없음
-- ----------------------------------------------------------------------------
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

alter table timers enable row level security;

drop policy if exists "timers_select" on timers;
drop policy if exists "timers_insert" on timers;
drop policy if exists "timers_update" on timers;
drop policy if exists "timers_delete" on timers;

create policy "timers_select" on timers for select using (user_id = auth.uid());
create policy "timers_insert" on timers for insert with check (user_id = auth.uid());
create policy "timers_update" on timers for update using (user_id = auth.uid());
create policy "timers_delete" on timers for delete using (user_id = auth.uid());

create index if not exists idx_timers_user on timers(user_id);

-- ============================================================================
-- 실시간 구독(realtime) 활성화 — 이미 등록돼 있으면 건너뜀
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'timers'
  ) then
    execute 'alter publication supabase_realtime add table timers';
  end if;
end $$;
