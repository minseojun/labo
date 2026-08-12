-- ============================================================================
-- LABO — schedules 테이블도 오래된 기록은 자동 정리
--
-- equipment_logs/supply_history/notices는 이미 보관 기간을 두고 자동 삭제되는데
-- schedules(공용 일정 + 개인 할 일)는 빠져 있었음 — 개인 할 일은 완료해도 지워지지
-- 않고 계속 쌓이기만 해서, 랩이 오래될수록 매번 전체를 읽어오는 홈/캘린더 화면이
-- 느려짐.
--
-- 다만 type='task'(잡무) 행은 지우면 안 됨 — 이건 "매주 화요일 청소" 같은 반복
-- 잡무의 정의(definition) 자체라서 date는 시작일일 뿐, 실제 발생일은 매번
-- utils.js의 computeSchedule()이 그 자리에서 계산해냄(별도 occurrence 행을
-- DB에 저장하지 않음). 그래서 잡무 정의 행 개수는 랩 하나당 몇 개 안 되고
-- 시간이 지나도 늘어나지 않음 — 정리 대상이 아니라 애초에 정리할 필요가 없음.
--
-- 정리 대상은 type in ('lab', 'mine')뿐이고, 지난 날짜 기준 180일(6개월)
-- 지난 것만 지움 — 로그성 데이터(90일)보다는 넉넉하게 잡음 (캘린더는 몇 달
-- 전 일정을 돌아볼 일이 로그보다는 있을 수 있어서).
-- ============================================================================

create index if not exists idx_schedules_type_date on schedules(type, date);

select cron.schedule(
  'cleanup-old-schedules',
  '0 3 * * *',
  $$ delete from schedules where type in ('lab', 'mine') and date < to_char(current_date - interval '180 days', 'YYYY-MM-DD') $$
);
