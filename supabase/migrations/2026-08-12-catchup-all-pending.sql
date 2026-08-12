-- ============================================================================
-- LABO — 지금까지 밀린 마이그레이션 한 번에 따라잡기
--
-- 최근 며칠 사이 마이그레이션 파일이 여러 개(개인 일정/타이머, 모듈 개인 표시,
-- 장비 사용 종료 리마인더) 나뉘어 있었는데, 이 중 일부만 적용된 상태에서 앱을
-- 쓰면 "장비 사용 시작 버튼 누르면 오류", "모듈 껐다 새로고침하면 도로 켜짐
-- (저장 안 됨)" 같은 문제가 생김 — 앱은 새 컬럼이 있다고 가정하고 저장을
-- 시도하는데 DB엔 아직 없어서 컬럼 에러로 실패하는 경우들임.
--
-- (모듈 켜고 끄기는 한 차례 더 바뀌어서 지금은 랩 전체 설정이 아니라 완전히
-- 개인 설정 — profiles.hidden_modules만 있으면 되고, 한때 있었던 labs 테이블
-- 전용 RPC는 더 이상 앱에서 쓰지 않음)
--
-- 이 파일 하나만 실행하면 이전에 뭘 실행했든 안 했든 전부 최신 상태로 맞춰짐
-- (전부 idempotent — 몇 번을 실행해도 안전). Supabase 대시보드 → SQL Editor →
-- New query → 이 파일 전체를 붙여넣고 Run.
-- ============================================================================

-- ── 1. 개인 일정 기본 비공개 + 타이머 서버 동기화 ──────────────────────────
alter table schedules add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table schedules add column if not exists visible boolean not null default false;

update schedules s
set user_id = lm.user_id
from lab_members lm
where s.type = 'mine' and s.user_id is null
  and lm.lab_id = s.lab_id and lm.name = s.assignee
  and 1 = (select count(*) from lab_members lm2 where lm2.lab_id = s.lab_id and lm2.name = s.assignee);
update schedules set visible = true where type = 'mine' and user_id is null;

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

-- ── 2. 모듈 개인별 탭바 표시/숨김 (지금은 이게 유일한 모듈 on/off 방식) ─────
alter table profiles add column if not exists hidden_modules text[] not null default '{}';

-- ── 3. 장비 사용 종료 리마인더 ───────────────────────────────────────────
alter table equipment add column if not exists in_use_since timestamptz;

-- ── realtime 구독 (이미 등록돼 있으면 건너뜀) ─────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'timers'
  ) then
    execute 'alter publication supabase_realtime add table timers';
  end if;
end $$;
