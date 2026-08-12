-- ============================================================================
-- LABO — 프로필 사진 업로드용 Storage 버킷 + 정책
--
-- profiles.avatar / lab_members.avatar 컬럼은 이미 text라서 스키마 변경은 필요
-- 없고, 이모지 대신 이 버킷에 올라간 사진의 공개 URL을 그대로 저장해요.
-- 몇 번을 실행해도 안전해요.
--
-- Supabase 대시보드 → SQL Editor → New query → 이 파일 전체를 붙여넣고 Run.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

alter table storage.objects enable row level security;

-- 업로드 경로를 "{내 user id}/파일명"으로 강제해서, 본인 폴더 안에서만
-- 올리고·바꾸고·지울 수 있게 함. 다운로드(select)는 버킷이 public이라
-- 굳이 정책이 없어도 공개 URL로 열리지만, API로도 조회 가능하게 명시적으로 열어둠
drop policy if exists "avatars_public_read" on storage.objects;
drop policy if exists "avatars_upload_own" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;

create policy "avatars_public_read" on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_upload_own" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_update_own" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_delete_own" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
