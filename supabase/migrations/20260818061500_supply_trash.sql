-- 소모품을 실수로 삭제해도 되돌릴 수 있도록 휴지통(소프트 삭제)을 둠.
-- 삭제 버튼을 누르면 바로 지우는 대신 deleted_at을 채우고, 앱에서는 이게
-- null인 것만 목록에 보여줌 — 실제 삭제(remove)는 휴지통 화면의 "영구 삭제"에서만 함
alter table supplies add column if not exists deleted_at timestamptz;
create index if not exists idx_supplies_deleted on supplies(deleted_at);

-- 휴지통도 무한히 쌓이면 의미가 없어서, 30일 지난 항목은 자동으로 완전히 지움
-- (다른 테이블들의 retention cron과 같은 패턴 — schedule_retention.sql 등 참고)
select cron.schedule(
  'cleanup-supplies-trash',
  '0 3 * * *',
  $$ delete from supplies where deleted_at is not null and deleted_at < now() - interval '30 days' $$
);
