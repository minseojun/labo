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
import { useCollection } from './hooks/useFirestore'
import './App.css'

const TABS = [
  { id: 'home', icon: '🏠', label: '홈' },
  { id: 'schedule', icon: '📅', label: '일정' },
  { id: 'equipment', icon: '🔬', label: '장비' },
  { id: 'timer', icon: '⏱', label: '타이머' },
  { id: 'supplies', icon: '📦', label: '소모품' },
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
  const [authLoading, setAuthLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('home')

  // Firebase Auth 상태 감지
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (userDoc.exists()) {
          setUser({ id: firebaseUser.uid, ...userDoc.data() })
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

  // Firestore 실시간 구독
  const schedulesHook = useCollection(labId, 'schedules', 'date')
  const equipmentHook = useCollection(labId, 'equipment', 'createdAt')
  const suppliesHook = useCollection(labId, 'supplies', 'createdAt')
  const noticesHook = useCollection(labId, 'notices', 'createdAt')

  if (authLoading) return <LoadingScreen />
  if (!user) return <AuthScreen onLogin={setUser} />

  return (
    <div className="app-shell">
      <div className="content-area">
        {activeTab === 'home' && (
          <HomeTab
            user={user}
            schedules={schedulesHook.data}
            supplies={suppliesHook.data}
            notices={noticesHook.data}
            setActiveTab={setActiveTab}
          />
        )}
        {activeTab === 'schedule' && (
          <ScheduleTab
            labId={labId}
            schedules={schedulesHook.data}
            schedulesHook={schedulesHook}
            notices={noticesHook.data}
            noticesHook={noticesHook}
            user={user}
          />
        )}
        {activeTab === 'equipment' && (
          <EquipmentTab
            labId={labId}
            equipment={equipmentHook.data}
            equipmentHook={equipmentHook}
            user={user}
          />
        )}
        {activeTab === 'timer' && (
          <TimerTab equipment={equipmentHook.data} />
        )}
        {activeTab === 'supplies' && (
          <SuppliesTab
            labId={labId}
            supplies={suppliesHook.data}
            suppliesHook={suppliesHook}
            user={user}
          />
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
    </div>
  )
}