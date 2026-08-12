-- 잡무 반복을 "N일마다" 숫자뿐 아니라 "매주 월·목처럼 특정 요일마다"로도 만들 수 있게
-- 요일 배열(0=일 ~ 6=토)을 저장할 컬럼을 추가함. repeat = 'weekdays'일 때만 씀
alter table schedules add column if not exists repeat_weekdays integer[];
