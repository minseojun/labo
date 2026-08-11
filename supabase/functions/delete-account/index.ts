// 계정 탈퇴 Edge Function
// 앱스토어/플레이스토어 심사 정책상 "계정을 만들 수 있으면 앱 안에서 계정을 지울 수도 있어야
// 함"(Apple Guideline 5.1.1(v), Google Play User Data policy)이 필수라서 만든 엔드포인트.
// service_role 키가 있어야만 auth.users를 지울 수 있고, 그 키는 클라이언트에 절대 노출하면
// 안 되기 때문에 Edge Function(서버 환경)에서만 처리함.
// profiles/lab_members/todos는 전부 auth.users(id) on delete cascade라서
// auth.users 행 하나만 지우면 나머지는 DB가 알아서 다 정리해줌.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: '인증이 필요해요.' }), { status: 401 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  // 요청자 본인 확인 — anon 클라이언트로 토큰 검증
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: userErr } = await userClient.auth.getUser()
  if (userErr || !user) {
    return new Response(JSON.stringify({ error: '유효하지 않은 세션이에요.' }), { status: 401 })
  }

  // service_role로 본인 계정 삭제 (cascade로 profiles/lab_members/todos 자동 정리됨)
  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { error: deleteErr } = await adminClient.auth.admin.deleteUser(user.id)
  if (deleteErr) {
    return new Response(JSON.stringify({ error: deleteErr.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
