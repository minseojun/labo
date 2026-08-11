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
import { useCollection, useMembers } from './hooks/useSupabase'
import ToastContainer from './components/ToastContainer'
import { toast } from './utils/toast'
import './App.css'

const TABS = [
  { id: 'home',      icon: '🏠', label: '홈' },
  { id: 'schedule',  icon: '📅', label: '일정' },
  { id: 'equipment', icon: '🔬', label: '장비' },
  { id: 'timer',     icon: '⏱', label: '타이머' },
  { id: 'supplies',  icon: '📦', label: '소모품' },
]

function LoadingScreen() {
  return (
    <div className="loading-screen" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #2BBD83 0%, #1F9D6B 45%, #147A4F 100%)',
    }}>
      <div style={{ fontSize: 52, fontWeight: 900, color: '#fff', letterSpacing: -4, lineHeight: 1, marginBottom: 20 }}>LABO</div>
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

// ===== 타이머 전역 관리 훅 =====
function useTimers() {
  const [timers, setTimers] = useState([])
  const intervalsRef = useRef({})

  // 타이머 틱 — 탭 전환해도 계속 돌아감
  const startInterval = useCallback((id) => {
    if (intervalsRef.current[id]) return
    intervalsRef.current[id] = setInterval(() => {
      setTimers(prev => prev.map(t => {
        if (t.id !== id || !t.running) return t
        const next = t.timeLeft - 1
        if (next <= 0) {
          clearInterval(intervalsRef.current[id])
          delete intervalsRef.current[id]
          // 브라우저 알림
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`⏱ ${t.name} 완료!`, { body: '실험이 완료되었습니다.' })
          }
          return { ...t, timeLeft: 0, running: false, done: true }
        }
        return { ...t, timeLeft: next }
      }))
    }, 1000)
  }, [])

  const stopInterval = useCallback((id) => {
    clearInterval(intervalsRef.current[id])
    delete intervalsRef.current[id]
  }, [])

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
    }])
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const updateTimer = useCallback((id, patch) => {
    setTimers(prev => prev.map(t => {
      if (t.id !== id) return t
      const updated = { ...t, ...patch }
      // running 상태 변화에 따라 interval 제어
      if (patch.running === true) startInterval(id)
      if (patch.running === false) stopInterval(id)
      // 리셋
      if (patch.timeLeft === t.duration) stopInterval(id)
      return updated
    }))
  }, [startInterval, stopInterval])

  const deleteTimer = useCallback((id) => {
    stopInterval(id)
    setTimers(prev => prev.filter(t => t.id !== id))
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
    if (lab) labInfo = { id: lab.id, name: lab.name, code: lab.code, profName: lab.prof_name }
  }
  return { user, labInfo }
}

export default function App() {
  const [user, setUser] = useState(null)
  const [labInfo, setLabInfo] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('home')
  const [showSidebar, setShowSidebar] = useState(false)

  // 타이머 — App 레벨에서 관리해서 탭 전환해도 유지
  const { timers, addTimer, updateTimer, deleteTimer } = useTimers()

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

  const labId = user?.labId
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
      {/* 상단 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'calc(14px + env(safe-area-inset-top, 0px)) 20px 0', position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--bg)',
      }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 21, color: 'var(--green)', letterSpacing: -1.5, lineHeight: 1 }}>LABO</div>
          {labInfo?.name && (
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2, fontWeight: 500 }}>
              {labInfo.name.length > 14 ? labInfo.name.slice(0, 14) + '…' : labInfo.name}
            </div>
          )}
        </div>
        <button onClick={() => setShowSidebar(true)} style={{
          width: 38, height: 38, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--green-light) 0%, #d0eddf 100%)',
          border: '1.5px solid var(--green-light)',
          color: 'var(--green)', cursor: 'pointer',
          fontWeight: 700, fontSize: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(31,157,107,0.18)',
        }}>
          {user.avatar || user.name?.slice(-1)}
        </button>
      </div>

      <div className="content-area">
        {activeTab === 'home' && (
          <HomeTab user={user} schedules={schedulesHook.data} schedulesHook={schedulesHook}
            supplies={suppliesHook.data} notices={noticesHook.data} setActiveTab={setActiveTab} timers={timers} />
        )}
        {activeTab === 'schedule' && (
          <ScheduleTab labId={labId} schedules={schedulesHook.data} schedulesHook={schedulesHook}
            notices={noticesHook.data} noticesHook={noticesHook} members={members} user={user} />
        )}
        {activeTab === 'equipment' && (
          <EquipmentTab labId={labId} equipment={equipmentHook.data} equipmentHook={equipmentHook} user={user} />
        )}
        {/* 타이머탭 — 항상 렌더링, display로 숨김 (언마운트 방지) */}
        <div style={{ display: activeTab === 'timer' ? 'block' : 'none' }}>
          <TimerTab
            timers={timers}
            onAdd={addTimer}
            onUpdate={updateTimer}
            onDelete={deleteTimer}
            equipment={equipmentHook.data}
          />
        </div>
        {activeTab === 'supplies' && (
          <SuppliesTab labId={labId} supplies={suppliesHook.data} suppliesHook={suppliesHook} user={user} />
        )}
      </div>

      {/* 탭바 — 타이머 실행중이면 배지 표시 */}
      <div className="tab-bar">
        {TABS.map(t => (
          <button key={t.id} className={`tab-item${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}
            style={{ position: 'relative' }}>
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
            {/* 타이머 실행 중 배지 */}
            {t.id === 'timer' && runningCount > 0 && (
              <div style={{
                position: 'absolute', top: 4, right: '50%', transform: 'translateX(10px)',
                width: 16, height: 16, borderRadius: '50%',
                background: 'var(--red)', color: '#fff',
                fontSize: 9, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>{runningCount}</div>
            )}
          </button>
        ))}
      </div>

      {showSidebar && (
        <Sidebar user={user} labInfo={labInfo} members={members}
          onClose={() => setShowSidebar(false)}
          onUserUpdate={updated => setUser(updated)} />
      )}
      <ToastContainer />
    </div>
  )
}
