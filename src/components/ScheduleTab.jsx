import React, { useState } from 'react'
import { DAYS } from '../mockData'
import { fmtDate, getWeekDates } from '../utils'
import { useMembers } from '../hooks/useFirestore'
import { collection, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'

// ===== 잡무 관리 섹션 =====
function TaskSection({ labId, schedules, schedulesHook, members, user }) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', repeat: 'weekly', note: '' })

  // 잡무만 필터
  const tasks = schedules.filter(s => s.type === 'task')

  // 구성원별 잡무 횟수
  const memberCounts = members.map(m => ({
    ...m,
    count: tasks.filter(t => t.assignee === m.name).length
  }))
  const maxCount = Math.max(...memberCounts.map(m => m.count), 1)

  // 자동 배정: 잡무 횟수 가장 적은 사람
  const getNextAssignee = () => {
    if (memberCounts.length === 0) return user.name
    return memberCounts.sort((a, b) => a.count - b.count)[0].name
  }

  const addTask = async () => {
    if (!form.name.trim()) return
    const assignee = getNextAssignee()
    const today = fmtDate(new Date())
    await schedulesHook.add({
      name: form.name,
      type: 'task',
      date: today,
      time: '',
      assignee,
      repeat: form.repeat,
      note: form.note,
    })
    setShowAdd(false)
    setForm({ name: '', repeat: 'weekly', note: '' })
  }

  const completeTask = async (task) => {
    // 완료 처리 후 다음 배정
    const nextAssignee = getNextAssignee()
    // 반복 잡무면 다음 날짜로 새로 생성
    if (task.repeat !== 'none') {
      const nextDate = new Date(task.date || new Date())
      if (task.repeat === 'weekly') nextDate.setDate(nextDate.getDate() + 7)
      if (task.repeat === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1)
      await schedulesHook.add({
        name: task.name,
        type: 'task',
        date: fmtDate(nextDate),
        time: task.time || '',
        assignee: nextAssignee,
        repeat: task.repeat,
        note: task.note || '',
      })
    }
    await schedulesHook.remove(task.id)
  }

  const REPEAT_LABEL = { weekly: '매주', monthly: '매월', none: '반복 없음' }

  return (
    <div>
      {/* 공정성 현황 */}
      {memberCounts.length > 0 && (
        <>
          <div className="section-label">구성원별 잡무 현황</div>
          <div className="card" style={{ paddingTop: 8, paddingBottom: 4 }}>
            {memberCounts.sort((a,b) => b.count - a.count).map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--green-light)', color: 'var(--green)', fontWeight: 700, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {m.name?.slice(-2)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                    {m.name}
                    <span style={{ fontSize: 11, color: 'var(--text2)', marginLeft: 6 }}>{m.role}</span>
                    {memberCounts.sort((a,b) => a.count - b.count)[0].id === m.id && (
                      <span style={{ marginLeft: 6, fontSize: 10, background: 'var(--green-light)', color: 'var(--green)', padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>다음 배정</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div className="fairness-bar">
                      <div className="fairness-fill" style={{ width: `${(m.count / maxCount) * 100}%` }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text2)', minWidth: 24 }}>{m.count}회</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 잡무 목록 */}
      <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 16 }}>
        <span>잡무 목록</span>
        <button onClick={() => setShowAdd(true)}
          style={{ padding: '4px 12px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
          + 잡무 추가
        </button>
      </div>

      {tasks.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 13, padding: '24px 16px' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
          등록된 잡무가 없습니다
        </div>
      ) : tasks.map(task => (
        <div key={task.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', margin: '0 16px 10px', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{task.name}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <span style={{ fontSize: 11, background: 'var(--yellow-light)', color: '#b97b10', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                  👤 {task.assignee}
                </span>
                <span style={{ fontSize: 11, background: 'var(--green-light)', color: '#1a7a52', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
                  🔁 {REPEAT_LABEL[task.repeat] || '반복 없음'}
                </span>
                {task.date && (
                  <span style={{ fontSize: 11, background: '#F5F3EE', color: 'var(--text2)', padding: '2px 8px', borderRadius: 10 }}>
                    📅 {task.date}
                  </span>
                )}
              </div>
              {task.note && (
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>{task.note}</div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button onClick={() => completeTask(task)}
                style={{ padding: '6px 10px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                ✓ 완료
              </button>
              <button onClick={() => schedulesHook.remove(task.id)}
                style={{ padding: '6px 10px', background: 'var(--red-light)', color: 'var(--red)', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                삭제
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* 잡무 추가 시트 */}
      {showAdd && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">잡무 추가</div>
            <div className="form-group">
              <label className="form-label">잡무 이름</label>
              <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="예: 실험실 청소, 약품 주문, 장비 점검" />
            </div>
            <div className="form-group">
              <label className="form-label">반복 주기</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['weekly', '매주'], ['monthly', '매월'], ['none', '1회']].map(([v, l]) => (
                  <button key={v} onClick={() => setForm(p => ({ ...p, repeat: v }))}
                    style={{ flex: 1, padding: '10px 4px', border: `2px solid ${form.repeat === v ? 'var(--green)' : 'var(--border)'}`, borderRadius: 8, background: form.repeat === v ? 'var(--green-light)' : 'var(--card)', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: form.repeat === v ? 'var(--green)' : 'var(--text2)' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">메모 (선택)</label>
              <input className="form-input" value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                placeholder="주의사항, 방법 등..." />
            </div>
            <div style={{ background: 'var(--green-light)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 13, color: '#1a7a52' }}>
              👤 담당자 자동 배정: <strong>{getNextAssignee()}</strong> (잡무 횟수 가장 적은 구성원)
            </div>
            <button className="btn-primary" onClick={addTask}>잡무 배정하기</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ===== 일정 캘린더 섹션 =====
function CalendarSection({ labId, schedules, schedulesHook, notices, noticesHook, members, user }) {
  const today = new Date()
  const [baseDate, setBaseDate] = useState(today)
  const [selDate, setSelDate] = useState(fmtDate(today))
  const [filter, setFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [newNotice, setNewNotice] = useState('')
  const [form, setForm] = useState({ name: '', date: fmtDate(today), time: '10:00', type: 'lab', assignee: '전체' })

  const weekDates = getWeekDates(baseDate)
  const nonTaskSchedules = schedules.filter(s => s.type !== 'task')
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
        <div style={{ textAlign: 'center', padding: '28px', color: 'var(--text2)', fontSize: 13 }}>이 날 일정이 없습니다</div>
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
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 16, padding: '2px 6px' }}>×</button>
          </div>
        </div>
      ))}

      <div className="section-label">공지사항</div>
      {notices.length === 0 && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 13 }}>공지사항이 없습니다</div>
      )}
      {/* 고정 공지 먼저, 나머지는 최신순 */}
      {[...notices.filter(n => n.pinned), ...notices.filter(n => !n.pinned)].map(n => (
        <div key={n.id} className="notice-card" style={{ borderColor: n.pinned ? '#f8c5c5' : 'var(--border)', borderWidth: n.pinned ? 1.5 : 1 }}>
          {n.pinned && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 700 }}>📌 고정 공지</span>
            </div>
          )}
          <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 8 }}>{n.body}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>{n.author}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {/* 교수만 고정/해제 가능 */}
              {user.role === '교수' && (
                <button onClick={async () => {
                  const { updateDoc, doc } = await import('firebase/firestore')
                  const { db } = await import('../firebase')
                  await updateDoc(doc(db, 'labs', labId, 'notices', n.id), { pinned: !n.pinned })
                }} style={{
                  padding: '3px 8px', border: '1px solid var(--border)',
                  borderRadius: 6, background: n.pinned ? 'var(--red-light)' : 'var(--bg)',
                  color: n.pinned ? 'var(--red)' : 'var(--text2)',
                  fontSize: 11, cursor: 'pointer', fontWeight: 600
                }}>
                  {n.pinned ? '📌 해제' : '📌 고정'}
                </button>
              )}
              {(user.role === '교수' || n.author === user.name) && (
                <button onClick={() => noticesHook.remove(n.id)}
                  style={{ padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text2)', fontSize: 11, cursor: 'pointer' }}>
                  삭제
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
      <div style={{ padding: '0 16px 16px' }}>
        <textarea className="form-input" rows={2} value={newNotice} onChange={e => setNewNotice(e.target.value)}
          placeholder="공지 작성..." style={{ resize: 'none', marginBottom: 8 }} />
        <button className="btn-primary" onClick={async () => {
          if (!newNotice.trim()) return
          await noticesHook.add({ author: user.name, body: newNotice, pinned: false })
          setNewNotice('')
        }}>공지 올리기</button>
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

// ===== 메인 탭 =====
export default function ScheduleTab({ labId, schedules, schedulesHook, notices, noticesHook, user }) {
  const [section, setSection] = useState('calendar') // calendar | tasks
  const members = useMembers(labId)

  return (
    <div>
      <div className="page-header">
        <div className="page-title">일정 & 잡무</div>
        {/* 섹션 전환 탭 */}
        <div style={{ display: 'flex', gap: 0, marginTop: 12, background: 'var(--border)', borderRadius: 10, padding: 3 }}>
          <button onClick={() => setSection('calendar')}
            style={{ flex: 1, padding: '8px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .2s', background: section === 'calendar' ? 'var(--card)' : 'transparent', color: section === 'calendar' ? 'var(--text)' : 'var(--text2)' }}>
            📅 일정
          </button>
          <button onClick={() => setSection('tasks')}
            style={{ flex: 1, padding: '8px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .2s', background: section === 'tasks' ? 'var(--card)' : 'transparent', color: section === 'tasks' ? 'var(--text)' : 'var(--text2)' }}>
            🧹 잡무 관리
          </button>
        </div>
      </div>

      {section === 'calendar' ? (
        <CalendarSection
          labId={labId}
          schedules={schedules}
          schedulesHook={schedulesHook}
          notices={notices}
          noticesHook={noticesHook}
          members={members}
          user={user}
        />
      ) : (
        <TaskSection
          labId={labId}
          schedules={schedules}
          schedulesHook={schedulesHook}
          members={members}
          user={user}
        />
      )}
    </div>
  )
}
