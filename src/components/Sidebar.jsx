import React, { useState } from 'react'
import { supabase } from '../supabase'
import { memberColor, assignMemberColors } from '../utils'
import { toast } from '../utils/toast'
import { haptic } from '../utils/haptics'
import { Icon } from './Icon'
import { MODULES, CORE_TABS, isModuleEnabled } from '../modules'

const AVATARS = ['🧑‍🔬','👩‍🔬','👨‍🔬','🧑‍💻','👩‍💻','👨‍💻','🧑‍🎓','👩‍🎓','👨‍🎓','🦊','🐧','🐻','🌱','⚗️','🔬','🧪','💡','🚀']
const ROLES = ['학부인턴','학부연구생','대학원생','교수']

// iOS 설정 앱처럼 각 섹션을 독립된 둥근 카드로 띄우는 그룹 래퍼
function SidebarGroup({ title, subtitle, right, onHeaderClick, children }) {
  return (
    <div style={{ margin: '0 16px 16px' }}>
      <div onClick={onHeaderClick} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 8px', cursor: onHeaderClick ? 'pointer' : 'default' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .6 }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{subtitle}</div>}
        </div>
        {right}
      </div>
      <div style={{ background: 'var(--card)', borderRadius: 16, boxShadow: 'var(--shadow-xs)', padding: '4px 16px', border: '1px solid rgba(14,17,23,0.04)' }}>
        {children}
      </div>
    </div>
  )
}

function GroupRow({ children, onClick, last }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0',
      borderBottom: last ? 'none' : '1px solid var(--border)', cursor: onClick ? 'pointer' : 'default',
    }}>
      {children}
    </div>
  )
}

function ToggleSwitch({ on, onClick }) {
  return (
    <div onClick={() => { haptic.light(); onClick() }} style={{
      width: 44, height: 26, borderRadius: 13, cursor: 'pointer', flexShrink: 0,
      background: on ? 'var(--green)' : 'var(--border)', position: 'relative', transition: 'background .2s',
    }}>
      <div style={{
        position: 'absolute', top: 2, left: on ? 20 : 2, width: 22, height: 22, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left .2s',
      }} />
    </div>
  )
}

