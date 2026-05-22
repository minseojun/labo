import React, { useState, useEffect, useMemo } from 'react'
import { DAYS } from '../mockData'
import { fmtDate, getWeekDates, memberColor, generateTaskDates } from '../utils'
import { useMembers } from '../hooks/useFirestore'
import { updateDoc, doc, addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'

// ===== 토스트 =====
function Toast({ message, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return () => clearTimeout(t) }, [])
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

// ===== 공지 댓글 =====
function NoticeComments({ labId, noticeId, user }) {
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open || !labId || !noticeId) return
    const q = query(collection(db, 'labs', labId, 'notices', noticeId, 'comments'), orderBy('createdAt', 'asc'))
    const unsub = onSnapshot(q, snap => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    return unsub
  }, [open, labId, noticeId])

  const addComment = async () => {
    if (!text.trim()) return
    await addDoc(collection(db, 'labs', labId, 'notices', noticeId, 'comments'), {
      author: user.name, avatar: user.avatar || '', role: user.role, text, createdAt: serverTimestamp()
    })
    setText('')
  }

  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setOpen(p => !p)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text2)', padding: '2px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
        💬 댓글 {open ? '접기' : '보기'}
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          {comments.length === 0 && <div style={{ fontSize: 12, color: 'var(--text2)', padding: '6px 0 10px' }}>첫 댓글을 남겨보세요</div>}
          {comments.map(c => (
            <div key={c.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: c.role === '교수' ? 'var(--purple-light)' : 'var(--green-light)', color: c.role === '교수' ? 'var(--purple)' : 'var(--green)', fontSize: c.avatar ? 14 : 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{c.avatar || c.author?.slice(-1)}</div>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{c.author}</span>
                <span style={{ fontSize: 10, color: 'var(--text2)' }}>{c.role}</span>
                <span style={{ fontSize: 10, color: 'var(--text2)', marginLeft: 'auto' }}>{c.createdAt?.toDate?.()?.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) || ''}</span>
                {(c.author === user.name || user.role === '교수') && (
                  <button onClick={() => deleteDoc(doc(db, 'labs', labId, 'notices', noticeId, 'comments', c.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 13, padding: '0 2px' }}>×</button>
                )}
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: '0 10px 10px 10px', padding: '7px 10px', fontSize: 13, marginLeft: 30 }}>{c.text}</div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <input className="form-input" style={{ flex: 1, padding: '7px 10px', fontSize: 13 }} value={text} onChange={e => setText(e.target.value)} placeholder="댓글 작성..." onKeyDown={e => e.key === 'Enter' && addComment()} />
            <button onClick={addComment} style={{ padding: '7px 14px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>전송</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ===== 공지 카드 =====
function NoticeCard({ n, labId, user, noticesHook, hidden }) {
  const canAct = user.role === '교수' || n.author === user.name
  return (
    <div className="notice-card" style={{ borderColor: n.pinned ? '#f8c5c5' : 'var(--border)', opacity: hidden ? .7 : 1, background: hidden ? 'var(--bg)' : 'var(--card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {n.pinned && <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 700, background: 'var(--red-light)', padding: '2px 7px', borderRadius: 20 }}>📌 고정</span>}
        {hidden && <span style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 600, background: 'var(--border)', padding: '2px 7px', borderRadius: 20 }}>숨김</span>}
      </div>
      <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 8, color: hidden ? 'var(--text2)' : 'var(--text)' }}>{n.body}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--text2)' }}>{n.author}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {user.role === '교수' && !hidden && (
            <button onClick={() => updateDoc(doc(db, 'labs', labId, 'notices', n.id), { pinned: !n.pinned })}
              style={{ padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6, background: n.pinned ? 'var(--red-light)' : 'var(--bg)', color: n.pinned ? 'var(--red)' : 'var(--text2)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
              {n.pinned ? '📌 해제' : '📌 고정'}
            </button>
          )}
          {canAct && (
            <button onClick={() => updateDoc(doc(db, 'labs', labId, 'notices', n.id), { hidden: !hidden, pinned: false })}
              style={{ padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text2)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
              {hidden ? '↩ 복원' : '✓ 완료'}
            </button>
          )}
          {user.role === '교수' && (
            <button onClick={() => noticesHook.remove(n.id)}
              style={{ padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--red)', fontSize: 11, cursor: 'pointer' }}>🗑</button>
          )}
        </div>
      </div>
      {!hidden && <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}><NoticeComments labId={labId} noticeId={n.id} user={user} /></div>}
    </div>
  )
}

// ===== 잡무 월간 캘린더 =====
function TaskCalendar({ labId, tasks, members, user, onSelectDate, selectedDate }) {
  const [baseDate, setBaseDate] = useState(new Date())
  const today = new Date()

  // 멤버 컬러 맵
  const colorMap = useMemo(() => {
    const map = {}
    members.forEach(m => { map[m.name] = memberColor(m.name) })
    return map
  }, [members])

  // 날짜별 잡무 맵
  const tasksByDate = useMemo(() => {
    const map = {}
    tasks.forEach(task => {
      const dates = generateTaskDates(task.startDate || task.date, task.repeat, task.repeatDays)
      dates.forEach(d => {
        if (!map[d]) map[d] = []
        // 중복 방지
        if (!map[d].find(t => t.taskId === task.id)) {
          map[d].push({ taskId: task.id, name: task.name, assignee: task.assignee, color: colorMap[task.assignee] || '#999' })
        }
      })
    })
    return map
  }, [tasks, colorMap])

  const year = baseDate.getFullYear()
  const month = baseDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1
  )
  // 6행 맞추기
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div style={{ margin: '0 16px 16px' }}>
      {/* 월 네비게이션 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={() => { const d = new Date(baseDate); d.setMonth(d.getMonth() - 1); setBaseDate(d) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text2)', padding: '4px 8px' }}>‹</button>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{year}년 {month + 1}월</span>
        <button onClick={() => { const d = new Date(baseDate); d.setMonth(d.getMonth() + 1); setBaseDate(d) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text2)', padding: '4px 8px' }}>›</button>
      </div>

      {/* 요일 헤더 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, color: 'var(--text2)', fontWeight: 600, padding: '4px 0' }}>{d}</div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const ds = fmtDate(new Date(year, month, day))
          const isToday = ds === fmtDate(today)
          const isSel = ds === selectedDate
          const dots = tasksByDate[ds] || []
          // dot은 최대 3개 표시
          const shownDots = dots.slice(0, 3)

          return (
            <div key={i} onClick={() => onSelectDate(ds)} style={{
              padding: '6px 2px 4px', borderRadius: 8, cursor: 'pointer',
              background: isSel ? 'var(--green-light)' : isToday ? 'var(--card)' : 'transparent',
              border: isToday ? '1.5px solid var(--green)' : isSel ? '1.5px solid var(--green)' : '1.5px solid transparent',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              minHeight: 48
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: isToday ? 'var(--green)' : 'transparent',
                color: isToday ? '#fff' : 'var(--text)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: isToday ? 700 : 400
              }}>{day}</div>
              {/* 컬러 dot */}
              {shownDots.length > 0 && (
                <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {shownDots.map((dot, j) => (
                    <div key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: dot.color, flexShrink: 0 }} />
                  ))}
                  {dots.length > 3 && <div style={{ fontSize: 8, color: 'var(--text2)', lineHeight: '6px' }}>+{dots.length - 3}</div>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 멤버 레전드 */}
      {members.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, padding: '10px 12px', background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)' }}>
          {members.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: colorMap[m.name] || '#999', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--text2)' }}>{m.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ===== 잡무 섹션 =====
function TaskSection({ labId, tasks, schedulesHook, members, user }) {
  const [showAdd, setShowAdd] = useState(false)
  const [selectedDate, setSelectedDate] = useState(fmtDate(new Date()))
  const [form, setForm] = useState({ name: '', repeat: 'weekly', customDays: '', startDate: fmtDate(new Date()), note: '', assignee: 'auto' })
  const [toast, setToast] = useState('')

  const uniqueMembers = members.filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)

  const memberCounts = uniqueMembers.map(m => ({
    ...m, count: tasks.filter(t => t.assignee === m.name).length
  })).sort((a, b) => a.count - b.count)

  const getNextAssignee = () => memberCounts.length > 0 ? memberCounts[0].name : user.name

  // 선택된 날짜에 해당하는 잡무 (반복 주기 포함)
  const tasksOnDate = useMemo(() => {
    return tasks.filter(task => {
      const dates = generateTaskDates(task.startDate || task.date, task.repeat, task.repeatDays)
      return dates.includes(selectedDate)
    })
  }, [tasks, selectedDate])

  const addTask = async () => {
    if (!form.name.trim()) return
    const assignee = form.assignee === 'auto' ? getNextAssignee() : form.assignee
    await schedulesHook.add({
      name: form.name, type: 'task',
      date: form.startDate, startDate: form.startDate, time: '',
      assignee, repeat: form.repeat,
      repeatDays: form.repeat === 'custom' ? Number(form.customDays) : null,
      note: form.note,
    })
    setShowAdd(false)
    setForm({ name: '', repeat: 'weekly', customDays: '', startDate: fmtDate(new Date()), note: '', assignee: 'auto' })
    setToast(`✅ ${assignee}에게 배정됐어요`)
  }

  const repeatLabel = (task) => {
    if (task.repeat === 'weekly') return '매주'
    if (task.repeat === 'biweekly') return '격주'
    if (task.repeat === 'monthly') return '매월'
    if (task.repeat === 'custom') return `${task.repeatDays}일마다`
    return '1회'
  }

  return (
    <div>
      {toast && <Toast message={toast} onDone={() => setToast('')} />}

      {/* 월간 캘린더 */}
      <TaskCalendar
        labId={labId} tasks={tasks} members={uniqueMembers}
        user={user} onSelectDate={setSelectedDate} selectedDate={selectedDate}
      />

      {/* 선택한 날짜 잡무 */}
      <div style={{ padding: '0 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700 }}>
              {selectedDate === fmtDate(new Date()) ? '오늘' : selectedDate} 잡무
            </span>
            {tasksOnDate.length > 0 && <span style={{ fontSize: 11, color: 'var(--text2)', marginLeft: 6 }}>{tasksOnDate.length}개</span>}
          </div>
          <button onClick={() => setShowAdd(true)} style={{ padding: '7px 14px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            + 잡무 추가
          </button>
        </div>

        {tasksOnDate.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text2)', fontSize: 13, background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>🧹</div>
            이 날 잡무가 없어요
          </div>
        ) : tasksOnDate.map(task => (
          <div key={task.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 10, overflow: 'hidden', borderLeft: `4px solid ${memberColor(task.assignee)}` }}>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{task.name}</div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, fontWeight: 600, background: `${memberColor(task.assignee)}20`, color: memberColor(task.assignee) }}>
                  👤 {task.assignee}
                </span>
                <span style={{ fontSize: 11, background: 'var(--green-light)', color: '#1a7a52', padding: '3px 9px', borderRadius: 20, fontWeight: 600 }}>
                  🔁 {repeatLabel(task)}
                </span>
              </div>
              {task.note && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8, padding: '6px 10px', background: 'var(--bg)', borderRadius: 6 }}>{task.note}</div>}
            </div>
            <div style={{ display: 'flex', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => { schedulesHook.remove(task.id); setToast('잡무를 삭제했어요') }}
                style={{ flex: 1, padding: '9px', background: 'none', border: 'none', color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}>
                🗑 삭제
              </button>
            </div>
          </div>
        ))}

        {/* 전체 잡무 목록 */}
        {tasks.length > 0 && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .6, margin: '20px 0 10px' }}>
              전체 잡무 {tasks.length}개
            </div>
            {tasks.map(task => (
              <div key={task.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, borderLeft: `3px solid ${memberColor(task.assignee)}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{task.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
                    {task.assignee} · {repeatLabel(task)} · {task.startDate}부터
                  </div>
                </div>
                <button onClick={() => schedulesHook.remove(task.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 16 }}>×</button>
              </div>
            ))}
          </>
        )}
      </div>

      {/* 잡무 추가 시트 */}
      {showAdd && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">잡무 추가</div>
            <div className="form-group">
              <label className="form-label">잡무 이름</label>
              <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="예: 실험실 청소, 약품 주문" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">시작 날짜</label>
              <input className="form-input" type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">반복 주기</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                {[['weekly','매주','7일'], ['biweekly','격주','14일'], ['monthly','매월','30일'], ['none','1회','반복 없음']].map(([v,l,sub]) => (
                  <button key={v} onClick={() => setForm(p => ({ ...p, repeat: v }))} style={{ padding: '10px 8px', border: `2px solid ${form.repeat === v ? 'var(--green)' : 'var(--border)'}`, borderRadius: 10, background: form.repeat === v ? 'var(--green-light)' : 'var(--card)', cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: form.repeat === v ? 'var(--green)' : 'var(--text)' }}>{l}</div>
                    <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 2 }}>{sub}</div>
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setForm(p => ({ ...p, repeat: 'custom' }))} style={{ padding: '10px 14px', border: `2px solid ${form.repeat === 'custom' ? 'var(--green)' : 'var(--border)'}`, borderRadius: 10, background: form.repeat === 'custom' ? 'var(--green-light)' : 'var(--card)', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: form.repeat === 'custom' ? 'var(--green)' : 'var(--text2)', whiteSpace: 'nowrap' }}>직접 입력</button>
                {form.repeat === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                    <input className="form-input" type="number" min="1" max="365" value={form.customDays} onChange={e => setForm(p => ({ ...p, customDays: e.target.value }))} placeholder="숫자" style={{ flex: 1 }} />
                    <span style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'nowrap' }}>일마다</span>
                  </div>
                )}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">담당자</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button onClick={() => setForm(p => ({ ...p, assignee: 'auto' }))} style={{ padding: '8px 14px', border: `2px solid ${form.assignee === 'auto' ? 'var(--green)' : 'var(--border)'}`, borderRadius: 20, background: form.assignee === 'auto' ? 'var(--green-light)' : 'var(--card)', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: form.assignee === 'auto' ? 'var(--green)' : 'var(--text2)' }}>
                  🔄 자동 배정 ({getNextAssignee()})
                </button>
                {uniqueMembers.map(m => (
                  <button key={m.id} onClick={() => setForm(p => ({ ...p, assignee: m.name }))} style={{ padding: '8px 14px', border: `2px solid ${form.assignee === m.name ? memberColor(m.name) : 'var(--border)'}`, borderRadius: 20, background: form.assignee === m.name ? `${memberColor(m.name)}20` : 'var(--card)', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: form.assignee === m.name ? memberColor(m.name) : 'var(--text2)' }}>
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">메모 (선택)</label>
              <input className="form-input" value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} placeholder="주의사항, 방법 등..." />
            </div>
            <button className="btn-primary" onClick={addTask}>잡무 등록하기</button>
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
  const [showEdit, setShowEdit] = useState(null)
  const [newNotice, setNewNotice] = useState('')
  const [showHidden, setShowHidden] = useState(false)
  const [form, setForm] = useState({ name: '', date: fmtDate(today), time: '10:00', type: 'lab', assignee: '전체' })

  const uniqueMembers = members.filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)
  const weekDates = getWeekDates(baseDate)
  const nonTaskSchedules = schedules.filter(s => s.type !== 'task')
  const filtered = nonTaskSchedules.filter(s => {
    if (s.date !== selDate) return false
    if (filter === 'mine') return s.assignee === user.name || s.type === 'lab'
    return true
  }).sort((a, b) => (a.time || '').localeCompare(b.time || ''))

  const addSchedule = async () => {
    if (!form.name) return
    await schedulesHook.add(form)
    setShowAdd(false)
    setForm({ name: '', date: selDate, time: '10:00', type: 'lab', assignee: '전체' })
  }

  const saveEdit = async () => {
    if (!showEdit) return
    await schedulesHook.update(showEdit.id, {
      name: showEdit.name, date: showEdit.date,
      time: showEdit.time, type: showEdit.type, assignee: showEdit.assignee
    })
    setShowEdit(null)
  }

  const visibleNotices = notices.filter(n => !n.hidden)
  const hiddenNotices = notices.filter(n => n.hidden)
  const pinnedNotices = visibleNotices.filter(n => n.pinned)
  const normalNotices = visibleNotices.filter(n => !n.pinned)

  return (
    <div>
      <div className="week-nav">
        <button onClick={() => { const d = new Date(baseDate); d.setDate(d.getDate() - 7); setBaseDate(d) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text2)', padding: '4px 8px' }}>‹</button>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{baseDate.getFullYear()}년 {baseDate.getMonth() + 1}월</span>
        <button onClick={() => { const d = new Date(baseDate); d.setDate(d.getDate() + 7); setBaseDate(d) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text2)', padding: '4px 8px' }}>›</button>
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

      <div className="filter-row">
        {[['all', '전체'], ['mine', '내 일정']].map(([v, l]) => (
          <div key={v} className={`filter-chip${filter === v ? ' active' : ''}`} onClick={() => setFilter(v)}>{l}</div>
        ))}
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
            <button onClick={e => { e.stopPropagation(); schedulesHook.remove(s.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 16, padding: '2px 6px' }}>×</button>
          </div>
        </div>
      ))}

      {/* 공지사항 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 8px' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .6 }}>공지사항</span>
        {hiddenNotices.length > 0 && (
          <button onClick={() => setShowHidden(p => !p)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text2)', fontWeight: 600 }}>
            {showHidden ? '👁 숨김 닫기' : `🗂 숨긴 공지 ${hiddenNotices.length}개`}
          </button>
        )}
      </div>
      {visibleNotices.length === 0 && !showHidden && (
        <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text2)', fontSize: 13, margin: '0 16px', background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>공지사항이 없습니다</div>
      )}
      {[...pinnedNotices, ...normalNotices].map(n => <NoticeCard key={n.id} n={n} labId={labId} user={user} noticesHook={noticesHook} hidden={false} />)}
      {showHidden && hiddenNotices.length > 0 && (
        <div style={{ margin: '4px 16px 0' }}>
          <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600, marginBottom: 8, padding: '8px 0 4px', borderTop: '1px dashed var(--border)' }}>🗂 숨긴 공지 — {hiddenNotices.length}개</div>
          {hiddenNotices.map(n => <NoticeCard key={n.id} n={n} labId={labId} user={user} noticesHook={noticesHook} hidden={true} />)}
        </div>
      )}

      {/* 공지 작성 */}
      <div style={{ display: 'flex', gap: 8, padding: '8px 16px 24px' }}>
        <input className="form-input" value={newNotice} onChange={e => setNewNotice(e.target.value)} placeholder="공지 작성..." style={{ flex: 1 }}
          onKeyDown={async e => { if (e.key === 'Enter' && newNotice.trim()) { await noticesHook.add({ author: user.name, body: newNotice, pinned: false }); setNewNotice('') } }} />
        <button onClick={async () => { if (!newNotice.trim()) return; await noticesHook.add({ author: user.name, body: newNotice, pinned: false }); setNewNotice('') }}
          style={{ padding: '0 16px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>올리기</button>
      </div>

      <button className="fab" onClick={() => setShowAdd(true)}>＋</button>

      {/* 일정 추가 시트 */}
      {showAdd && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">일정 추가</div>
            <div className="form-group"><label className="form-label">일정 이름</label><input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="일정 이름" autoFocus /></div>
            <div className="form-group"><label className="form-label">날짜</label><input className="form-input" type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">시간</label><input className="form-input" type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} /></div>
            <div className="form-group">
              <label className="form-label">유형</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['lab','🏛 공용'], ['mine','👤 개인']].map(([v,l]) => (
                  <button key={v} onClick={() => setForm(p => ({ ...p, type: v }))} style={{ flex: 1, padding: '10px', border: `2px solid ${form.type === v ? 'var(--green)' : 'var(--border)'}`, borderRadius: 10, background: form.type === v ? 'var(--green-light)' : 'var(--card)', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: form.type === v ? 'var(--green)' : 'var(--text2)' }}>{l}</button>
                ))}
              </div>
            </div>
            <div className="form-group"><label className="form-label">담당자</label>
              <select className="form-select" value={form.assignee} onChange={e => setForm(p => ({ ...p, assignee: e.target.value }))}>
                <option value="전체">전체</option>
                {uniqueMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
            </div>
            <button className="btn-primary" onClick={addSchedule}>추가하기</button>
          </div>
        </div>
      )}

      {/* 일정 수정 시트 */}
      {showEdit && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setShowEdit(null)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">일정 수정</div>
            <div className="form-group"><label className="form-label">일정 이름</label><input className="form-input" value={showEdit.name} onChange={e => setShowEdit(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">날짜</label><input className="form-input" type="date" value={showEdit.date} onChange={e => setShowEdit(p => ({ ...p, date: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">시간</label><input className="form-input" type="time" value={showEdit.time} onChange={e => setShowEdit(p => ({ ...p, time: e.target.value }))} /></div>
            <div className="form-group">
              <label className="form-label">유형</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['lab','🏛 공용'], ['mine','👤 개인']].map(([v,l]) => (
                  <button key={v} onClick={() => setShowEdit(p => ({ ...p, type: v }))} style={{ flex: 1, padding: '10px', border: `2px solid ${showEdit.type === v ? 'var(--green)' : 'var(--border)'}`, borderRadius: 10, background: showEdit.type === v ? 'var(--green-light)' : 'var(--card)', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: showEdit.type === v ? 'var(--green)' : 'var(--text2)' }}>{l}</button>
                ))}
              </div>
            </div>
            <div className="form-group"><label className="form-label">담당자</label>
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

// ===== 메인 탭 =====
export default function ScheduleTab({ labId, schedules, schedulesHook, notices, noticesHook, user }) {
  const [section, setSection] = useState('calendar')
  const members = useMembers(labId)
  const tasks = schedules.filter(s => s.type === 'task')

  return (
    <div>
      <div className="page-header">
        <div className="page-title">일정 & 잡무</div>
        <div style={{ display: 'flex', gap: 0, marginTop: 12, background: 'var(--border)', borderRadius: 10, padding: 3 }}>
          <button onClick={() => setSection('calendar')} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .2s', background: section === 'calendar' ? 'var(--card)' : 'transparent', color: section === 'calendar' ? 'var(--text)' : 'var(--text2)' }}>📅 일정</button>
          <button onClick={() => setSection('tasks')} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .2s', background: section === 'tasks' ? 'var(--card)' : 'transparent', color: section === 'tasks' ? 'var(--text)' : 'var(--text2)', position: 'relative' }}>
            🧹 잡무
            {tasks.length > 0 && <span style={{ marginLeft: 4, background: 'var(--green)', color: '#fff', borderRadius: 10, fontSize: 10, padding: '1px 5px' }}>{tasks.length}</span>}
          </button>
        </div>
      </div>

      {section === 'calendar' ? (
        <CalendarSection labId={labId} schedules={schedules} schedulesHook={schedulesHook} notices={notices} noticesHook={noticesHook} members={members} user={user} />
      ) : (
        <TaskSection labId={labId} tasks={tasks} schedulesHook={schedulesHook} members={members} user={user} />
      )}
    </div>
  )
}
