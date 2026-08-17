import React, { useState, useEffect } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'
import AuthScreen from './components/AuthScreen'
import HomeTab from './components/HomeTab'
import ScheduleTab from './components/ScheduleTab'
import EquipmentTab from './components/EquipmentTab'
import TimerTab from './components/TimerTab'
import SuppliesTab from './components/SuppliesTab'
import Sidebar from './components/Sidebar'
import ErrorBoundary from './components/ErrorBoundary'
import { Avatar } from './components/Avatar'
import { Icon } from './components/Icon'
import { useLabRealtime } from './hooks/useSupabase'
import ToastContainer from './components/ToastContainer'
import { toast } from './utils/toast'
import { haptic } from './utils/haptics'
import { CORE_TABS, MODULES } from './modules'
import './App.css'

const TABS = [{ id: 'home', icon: Icon.Home, label: '홈' }, ...CORE_TABS]

function LoadingScreen() {
  return (
    <div className="loading-screen" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'var(--green-dark)',
    }}>
      <div style={{ fontSize: 44, fontWeight: 700, color: '#fff', letterSpacing: -2, lineHeight: 1, marginBottom: 20 }}>LABO</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.7)',
            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
    </div>
  )
}

async function loadUserAndLab(authUser) {
  const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', authUser.id).single()
  if (error || !profile) return { user: null, labInfo: null }
  const user = { id: authUser.id, name: profile.name, email: profile.email, role: profile.role, labId: profile.lab_id, avatar: profile.avatar, hiddenModules: profile.hidden_modules || [] }
  let labInfo = null
  if (user.labId) {
    const { data: lab } = await supabase.from('labs').select('*').eq('id', user.labId).single()
    if (lab) labInfo = {
      id: lab.id, name: lab.name, code: lab.code, profName: lab.prof_name,
      enabledModules: lab.enabled_modules || [], disabledTabs: lab.disabled_tabs || [],
    }
  }
  return { user, labInfo }
}

