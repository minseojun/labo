import React, { useState } from 'react'
import { MOCK_USER } from '../mockData'

export default function AuthScreen({ onLogin }) {
  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')

  // TODO: Replace with real Firebase Auth
  // import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth'
  // import { auth, googleProvider } from '../firebase'
  const handleLogin = () => onLogin(MOCK_USER)
  const handleSignup = () => onLogin({ ...MOCK_USER, name: name || MOCK_USER.name })
  const handleGoogle = () => onLogin(MOCK_USER)

  return (
    <div className="auth-screen">
      <div className="auth-logo">LABO</div>
      <div className="auth-tagline">연구실 올인원 운영 플랫폼</div>
      <div className="auth-card">
        <div className="auth-tabs">
          <div className={`auth-tab${tab === 'login' ? ' active' : ''}`} onClick={() => setTab('login')}>로그인</div>
          <div className={`auth-tab${tab === 'signup' ? ' active' : ''}`} onClick={() => setTab('signup')}>가입</div>
        </div>
        {tab === 'login' ? (
          <>
            <div className="form-group">
              <label className="form-label">이메일</label>
              <input className="form-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="lab@yonsei.ac.kr" />
            </div>
            <div className="form-group">
              <label className="form-label">비밀번호</label>
              <input className="form-input" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" />
            </div>
            <button className="btn-primary" onClick={handleLogin}>로그인</button>
            <div className="or-divider">또는</div>
            <button className="google-btn" onClick={handleGoogle}>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853" />
                <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
              </svg>
              Google로 계속하기
            </button>
          </>
        ) : (
          <>
            <div className="form-group">
              <label className="form-label">이름</label>
              <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="홍길동" />
            </div>
            <div className="form-group">
              <label className="form-label">이메일</label>
              <input className="form-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="lab@yonsei.ac.kr" />
            </div>
            <div className="form-group">
              <label className="form-label">비밀번호</label>
              <input className="form-input" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" />
            </div>
            <div className="form-group">
              <label className="form-label">연구실 초대코드</label>
              <input className="form-input" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="NANO-042" />
            </div>
            <button className="btn-primary" onClick={handleSignup}>가입하기</button>
          </>
        )}
      </div>
    </div>
  )
}
