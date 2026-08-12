import React, { useState, useEffect } from 'react'
import { StatusBar, Style } from '@capacitor/status-bar'
import { Capacitor } from '@capacitor/core'
import { supabase } from '../supabase'
import { redistributeTasks } from '../utils'
import { toast } from '../utils/toast'
import { Icon } from './Icon'

function generateLabCode() {
  const prefix = ['NANO', 'BIO', 'CHEM', 'PHYS', 'MAT'][Math.floor(Math.random() * 5)]
  const num = String(Math.floor(Math.random() * 900) + 100)
  return `${prefix}-${num}`
}

const ROLES = [
  { value: '학부인턴',   desc: '학부 인턴' },
  { value: '학부연구생', desc: '학부 연구생' },
  { value: '대학원생',   desc: '석·박사 과정' },
  { value: '교수',       desc: '지도교수' },
]

export default function AuthScreen({ onLogin }) {
  const [tab, setTab] = useState('login')
  const [mode, setMode] = useState('join')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [labName, setLabName] = useState('')
  const [role, setRole] = useState('학부인턴')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [createdLab, setCreatedLab] = useState(null)

  // 로그인 화면 상단은 진한 초록 히어로라 상태바 아이콘을 밝게, 나가면 원래대로
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    StatusBar.setStyle({ style: Style.Light }).catch(() => {})
    return () => { StatusBar.setStyle({ style: Style.Dark }).catch(() => {}) }
  }, [])

  const handleLogin = async () => {
    setError(''); setLoading(true)
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password: pw })
      if (authErr) {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.')
        setLoading(false)
        return
      }
      const { data: profile, error: profErr } = await supabase.from('profiles').select('*').eq('id', data.user.id).single()
      if (profErr || !profile) { setError('사용자 정보가 없습니다.'); setLoading(false); return }
      onLogin({ id: data.user.id, name: profile.name, email: profile.email, role: profile.role, labId: profile.lab_id, avatar: profile.avatar })
    } catch (e) {
      setError('로그인 오류: ' + e.message)
    }
    setLoading(false)
  }

  const handleSignup = async () => {
    setError(''); setLoading(true)
    if (!name.trim()) { setError('이름을 입력해주세요.'); setLoading(false); return }

    try {
      if (mode === 'join') {
        // 계정을 만들기 전에 초대코드부터 확인 — 잘못된 코드로 인해 빈 계정만 남는 걸 방지
        const { data: labMatches, error: labErr } = await supabase.rpc('lookup_lab_by_code', { p_code: code.toUpperCase() })
        if (labErr || !labMatches || labMatches.length === 0) {
          setError('존재하지 않는 초대코드입니다.'); setLoading(false); return
        }
        const lab = labMatches[0]

        const { data: cred, error: signUpErr } = await supabase.auth.signUp({
          email, password: pw, options: { data: { name } }
        })
        if (signUpErr) throw signUpErr
        if (!cred.session) {
          setError('이메일 인증이 필요한 상태예요. Supabase Auth 설정에서 "Confirm email"을 꺼주세요.')
          setLoading(false); return
        }

        const userData = { name, email, role, labId: lab.id }
        await supabase.from('profiles').insert({ id: cred.user.id, name, email, role, lab_id: lab.id })
        await supabase.from('lab_members').insert({ lab_id: lab.id, user_id: cred.user.id, name, role })

        // 새 멤버가 합류하면 기존 잡무 전체를 전원이 돌아가며 맡도록 재배정
        try {
          const [{ data: taskRows }, { data: memberRows }] = await Promise.all([
            supabase.from('schedules').select('*').eq('lab_id', lab.id).eq('type', 'task'),
            supabase.from('lab_members').select('*').eq('lab_id', lab.id),
          ])
          const tasks = (taskRows || []).map(t => ({ id: t.id, rotation: t.rotation }))
          const allMembers = (memberRows || []).map(m => ({ id: m.user_id, name: m.name }))
          const reassignments = redistributeTasks(tasks, allMembers)
          await Promise.all(reassignments.map(r =>
            supabase.from('schedules').update({ assignee: r.rotation[0], rotation: r.rotation }).eq('id', r.id)
          ))
        } catch (redistErr) {
          console.error('잡무 재배정 실패:', redistErr)
        }

        onLogin({ id: cred.user.id, ...userData })

      } else {
        if (!labName.trim()) { setError('연구실 이름을 입력해주세요.'); setLoading(false); return }
        const newCode = generateLabCode()
        const { data: cred, error: signUpErr } = await supabase.auth.signUp({
          email, password: pw, options: { data: { name } }
        })
        if (signUpErr) throw signUpErr
        if (!cred.session) {
          setError('이메일 인증이 필요한 상태예요. Supabase Auth 설정에서 "Confirm email"을 꺼주세요.')
          setLoading(false); return
        }

        const { data: newLab, error: labInsertErr } = await supabase
          .from('labs').insert({ name: labName, code: newCode, prof_name: name }).select().single()
        if (labInsertErr) throw labInsertErr

        const userData = { name, email, role: '교수', labId: newLab.id }
        await supabase.from('profiles').insert({ id: cred.user.id, name, email, role: '교수', lab_id: newLab.id })
        await supabase.from('lab_members').insert({ lab_id: newLab.id, user_id: cred.user.id, name, role: '교수' })
        // onLogin은 "초대코드 확인했어요" 시트를 닫을 때 호출 — alert()는 코드를 복사할
        // 방법이 없어서 손으로 옮겨 적어야 했는데, 여기서 바로 복사할 수 있게 함
        setCreatedLab({ code: newCode, userData: { id: cred.user.id, ...userData } })
      }
    } catch (e) {
      if (e.message?.includes('already registered') || e.code === 'user_already_exists') setError('이미 사용 중인 이메일입니다.')
      else if (e.message?.includes('Password') || e.code === 'weak_password') setError('비밀번호는 6자 이상이어야 합니다.')
      else setError('오류가 발생했습니다: ' + e.message)
    }
    setLoading(false)
  }

  const copyCreatedCode = async () => {
    if (!createdLab) return
    try {
      await navigator.clipboard.writeText(createdLab.code)
      toast.success('초대코드를 복사했어요')
    } catch (e) {
      toast.error('복사에 실패했어요. 아래 코드를 직접 적어주세요.')
    }
  }

  return (
    <div className="auth-screen">
      {/* 그린 히어로 영역 */}
      <div className="auth-hero">
        <div className="auth-logo">LABO</div>
        <div className="auth-tagline">연구실 올인원 운영 플랫폼</div>
      </div>

      {/* 흰 카드 영역 */}
      <div className="auth-card">
        {/* 탭 세그먼트 */}
        <div className="auth-seg">
          <button className={`auth-seg-btn${tab === 'login' ? ' active' : ''}`} onClick={() => setTab('login')}>
            로그인
          </button>
          <button className={`auth-seg-btn${tab === 'signup' ? ' active' : ''}`} onClick={() => setTab('signup')}>
            회원가입
          </button>
        </div>

        {/* 에러 */}
        {error && (
          <div style={{
            background: 'var(--red-light)', border: '1px solid #f5c0c0',
            borderRadius: 10, padding: '11px 13px',
            fontSize: 13, color: '#c42e2e', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 8
          }}>
            <Icon.AlertTriangle size={16} strokeWidth={1.8} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {tab === 'login' ? (
          <>
            <div className="form-group">
              <label className="form-label">이메일</label>
              <input className="form-input" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="lab@yonsei.ac.kr" type="email" autoComplete="email" />
            </div>
            <div className="form-group">
              <label className="form-label">비밀번호</label>
              <input className="form-input" type="password" value={pw} onChange={e => setPw(e.target.value)}
                placeholder="••••••••" autoComplete="current-password"
                onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            <button className="btn-primary" onClick={handleLogin} disabled={loading} style={{ marginTop: 4 }}>
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </>
        ) : (
          <>
            {/* 참여 / 생성 토글 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {[
                { k: 'join', icon: Icon.Key, label: '코드로 입장' },
                { k: 'create', icon: Icon.Building, label: '연구실 생성' },
              ].map(m => (
                <button key={m.k} onClick={() => setMode(m.k)} style={{
                  flex: 1, padding: '11px 8px',
                  border: `2px solid ${mode === m.k ? 'var(--green)' : 'var(--border)'}`,
                  borderRadius: 12,
                  background: mode === m.k ? 'var(--green-ultra)' : 'var(--card)',
                  color: mode === m.k ? 'var(--green)' : 'var(--text2)',
                  fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  transition: 'all .2s', fontFamily: 'inherit',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4
                }}>
                  <m.icon size={18} strokeWidth={1.7} />
                  {m.label}
                </button>
              ))}
            </div>

            <div className="form-group">
              <label className="form-label">이름</label>
              <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="홍길동" />
            </div>
            <div className="form-group">
              <label className="form-label">이메일</label>
              <input className="form-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="lab@yonsei.ac.kr" type="email" />
            </div>
            <div className="form-group">
              <label className="form-label">비밀번호</label>
              <input className="form-input" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="6자 이상" />
            </div>

            {mode === 'join' ? (
              <>
                <div className="form-group">
                  <label className="form-label">역할</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {ROLES.map(r => (
                      <button key={r.value} onClick={() => setRole(r.value)} style={{
                        padding: '12px 8px',
                        border: `2px solid ${role === r.value ? 'var(--green)' : 'var(--border)'}`,
                        borderRadius: 12,
                        background: role === r.value ? 'var(--green-ultra)' : 'var(--card)',
                        cursor: 'pointer', textAlign: 'center', transition: 'all .15s',
                        fontFamily: 'inherit',
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: role === r.value ? 'var(--green)' : 'var(--text)' }}>{r.value}</div>
                        <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 2 }}>{r.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">연구실 초대코드</label>
                  <input className="form-input" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="예: NANO-042" style={{ letterSpacing: 1, fontWeight: 600 }} />
                </div>
              </>
            ) : (
              <div className="form-group">
                <label className="form-label">연구실 이름</label>
                <input className="form-input" value={labName} onChange={e => setLabName(e.target.value)} placeholder="나노과학 연구실" />
              </div>
            )}

            <button className="btn-primary" onClick={handleSignup} disabled={loading} style={{ marginTop: 4 }}>
              {loading ? '처리 중...' : mode === 'join' ? '입장하기' : '연구실 만들기'}
            </button>
          </>
        )}
      </div>

      {createdLab && (
        <div className="sheet-backdrop">
          <div className="sheet">
            <div className="sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 18, marginBottom: 6 }}>
              <Icon.Building size={20} strokeWidth={1.7} style={{ color: 'var(--green)' }} /> 연구실 생성 완료!
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 18, lineHeight: 1.6 }}>
              아래 초대코드를 구성원들에게 공유하세요. 나중에 사이드바 → 연구실 정보에서도 다시 확인할 수 있어요.
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              padding: '16px 18px', background: 'var(--green-light)', border: '1.5px solid #c8ecd9', borderRadius: 14, marginBottom: 20,
            }}>
              <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2, color: 'var(--green)' }}>{createdLab.code}</span>
              <button onClick={copyCreatedCode} style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px',
                background: '#fff', border: '1px solid #c8ecd9', borderRadius: 20,
                color: 'var(--green)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', flexShrink: 0,
              }}>
                <Icon.Copy size={14} strokeWidth={1.8} /> 복사
              </button>
            </div>
            <button className="btn-primary" onClick={() => onLogin(createdLab.userData)}>시작하기</button>
          </div>
        </div>
      )}
    </div>
  )
}