export default function App() {
  const [user, setUser] = useState(null)
  const [labInfo, setLabInfo] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('home')
  const [showSidebar, setShowSidebar] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  // 안드로이드 하드웨어 뒤로가기 — 사이드바 닫기 > 홈 탭으로 > 앱 종료 순으로 처리
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const sub = CapacitorApp.addListener('backButton', () => {
      if (showSidebar) { setShowSidebar(false); return }
      if (activeTab !== 'home') { setActiveTab('home'); return }
      CapacitorApp.exitApp()
    })
    return () => { sub.then(s => s.remove()) }
  }, [showSidebar, activeTab])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { if (active) setAuthLoading(false); return }
      const { user: u, labInfo: l } = await loadUserAndLab(session.user)
      if (active) { setUser(u); setLabInfo(l); setAuthLoading(false) }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        if (active) { setUser(null); setLabInfo(null) }
        return
      }
      if (event === 'SIGNED_IN') {
        const { user: u, labInfo: l } = await loadUserAndLab(session.user)
        if (active) { setUser(u); setLabInfo(l) }
      }
    })

    return () => { active = false; subscription.unsubscribe() }
  }, [])

  // 본인의 랩 멤버십을 실시간 감시 — 강퇴되면 labId를 정리하고,
  // 교수가 역할을 바꾸면 스스로 동기화
  useEffect(() => {
    if (!user?.id || !user?.labId) return
    const uid = user.id
    const labId = user.labId

    const channel = supabase
      .channel(`self-membership-${uid}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'lab_members',
        filter: `user_id=eq.${uid}`,
      }, async (payload) => {
        if (payload.eventType === 'DELETE') {
          await supabase.from('profiles').update({ lab_id: null }).eq('id', uid)
          toast.error('연구실에서 제외되었어요. 초대코드로 다시 참여해주세요.')
          setUser(p => (p && p.id === uid) ? { ...p, labId: null } : p)
          setLabInfo(null)
          return
        }
        const role = payload.new?.role
        if (!role) return
        setUser(p => {
          if (!p || p.id !== uid || p.role === role) return p
          supabase.from('profiles').update({ role }).eq('id', uid).then(() => {})
          return { ...p, role }
        })
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user?.id, user?.labId])

  // 본인이 이 탭(또는 모듈)을 개인적으로 숨겨뒀는데 마침 그 화면을 보고 있었다면 홈으로 돌려보냄
  useEffect(() => {
    if (activeTab !== 'home' && (user?.hiddenModules || []).includes(activeTab)) setActiveTab('home')
  }, [activeTab, user?.hiddenModules])

  const labId = user?.labId
  // 모든 탭·모듈은 항상 존재함 — 각자 자기 탭바에 뭘 보이게 할지만 개인 취향으로 조절
  // (랩 전체에 적용되는 설정이 아니라 profiles.hidden_modules에 본인만 저장됨)
  const hiddenTabs = user?.hiddenModules || []
  const visibleModuleTabs = MODULES.filter(m => !hiddenTabs.includes(m.key))
  const visibleTabs = [
    ...TABS.filter(t => t.id === 'home' || !hiddenTabs.includes(t.id)),
    ...visibleModuleTabs.map(m => ({ id: m.key, icon: m.icon, label: m.label })),
  ]
  // 일정/장비/소모품/공지/멤버/타이머를 채널 하나로 묶어서 실시간 구독 —
  // App 레벨에서 관리해서 탭 전환해도 유지되고, 타이머는 서버에도 동기화돼서
  // 기기를 바꾸거나 새로고침해도 안 사라짐
  const {
    schedulesHook, equipmentHook, suppliesHook, noticesHook, members,
    timers, addTimer, updateTimer, deleteTimer,
  } = useLabRealtime(user?.id, labId)

  if (authLoading) return <LoadingScreen />
  if (!user) return <AuthScreen onLogin={setUser} />

  const runningCount = timers.filter(t => t.running).length

  return (
    <div className="app-shell">
      {/* 상단 헤더 — 스크롤하면 살짝 그림자가 생겨서 콘텐츠 위에 떠 있는 느낌을 줌 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'calc(14px + env(safe-area-inset-top, 0px)) 20px 12px', position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--bg)',
        boxShadow: scrolled ? '0 1px 0 rgba(14,17,23,0.06), 0 6px 16px -4px rgba(14,17,23,0.08)' : 'none',
        transition: 'box-shadow .2s ease',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--green)', letterSpacing: -1, lineHeight: 1 }}>LABO</div>
          {labInfo?.name && (
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2, fontWeight: 500 }}>
              {labInfo.name.length > 14 ? labInfo.name.slice(0, 14) + '…' : labInfo.name}
            </div>
          )}
        </div>
        <button onClick={() => { haptic.light(); setShowSidebar(true) }} style={{
          width: 36, height: 36, borderRadius: '50%', overflow: 'hidden',
          background: 'var(--green-light)',
          border: '1px solid var(--border)',
          color: 'var(--green)', cursor: 'pointer',
          fontWeight: 650, fontSize: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Avatar value={user.avatar} fallback={user.name?.slice(-1)} />
        </button>
      </div>

      <div className="content-area" onScroll={e => setScrolled(e.currentTarget.scrollTop > 4)}>
        {activeTab === 'home' && (
          <HomeTab user={user} schedules={schedulesHook.data} schedulesHook={schedulesHook}
            supplies={suppliesHook.data} notices={noticesHook.data} setActiveTab={setActiveTab} timers={timers}
            disabledTabs={hiddenTabs} />
        )}
        {activeTab === 'schedule' && !hiddenTabs.includes('schedule') && (
          <ScheduleTab labId={labId} schedules={schedulesHook.data} schedulesHook={schedulesHook}
            notices={noticesHook.data} noticesHook={noticesHook} members={members} user={user} />
        )}
        {activeTab === 'equipment' && !hiddenTabs.includes('equipment') && (
          <EquipmentTab labId={labId} equipment={equipmentHook.data} equipmentHook={equipmentHook} user={user} />
        )}
        {/* 타이머탭 — 항상 렌더링, display로 숨김 (언마운트 방지) */}
        <div style={{ display: activeTab === 'timer' && !hiddenTabs.includes('timer') ? 'block' : 'none' }}>
          <TimerTab
            timers={timers}
            onAdd={addTimer}
            onUpdate={updateTimer}
            onDelete={deleteTimer}
            equipment={equipmentHook.data}
          />
        </div>
        {activeTab === 'supplies' && !hiddenTabs.includes('supplies') && (
          <SuppliesTab labId={labId} supplies={suppliesHook.data} suppliesHook={suppliesHook} user={user} />
        )}
        {visibleModuleTabs.map(m => activeTab === m.key && (
          <ErrorBoundary key={m.key}>
            <m.Screen labId={labId} user={user} members={members} />
          </ErrorBoundary>
        ))}
      </div>

      {/* 탭바 — 타이머 실행중이면 배지 표시.
          탭이 많아지면(모듈을 여러 개 켜면) flex:1로 억지로 욱여넣으면 라벨이
          두 줄로 깨지면서 탭바 전체 높이가 들쭉날쭉해짐 — 6개 넘으면 각 탭을
          고정 너비로 두고 옆으로 스크롤하게 바꿔서 항상 한 줄을 유지함 */}
      <div className={`tab-bar${visibleTabs.length > 6 ? ' scrollable' : ''}`}>
        {visibleTabs.map(t => (
          <button key={t.id} className={`tab-item${activeTab === t.id ? ' active' : ''}`}
            onClick={() => { if (activeTab !== t.id) { haptic.selection(); setActiveTab(t.id) } }}
            style={{ position: 'relative' }}>
            <span className="tab-icon"><t.icon size={21} strokeWidth={activeTab === t.id ? 2 : 1.7} /></span>
            <span className="tab-label">{t.label}</span>
            {/* 타이머 실행 중 배지 */}
            {t.id === 'timer' && runningCount > 0 && (
              <div style={{
                position: 'absolute', top: 4, right: '50%', transform: 'translateX(10px)',
                width: 16, height: 16, borderRadius: '50%',
                background: 'var(--red)', color: '#fff',
                fontSize: 9, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>{runningCount}</div>
            )}
          </button>
        ))}
      </div>

      {showSidebar && (
        <Sidebar user={user} labInfo={labInfo} members={members}
          onClose={() => setShowSidebar(false)}
          onUserUpdate={updated => setUser(updated)}
          onLabUpdate={updated => setLabInfo(updated)} />
      )}
      <ToastContainer />
    </div>
  )
}
