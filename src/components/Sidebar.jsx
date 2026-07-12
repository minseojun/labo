import React, { useState } from 'react'
import { signOut, updateProfile } from 'firebase/auth'
import { doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { memberColor, assignMemberColors } from '../utils'
import { toast } from '../utils/toast'

const AVATARS = ['🧑‍🔬','👩‍🔬','👨‍🔬','🧑‍💻','👩‍💻','👨‍💻','🧑‍🎓','👩‍🎓','👨‍🎓','🦊','🐧','🐻','🌱','⚗️','🔬','🧪','💡','🚀']
const ROLES = ['학부인턴','학부연구생','대학원생','교수']

export default function Sidebar({ user, labInfo, members, onClose, onUserUpdate }) {
  const [editing, setEditing] = useState(false)
  const [newName, setNewName] = useState(user.name || '')
  const [selAvatar, setSelAvatar] = useState(user.avatar || '🧑‍🔬')
  const [saving, setSaving] = useState(false)
  const [managingMember, setManagingMember] = useState(null)
  const [showInfo, setShowInfo] = useState(null)
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )

  const requestNotify = async () => {
    if (typeof Notification === 'undefined') return
    const result = await Notification.requestPermission()
    setNotifPermission(result)
  }

  const uniqueMembers = members.filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)
  const colorMap = assignMemberColors(uniqueMembers)
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
    try {
      // users/{memberId} 문서는 본인만 쓸 수 있어서(보안 규칙) 여기서 직접 못 고침 —
      // members 문서만 바꾸면 해당 유저 세션이 실시간 감시로 스스로 동기화함
      await updateDoc(doc(db, 'labs', user.labId, 'members', memberId), { role: newRole })
      setManagingMember(p => p ? { ...p, role: newRole } : p)
      toast.success('역할을 변경했어요')
    } catch (e) {
      console.error(e)
      toast.error('역할 변경에 실패했어요.')
    }
  }

  const handleKick = async (memberId) => {
    if (!window.confirm('이 구성원을 연구실에서 내보내시겠습니까?')) return
    try {
      await deleteDoc(doc(db, 'labs', user.labId, 'members', memberId))
      setManagingMember(null)
    } catch (e) {
      console.error(e)
      toast.error('내보내기에 실패했어요.')
    }
  }

  const avatar = user.avatar || '🧑‍🔬'

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300 }} />
      <div style={{ position: 'fixed', top: 0, right: 'max(0px, calc((100vw - 480px) / 2))', bottom: 0, width: 'min(82%, 320px)', background: 'var(--card)', zIndex: 301, display: 'flex', flexDirection: 'column', animation: 'slideInRight .25s ease', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>

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
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: `${colorMap[m.name] || memberColor(m.name)}20`, color: colorMap[m.name] || memberColor(m.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: m.avatar ? 20 : 13, fontWeight: 700, flexShrink: 0 }}>
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
            {[{ key: 'notify', icon: '🔔', label: '알림 설정' }, { key: 'help', icon: '❓', label: '도움말' }, { key: 'about', icon: '📋', label: '서비스 정보' }].map(item => (
              <div key={item.key} onClick={() => setShowInfo(item.key)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
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
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: `${colorMap[managingMember.name] || memberColor(managingMember.name)}20`, color: colorMap[managingMember.name] || memberColor(managingMember.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: managingMember.avatar ? 26 : 16, fontWeight: 700 }}>
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

      {/* 설정 상세 시트 (알림 설정 / 도움말 / 서비스 정보) */}
      {showInfo && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={() => setShowInfo(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
          <div style={{ background: 'var(--card)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 320, padding: 20, position: 'relative', zIndex: 1, animation: 'slideUp .25s ease', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 16px' }} />

            {showInfo === 'notify' && (
              <>
                <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 12 }}>🔔 알림 설정</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 16 }}>
                  타이머가 끝나면 브라우저 알림으로 알려드려요.
                </div>
                <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 10, fontSize: 13, marginBottom: 16 }}>
                  현재 상태: <b>{
                    notifPermission === 'granted' ? '허용됨' :
                    notifPermission === 'denied' ? '차단됨' :
                    notifPermission === 'unsupported' ? '이 브라우저는 지원하지 않음' : '아직 허용 안 함'
                  }</b>
                </div>
                {notifPermission === 'default' && (
                  <button className="btn-primary" onClick={requestNotify}>알림 켜기</button>
                )}
                {notifPermission === 'denied' && (
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>브라우저 주소창 옆 사이트 설정에서 알림 차단을 해제한 뒤 새로고침해주세요.</div>
                )}
              </>
            )}

            {showInfo === 'help' && (
              <>
                <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 14 }}>❓ 도움말</div>
                {[
                  ['🏠 홈', '오늘 일정과 잡무, 할 일, 공지를 한눈에 모아 보여줘요.'],
                  ['📅 일정', '연구실 공용/개인 일정과 공지사항을 관리해요.'],
                  ['🧹 잡무', '청소, 장비 점검 같은 반복 잡무를 구성원끼리 나눠서 관리해요. 잡무 카드를 탭하면 담당자를 바꿀 수 있어요.'],
                  ['🔬 장비', '장비 사용 현황과 사용 이력을 기록해요.'],
                  ['⏱ 타이머', '실험 타이머를 설정하고, 완료되면 알림을 받아요.'],
                  ['📦 소모품', '시약·소모품 재고 상태를 신호등 색으로 관리해요.'],
                ].map(([t, d]) => (
                  <div key={t} style={{ marginBottom: 13 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{t}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{d}</div>
                  </div>
                ))}
              </>
            )}

            {showInfo === 'about' && (
              <>
                <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>📋 서비스 정보</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 16 }}>LABO · 연구실 올인원 운영 플랫폼</div>
                <div style={{ fontSize: 13, lineHeight: 2, color: 'var(--text2)' }}>
                  <div>소속 연구실: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{labInfo?.name || '연구실'}</span></div>
                  <div>초대코드: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{labInfo?.code}</span></div>
                  <div>구성원: <span style={{ color: 'var(--text)', fontWeight: 600 }}>{uniqueMembers.length}명</span></div>
                </div>
              </>
            )}
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
