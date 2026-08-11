-- ============================================================================
-- LABO — 모듈 시스템 + Wet Lab 모듈(위험물 이력) 추가
-- Supabase SQL Editor에서 이 파일 전체를 실행하세요 (schema.sql을 이미 실행한 다음 단계)
-- ============================================================================

-- 랩마다 켜져 있는 모듈 목록 (예: '{wet_lab_hazard_log}')
alter table labs add column if not exists enabled_modules text[] not null default '{}';

-- 위험물 이력 (유출/노출/화상 등 실험실 안전 사고 기록)
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

alter table hazard_incidents enable row level security;

create policy "hazard_select" on hazard_incidents for select using (is_lab_member(lab_id));
create policy "hazard_insert" on hazard_incidents for insert with check (is_lab_member(lab_id));
create policy "hazard_update" on hazard_incidents for update using (is_lab_member(lab_id));
create policy "hazard_delete" on hazard_incidents for delete using (is_professor(lab_id));

alter publication supabase_realtime add table hazard_incidents;

create index if not exists idx_hazard_lab on hazard_incidents(lab_id);
