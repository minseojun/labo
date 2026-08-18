-- 소모품이 쌓일수록 그냥 한 줄로 쭉 나열돼서 정리가 안 되는 느낌이 들어서,
-- 냉장고맵이 물리 위치로 묶어주던 것처럼 소모품도 고정된 카테고리 몇 개로
-- 묶어 보여주기 위한 컬럼을 추가함. 재질(용매/분말)보다 "어떻게 찾는지"가
-- 우선이라, 냉장/냉동 보관이 필요한 건 재질과 무관하게 무조건 냉장/냉동으로
-- 분류하고, 상온 보관되는 것만 용매/분말로 나눔
alter table supplies add column if not exists category text not null default 'other'
  check (category in ('fridge', 'freezer', 'solvent', 'powder', 'consumable', 'other'));

-- 기존 데이터 중 냉장고맵에서 넘어온 항목은 location 문자열에 "냉장"/"냉동"이
-- 남아있어서 최대한 자동으로 분류해줌 — 그 외(원래 소모품탭에 있던 항목)는
-- 전부 '기타'로 남고, 실험실 구성원이 직접 재분류해야 함
update supplies set category = 'freezer' where category = 'other' and location ilike '%냉동%';
update supplies set category = 'fridge' where category = 'other' and location ilike '%냉장%';
