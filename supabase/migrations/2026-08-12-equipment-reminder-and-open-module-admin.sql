-- ============================================================================
-- LABO — 장비 사용 종료 리마인더 + 모듈 관리 권한 개방
--
-- 1) equipment.in_use_since — "사용 종료를 깜빡함"을 감지하기 위해 in-use로 바뀐
--    시각을 기록. 클라이언트에서 본인 장비가 오래 사용중이면 리마인더를 띄우고,
--    목록에 "n시간째 사용중"을 보여주는 데 씀.
-- 2) 모듈 켜고 끄기(사이드바 "모듈 관리")를 교수 전용에서 랩 멤버 전체로 개방.
--    labs 테이블 자체의 update 권한은 이름/초대코드 등 다른 필드도 있어서 여전히
--    교수 전용으로 두고, enabled_modules/disabled_tabs 두 컬럼만 바꿀 수 있는
--    전용 RPC(set_lab_enabled_modules / set_lab_disabled_tabs)를 새로 둠.
--
-- 몇 번을 실행해도 안전해요(idempotent). Supabase 대시보드 → SQL Editor →
-- New query → 이 파일 전체를 붙여넣고 Run.
-- ============================================================================

alter table equipment add column if not exists in_use_since timestamptz;

create or replace function set_lab_enabled_modules(target_lab_id uuid, new_modules text[])
returns void language sql security definer as $$
  update labs set enabled_modules = new_modules
  where id = target_lab_id and is_lab_member(target_lab_id);
$$;
grant execute on function set_lab_enabled_modules(uuid, text[]) to authenticated;

create or replace function set_lab_disabled_tabs(target_lab_id uuid, new_tabs text[])
returns void language sql security definer as $$
  update labs set disabled_tabs = new_tabs
  where id = target_lab_id and is_lab_member(target_lab_id);
$$;
grant execute on function set_lab_disabled_tabs(uuid, text[]) to authenticated;
