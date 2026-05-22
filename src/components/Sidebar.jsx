import React from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'

export default function Sidebar({ user, labInfo, members, onClose }) {
  const handleLogout = async () => {
    await signOut(auth)
    window.location.reload()
  }

  const roleColor = r => r === '교수' ? 'var(--purple)' : r === '대학원생' ? 'var(--green)' : 'var(--yellow)'
  const roleBg = r => r === '교수' ? 'var(--purple-light)' : r === '대학원생' ? 'var(--green-light)' : 'var(--yellow-light)'

  return (
    <>
      {/* 배경 딤 */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        zIndex: 300, animation: 'fadeIn .2s ease'
      }} />

      {/* 사이드바 패널 */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '80%', maxWidth: 320,
        background: 'var(--card)', zIndex: 301,
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight .25s ease',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.12)'
      }}>
        {/* 헤더 */}
        <div style={{ padding: '48px 20px 20px', background: 'var(--green)', color: '#fff' }}>
          <button onClick={onClose} style={{
            position: 'absolute', top: 16, right: 16,
            background: 'rgba(255,255,255,0.2)', border: 'none',
            color: '#fff', width: 32, height: 32, borderRadius: '50%',
            cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>×</button>

          {/* 아바타 */}
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(255,255,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 700, marginBottom: 12, border: '2px solid rgba(255,255,255,0.4)'
          }}>
            {user.name?.slice(-1)}
          </div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>{user.name}</div>
          <div style={{ fontSize: 13, opacity: .85, marginTop: 2 }}>{user.email}</div>
          <div style={{
            display: 'inline-flex', marginTop: 8, padding: '3px 10px',
            background: 'rgba(255,255,255,0.2)', borderRadius: 20,
            fontSize: 12, fontWeight: 600
          }}>{user.role}</div>
        </div>

        {/* 본문 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>

          {/* 연구실 정보 */}
          <div style={{ padding: '0 20px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>연구실</div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{labInfo?.name || '연구실'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <div style={{
                background: 'var(--green-light)', color: 'var(--green)',
                padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                letterSpacing: 1
              }}>{labInfo?.code}</div>
              <span style={{ fontSize: 11, color: 'var(--text2)' }}>초대코드</span>
            </div>
          </div>

          {/* 구성원 목록 */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>
              구성원 {members.length}명
            </div>
            {members.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' }}>
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: roleBg(m.role),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: roleColor(m.role), flexShrink: 0
                }}>{m.name?.slice(-1)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    {m.name}
                    {m.id === user.id && <span style={{ fontSize: 10, color: 'var(--text2)', marginLeft: 4 }}>(나)</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>{m.role}</div>
                </div>
              </div>
            ))}
          </div>

          {/* 메뉴 */}
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>설정</div>
            {[
              { icon: '🔔', label: '알림 설정' },
              { icon: '❓', label: '도움말' },
              { icon: '📋', label: '서비스 정보' },
            ].map(item => (
              <div key={item.label} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 0', borderBottom: '1px solid var(--border)',
                cursor: 'pointer', color: 'var(--text)'
              }}>
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                <span style={{ fontSize: 14 }}>{item.label}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--text2)' }}>›</span>
              </div>
            ))}
          </div>
        </div>

        {/* 로그아웃 */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
          <button onClick={handleLogout} style={{
            width: '100%', padding: '12px',
            background: 'var(--red-light)', color: 'var(--red)',
            border: 'none', borderRadius: 10,
            fontWeight: 600, fontSize: 14, cursor: 'pointer',
            fontFamily: 'inherit'
          }}>로그아웃</button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideInRight { from { transform: translateX(100%) } to { transform: translateX(0) } }
      `}</style>
    </>
  )
}
