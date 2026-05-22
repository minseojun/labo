import React, { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import AuthScreen from './components/AuthScreen'
import HomeTab from './components/HomeTab'
import ScheduleTab from './components/ScheduleTab'
import EquipmentTab from './components/EquipmentTab'
import TimerTab from './components/TimerTab'
import SuppliesTab from './components/SuppliesTab'
import Sidebar from './components/Sidebar'
import { useCollection, useMembers } from './hooks/useFirestore'
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
      <div style={{ fontSize: 40, fontWeight: 900, color: 'var(--green)', letterSpacing: -2, marginBottom: 16 }}>LABO</div>
      <div style={{ fontSize: 13, color: 'var(--text2)' }}>불러오는 중...</div>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [labInfo, setLabInfo] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('home')
  const [showSidebar, setShowSidebar] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (userDoc.exists()) {
          const userData = { id: firebaseUser.uid, ...userDoc.data() }
          setUser(userData)
          // 연구실 정보 로드
          if (userData.labId) {
            const labDoc = await getDoc(doc(db, 'labs', userData.labId))
            if (labDoc.exists()) setLabInfo({ id: labDoc.id, ...labDoc.data() })
          }
        } else {
          setUser(null)
        }
      } else {
        setUser(null)
      }
      setAuthLoading(false)
    })
    return unsub
  }, [])

  const labId = user?.labId
  const schedulesHook  = useCollection(labId, 'schedules', 'date')
  const equipmentHook  = useCollection(labId, 'equipment', 'createdAt')
  const suppliesHook   = useCollection(labId, 'supplies', 'createdAt')
  const noticesHook    = useCollection(labId, 'notices', 'createdAt')
  const members        = useMembers(labId)

  if (authLoading) return <LoadingScreen />
  if (!user) return <AuthScreen onLogin={setUser} />

  return (
    <div className="app-shell">
      {/* 상단 헤더 바 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px 0',
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--bg)'
      }}>
        <div style={{ fontWeight: 900, fontSize: 22, color: 'var(--green)', letterSpacing: -1 }}>LABO</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>{labInfo?.name?.slice(0, 10)}{labInfo?.name?.length > 10 ? '...' : ''}</span>
          {/* 아바타 버튼 → 사이드바 열기 */}
          <button onClick={() => setShowSidebar(true)} style={{
            width: 34, height: 34, borderRadius: '50%',
            background: 'var(--green)', color: '#fff',
            border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {user.avatar || user.name?.slice(-1)}
          </button>
        </div>
      </div>

      <div className="content-area">
        {activeTab === 'home' && (
          <HomeTab user={user} schedules={schedulesHook.data} supplies={suppliesHook.data}
            notices={noticesHook.data} setActiveTab={setActiveTab} />
        )}
        {activeTab === 'schedule' && (
          <ScheduleTab labId={labId} schedules={schedulesHook.data} schedulesHook={schedulesHook}
            notices={noticesHook.data} noticesHook={noticesHook} user={user} />
        )}
        {activeTab === 'equipment' && (
          <EquipmentTab labId={labId} equipment={equipmentHook.data} equipmentHook={equipmentHook} user={user} />
        )}
        {activeTab === 'timer' && (
          <TimerTab equipment={equipmentHook.data} />
        )}
        {activeTab === 'supplies' && (
          <SuppliesTab labId={labId} supplies={suppliesHook.data} suppliesHook={suppliesHook} user={user} />
        )}
      </div>

      <div className="tab-bar">
        {TABS.map(t => (
          <button key={t.id} className={`tab-item${activeTab === t.id ? ' active' : ''}`} onClick={() => setActiveTab(t.id)}>
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </div>

      {/* 사이드바 */}
      {showSidebar && (
        <Sidebar user={user} labInfo={labInfo} members={members} onClose={() => setShowSidebar(false)} onUserUpdate={updated => setUser(updated)} />
      )}
    </div>
  )
}