export default function Sidebar({ user, labInfo, members, onClose, onUserUpdate, onLabUpdate }) {
  const [editing, setEditing] = useState(false)
  const [newName, setNewName] = useState(user.name || '')
  const [selAvatar, setSelAvatar] = useState(user.avatar || '🧑‍🔬')
  const [saving, setSaving] = useState(false)
  const [managingMember, setManagingMember] = useState(null)
  const [showInfo, setShowInfo] = useState(null)
  const [modulesOpen, setModulesOpen] = useState(false)
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

  const [deleting, setDeleting] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.reload()
  }

  const handleDeleteAccount = async () => {
    if (!window.confirm('정말 탈퇴하시겠어요?\n계정과 작성한 데이터(프로필, 할 일 등)가 영구적으로 삭제되고 되돌릴 수 없어요.')) return
    if (!window.confirm('마지막 확인이에요. 계정을 삭제할까요?')) return
    setDeleting(true)
    try {
      const { error } = await supabase.functions.invoke('delete-account')
      if (error) throw error
      await supabase.auth.signOut()
      window.location.reload()
    } catch (e) {
      console.error(e)
      toast.error('탈퇴 처리에 실패했어요. 잠시 후 다시 시도해주세요.')
      setDeleting(false)
    }
  }

  const handleSave = async () => {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await supabase.from('profiles').update({ name: newName.trim(), avatar: selAvatar }).eq('id', user.id)
      await supabase.from('lab_members').update({ name: newName.trim(), avatar: selAvatar }).eq('lab_id', user.labId).eq('user_id', user.id)
      onUserUpdate({ ...user, name: newName.trim(), avatar: selAvatar })
      setEditing(false)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  const handleRoleChange = async (memberId, newRole) => {
    try {
      // profiles 행은 본인만 쓸 수 있어서(RLS) 여기서 직접 못 고침 —
      // lab_members 행만 바꾸면 해당 유저 세션이 실시간 감시로 스스로 동기화함
      await supabase.from('lab_members').update({ role: newRole }).eq('lab_id', user.labId).eq('user_id', memberId)
      setManagingMember(p => p ? { ...p, role: newRole } : p)
      toast.success('역할을 변경했어요')
    } catch (e) {
      console.error(e)
      toast.error('역할 변경에 실패했어요.')
    }
  }

  const handleToggleModule = async (key, enabled) => {
    const current = labInfo?.enabledModules || []
    const next = enabled ? [...new Set([...current, key])] : current.filter(k => k !== key)
    try {
      await supabase.from('labs').update({ enabled_modules: next }).eq('id', user.labId)
      onLabUpdate({ ...labInfo, enabledModules: next })
      toast.success(enabled ? '모듈을 켰어요' : '모듈을 껐어요')
    } catch (e) {
      console.error(e)
      toast.error('모듈 설정 변경에 실패했어요.')
    }
  }

  // disabledTabs는 블랙리스트(기본 전부 켜짐) — 탭 켜기=배열에서 빼기, 끄기=배열에 넣기
  const handleToggleTab = async (id, enabled) => {
    const current = labInfo?.disabledTabs || []
    const next = enabled ? current.filter(k => k !== id) : [...new Set([...current, id])]
    try {
      await supabase.from('labs').update({ disabled_tabs: next }).eq('id', user.labId)
      onLabUpdate({ ...labInfo, disabledTabs: next })
      toast.success(enabled ? '탭을 켰어요' : '탭을 껐어요')
    } catch (e) {
      console.error(e)
      toast.error('탭 설정 변경에 실패했어요.')
    }
  }

  const handleKick = async (memberId) => {
    if (!window.confirm('이 구성원을 연구실에서 내보내시겠습니까?')) return
    try {
      await supabase.from('lab_members').delete().eq('lab_id', user.labId).eq('user_id', memberId)
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
      <div style={{ position: 'fixed', top: 0, right: 'max(0px, calc((100vw - 480px) / 2))', bottom: 0, width: 'min(86%, 340px)', background: 'var(--bg)', zIndex: 301, display: 'flex', flexDirection: 'column', animation: 'slideInRight .25s ease', boxShadow: '-4px 0 24px rgba(0,0,0,0.12)' }}>

        {/* 헤더 */}
        <div style={{ padding: 'calc(48px + env(safe-area-inset-top, 0px)) 20px 20px', background: 'var(--green)', color: '#fff', position: 'relative' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: 'calc(16px + env(safe-area-inset-top, 0px))', right: 16, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon.X size={16} strokeWidth={2} /></button>
          <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, marginBottom: 12 }}>{avatar}</div>
          {editing ? (
            <input value={newName} onChange={e => setNewName(e.target.value)} style={{ fontSize: 18, fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.5)', borderRadius: 8, padding: '4px 10px', width: '100%', outline: 'none', fontFamily: 'inherit', marginBottom: 4 }} onKeyDown={e => e.key === 'Enter' && handleSave()} autoFocus />
          ) : (
            <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 2 }}>{user.name}</div>
          )}
          <div style={{ fontSize: 12, opacity: .8 }}>{user.email}</div>
          <div style={{ display: 'inline-flex', marginTop: 8, padding: '3px 10px', background: 'rgba(255,255,255,0.2)', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{user.role}</div>
          {!editing && (
            <button onClick={() => { setEditing(true); setNewName(user.name); setSelAvatar(user.avatar || '🧑‍🔬') }} style={{ position: 'absolute', bottom: 20, right: 20, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', color: '#fff', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}><Icon.Pencil size={12} strokeWidth={2} /> 편집</button>
          )}
        </div>

        {/* 프로필 편집 */}
        {editing && (
          <div style={{ padding: '16px 20px', background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: .6 }}>아바타 선택</div>
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
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0 4px' }}>
          {/* 연구실 정보 */}
          <SidebarGroup title="연구실">
            <GroupRow last>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{labInfo?.name || '연구실'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <div style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '3px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600, letterSpacing: 1 }}>{labInfo?.code}</div>
                  <span style={{ fontSize: 11, color: 'var(--text2)' }}>초대코드</span>
                </div>
              </div>
            </GroupRow>
          </SidebarGroup>

          {/* 구성원 목록 */}
          <SidebarGroup title={`구성원 ${uniqueMembers.length}명`}>
            {uniqueMembers.map((m, i) => (
              <GroupRow key={m.id} last={i === uniqueMembers.length - 1}
                onClick={isAdmin && m.id !== user.id ? () => setManagingMember(m) : undefined}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: `${colorMap[m.name] || memberColor(m.name)}20`, color: colorMap[m.name] || memberColor(m.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: m.avatar ? 18 : 12, fontWeight: 600, flexShrink: 0 }}>
                  {m.avatar || m.name?.slice(-1)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    {m.name}
                    {m.id === user.id && <span style={{ fontSize: 10, color: 'var(--text2)', marginLeft: 4 }}>(나)</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text2)' }}>{m.role}</div>
                </div>
                {isAdmin && m.id !== user.id && <Icon.ChevronRight size={15} strokeWidth={1.8} style={{ color: 'var(--text3)' }} />}
              </GroupRow>
            ))}
          </SidebarGroup>

          {/* 모듈 관리 (교수 전용) — 기본 탭 + 추가 모듈을 한 목록에서 켜고 끔, 접이식 */}
          {isAdmin && (() => {
            const toggleItems = [
              ...CORE_TABS.map(t => ({
                key: t.id, icon: t.icon, label: t.label, description: t.description,
                on: !labInfo?.disabledTabs?.includes(t.id),
                toggle: () => handleToggleTab(t.id, !!labInfo?.disabledTabs?.includes(t.id)),
              })),
              ...MODULES.map(m => ({
                key: m.key, icon: m.icon, label: m.label, description: m.description,
                on: isModuleEnabled(labInfo, m.key),
                toggle: () => handleToggleModule(m.key, !isModuleEnabled(labInfo, m.key)),
              })),
            ]
            return (
              <SidebarGroup title="모듈 관리" subtitle="필요한 기능만 켜서 화면을 단순하게 만드세요"
                onHeaderClick={() => setModulesOpen(p => !p)}
                right={<Icon.ChevronDown size={14} strokeWidth={2} style={{ color: 'var(--text2)', transform: modulesOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />}>
                {modulesOpen ? toggleItems.map((item, i) => (
                  <GroupRow key={item.key} last={i === toggleItems.length - 1}>
                    <item.icon size={17} strokeWidth={1.7} style={{ color: item.on ? 'var(--green)' : 'var(--text3)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{item.label}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text2)', marginTop: 1 }}>{item.description}</div>
                    </div>
                    <ToggleSwitch on={item.on} onClick={item.toggle} />
                  </GroupRow>
                )) : (
                  <GroupRow last onClick={() => setModulesOpen(true)}>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>{toggleItems.filter(m => m.on).length}/{toggleItems.length}개 켜짐 — 눌러서 펼치기</span>
                  </GroupRow>
                )}
              </SidebarGroup>
            )
          })()}

          {/* 설정 */}
          <SidebarGroup title="설정">
            {[
              { key: 'notify', icon: Icon.Bell, label: '알림 설정', onClick: () => setShowInfo('notify') },
              { key: 'help', icon: Icon.HelpCircle, label: '도움말', onClick: () => setShowInfo('help') },
              { key: 'about', icon: Icon.Info, label: '서비스 정보', onClick: () => setShowInfo('about') },
            ].map((item, i, arr) => (
              <GroupRow key={item.key} last={i === arr.length - 1} onClick={item.onClick}>
                <item.icon size={18} strokeWidth={1.7} style={{ color: 'var(--text2)' }} />
                <span style={{ fontSize: 14, flex: 1 }}>{item.label}</span>
                <Icon.ChevronRight size={15} strokeWidth={1.8} style={{ color: 'var(--text3)' }} />
              </GroupRow>
            ))}
          </SidebarGroup>

          {/* 로그아웃 / 탈퇴 */}
          <div style={{ margin: '0 16px 16px' }}>
            <div style={{ background: 'var(--card)', borderRadius: 16, boxShadow: 'var(--shadow-xs)', border: '1px solid rgba(14,17,23,0.04)', overflow: 'hidden' }}>
              <button onClick={handleLogout} style={{ width: '100%', padding: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'none', color: 'var(--red)', border: 'none', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}><Icon.LogOut size={16} strokeWidth={1.8} /> 로그아웃</button>
              <button onClick={handleDeleteAccount} disabled={deleting} style={{ width: '100%', padding: '11px', background: 'none', color: 'var(--text3)', border: 'none', fontWeight: 500, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                {deleting ? '탈퇴 처리 중...' : '계정 탈퇴'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 구성원 관리 시트 (교수 전용) */}
      {managingMember && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div onClick={() => setManagingMember(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
          <div style={{ background: 'var(--card)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 320, padding: 20, position: 'relative', zIndex: 1, animation: 'slideUp .25s ease' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 16px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: `${colorMap[managingMember.name] || memberColor(managingMember.name)}20`, color: colorMap[managingMember.name] || memberColor(managingMember.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: managingMember.avatar ? 26 : 16, fontWeight: 600 }}>
                {managingMember.avatar || managingMember.name?.slice(-1)}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 17 }}>{managingMember.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{managingMember.role}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: .6 }}>역할 변경</div>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 17, marginBottom: 12 }}><Icon.Bell size={19} strokeWidth={1.7} /> 알림 설정</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 16 }}>
                  타이머가 끝나거나, 오늘·내일 내 잡무 당번이 있으면 브라우저 알림으로 알려드려요.
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 17, marginBottom: 14 }}><Icon.HelpCircle size={19} strokeWidth={1.7} /> 도움말</div>
                {[
                  [Icon.Home, '홈', '오늘 일정과 잡무, 할 일, 공지를 한눈에 모아 보여줘요.'],
                  [Icon.Calendar, '일정', '연구실 공용/개인 일정과 공지사항을 관리해요.'],
                  [Icon.Calendar, '잡무', '청소, 장비 점검 같은 반복 잡무를 구성원끼리 나눠서 관리해요. 잡무 카드를 탭하면 담당자를 바꿀 수 있어요.'],
                  [Icon.Flask, '장비', '장비 사용 현황과 사용 이력을 기록해요.'],
                  [Icon.Timer, '타이머', '실험 타이머를 설정하고, 완료되면 알림을 받아요.'],
                  [Icon.Package, '소모품', '시약·소모품 재고 상태를 신호등 색으로 관리해요.'],
                ].map(([IconComp, t, d]) => (
                  <div key={t} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    <IconComp size={17} strokeWidth={1.6} style={{ color: 'var(--text2)', flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{t}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{d}</div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {showInfo === 'about' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 17, marginBottom: 4 }}><Icon.Info size={19} strokeWidth={1.7} /> 서비스 정보</div>
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
