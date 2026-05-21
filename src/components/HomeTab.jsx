import React, { useState } from 'react'
import { DAYS } from '../mockData'
import { fmtDate } from '../utils'
import { useUserTodos } from '../hooks/useFirestore'

export default function HomeTab({ user, schedules, supplies, notices, setActiveTab }) {
  const today = new Date()
  const todayStr = fmtDate(today)
  const todayScheds = schedules.filter(s => s.date === todayStr).sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  const myTasks = schedules.filter(s => s.type === 'task' && s.assignee === user.name)
  const redSupplies = supplies.filter(s => s.status === 'red')
  const yellowSupplies = supplies.filter(s => s.status === 'yellow')

  const { todos, add, toggle, remove } = useUserTodos(user.id)
  const [newTodo, setNewTodo] = useState('')

  const addTodo = async () => {
    if (!newTodo.trim()) return
    await add(newTodo)
    setNewTodo('')
  }

  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 ${DAYS[today.getDay()]}요일`

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="page-title">안녕하세요, {user.name}님 👋</div>
            <div className="page-subtitle">{dateStr}</div>
          </div>
          <span className={`chip ${user.role === '교수' ? 'chip-purple' : user.role === '대학원생' ? 'chip-green' : 'chip-yellow'}`}>
            {user.role}
          </span>
        </div>
      </div>

      {redSupplies.length > 0 && (
        <div className="alert-banner alert-red" onClick={() => setActiveTab('supplies')}>
          <div className="alert-dot" style={{ background: 'var(--red)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#c23b3b' }}>재고 없음 알림</div>
            <div style={{ fontSize: 12, color: '#c23b3b', opacity: .8 }}>{redSupplies.map(s => s.name).join(', ')}</div>
          </div>
          <span style={{ color: '#c23b3b', fontSize: 16 }}>›</span>
        </div>
      )}
      {yellowSupplies.length > 0 && redSupplies.length === 0 && (
        <div className="alert-banner alert-yellow" onClick={() => setActiveTab('supplies')}>
          <div className="alert-dot" style={{ background: 'var(--yellow)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#b97b10' }}>재고 주의</div>
            <div style={{ fontSize: 12, color: '#b97b10', opacity: .8 }}>{yellowSupplies.map(s => s.name).join(', ')}</div>
          </div>
          <span style={{ color: '#b97b10', fontSize: 16 }}>›</span>
        </div>
      )}

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-num" style={{ color: 'var(--yellow)' }}>{myTasks.length}</div>
          <div className="stat-label">내 잡무</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: 'var(--red)' }}>{redSupplies.length}</div>
          <div className="stat-label">재고 없음</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: 'var(--green)' }}>{todayScheds.length}</div>
          <div className="stat-label">오늘 일정</div>
        </div>
      </div>

      <div className="section-label">오늘 일정</div>
      <div className="card" style={{ paddingTop: 8, paddingBottom: 8 }}>
        {todayScheds.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text2)', fontSize: 13 }}>오늘 일정이 없습니다</div>
        ) : todayScheds.map(s => (
          <div key={s.id} className="timeline-item">
            <div className="timeline-dot" style={{ background: s.type === 'lab' ? 'var(--green)' : s.type === 'mine' ? 'var(--purple)' : 'var(--yellow)' }} />
            <div className="timeline-content">
              <div className="timeline-time">{s.time} · {s.assignee}</div>
              <div className="timeline-title">{s.name}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="section-label">할 일 체크리스트</div>
      <div className="card">
        {todos.map(t => (
          <div key={t.id} className="todo-item">
            <div className={`todo-check${t.done ? ' done' : ''}`} onClick={() => toggle(t.id, !t.done)}>
              {t.done && <svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>}
            </div>
            <span style={{ textDecoration: t.done ? 'line-through' : 'none', color: t.done ? 'var(--text2)' : 'var(--text)', flex: 1, fontSize: 13 }}>
              {t.text}
            </span>
            <button onClick={() => remove(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 16, padding: '0 4px' }}>×</button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input className="form-input" style={{ flex: 1, padding: '8px 10px', fontSize: 13 }}
            value={newTodo} onChange={e => setNewTodo(e.target.value)}
            placeholder="새 할 일 추가..." onKeyDown={e => e.key === 'Enter' && addTodo()} />
          <button style={{ padding: '8px 14px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 16 }} onClick={addTodo}>+</button>
        </div>
      </div>

      <div className="section-label">최근 공지</div>
      {notices.filter(n => n.pinned).slice(0, 1).map(n => (
        <div key={n.id} className="notice-card">
          <div className="notice-pin">📌 고정</div>
          <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>{n.body}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>{n.author} · {n.createdAt?.toDate?.()?.toLocaleDateString('ko-KR') || n.createdAt}</div>
        </div>
      ))}
      {notices.filter(n => n.pinned).length === 0 && notices.slice(0, 1).map(n => (
        <div key={n.id} className="notice-card">
          <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>{n.body}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>{n.author}</div>
        </div>
      ))}
      {notices.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 13 }}>공지사항이 없습니다</div>
      )}
    </div>
  )
}