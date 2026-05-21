import React, { useState } from 'react'
import { DAYS } from '../mockData'
import { fmtDate, getWeekDates } from '../utils'
import { useMembers } from '../hooks/useFirestore'

export default function ScheduleTab({ labId, schedules, schedulesHook, notices, noticesHook, user }) {
  const today = new Date()
  const [baseDate, setBaseDate] = useState(today)
  const [selDate, setSelDate] = useState(fmtDate(today))
  const [filter, setFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [newNotice, setNewNotice] = useState('')
  const [form, setForm] = useState({ name: '', date: fmtDate(today), time: '10:00', type: 'lab', assignee: '전체' })
  const members = useMembers(labId)

  const weekDates = getWeekDates(baseDate)
  const filtered = schedules.filter(s => {
    if (s.date !== selDate) return false
    if (filter === 'mine') return s.assignee === user.name || s.type === 'lab'
    if (filter === 'task') return s.type === 'task'
    return true
  }).sort((a, b) => (a.time || '').localeCompare(b.time || ''))

  const addSchedule = async () => {
    if (!form.name) return
    await schedulesHook.add(form)
    setShowAdd(false)
    setForm({ name: '', date: selDate, time: '10:00', type: 'lab', assignee: '전체' })
  }

  const addNotice = async () => {
    if (!newNotice.trim()) return
    await noticesHook.add({ author: user.name, body: newNotice, pinned: false })
    setNewNotice('')
  }

  // 구성원별 잡무 횟수 계산
  const taskCounts = members.map(m => ({
    ...m,
    count: schedules.filter(s => s.type === 'task' && s.assignee === m.name).length
  }))
  const maxCount = Math.max(...taskCounts.map(m => m.count), 1)

  return (
    <div>
      <div className="page-header">
        <div className="page-title">일정 & 공지</div>
      </div>

      <div className="week-nav">
        <button onClick={() => { const d = new Date(baseDate); d.setDate(d.getDate() - 7); setBaseDate(d) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text2)', padding: '4px 8px' }}>‹</button>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{baseDate.getFullYear()}년 {baseDate.getMonth() + 1}월</span>
        <button onClick={() => { const d = new Date(baseDate); d.setDate(d.getDate() + 7); setBaseDate(d) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text2)', padding: '4px 8px' }}>›</button>
      </div>

      <div className="week-days">
        {weekDates.map((d, i) => {
          const ds = fmtDate(d)
          const isToday = ds === fmtDate(today)
          const isSel = ds === selDate
          const hasSched = schedules.some(s => s.date === ds)
          return (
            <div key={i} className="day-col" onClick={() => setSelDate(ds)}>
              <div className="day-label">{DAYS[d.getDay()]}</div>
              <div className={`day-num${isToday ? ' today' : isSel ? ' selected' : ''}`}>{d.getDate()}</div>
              {hasSched && !isToday && !isSel && <div className="day-dot" />}
            </div>
          )
        })}
      </div>

      <div className="filter-row">
        {[['all', '전체'], ['mine', '내 일정'], ['task', '잡무']].map(([v, l]) => (
          <div key={v} className={`filter-chip${filter === v ? ' active' : ''}`} onClick={() => setFilter(v)}>{l}</div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text2)', fontSize: 13 }}>이 날 일정이 없습니다</div>
      ) : filtered.map(s => (
        <div key={s.id} className="sched-item">
          <div className="sched-bar" style={{ background: s.type === 'lab' ? 'var(--green)' : s.type === 'mine' ? 'var(--purple)' : 'var(--yellow)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, fontSize: 14 }}>{s.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{s.time} · {s.assignee}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {s.type === 'task' && <span className="chip chip-yellow">잡무</span>}
            {s.type === 'mine' && <span className="chip chip-purple">개인</span>}
            {s.type === 'lab' && <span className="chip chip-green">공용</span>}
            <button onClick={() => schedulesHook.remove(s.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 14, padding: '2px 4px' }}>×</button>
          </div>
        </div>
      ))}

      {taskCounts.length > 0 && (
        <>
          <div className="section-label">구성원별 잡무 현황</div>
          <div className="card" style={{ paddingTop: 8 }}>
            {taskCounts.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green)', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {m.name?.slice(-2) || '?'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name} <span style={{ fontSize: 11, color: 'var(--text2)' }}>{m.role}</span></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <div className="fairness-bar"><div className="fairness-fill" style={{ width: `${(m.count / maxCount) * 100}%` }} /></div>
                    <span style={{ fontSize: 11, color: 'var(--text2)', minWidth: 20 }}>{m.count}회</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="section-label">공지사항</div>
      {notices.map(n => (
        <div key={n.id} className="notice-card">
          {n.pinned && <div className="notice-pin">📌 고정</div>}
          <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 6 }}>{n.body}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>{n.author}</div>
            <button onClick={() => noticesHook.remove(n.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 13 }}>삭제</button>
          </div>
        </div>
      ))}
      {notices.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 13 }}>공지사항이 없습니다</div>
      )}
      <div style={{ padding: '0 16px 16px' }}>
        <textarea className="form-input" rows={2} value={newNotice} onChange={e => setNewNotice(e.target.value)}
          placeholder="공지 작성..." style={{ resize: 'none', marginBottom: 8 }} />
        <button className="btn-primary" onClick={addNotice}>공지 올리기</button>
      </div>

      <button className="fab" onClick={() => setShowAdd(true)}>＋</button>

      {showAdd && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">일정 추가</div>
            <div className="form-group">
              <label className="form-label">일정 이름</label>
              <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="일정 이름" />
            </div>
            <div className="form-group">
              <label className="form-label">날짜</label>
              <input className="form-input" type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">시간</label>
              <input className="form-input" type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">유형</label>
              <select className="form-select" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                <option value="lab">랩 공용</option>
                <option value="mine">개인</option>
                <option value="task">잡무</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">담당자</label>
              <select className="form-select" value={form.assignee} onChange={e => setForm(p => ({ ...p, assignee: e.target.value }))}>
                <option value="전체">전체</option>
                {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            </div>
            <button className="btn-primary" onClick={addSchedule}>추가하기</button>
          </div>
        </div>
      )}
    </div>
  )
}