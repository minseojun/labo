-- ============================================================================
-- LABO — 잡무 완료/오픈슬롯, GPU예약↔일정 연결, 소모품 위치/유효기한
-- ============================================================================

-- 잡무(occurrence)는 반복 규칙으로 매번 계산되는 가상의 발생일이라 행 자체가
-- 없음 — "이 잡무를 이 날짜에 완료했다/오늘은 못한다"를 저장하려면 날짜 배열로
-- 들고 있는 수밖에 없음. done_dates에 있으면 완료, open_dates에 있으면
-- "당번이 오늘 못 한다고 표시해서 자원자를 기다리는 중"
alter table schedules add column if not exists done_dates text[] default '{}';
alter table schedules add column if not exists open_dates text[] default '{}';

-- GPU 예약을 만들면 본인 개인 일정에도 자동으로 걸어주는데, 예약을 취소할 때
-- 그 일정도 같이 지우려면 어떤 schedules 행이 이 예약에서 만들어졌는지 알아야 함.
-- 예약을 만든 직후에 방금 만든 일정의 id를 이 컬럼에 채워 넣어야 해서 update
-- 정책도 필요함(원래 gpu_reservations는 update 정책 자체가 없어서 전부 막혀있었음)
alter table gpu_reservations add column if not exists schedule_id uuid references schedules(id) on delete set null;
drop policy if exists "gpu_reservations_update" on gpu_reservations;
create policy "gpu_reservations_update" on gpu_reservations for update
  using (is_lab_member(lab_id) and user_name = (select name from profiles where id = auth.uid()));

-- 소모품에 보관 위치(선택)와 유효기한(선택)을 추가 — 냉장고맵 모듈을 소모품
-- 탭으로 흡수하면서 그쪽이 갖고 있던 필드를 소모품 쪽으로 가져옴
alter table supplies add column if not exists location text;
alter table supplies add column if not exists expires_at date;

-- ── 냉장고맵 데이터를 소모품으로 이전 ──────────────────────────────────────
-- fridge_items 한 행 = 소모품 한 행으로 변환. fridgeName+location을 하나의
-- location 문자열로 합치고, 재고 상태 개념이 없던 데이터라 기본값 'green'으로.
-- migrated_to_supplies 플래그로 재실행해도 중복 삽입되지 않게 함(멱등).
alter table fridge_items add column if not exists migrated_to_supplies boolean not null default false;

insert into supplies (lab_id, name, spec, status, location, expires_at, created_at)
select
  lab_id,
  item_name,
  quantity,
  'green',
  fridge_name || case when location is not null and location <> '' then ' · ' || location else '' end,
  expires_at,
  created_at
from fridge_items
where not migrated_to_supplies;

update fridge_items set migrated_to_supplies = true where not migrated_to_supplies;

-- ── 소모품 수정/삭제 권한을 랩 구성원 전체로 개방 ──────────────────────────
-- 냉장고맵을 흡수하면서 "누가 올렸든 상관없이 위치·수량 정보는 아무나 고치고
-- 지울 수 있어야 한다"는 요구를 반영. 기존엔 수정은 대학원생·교수만,
-- 삭제는 교수만 가능했음(can_edit_supply / is_professor) — 랩 구성원이면
-- 누구나 가능하도록 완화함
drop policy if exists "supplies_update" on supplies;
drop policy if exists "supplies_delete" on supplies;
create policy "supplies_update" on supplies for update using (is_lab_member(lab_id));
create policy "supplies_delete" on supplies for delete using (is_lab_member(lab_id));
