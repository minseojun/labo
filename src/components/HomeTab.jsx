import React, { useState, useMemo, useEffect } from 'react'
import { DAYS } from '../mockData'
import { fmtDate, formatTime, computeSchedule, scheduleAssigneeOn, scheduleOccurrences } from '../utils'

const typeStyle = {
  lab:  { bar: 'var(--green)',  chip: 'chip-green',  label: '공용' },
  mine: { bar: 'var(--purple)', chip: 'chip-purple', label: '개인' },
  task: { bar: 'var(--yellow)', chip: 'chip-yellow', label: '잡무' },
}

export default function HomeTab({ user, schedules, schedulesHook, supplies, notices, setActiveTab, timers = [], disabledTabs = [] }) {
  const today = new Date()
  const todayStr = fmtDate(today)

  const [newTodo, setNewTodo] = useState('')
  const [todoDate, setTodoDate] = useState(todayStr)

  // 잡무는 하루 여러 명이 돌아가며 맡을 수 있어서, 랩 전체 잡무를 같이 봐야
  // 오늘 실제로 누구 차례인지 정확히 알 수 있음
  const taskSchedules = useMemo(() => schedules.filter(s => s.type === 'task'), [schedules])
  const schedule = useMemo(() => computeSchedule(taskSchedules), [taskSchedules])

  // "오늘 할 일" = 오늘의 공용/개인 일정 + 오늘 담당 잡무 + 아직 안 끝난 미래 개인 할 일.
  // 예전엔 이 내용이 "오늘" 섹션과 "할 일" 섹션 두 군데에 중복 표시됐음 — 하나로 합침
  const combinedItems = useMemo(() => {
    const todayPart = schedules
      .filter(s => {
        if (s.type === 'task') return scheduleAssigneeOn(schedule, s.id, todayStr) === user.name
        return s.date === todayStr
      })
      .map(s => (s.type === 'task' ? { ...s, assignee: user.name } : s))
      .map(s => ({ ...s, isToday: true }))

    const futurePart = schedules
      .filter(s => s.type === 'mine' && s.assignee === user.name && s.date > todayStr && !s.done)
      .map(s => ({ ...s, isToday: false }))

    return [...todayPart, ...futurePart].sort((a, b) => {
      if (a.isToday !== b.isToday) return a.isToday ? -1 : 1
      if (a.isToday) {
        if (a.time && !b.time) return -1
        if (!a.time && b.time) return 1
        return (a.time || '').localeCompare(b.time || '')
      }
      return a.date.localeCompare(b.date)
    })
  }, [schedules, schedule, todayStr, user.name])

  const checkableItems = combinedItems.filter(s => s.type === 'mine' && s.assignee === user.name)
  const doneCount = checkableItems.filter(t => t.done).length

  // 다음 잡무 — 디데이가 가장 가까운 것 하나만
  const nextTask = schedules
    .filter(s => s.type === 'task')
    .map(s => {
      const next = scheduleOccurrences(schedule, s.id).find(o => o.date > todayStr && o.assignee === user.name)
      return next ? { ...s, nextDate: next.date } : null
    })
    .filter(Boolean)
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate))[0] || null

  // 잡무 당번 알림 — 하루에 한 번, 오늘/내일 내 담당 잡무가 있으면 브라우저 알림으로 미리 알려줌.
  // (탭이 열려 있을 때만 동작. 앱을 완전히 닫아도 오는 진짜 푸시는 서버(FCM) 구성이 필요해서 별개)
  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const notifyKey = `labo-duty-notified-${user.id}-${todayStr}`
    if (localStorage.getItem(notifyKey)) return

    const tomorrowStr = fmtDate(new Date(today.getTime() + 86400000))
    const myToday = taskSchedules.filter(t => scheduleAssigneeOn(schedule, t.id, todayStr) === user.name)
    const myTomorrow = taskSchedules.filter(t => scheduleAssigneeOn(schedule, t.id, tomorrowStr) === user.name)
    if (myToday.length === 0 && myTomorrow.length === 0) return

    const lines = []
    if (myToday.length > 0) lines.push(`오늘: ${myToday.map(t => t.name).join(', ')}`)
    if (myTomorrow.length > 0) lines.push(`내일: ${myTomorrow.map(t => t.name).join(', ')}`)
    new Notification('🧹 잡무 당번 알림', { body: lines.join('\n') })
    localStorage.setItem(notifyKey, '1')
  }, [schedule, taskSchedules, todayStr])

  const addTodo = async () => {
    const name = newTodo.trim()
    if (!name) return
    try {
      await schedulesHook.add({ name, type: 'mine', assignee: user.name, date: todoDate, time: '', done: false })
      setNewTodo('')
      setTodoDate(todayStr)
    } catch (e) {}
  }

  const toggleTodo = async (id, done) => {
    try {
      await schedulesHook.update(id, { done: !done, doneDate: !done ? todayStr : null })
    } catch (e) {}
  }

  const removeTodo = async (id) => {
    try {
      await schedulesHook.remove(id)
    } catch (e) {}
  }

  const redSupplies = supplies.filter(s => s.status === 'red')

  const hour = today.getHours()
  const greeting = hour < 12 ? '좋은 아침이에요 ☀️' : hour < 18 ? '좋은 오후예요 🌤' : '수고했어요 🌙'

  const roleStyle = r => r === '교수'
    ? { bg: 'rgba(255,255,255,0.25)', color: '#fff' }
    : { bg: 'rgba(255,255,255,0.18)', color: '#fff' }
  const rs = roleStyle(user.role)

  const pinnedNotices = notices.filter(n => n.pinned && !n.hidden)
  const shownNotices = pinnedNotices.length > 0
    ? [...pinnedNotices, ...notices.filter(n => !n.pinned && !n.hidden)].slice(0, 2)
    : notices.filter(n => !n.hidden).slice(0, 2)

  const dday = (dateStr) => {
    if (!dateStr) return null
    const diff = Math.ceil((new Date(dateStr) - new Date().setHours(0,0,0,0)) / 86400000)
    if (diff < 0)  return { label: `D+${Math.abs(diff)}`, color: 'var(--text2)' }
    if (diff === 0) return { label: 'D-Day', color: 'var(--red)' }
    if (diff <= 3)  return { label: `D-${diff}`, color: 'var(--yellow)' }
    return { label: `D-${diff}`, color: 'var(--green)' }
  }

  const fmtShort = (dateStr) => {
    if (!dateStr) return ''
    if (dateStr === todayStr) return '오늘'
    return dateStr.replace(/^\d{4}-/, '').replace('-', '/')
  }

  return (
    <div style={{ paddingBottom: 24 }}>

      {/* 히어로 헤더 */}
      <div style={{
        background: 'linear-gradient(135deg, #2BBD83 0%, #1F9D6B 60%, #157A52 100%)',
        padding: '52px 20px 24px', color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: -20, right: 50, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0,
          }}>{user.avatar || user.name?.slice(-1)}</div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, opacity: .8, marginBottom: 3 }}>{greeting}</div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -.5 }}>{user.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', background: rs.bg, borderRadius: 20, color: rs.color }}>{user.role}</span>
              <span style={{ fontSize: 11, opacity: .7 }}>{today.getMonth() + 1}월 {today.getDate()}일 {DAYS[today.getDay()]}요일</span>
            </div>
          </div>
        </div>
      </div>

      {/* 재고 알림 */}
      {redSupplies.length > 0 && !disabledTabs.includes('supplies') && (
        <div onClick={() => setActiveTab('supplies')} style={{
          margin: '12px 16px 0', padding: '11px 14px',
          background: 'var(--red-light)', border: '1px solid #f5c0c0',
          borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
        }}>
          <span style={{ fontSize: 16 }}>🚨</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: '#c42e2e' }}>재고 없음 — 즉시 확인 필요</div>
            <div style={{ fontSize: 11, color: '#c42e2e', opacity: .8, marginTop: 1 }}>{redSupplies.map(s => s.name).join(', ')}</div>
          </div>
          <span style={{ color: '#c42e2e', fontSize: 16 }}>›</span>
        </div>
      )}

      {/* 오늘 할 일 — 오늘 일정 + 오늘 잡무 + 개인 할 일 통합 */}
      <div style={{ margin: '20px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: -.3 }}>오늘 할 일</span>
          {checkableItems.length > 0 ? (
            <span style={{ fontSize: 11, color: 'var(--text2)' }}>{doneCount}/{checkableItems.length} 완료</span>
          ) : !disabledTabs.includes('schedule') && (
            <button onClick={() => setActiveTab('schedule')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--green)', fontWeight: 600, padding: 0 }}>
              전체 보기 ›
            </button>
          )}
        </div>

        {checkableItems.length > 0 && (
          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: 'linear-gradient(90deg, var(--green-mid), var(--green))',
              width: `${(doneCount / checkableItems.length) * 100}%`, transition: 'width .35s ease',
            }} />
          </div>
        )}

        <div style={{ background: 'var(--card)', borderRadius: 16, boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          {combinedItems.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text2)' }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>☀️</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>오늘은 여유로운 하루예요</div>
            </div>
          )}
          {combinedItems.map((s, i) => {
            const ts = typeStyle[s.type] || typeStyle.lab
            const checkable = s.type === 'mine' && s.assignee === user.name
            return (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 14px',
                borderBottom: i < combinedItems.length - 1 ? '1px solid var(--border)' : 'none',
                background: s.done ? 'var(--bg)' : 'transparent',
                transition: 'background .2s',
              }}>
                {checkable ? (
                  <div className={`todo-check${s.done ? ' done' : ''}`} onClick={() => toggleTodo(s.id, s.done)}>
                    {s.done && <svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>}
                  </div>
                ) : (
                  <div style={{ width: 4, height: 36, borderRadius: 2, flexShrink: 0, background: ts.bar, opacity: s.done ? .4 : 1 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    textDecoration: s.done ? 'line-through' : 'none',
                    color: s.done ? 'var(--text2)' : 'var(--text)',
                  }}>{s.name}</div>
                  {s.isToday && (
                    <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
                      {s.time ? `${s.time} · ` : ''}{s.assignee}
                    </div>
                  )}
                </div>
                {s.isToday ? (
                  <span className={`chip ${ts.chip}`} style={{ fontSize: 10, flexShrink: 0, opacity: s.done ? .5 : 1 }}>{ts.label}</span>
                ) : (
                  <span style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>{fmtShort(s.date)}</span>
                )}
                {checkable && (
                  <button onClick={() => removeTodo(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 18, padding: '0 2px', lineHeight: 1 }}>×</button>
                )}
              </div>
            )
          })}
          <div style={{ borderTop: combinedItems.length > 0 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '4px 14px 4px 4px', gap: 8 }}>
              <input
                className="form-input"
                style={{ flex: 1, padding: '10px 10px', fontSize: 13, border: 'none', background: 'transparent', borderRadius: 0, boxShadow: 'none' }}
                value={newTodo} onChange={e => setNewTodo(e.target.value)}
                placeholder="+ 할 일 추가..."
                onKeyDown={e => e.key === 'Enter' && addTodo()}
              />
              <input
                type="date"
                value={todoDate}
                onChange={e => setTodoDate(e.target.value)}
                style={{ fontSize: 11, color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 6px', background: 'var(--bg)', cursor: 'pointer', flexShrink: 0 }}
              />
            </div>
            {newTodo.trim() && (
              <div style={{ padding: '0 14px 10px' }}>
                <button onClick={addTodo} style={{ width: '100%', padding: '8px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>추가</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 다음 잡무 — 디데이 가장 가까운 것 하나만 */}
      {nextTask && !disabledTabs.includes('schedule') && (
        <div style={{ margin: '16px 16px 0' }}>
          <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: -.3, marginBottom: 10 }}>다음 잡무</div>
          <div onClick={() => setActiveTab('schedule')} style={{
            background: 'var(--card)', borderRadius: 16, boxShadow: 'var(--shadow-sm)',
            padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
          }}>
            <div style={{ width: 4, height: 36, borderRadius: 2, flexShrink: 0, background: 'var(--yellow)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nextTask.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{nextTask.nextDate}</div>
            </div>
            {dday(nextTask.nextDate) && (
              <span style={{ fontSize: 11, fontWeight: 700, color: dday(nextTask.nextDate).color, flexShrink: 0 }}>{dday(nextTask.nextDate).label}</span>
            )}
          </div>
        </div>
      )}

      {/* 실행 중 타이머 */}
      {timers.filter(t => t.running || t.done).length > 0 && !disabledTabs.includes('timer') && (
        <div style={{ margin: '16px 16px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: -.3 }}>실행 중 타이머</span>
            <button onClick={() => setActiveTab('timer')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--green)', fontWeight: 600, padding: 0 }}>전체 보기 ›</button>
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {timers.filter(t => t.running || t.done).map(t => (
              <div key={t.id} onClick={() => setActiveTab('timer')} style={{
                flexShrink: 0, width: 130,
                background: 'var(--card)', borderRadius: 14,
                border: `2px solid ${t.done ? 'var(--red)' : 'var(--green)'}`,
                padding: '12px 14px', cursor: 'pointer',
                boxShadow: 'var(--shadow-xs)',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.done ? 'var(--red)' : 'var(--green)', marginBottom: 4 }}>
                  {t.done ? '✅ 완료' : '⏱ 실행중'}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>{t.name}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: t.done ? 'var(--red)' : 'var(--green)', letterSpacing: -1 }}>
                  {formatTime(t.timeLeft)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 최근 공지 */}
      {shownNotices.length > 0 && (
        <div style={{ margin: '16px 16px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: -.3 }}>공지</span>
            {!disabledTabs.includes('schedule') && (
              <button onClick={() => setActiveTab('schedule')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--green)', fontWeight: 600, padding: 0 }}>전체 보기 ›</button>
            )}
          </div>
          <div style={{ background: 'var(--card)', borderRadius: 16, boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            {shownNotices.map((n, i) => (
              <div key={n.id} style={{
                padding: '13px 14px',
                borderBottom: i < shownNotices.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                {n.pinned && <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 700, marginBottom: 3 }}>📌 고정</div>}
                <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.5 }}>{n.body}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 5, display: 'flex', gap: 6 }}>
                  <span>{n.author}</span>
                  {n.date && <span>· {n.date.replace(/^\d{4}-/, '').replace('-', '/')}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
