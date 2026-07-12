import React, { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile
} from 'firebase/auth'
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore'
import { auth, db, googleProvider } from '../firebase'
import { redistributeTasks } from '../utils'

function generateLabCode() {
  const prefix = ['NANO', 'BIO', 'CHEM', 'PHYS', 'MAT'][Math.floor(Math.random() * 5)]
  const num = String(Math.floor(Math.random() * 900) + 100)
  return `${prefix}-${num}`
}

const ROLES = [
  { value: '학부인턴',   emoji: '🎓', desc: '학부 인턴' },
  { value: '학부연구생', emoji: '🔬', desc: '학부 연구생' },
  { value: '대학원생',   emoji: '📚', desc: '석·박사 과정' },
  { value: '교수',       emoji: '👨‍🏫', desc: '지도교수' },
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

  const handleLogin = async () => {
    setError(''); setLoading(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pw)
      const userDoc = await getDoc(doc(db, 'users', cred.user.uid))
      if (!userDoc.exists()) { setError('사용자 정보가 없습니다.'); setLoading(false); return }
      onLogin({ id: cred.user.uid, ...userDoc.data() })
    } catch (e) {
      if (e.code === 'auth/wrong-password' || e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
        setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      } else {
        setError('로그인 오류: ' + e.message)
      }
    }
    setLoading(false)
  }

  const handleSignup = async () => {
    setError(''); setLoading(true)
    if (!name.trim()) { setError('이름을 입력해주세요.'); setLoading(false); return }

    try {
      if (mode === 'join') {
        const cred = await createUserWithEmailAndPassword(auth, email, pw)
        await updateProfile(cred.user, { displayName: name })

        const labsQ = query(collection(db, 'labs'), where('code', '==', code.toUpperCase()))
        const labsSnap = await getDocs(labsQ)
        if (labsSnap.empty) {
          await cred.user.delete()
          setError('존재하지 않는 초대코드입니다.'); setLoading(false); return
        }
        const labDoc = labsSnap.docs[0]

        const userData = { name, email, role, labId: labDoc.id, createdAt: serverTimestamp() }
        await setDoc(doc(db, 'users', cred.user.uid), userData)
        await setDoc(doc(db, 'labs', labDoc.id, 'members', cred.user.uid), {
          name, role, joinedAt: serverTimestamp()
        })

        // 새 멤버가 합류하면 기존 잡무 전체를 구성원 수 기준으로 다시 고르게 재배정
        try {
          const [tasksSnap, membersSnap] = await Promise.all([
            getDocs(query(collection(db, 'labs', labDoc.id, 'schedules'), where('type', '==', 'task'))),
            getDocs(collection(db, 'labs', labDoc.id, 'members')),
          ])
          const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          const allMembers = membersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          const reassignments = redistributeTasks(tasks, allMembers)
          await Promise.all(reassignments.map(r =>
            updateDoc(doc(db, 'labs', labDoc.id, 'schedules', r.id), { assignee: r.assignee })
          ))
        } catch (redistErr) {
          console.error('잡무 재배정 실패:', redistErr)
        }

        onLogin({ id: cred.user.uid, ...userData, labId: labDoc.id })

      } else {
        if (!labName.trim()) { setError('연구실 이름을 입력해주세요.'); setLoading(false); return }
        const newCode = generateLabCode()
        const cred = await createUserWithEmailAndPassword(auth, email, pw)
        await updateProfile(cred.user, { displayName: name })

        const labRef = doc(collection(db, 'labs'))
        await setDoc(labRef, { name: labName, code: newCode, profName: name, createdAt: serverTimestamp() })
        const userData = { name, email, role: '교수', labId: labRef.id, createdAt: serverTimestamp() }
        await setDoc(doc(db, 'users', cred.user.uid), userData)
        await setDoc(doc(db, 'labs', labRef.id, 'members', cred.user.uid), { name, role: '교수', joinedAt: serverTimestamp() })
        alert(`연구실 생성 완료!\n초대코드: ${newCode}\n구성원들에게 공유하세요.`)
        onLogin({ id: cred.user.uid, ...userData })
      }
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') setError('이미 사용 중인 이메일입니다.')
      else if (e.code === 'auth/weak-password') setError('비밀번호는 6자 이상이어야 합니다.')
      else setError('오류가 발생했습니다: ' + e.message)
    }
    setLoading(false)
  }

  const handleGoogle = async () => {
    setError(''); setLoading(true)
    try {
      const cred = await signInWithPopup(auth, googleProvider)
      const userDoc = await getDoc(doc(db, 'users', cred.user.uid))
      if (userDoc.exists()) {
        onLogin({ id: cred.user.uid, ...userDoc.data() })
      } else {
        setError('가입된 계정이 없습니다. 이메일로 먼저 가입해주세요.')
      }
    } catch (e) {
      setError('Google 로그인 실패')
    }
    setLoading(false)
  }

  return (
    <div className="auth-screen">
      {/* 그린 히어로 영역 */}
      <div className="auth-hero">
        <div className="auth-hero-deco" style={{ width: 220, height: 220, top: -80, right: -60 }} />
        <div className="auth-hero-deco" style={{ width: 100, height: 100, top: 30, right: 60, opacity: .5 }} />
        <div className="auth-hero-deco" style={{ width: 60, height: 60, bottom: -10, left: 40, opacity: .4 }} />
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
            <span style={{ flexShrink: 0 }}>⚠️</span>
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
            <div className="or-divider" style={{ marginTop: 20 }}>또는</div>
            <button className="google-btn" onClick={handleGoogle} disabled={loading}>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Google로 계속하기
            </button>
          </>
        ) : (
          <>
            {/* 참여 / 생성 토글 */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {[
                { k: 'join', icon: '🔑', label: '코드로 입장' },
                { k: 'create', icon: '🏗️', label: '연구실 생성' },
              ].map(m => (
                <button key={m.k} onClick={() => setMode(m.k)} style={{
                  flex: 1, padding: '11px 8px',
                  border: `2px solid ${mode === m.k ? 'var(--green)' : 'var(--border)'}`,
                  borderRadius: 12,
                  background: mode === m.k ? 'var(--green-ultra)' : 'var(--card)',
                  color: mode === m.k ? 'var(--green)' : 'var(--text2)',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  transition: 'all .2s', fontFamily: 'inherit',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4
                }}>
                  <span style={{ fontSize: 18 }}>{m.icon}</span>
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
                        padding: '10px 8px',
                        border: `2px solid ${role === r.value ? 'var(--green)' : 'var(--border)'}`,
                        borderRadius: 12,
                        background: role === r.value ? 'var(--green-ultra)' : 'var(--card)',
                        cursor: 'pointer', textAlign: 'center', transition: 'all .15s',
                        fontFamily: 'inherit',
                      }}>
                        <div style={{ fontSize: 20, marginBottom: 3 }}>{r.emoji}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: role === r.value ? 'var(--green)' : 'var(--text)' }}>{r.value}</div>
                        <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 1 }}>{r.desc}</div>
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
    </div>
  )
}
