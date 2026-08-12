-- ============================================================================
-- LABO — gpu_reservations도 오래된 예약 기록 자동 정리
--
-- GPU 예약도 schedules와 같은 패턴(예약 하나하나가 영구히 남는 append-only
-- 기록, 삭제 로직 없음)이라 랩이 GPU 서버를 오래 쓸수록 계속 쌓이기만 함.
-- schedules(180일)와 같은 기준으로, 사용이 끝난(end_at) 지 180일 지난
-- 예약만 정리함. schedules처럼 별도 "정의" 행이 있는 게 아니라 예약 하나하나가
-- 전부 실제 사용 기록이라 예외 없이 전부 정리 대상임.
-- ============================================================================

create index if not exists idx_gpu_res_end_at on gpu_reservations(end_at);

select cron.schedule(
  'cleanup-old-gpu-reservations',
  '0 3 * * *',
  $$ delete from gpu_reservations where end_at < now() - interval '180 days' $$
);
