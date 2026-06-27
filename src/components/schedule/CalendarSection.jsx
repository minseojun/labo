import React, { useState } from 'react'
import { DAYS } from '../../mockData'
import { fmtDate, getWeekDates } from '../../utils'
import { toast } from '../../utils/toast'
import NoticeCard from './NoticeCard'

export default function CalendarSection({ labId, schedules, schedulesHook, notices, noticesHook, members, user }) {
  const today = new Date()
  const [baseDate, setBaseDate] = useState(today)
  const [selDate, setSelDate] = useState(fmtDate(today))

  const [showAdd, setShowAdd] = useState(false)
  const [showEdit, setShowEdit] = useState(null)
  const [newNotice, setNewNotice] = useState('')
  const [showHidden, setShowHidden] = useState(false)
  const [form, setForm] = useState({ name: '', date: fmtDate(today), time: '10:00', type: 'lab', assignee: '전체' })

  const uniqueMembers = members.filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)
  const weekDates = getWeekDates(baseDate)
  const nonTaskSchedules = schedules.filter(s => s.type !== 'task')
  const filtered = nonTaskSchedules
    .filter(s => s.date === selDate)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))

  const addSchedule = async () => {
    const name = form.name.trim()
    if (!name) { toast.error('일정 이름을 입력해주세요.'); return }
    if (name.length > 100) { toast.error('이름은 100자 이내로 입력해주세요.'); return }
    try {
      await schedulesHook.add({ ...form, name })
      setShowAdd(false)
      setForm({ name: '', date: selDate, time: '10:00', type: 'lab', assignee: '전체' })
    } catch (e) {
      // error shown by hook
    }
  }

  const saveEdit = async () => {
    if (!showEdit) return
    const name = showEdit.name?.trim()
    if (!name) { toast.error('일정 이름을 입력해주세요.'); return }
    try {
      await schedulesHook.update(showEdit.id, {
        name, date: showEdit.date,
        time: showEdit.time, type: showEdit.type, assignee: showEdit.assignee
      })
      setShowEdit(null)
    } catch (e) {
      // error shown by hook
    }
  }

  const deleteSchedule = async (s, e) => {
    e.stopPropagation()
    if (!window.confirm(`"${s.name}" 일정을 삭제하시겠습니까?`)) return
    try {
      await schedulesHook.remove(s.id)
    } catch (e) {
      // error shown by hook
    }
  }

  const addNotice = async () => {
    const body = newNotice.trim()
    if (!body) return
    if (body.length > 500) { toast.error('공지는 500자 이내로 입력해주세요.'); return }
    try {
      await noticesHook.add({ author: user.name, body, pinned: false })
      setNewNotice('')
    } catch (e) {
      // error shown by hook
    }
  }

  const visibleNotices = notices.filter(n => !n.hidden)
  const hiddenNotices = notices.filter(n => n.hidden)
  const pinnedNotices = visibleNotices.filter(n => n.pinned)
  const normalNotices = visibleNotices.filter(n => !n.pinned)

  return (
    <div>
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
          const hasSched = nonTaskSchedules.some(s => s.date === ds)
          return (
            <div key={i} className="day-col" onClick={() => setSelDate(ds)}>
              <div className="day-label">{DAYS[d.getDay()]}</div>
              <div className={`day-num${isToday ? ' today' : isSel ? ' selected' : ''}`}>{d.getDate()}</div>
              {hasSched && !isToday && !isSel && <div className="day-dot" />}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text2)', fontSize: 13 }}>이 날 일정이 없습니다</div>
      ) : filtered.map(s => (
        <div key={s.id} className="sched-item" onClick={() => setShowEdit({ ...s })}>
          <div className="sched-bar" style={{ background: s.type === 'lab' ? 'var(--green)' : 'var(--purple)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, fontSize: 14 }}>{s.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{s.time && `${s.time} · `}{s.assignee}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {s.type === 'mine' && <span className="chip chip-purple">개인</span>}
            {s.type === 'lab' && <span className="chip chip-green">공용</span>}
            <button onClick={e => deleteSchedule(s, e)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 16, padding: '2px 6px' }}>×</button>
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 8px' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .6 }}>공지사항</span>
        {hiddenNotices.length > 0 && (
          <button onClick={() => setShowHidden(p => !p)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>
            {showHidden ? '👁 숨김 닫기' : '🗂 숨긴 공지'}
          </button>
        )}
      </div>

      {visibleNotices.length === 0 && !showHidden && (
        <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text2)', fontSize: 13, margin: '0 16px', background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>공지사항이 없습니다</div>
      )}
      {[...pinnedNotices, ...normalNotices].map(n => <NoticeCard key={n.id} n={n} labId={labId} user={user} noticesHook={noticesHook} hidden={false} />)}
      {showHidden && hiddenNotices.length > 0 && (
        <div style={{ margin: '4px 16px 0' }}>
          <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600, marginBottom: 8, padding: '8px 0 4px', borderTop: '1px dashed var(--border)' }}>🗂 숨긴 공지</div>
          {hiddenNotices.map(n => <NoticeCard key={n.id} n={n} labId={labId} user={user} noticesHook={noticesHook} hidden={true} />)}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, padding: '8px 16px 24px' }}>
        <input className="form-input" value={newNotice} maxLength={500}
          onChange={e => setNewNotice(e.target.value)}
          placeholder="공지 작성..."
          style={{ flex: 1 }}
          onKeyDown={e => e.key === 'Enter' && addNotice()} />
        <button onClick={addNotice}
          style={{ padding: '0 16px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>올리기</button>
      </div>

      <button className="fab" onClick={() => setShowAdd(true)}>＋</button>

      {showAdd && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">일정 추가</div>
            <div className="form-group">
              <label className="form-label">일정 이름</label>
              <input className="form-input" value={form.name} maxLength={100}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="일정 이름" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">날짜</label>
              <input className="form-input" type="date" value={form.date}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">시간</label>
              <input className="form-input" type="time" value={form.time}
                onChange={e => setForm(p => ({ ...p, time: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">유형</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['lab','🏛 공용'], ['mine','👤 개인']].map(([v,l]) => (
                  <button key={v} onClick={() => setForm(p => ({ ...p, type: v }))} style={{ flex: 1, padding: '10px', border: `2px solid ${form.type === v ? 'var(--green)' : 'var(--border)'}`, borderRadius: 10, background: form.type === v ? 'var(--green-light)' : 'var(--card)', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: form.type === v ? 'var(--green)' : 'var(--text2)' }}>{l}</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">담당자</label>
              <select className="form-select" value={form.assignee} onChange={e => setForm(p => ({ ...p, assignee: e.target.value }))}>
                <option value="전체">전체</option>
                {uniqueMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            </div>
            <button className="btn-primary" onClick={addSchedule}>추가하기</button>
          </div>
        </div>
      )}

      {showEdit && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setShowEdit(null)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">일정 수정</div>
            <div className="form-group">
              <label className="form-label">일정 이름</label>
              <input className="form-input" value={showEdit.name} maxLength={100}
                onChange={e => setShowEdit(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">날짜</label>
              <input className="form-input" type="date" value={showEdit.date}
                onChange={e => setShowEdit(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">시간</label>
              <input className="form-input" type="time" value={showEdit.time}
                onChange={e => setShowEdit(p => ({ ...p, time: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">유형</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['lab','🏛 공용'], ['mine','👤 개인']].map(([v,l]) => (
                  <button key={v} onClick={() => setShowEdit(p => ({ ...p, type: v }))} style={{ flex: 1, padding: '10px', border: `2px solid ${showEdit.type === v ? 'var(--green)' : 'var(--border)'}`, borderRadius: 10, background: showEdit.type === v ? 'var(--green-light)' : 'var(--card)', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: showEdit.type === v ? 'var(--green)' : 'var(--text2)' }}>{l}</button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">담당자</label>
              <select className="form-select" value={showEdit.assignee} onChange={e => setShowEdit(p => ({ ...p, assignee: e.target.value }))}>
                <option value="전체">전체</option>
                {uniqueMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            </div>
            <button className="btn-primary" onClick={saveEdit}>저장하기</button>
          </div>
        </div>
      )}
    </div>
  )
}
