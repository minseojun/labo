import React, { useState, useEffect, useRef, useCallback } from 'react'
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
import { useCollection, useMembers } from './hooks/useSupabase'
import ToastContainer from './components/ToastContainer'
import { toast } from './utils/toast'
import { haptic } from './utils/haptics'
import { CORE_TABS, MODULES, isModuleEnabled } from './modules'
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

function notifyTimerDone(name) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`${name} 완료!`, { body: '실험이 완료되었습니다.' })
  }
  haptic.medium()
}

// endAt(완료 예정 절대 시각) 기준으로 남은 시간을 매번 새로 계산 — setInterval은
// 화면이 꺼지거나 탭이 백그라운드로 밀리면 브라우저가 틱을 늦추거나 통째로 멈추는데,
// "1초씩 빼기" 방식이면 그 지연이 그대로 오차로 쌓임. 대신 틱이 오든 늦게 오든
// (endAt - now)로 다시 계산하면 실제 경과 시간과 항상 일치함
function timeLeftFrom(t) {
  if (!t.running || !t.endAt) return t.timeLeft
  return Math.max(0, Math.round((t.endAt - Date.now()) / 1000))
}

// ===== 타이머 전역 관리 훅 =====
function useTimers() {
  const [timers, setTimers] = useState([])
  const intervalsRef = useRef({})

  const stopInterval = useCallback((id) => {
    clearInterval(intervalsRef.current[id])
    delete intervalsRef.current[id]
  }, [])

  // 타이머 틱 — 탭 전환해도 계속 돌아감. 실제 남은 시간은 항상 endAt에서 다시 계산
  const startInterval = useCallback((id) => {
    if (intervalsRef.current[id]) return
    intervalsRef.current[id] = setInterval(() => {
      setTimers(prev => prev.map(t => {
        if (t.id !== id || !t.running) return t
        const next = timeLeftFrom(t)
        if (next <= 0) {
          stopInterval(id)
          notifyTimerDone(t.name)
          return { ...t, timeLeft: 0, running: false, done: true, endAt: null }
        }
        return next === t.timeLeft ? t : { ...t, timeLeft: next }
      }))
    }, 1000)
  }, [stopInterval])

  const addTimer = useCallback((config) => {
    const id = 't' + Date.now()
    setTimers(prev => [...prev, {
      id,
      name: config.name,
      duration: config.duration,
      equipment: config.equipment || '',
      timeLeft: config.duration,
      running: false,
      done: false,
      memo: '',
      endAt: null,
    }])
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const updateTimer = useCallback((id, patch) => {
    setTimers(prev => prev.map(t => {
      if (t.id !== id) return t
      const updated = { ...t, ...patch }
      // running 상태 변화에 따라 interval 제어. 시작/재개 시점의 실제 시각으로
      // endAt을 다시 잡아야 일시정지했다가 이어서 돌려도 오차가 안 생김
      if (patch.running === true) {
        updated.endAt = Date.now() + t.timeLeft * 1000
        startInterval(id)
      }
      if (patch.running === false) { stopInterval(id); updated.endAt = null }
      // 리셋
      if (patch.timeLeft === t.duration) { stopInterval(id); updated.endAt = null }
      return updated
    }))
  }, [startInterval, stopInterval])

  const deleteTimer = useCallback((id) => {
    stopInterval(id)
    setTimers(prev => prev.filter(t => t.id !== id))
  }, [stopInterval])

  // 탭/앱이 백그라운드에 있는 동안엔 setInterval 자체가 통째로 멈출 수 있어서,
  // 화면으로 돌아온 순간 즉시 한 번 다시 계산해서 "몰래 끝나 있던" 타이머를 바로 잡아냄
  useEffect(() => {
    const recompute = () => {
      setTimers(prev => prev.map(t => {
        if (!t.running) return t
        const next = timeLeftFrom(t)
        if (next <= 0) {
          stopInterval(t.id)
          notifyTimerDone(t.name)
          return { ...t, timeLeft: 0, running: false, done: true, endAt: null }
        }
        return next === t.timeLeft ? t : { ...t, timeLeft: next }
      }))
    }
    const onVisible = () => { if (!document.hidden) recompute() }
    document.addEventListener('visibilitychange', onVisible)
    let sub
    if (Capacitor.isNativePlatform()) {
      sub = CapacitorApp.addListener('resume', recompute)
    }
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      sub?.then(s => s.remove())
    }
  }, [stopInterval])

  // 언마운트 시 전체 정리
  useEffect(() => {
    return () => Object.values(intervalsRef.current).forEach(clearInterval)
  }, [])

  return { timers, addTimer, updateTimer, deleteTimer }
}

async function loadUserAndLab(authUser) {
  const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', authUser.id).single()
  if (error || !profile) return { user: null, labInfo: null }
  const user = { id: authUser.id, name: profile.name, email: profile.email, role: profile.role, labId: profile.lab_id, avatar: profile.avatar }
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
  const [showModuleSheet, setShowModuleSheet] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  // 타이머 — App 레벨에서 관리해서 탭 전환해도 유지
  const { timers, addTimer, updateTimer, deleteTimer } = useTimers()

  // 안드로이드 하드웨어 뒤로가기 — 사이드바 닫기 > 홈 탭으로 > 앱 종료 순으로 처리
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const sub = CapacitorApp.addListener('backButton', () => {
      if (showSidebar) { setShowSidebar(false); return }
      if (showModuleSheet) { setShowModuleSheet(false); return }
      if (activeTab !== 'home') { setActiveTab('home'); return }
      CapacitorApp.exitApp()
    })
    return () => { sub.then(s => s.remove()) }
  }, [showSidebar, showModuleSheet, activeTab])

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

  // 랩 관리자가 이 탭(또는 모듈)을 꺼버렸는데 마침 그 화면을 보고 있었다면 홈으로 돌려보냄
  useEffect(() => {
    const isDisabledCore = labInfo?.disabledTabs?.includes(activeTab)
    const moduleMatch = MODULES.find(m => m.key === activeTab)
    const isDisabledModule = moduleMatch && !isModuleEnabled(labInfo, moduleMatch.key)
    if (isDisabledCore || isDisabledModule) setActiveTab('home')
  }, [labInfo, activeTab])

  const labId = user?.labId
  const enabledModuleTabs = MODULES.filter(m => isModuleEnabled(labInfo, m.key))
  // 하단 탭바는 홈 + 기본 탭(최대 4개)으로 고정 — 랩이 모듈을 여러 개 켜도
  // 탭이 계속 늘어나 엄지로 누르기 힘들어지지 않도록, 모듈은 전부 "더보기" 시트로 모음
  const fixedTabs = TABS.filter(t => t.id === 'home' || !labInfo?.disabledTabs?.includes(t.id))
  const activeModule = enabledModuleTabs.find(m => m.key === activeTab)
  const visibleTabs = enabledModuleTabs.length > 0
    ? [...fixedTabs, { id: '__more__', icon: activeModule?.icon || Icon.Grid, label: activeModule?.label || '더보기' }]
    : fixedTabs
  const schedulesHook = useCollection(labId, 'schedules', 'date')
  const equipmentHook = useCollection(labId, 'equipment', 'created_at')
  const suppliesHook  = useCollection(labId, 'supplies', 'created_at')
  const noticesHook   = useCollection(labId, 'notices', 'created_at')
  const members       = useMembers(labId)

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
            disabledTabs={labInfo?.disabledTabs || []} />
        )}
        {activeTab === 'schedule' && !labInfo?.disabledTabs?.includes('schedule') && (
          <ScheduleTab labId={labId} schedules={schedulesHook.data} schedulesHook={schedulesHook}
            notices={noticesHook.data} noticesHook={noticesHook} members={members} user={user} />
        )}
        {activeTab === 'equipment' && !labInfo?.disabledTabs?.includes('equipment') && (
          <EquipmentTab labId={labId} equipment={equipmentHook.data} equipmentHook={equipmentHook} user={user} />
        )}
        {/* 타이머탭 — 항상 렌더링, display로 숨김 (언마운트 방지) */}
        <div style={{ display: activeTab === 'timer' && !labInfo?.disabledTabs?.includes('timer') ? 'block' : 'none' }}>
          <TimerTab
            timers={timers}
            onAdd={addTimer}
            onUpdate={updateTimer}
            onDelete={deleteTimer}
            equipment={equipmentHook.data}
          />
        </div>
        {activeTab === 'supplies' && !labInfo?.disabledTabs?.includes('supplies') && (
          <SuppliesTab labId={labId} supplies={suppliesHook.data} suppliesHook={suppliesHook} user={user} />
        )}
        {enabledModuleTabs.map(m => activeTab === m.key && (
          <ErrorBoundary key={m.key}>
            <m.Screen labId={labId} user={user} members={members} />
          </ErrorBoundary>
        ))}
      </div>

      {/* 탭바 — 타이머 실행중이면 배지 표시. 모듈이 있으면 마지막 슬롯은 "더보기" 시트를 염 */}
      <div className="tab-bar">
        {visibleTabs.map(t => {
          const isActive = t.id === '__more__' ? !!activeModule : activeTab === t.id
          return (
            <button key={t.id} className={`tab-item${isActive ? ' active' : ''}`}
              onClick={() => {
                if (t.id === '__more__') { haptic.selection(); setShowModuleSheet(true); return }
                if (activeTab !== t.id) { haptic.selection(); setActiveTab(t.id) }
              }}
              style={{ position: 'relative' }}>
              <span className="tab-icon"><t.icon size={21} strokeWidth={isActive ? 2 : 1.7} /></span>
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
          )
        })}
      </div>

      {showModuleSheet && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setShowModuleSheet(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">모듈</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {enabledModuleTabs.map(m => (
                <button key={m.key} onClick={() => { haptic.selection(); setActiveTab(m.key); setShowModuleSheet(false) }}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
                    padding: '14px 14px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                    border: `1.5px solid ${activeTab === m.key ? 'var(--green)' : 'var(--border)'}`,
                    background: activeTab === m.key ? 'var(--green-ultra)' : 'var(--card)',
                    borderRadius: 14,
                  }}>
                  <m.icon size={20} strokeWidth={1.7} style={{ color: activeTab === m.key ? 'var(--green)' : 'var(--text2)' }} />
                  <span style={{ fontSize: 13, fontWeight: 650, color: activeTab === m.key ? 'var(--green)' : 'var(--text)' }}>{m.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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
