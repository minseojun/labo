-- ============================================================================
-- LABO — 장비/소모품 이력을 별도 테이블로 분리 + 오래된 기록 자동 정리
--
-- 지금까지 equipment.logs / supplies.history가 각 행 안에 통째로 들어있는
-- JSONB 배열이었음 — 장비 하나를 오래 쓸수록 그 배열이 끝없이 자라고, 조회할
-- 때마다 전체를 통째로 읽어와야 해서 사용량이 늘어날수록 느려짐(페이지네이션
-- 불가능). 각각 별도 테이블(equipment_logs / supply_history)로 분리해서
-- 인덱스 걸고 최근 것만 조회하도록 바꿈.
--
-- 기존에 이미 쌓여있던 로그는 잃어버리지 않게 새 테이블로 옮겨 담음(백필).
-- 로그의 시각(time)이 "2026. 8. 1. 오전 9:00:00" 같은 사람이 읽는 문자열로
-- 저장돼 있어서 정확한 타임스탬프로 되돌릴 수는 없음 — 대신 장비/소모품의
-- created_at을 기준으로 배열 순서대로 1초씩 띄워서 상대적인 순서(무엇이 먼저
-- 일어났는지)는 정확히 보존함. 백필 후 원래 jsonb 컬럼은 삭제함(이 마이그레이션이
-- 다시 실행돼도 이미 컬럼이 없으면 그냥 건너뜀 — 안전하게 재실행 가능).
--
-- 추가로: pg_cron으로 오래된 이력을 자동 정리함 — 장비/소모품 이력은 90일,
-- 공지(고정된 것 제외)는 30일 지나면 삭제. 안전사고 기록(hazard_incidents)은
-- 감사/안전 목적상 자동 삭제 대상에서 일부러 제외함.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. equipment_logs
-- ----------------------------------------------------------------------------
create table if not exists equipment_logs (
  id            uuid primary key default gen_random_uuid(),
  equipment_id  uuid not null references equipment(id) on delete cascade,
  lab_id        uuid not null references labs(id) on delete cascade,
  user_name     text not null,
  action        text not null,
  memo          text,
  created_at    timestamptz not null default now()
);

alter table equipment_logs enable row level security;
drop policy if exists "equipment_logs_select" on equipment_logs;
drop policy if exists "equipment_logs_insert" on equipment_logs;
create policy "equipment_logs_select" on equipment_logs for select using (is_lab_member(lab_id));
create policy "equipment_logs_insert" on equipment_logs for insert with check (is_lab_member(lab_id));

create index if not exists idx_equipment_logs_equipment on equipment_logs(equipment_id, created_at desc);
create index if not exists idx_equipment_logs_lab on equipment_logs(lab_id);

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='equipment' and column_name='logs') then
    insert into equipment_logs (equipment_id, lab_id, user_name, action, memo, created_at)
    select
      e.id, e.lab_id, log->>'user', log->>'action', nullif(log->>'memo', ''),
      e.created_at + (idx * interval '1 second')
    from equipment e, jsonb_array_elements(e.logs) with ordinality as arr(log, idx)
    where jsonb_typeof(e.logs) = 'array' and jsonb_array_length(e.logs) > 0;

    alter table equipment drop column logs;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 2. supply_history
-- ----------------------------------------------------------------------------
create table if not exists supply_history (
  id            uuid primary key default gen_random_uuid(),
  supply_id     uuid not null references supplies(id) on delete cascade,
  lab_id        uuid not null references labs(id) on delete cascade,
  user_name     text not null,
  from_status   text,
  to_status     text not null,
  created_at    timestamptz not null default now()
);

alter table supply_history enable row level security;
drop policy if exists "supply_history_select" on supply_history;
drop policy if exists "supply_history_insert" on supply_history;
create policy "supply_history_select" on supply_history for select using (is_lab_member(lab_id));
create policy "supply_history_insert" on supply_history for insert with check (can_edit_supply(lab_id));

create index if not exists idx_supply_history_supply on supply_history(supply_id, created_at desc);
create index if not exists idx_supply_history_lab on supply_history(lab_id);

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='supplies' and column_name='history') then
    insert into supply_history (supply_id, lab_id, user_name, from_status, to_status, created_at)
    select
      s.id, s.lab_id, h->>'user', h->>'from', h->>'to',
      s.created_at + (idx * interval '1 second')
    from supplies s, jsonb_array_elements(s.history) with ordinality as arr(h, idx)
    where jsonb_typeof(s.history) = 'array' and jsonb_array_length(s.history) > 0;

    alter table supplies drop column history;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 3. realtime 구독
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['equipment_logs', 'supply_history']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 4. 오래된 기록 자동 정리 (pg_cron) — 매일 새벽 3시(UTC)에 실행
-- ----------------------------------------------------------------------------
create extension if not exists pg_cron;

select cron.schedule(
  'cleanup-equipment-logs',
  '0 3 * * *',
  $$ delete from equipment_logs where created_at < now() - interval '90 days' $$
);

select cron.schedule(
  'cleanup-supply-history',
  '0 3 * * *',
  $$ delete from supply_history where created_at < now() - interval '90 days' $$
);

-- 고정(pinned)된 공지는 계속 중요할 수 있어서 자동 삭제 대상에서 제외함
select cron.schedule(
  'cleanup-old-notices',
  '0 3 * * *',
  $$ delete from notices where created_at < now() - interval '30 days' and pinned = false $$
);
