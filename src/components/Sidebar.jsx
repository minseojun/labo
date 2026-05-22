import React, { useState } from 'react'
import { signOut, updateProfile } from 'firebase/auth'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { memberColor } from '../utils'

const AVATARS = ['🧑‍🔬','👩‍🔬','👨‍🔬','🧑‍💻','👩‍💻','👨‍💻','🧑‍🎓','👩‍🎓','👨‍🎓','🦊','🐧','🐻','🌱','⚗️','🔬','🧪','💡','🚀']
const ROLES = ['학부인턴','학부연구생','대학원생','교수']

export default function Sidebar({ user, labInfo, members, onClose, onUserUpdate }) {
  const [editing, setEditing] = useState(false)
  const [newName, setNewName] = useState(user.name || '')
  const [selAvatar, setSelAvatar] = useState(user.avatar || '🧑‍🔬')
  const [saving, setSaving] = useState(false)
  const [managingMember, setManagingMember] = useState(null)

  const uniqueMembers = members.filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)
  const isAdmin = user.role === '교수'

  const handleLogout = async () => {
    await signOut(auth)
    window.location.reload()
  }

  const handleSave = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'users', user.id), { name: newName.trim(), avatar: selAvatar })
      await updateDoc(doc(db, 'labs', user.labId, 'members', user.id), { name: newName.trim(), avatar: selAvatar })
      if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: newName.trim() })
      onUserUpdate({ ...user, name: newName.trim(), avatar: selAvatar })
      setEditing(false)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const handleRoleChange = async (memberId, newRole) => {
    await updateDoc(doc(db, 'labs', user.labId, 'members', memberId), { role: newRole })
    await updateDoc(doc(db, 'users', memberId), { role: newRole })
    setManagingMember(p => p ? { ...p, role: newRole } : p)
  }

  const handleKick = async (memberId) => {
    if (!window.confirm('이 구성원을 연구실에서 내보내시겠습니까?')) return
    await deleteDoc(doc(db, 'labs', user.labId, 'members', memberId))
    setManagingMember(null)
  }

  const avatar = user.avatar || '🧑‍🔬'

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '82%', maxWidth: 320, background: 'var(--card)', zIndex: 301, display: 'flex', flexDirection: 'column', animation: 'slideInRight .25s ease', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>

        {/* 헤더 */}
        <div style={{ padding: '48px 20px 20px', background: 'var(--green)', color: '#fff', position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, marginBottom: 12 }}>{avatar}</div>
          {editing ? (
            <input value={newName} onChange={e => setNewName(e.target.value)} style={{ fontSize: 18, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: 8, padding: '4px 10px', width: '100%', outline: 'none', fontFamily: 'inherit', marginBottom: 4 }} onKeyDown={e => e.key === 'Enter' && handleSave()} autoFocus />
          ) : (
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 2 }}>{user.name}</div>
          )}
          <div style={{ fontSize: 12, opacity: .8 }}>{user.email}</div>
          <div style={{ display: 'inline-flex', marginTop: 8, padding: '3px 10px', background: 'rgba(255,255,255,0.2)', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{user.role}</div>
          {!editing && (
            <button onClick={() => { setEditing(true); setNewName(user.name); setSelAvatar(user.avatar || '🧑‍🔬') }} style={{ position: 'absolute', bottom: 20, right: 20, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', color: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>✏️ 편집</button>
          )}
        </div>

        {/* 프로필 편집 */}
        {editing && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: .6 }}>아바타 선택</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {AVATARS.map(av => (
                <button key={av} onClick={() => setSelAvatar(av)} style={{ width: 40, height: 40, borderRadius: '50%', fontSize: 20, border: `2px solid ${selAvatar === av ? 'var(--green)' : 'var(--border)'}`, background: selAvatar === av ? 'var(--green-light)' : 'var(--card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{av}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditing(false)} style={{ flex: 1, padding: '10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>취소</button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '10px', border: 'none', borderRadius: 8, background: 'var(--green)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{saving ? '저장 중...' : '저장하기'}</button>
            </div>
          </div>
        )}

        {/* 본문 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
          {/* 연구실 정보 */}
          <div style={{ padding: '0 20px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>연구실</div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{labInfo?.name || '연구실'}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <div style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '4px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>{labInfo?.code}</div>
              <span style={{ fontSize: 11, color: 'var(--text2)' }}>초대코드</span>
            </div>
          </div>

          {/* 구성원 목록 */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>구성원 {uniqueMembers.length}명</div>
            {uniqueMembers.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', cursor: isAdmin && m.id !== user.id ? 'pointer' : 'default' }}
                onClick={() => isAdmin && m.id !== user.id && setManagingMember(m)}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${memberColor(m.name)}20`, color: memberColor(m.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: m.avatar ? 20 : 13, fontWeight: 700, flexShrink: 0 }}>
                  {m.avatar || m.name?.slice(-1)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    {m.name}
                    {m.id === user.id && <span style={{ fontSize: 10, color: 'var(--text2)', marginLeft: 4 }}>(나)</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>{m.role}</div>
                </div>
                {isAdmin && m.id !== user.id && <span style={{ fontSize: 12, color: 'var(--text2)' }}>›</span>}
              </div>
            ))}
          </div>

          {/* 설정 */}
          <div style={{ padding: '16px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .6, marginBottom: 10 }}>설정</div>
            {[{ icon: '🔔', label: '알림 설정' }, { icon: '❓', label: '도움말' }, { icon: '📋', label: '서비스 정보' }].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                <span style={{ fontSize: 14 }}>{item.label}</span>
                <span style={{ marginLeft: 'auto', color: 'var(--text2)' }}>›</span>
              </div>
            ))}
          </div>
        </div>

        {/* 로그아웃 */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
          <button onClick={handleLogout} style={{ width: '100%', padding: '12px', background: 'var(--red-light)', color: 'var(--red)', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>로그아웃</button>
        </div>
      </div>

      {/* 구성원 관리 시트 (교수 전용) */}
      {managingMember && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={() => setManagingMember(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
          <div style={{ background: 'var(--card)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 320, padding: 20, position: 'relative', zIndex: 1, animation: 'slideUp .25s ease' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: `${memberColor(managingMember.name)}20`, color: memberColor(managingMember.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: managingMember.avatar ? 26 : 16, fontWeight: 700 }}>
                {managingMember.avatar || managingMember.name?.slice(-1)}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{managingMember.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{managingMember.role}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: .6 }}>역할 변경</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {ROLES.map(r => (
                <button key={r} onClick={() => handleRoleChange(managingMember.id, r)} style={{ padding: '10px', border: `2px solid ${managingMember.role === r ? 'var(--green)' : 'var(--border)'}`, borderRadius: 10, background: managingMember.role === r ? 'var(--green-light)' : 'var(--card)', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: managingMember.role === r ? 'var(--green)' : 'var(--text2)' }}>{r}</button>
              ))}
            </div>
            <button onClick={() => handleKick(managingMember.id)} style={{ width: '100%', padding: '12px', background: 'var(--red-light)', color: 'var(--red)', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              연구실에서 내보내기
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideInRight { from { transform: translateX(100%) } to { transform: translateX(0) } }
        @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>
    </>
  )
}
