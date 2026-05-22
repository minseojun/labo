import React, { useState, useEffect } from 'react'
import { DAYS } from '../mockData'
import { fmtDate, getWeekDates } from '../utils'
import { useMembers } from '../hooks/useFirestore'
import { updateDoc, doc, addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'

// ===== 토스트 =====
function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500)
    return () => clearTimeout(t)
  }, [])
  return (
    <div style={{
      position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
      background: '#1A1A1A', color: '#fff', padding: '10px 20px',
      borderRadius: 24, fontSize: 13, fontWeight: 500, zIndex: 999,
      whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,.2)',
      animation: 'slideUp .2s ease'
    }}>{message}</div>
  )
}

// ===== 공지 댓글 컴포넌트 =====
function NoticeComments({ labId, noticeId, user }) {
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open || !labId || !noticeId) return
    const q = query(
      collection(db, 'labs', labId, 'notices', noticeId, 'comments'),
      orderBy('createdAt', 'asc')
    )
    const unsub = onSnapshot(q, snap => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [open, labId, noticeId])

  const addComment = async () => {
    if (!text.trim()) return
    await addDoc(collection(db, 'labs', labId, 'notices', noticeId, 'comments'), {
      author: user.name,
      avatar: user.avatar || '',
      role: user.role,
      text,
      createdAt: serverTimestamp()
    })
    setText('')
  }

  const removeComment = async (cid) => {
    await deleteDoc(doc(db, 'labs', labId, 'notices', noticeId, 'comments', cid))
  }

  return (
    <div style={{ marginTop: 8 }}>
      {/* 댓글 토글 버튼 */}
      <button onClick={() => setOpen(p => !p)} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 12, color: 'var(--text2)', padding: '2px 0',
        display: 'flex', alignItems: 'center', gap: 4
      }}>
        💬 댓글 {open ? '접기' : '보기'}
      </button>

      {open && (
        <div style={{ marginTop: 10 }}>
          {comments.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text2)', padding: '6px 0 10px' }}>첫 댓글을 남겨보세요</div>
          )}
          {comments.map(c => (
            <div key={c.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: c.role === '교수' ? 'var(--purple-light)' : 'var(--green-light)',
                  color: c.role === '교수' ? 'var(--purple)' : 'var(--green)',
                  fontSize: c.avatar ? 14 : 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>{c.avatar || c.author?.slice(-1)}</div>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{c.author}</span>
                <span style={{ fontSize: 10, color: 'var(--text2)' }}>{c.role}</span>
                <span style={{ fontSize: 10, color: 'var(--text2)', marginLeft: 'auto' }}>
                  {c.createdAt?.toDate?.()?.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) || ''}
                </span>
                {(c.author === user.name || user.role === '교수') && (
                  <button onClick={() => removeComment(c.id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text2)', fontSize: 13, padding: '0 2px'
                  }}>×</button>
                )}
              </div>
              <div style={{
                background: 'var(--bg)', borderRadius: '0 10px 10px 10px',
                padding: '7px 10px', fontSize: 13, marginLeft: 30
              }}>{c.text}</div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <input className="form-input" style={{ flex: 1, padding: '7px 10px', fontSize: 13 }}
              value={text} onChange={e => setText(e.target.value)}
              placeholder="댓글 작성..."
              onKeyDown={e => e.key === 'Enter' && addComment()} />
            <button onClick={addComment} style={{
              padding: '7px 14px', background: 'var(--green)', color: '#fff',
              border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600
            }}>전송</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ===== 잡무 섹션 =====
function TaskSection({ labId, schedules, schedulesHook, members, user }) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', repeat: 'weekly', customDays: '', startDate: '', note: '' })
  const [toast, setToast] = useState('')

  const tasks = schedules.filter(s => s.type === 'task')

  // 중복 제거된 구성원
  const uniqueMembers = members.filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)

  const memberCounts = uniqueMembers.map(m => ({
    ...m,
    count: tasks.filter(t => t.assignee === m.name).length
  })).sort((a, b) => a.count - b.count)

  const maxCount = Math.max(...memberCounts.map(m => m.count), 1)

  const getNextAssignee = () => {
    if (memberCounts.length === 0) return user.name
    return memberCounts[0].name
  }

  const addTask = async () => {
    if (!form.name.trim()) return
    const assignee = getNextAssignee()
    const today = fmtDate(new Date())
    const repeatDays = form.repeat === 'custom' ? Number(form.customDays) : null
    await schedulesHook.add({
      name: form.name, type: 'task',
      date: form.startDate || today, time: '',
      assignee, repeat: form.repeat, repeatDays,
      note: form.note,
    })
    setShowAdd(false)
    setForm({ name: '', repeat: 'weekly', customDays: '', startDate: '', note: '' })
    setToast(`✅ ${assignee}에게 배정됐어요`)
  }

  const completeTask = async (task) => {
    const nextAssignee = getNextAssignee()
    if (task.repeat !== 'none') {
      const nextDate = new Date(task.date || new Date())
      if (task.repeat === 'weekly') nextDate.setDate(nextDate.getDate() + 7)
      if (task.repeat === 'biweekly') nextDate.setDate(nextDate.getDate() + 14)
      if (task.repeat === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1)
      if (task.repeat === 'custom' && task.repeatDays) nextDate.setDate(nextDate.getDate() + task.repeatDays)
      await schedulesHook.add({
        name: task.name, type: 'task',
        date: fmtDate(nextDate), time: task.time || '',
        assignee: nextAssignee, repeat: task.repeat,
        repeatDays: task.repeatDays || null, note: task.note || '',
      })
    }
    await schedulesHook.remove(task.id)
    setToast(`✅ 완료! 다음은 ${task.repeat !== 'none' ? nextAssignee : '없음'}`)
  }

  const repeatLabel = (task) => {
    if (task.repeat === 'weekly') return '매주'
    if (task.repeat === 'biweekly') return '격주'
    if (task.repeat === 'monthly') return '매월'
    if (task.repeat === 'custom') return `${task.repeatDays}일마다`
    return '1회'
  }

  // 날짜 기준 D-day
  const dday = (dateStr) => {
    if (!dateStr) return null
    const diff = Math.ceil((new Date(dateStr) - new Date().setHours(0,0,0,0)) / 86400000)
    if (diff < 0) return { label: `D+${Math.abs(diff)}`, color: 'var(--text2)' }
    if (diff === 0) return { label: 'D-Day', color: 'var(--red)' }
    return { label: `D-${diff}`, color: 'var(--green)' }
  }

  return (
    <div>
      {toast && <Toast message={toast} onDone={() => setToast('')} />}

      {/* 공정성 현황 — 가로 스크롤 카드 */}
      {memberCounts.length > 0 && (
        <>
          <div className="section-label">잡무 현황</div>
          <div style={{ display: 'flex', gap: 8, padding: '0 16px', overflowX: 'auto', marginBottom: 16, scrollbarWidth: 'none' }}>
            {memberCounts.map((m, i) => (
              <div key={m.id} style={{
                flexShrink: 0, background: 'var(--card)',
                border: `1.5px solid ${i === 0 ? 'var(--green)' : 'var(--border)'}`,
                borderRadius: 12, padding: '10px 14px', minWidth: 90, textAlign: 'center',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', margin: '0 auto 6px',
                  background: i === 0 ? 'var(--green)' : 'var(--green-light)',
                  color: i === 0 ? '#fff' : 'var(--green)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700
                }}>{m.name?.slice(-1)}</div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{m.name}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: i === 0 ? 'var(--green)' : 'var(--text)' }}>{m.count}</div>
                <div style={{ fontSize: 10, color: 'var(--text2)' }}>회</div>
                {i === 0 && <div style={{ fontSize: 9, color: 'var(--green)', fontWeight: 700, marginTop: 3 }}>다음 배정</div>}
              </div>
            ))}
          </div>
        </>
      )}

      {/* 잡무 목록 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
          잡무 목록
          {tasks.length > 0 && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text2)', fontWeight: 400 }}>{tasks.length}개</span>}
        </div>
        <button onClick={() => setShowAdd(true)} style={{
          padding: '7px 14px', background: 'var(--green)', color: '#fff',
          border: 'none', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer'
        }}>+ 잡무 추가</button>
      </div>

      {tasks.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 13, padding: '28px 16px' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🧹</div>
          <div style={{ fontWeight: 500 }}>등록된 잡무가 없습니다</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>+ 잡무 추가 버튼을 눌러보세요</div>
        </div>
      ) : tasks.map(task => {
        const dd = dday(task.date)
        return (
          <div key={task.id} style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', margin: '0 16px 10px',
            overflow: 'hidden'
          }}>
            {/* 카드 본문 */}
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 15, flex: 1 }}>{task.name}</div>
                {dd && <span style={{ fontSize: 11, fontWeight: 700, color: dd.color, flexShrink: 0 }}>{dd.label}</span>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <span style={{ fontSize: 11, background: 'var(--yellow-light)', color: '#b97b10', padding: '3px 9px', borderRadius: 20, fontWeight: 600 }}>
                  👤 {task.assignee}
                </span>
                <span style={{ fontSize: 11, background: 'var(--green-light)', color: '#1a7a52', padding: '3px 9px', borderRadius: 20, fontWeight: 600 }}>
                  🔁 {repeatLabel(task)}
                </span>
                {task.date && (
                  <span style={{ fontSize: 11, background: 'var(--bg)', color: 'var(--text2)', padding: '3px 9px', borderRadius: 20 }}>
                    {task.date}
                  </span>
                )}
              </div>
              {task.note && (
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8, padding: '6px 10px', background: 'var(--bg)', borderRadius: 6 }}>
                  {task.note}
                </div>
              )}
            </div>
            {/* 액션 버튼 — 하단 바 */}
            <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => completeTask(task)} style={{
                flex: 1, padding: '10px', background: 'none', border: 'none',
                borderRight: '1px solid var(--border)',
                color: 'var(--green)', fontWeight: 700, fontSize: 13, cursor: 'pointer'
              }}>✓ 완료</button>
              <button onClick={() => schedulesHook.remove(task.id)} style={{
                width: 56, padding: '10px', background: 'none', border: 'none',
                color: 'var(--text2)', fontSize: 13, cursor: 'pointer'
              }}>🗑</button>
            </div>
          </div>
        )
      })}

      {/* 잡무 추가 시트 */}
      {showAdd && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">잡무 추가</div>
            <div className="form-group">
              <label className="form-label">잡무 이름</label>
              <input className="form-input" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="예: 실험실 청소, 약품 주문" />
            </div>
            <div className="form-group">
              <label className="form-label">시작 날짜 (선택)</label>
              <input className="form-input" type="date" value={form.startDate}
                onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">반복 주기</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                {[['weekly','매주','7일'], ['biweekly','격주','14일'], ['monthly','매월','30일'], ['none','1회','반복 없음']].map(([v,l,sub]) => (
                  <button key={v} onClick={() => setForm(p => ({ ...p, repeat: v }))} style={{
                    padding: '10px 8px', border: `2px solid ${form.repeat === v ? 'var(--green)' : 'var(--border)'}`,
                    borderRadius: 10, background: form.repeat === v ? 'var(--green-light)' : 'var(--card)',
                    cursor: 'pointer', textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: form.repeat === v ? 'var(--green)' : 'var(--text)' }}>{l}</div>
                    <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 2 }}>{sub}</div>
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setForm(p => ({ ...p, repeat: 'custom' }))} style={{
                  padding: '10px 14px', border: `2px solid ${form.repeat === 'custom' ? 'var(--green)' : 'var(--border)'}`,
                  borderRadius: 10, background: form.repeat === 'custom' ? 'var(--green-light)' : 'var(--card)',
                  cursor: 'pointer', fontSize: 13, fontWeight: 700,
                  color: form.repeat === 'custom' ? 'var(--green)' : 'var(--text2)', whiteSpace: 'nowrap'
                }}>직접 입력</button>
                {form.repeat === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                    <input className="form-input" type="number" min="1" max="365"
                      value={form.customDays} onChange={e => setForm(p => ({ ...p, customDays: e.target.value }))}
                      placeholder="숫자" style={{ flex: 1 }} />
                    <span style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'nowrap' }}>일마다</span>
                  </div>
                )}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">메모 (선택)</label>
              <input className="form-input" value={form.note}
                onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                placeholder="주의사항, 방법 등..." />
            </div>
            <div style={{ background: 'var(--green-light)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 13, color: '#1a7a52' }}>
              👤 자동 배정: <strong>{getNextAssignee()}</strong> (가장 적게 한 구성원)
            </div>
            <button className="btn-primary" onClick={addTask}>잡무 배정하기</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ===== 일정 + 공지 섹션 =====
function CalendarSection({ labId, schedules, schedulesHook, notices, noticesHook, members, user }) {
  const today = new Date()
  const [baseDate, setBaseDate] = useState(today)
  const [selDate, setSelDate] = useState(fmtDate(today))
  const [filter, setFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [newNotice, setNewNotice] = useState('')
  const [form, setForm] = useState({ name: '', date: fmtDate(today), time: '10:00', type: 'lab', assignee: '전체' })

  const uniqueMembers = members.filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)
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

  const pinnedNotices = notices.filter(n => n.pinned)
  const normalNotices = notices.filter(n => !n.pinned)

  return (
    <div>
      {/* 주간 캘린더 */}
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

      {/* 필터 */}
      <div className="filter-row">
        {[['all', '전체'], ['mine', '내 일정'], ['task', '잡무']].map(([v, l]) => (
          <div key={v} className={`filter-chip${filter === v ? ' active' : ''}`} onClick={() => setFilter(v)}>{l}</div>
        ))}
      </div>

      {/* 일정 목록 */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text2)', fontSize: 13 }}>
          이 날 일정이 없습니다
        </div>
      ) : filtered.map(s => (
        <div key={s.id} className="sched-item">
          <div className="sched-bar" style={{ background: s.type === 'lab' ? 'var(--green)' : s.type === 'mine' ? 'var(--purple)' : 'var(--yellow)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, fontSize: 14 }}>{s.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
              {s.time && `${s.time} · `}{s.assignee}
            </div>
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

      {/* 공지사항 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 8px' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .6 }}>공지사항</span>
      </div>

      {notices.length === 0 && (
        <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text2)', fontSize: 13, margin: '0 16px', background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          공지사항이 없습니다
        </div>
      )}

      {[...pinnedNotices, ...normalNotices].map(n => (
        <div key={n.id} className="notice-card" style={{ borderColor: n.pinned ? '#f8c5c5' : 'var(--border)' }}>
          {n.pinned && <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700, marginBottom: 4 }}>📌 고정</div>}
          <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 8 }}>{n.body}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>{n.author}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {user.role === '교수' && (
                <button onClick={() => updateDoc(doc(db, 'labs', labId, 'notices', n.id), { pinned: !n.pinned })}
                  style={{ padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6, background: n.pinned ? 'var(--red-light)' : 'var(--bg)', color: n.pinned ? 'var(--red)' : 'var(--text2)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
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
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <NoticeComments labId={labId} noticeId={n.id} user={user} />
          </div>
        </div>
      ))}

      {/* 공지 작성 — compact */}
      <div style={{ display: 'flex', gap: 8, padding: '8px 16px 24px' }}>
        <input className="form-input" value={newNotice} onChange={e => setNewNotice(e.target.value)}
          placeholder="공지 작성..." style={{ flex: 1 }}
          onKeyDown={async e => {
            if (e.key === 'Enter' && newNotice.trim()) {
              await noticesHook.add({ author: user.name, body: newNotice, pinned: false })
              setNewNotice('')
            }
          }} />
        <button onClick={async () => {
          if (!newNotice.trim()) return
          await noticesHook.add({ author: user.name, body: newNotice, pinned: false })
          setNewNotice('')
        }} style={{
          padding: '0 16px', background: 'var(--green)', color: '#fff',
          border: 'none', borderRadius: 'var(--radius-sm)',
          fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap'
        }}>올리기</button>
      </div>

      {/* FAB — 일정 추가 */}
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
              <div style={{ display: 'flex', gap: 8 }}>
                {[['lab', '🏛 공용'], ['mine', '👤 개인']].map(([v, l]) => (
                  <button key={v} onClick={() => setForm(p => ({ ...p, type: v }))} style={{
                    flex: 1, padding: '10px', border: `2px solid ${form.type === v ? 'var(--green)' : 'var(--border)'}`,
                    borderRadius: 10, background: form.type === v ? 'var(--green-light)' : 'var(--card)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    color: form.type === v ? 'var(--green)' : 'var(--text2)'
                  }}>{l}</button>
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
    </div>
  )
}

// ===== 메인 탭 =====
export default function ScheduleTab({ labId, schedules, schedulesHook, notices, noticesHook, user }) {
  const [section, setSection] = useState('calendar')
  const members = useMembers(labId)

  return (
    <div>
      <div className="page-header">
        <div className="page-title">일정 & 잡무</div>
        <div style={{ display: 'flex', gap: 0, marginTop: 12, background: 'var(--border)', borderRadius: 10, padding: 3 }}>
          <button onClick={() => setSection('calendar')} style={{
            flex: 1, padding: '8px', border: 'none', borderRadius: 8,
            fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .2s',
            background: section === 'calendar' ? 'var(--card)' : 'transparent',
            color: section === 'calendar' ? 'var(--text)' : 'var(--text2)'
          }}>📅 일정</button>
          <button onClick={() => setSection('tasks')} style={{
            flex: 1, padding: '8px', border: 'none', borderRadius: 8,
            fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .2s',
            background: section === 'tasks' ? 'var(--card)' : 'transparent',
            color: section === 'tasks' ? 'var(--text)' : 'var(--text2)'
          }}>🧹 잡무</button>
        </div>
      </div>

      {section === 'calendar' ? (
        <CalendarSection labId={labId} schedules={schedules} schedulesHook={schedulesHook}
          notices={notices} noticesHook={noticesHook} members={members} user={user} />
      ) : (
        <TaskSection labId={labId} schedules={schedules} schedulesHook={schedulesHook}
          members={members} user={user} />
      )}
    </div>
  )
}
