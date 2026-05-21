import React, { useState } from 'react'
import AuthScreen from './components/AuthScreen'
import HomeTab from './components/HomeTab'
import ScheduleTab from './components/ScheduleTab'
import EquipmentTab from './components/EquipmentTab'
import TimerTab from './components/TimerTab'
import SuppliesTab from './components/SuppliesTab'
import { initSchedules, initEquipment, initSupplies, initTodos, initNotices } from './mockData'
import './App.css'

const TABS = [
  { id: 'home', icon: '🏠', label: '홈' },
  { id: 'schedule', icon: '📅', label: '일정' },
  { id: 'equipment', icon: '🔬', label: '장비' },
  { id: 'timer', icon: '⏱', label: '타이머' },
  { id: 'supplies', icon: '📦', label: '소모품' },
]

export default function App() {
  const [user, setUser] = useState(null)
  const [activeTab, setActiveTab] = useState('home')
  const [schedules, setSchedules] = useState(initSchedules)
  const [equipment, setEquipment] = useState(initEquipment)
  const [supplies, setSupplies] = useState(initSupplies)
  const [todos, setTodos] = useState(initTodos)

  if (!user) return <AuthScreen onLogin={setUser} />

  return (
    <div className="app-shell">
      <div className="content-area">
        {activeTab === 'home' && (
          <HomeTab user={user} schedules={schedules} supplies={supplies}
            todos={todos} setTodos={setTodos} notices={initNotices} setActiveTab={setActiveTab} />
        )}
        {activeTab === 'schedule' && (
          <ScheduleTab schedules={schedules} setSchedules={setSchedules} user={user} />
        )}
        {activeTab === 'equipment' && (
          <EquipmentTab equipment={equipment} setEquipment={setEquipment} user={user} />
        )}
        {activeTab === 'timer' && (
          <TimerTab equipment={equipment} />
        )}
        {activeTab === 'supplies' && (
          <SuppliesTab supplies={supplies} setSupplies={setSupplies} user={user} />
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
