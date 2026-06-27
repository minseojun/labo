import React, { useState } from 'react'
import { DAYS } from '../mockData'
import { fmtDate, formatTime } from '../utils'
import { useUserTodos } from '../hooks/useFirestore'

const typeStyle = {
  lab:  { bar: 'var(--green)',  chip: 'chip-green',  label: '공용' },
  mine: { bar: 'var(--purple)', chip: 'chip-purple', label: '개인' },
  task: { bar: 'var(--yellow)', chip: 'chip-yellow', label: '잡무' },
}

export default function HomeTab({ user, schedules, supplies, notices, setActiveTab, timers = [] }) {
  const today = new Date()
  const todayStr = fmtDate(today)

  // 오늘 일정 (잡무 포함) — 시간 있는 것 먼저, 없는 것 뒤
  const todayItems = schedules
    .filter(s => s.date === todayStr)
    .sort((a, b) => {
      if (a.time && !b.time) return -1
      if (!a.time && b.time) return 1
      return (a.time || '').localeCompare(b.time || '')
    })

  // 내 예정 잡무 (오늘 이후, 나에게 할당)
  const upcomingMyTasks = schedules
    .filter(s => s.type === 'task' && s.assignee === user.name && s.date > todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3)

  const redSupplies    = supplies.filter(s => s.status === 'red')
  const yellowSupplies = supplies.filter(s => s.status === 'yellow')

  const { todos, add, toggle, remove } = useUserTodos(user.id)
  const [newTodo, setNewTodo] = useState('')

  // 완료된 할 일은 오늘 완료한 것만 보여줌
  const visibleTodos = todos.filter(t => !t.done || t.doneDate === todayStr)
  const doneTodos = visibleTodos.filter(t => t.done).length

  const addTodo = async () => {
    if (!newTodo.trim()) return
    await add(newTodo)
    setNewTodo('')
  }

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
      {redSupplies.length > 0 && (
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

      {/* 빠른 현황 카드 */}
      <div style={{ display: 'flex', gap: 10, padding: '16px 16px 0', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {[
          {
            icon: '📅', label: '오늘 일정', value: todayItems.length,
            sub: todayItems.length > 0 ? (todayItems[0].time ? `${todayItems[0].time} 시작` : todayItems[0].name?.slice(0, 6)) : '없음',
            color: 'var(--green)', tab: 'schedule',
          },
          {
            icon: '🧹', label: '내 잡무', value: upcomingMyTasks.length,
            sub: upcomingMyTasks.length > 0 ? dday(upcomingMyTasks[0].date)?.label || '' : '없음',
            color: 'var(--yellow)', tab: 'schedule',
          },
          {
            icon: '📦', label: '재고 주의', value: redSupplies.length + yellowSupplies.length,
            sub: redSupplies.length > 0 ? `없음 ${redSupplies.length}개` : '정상',
            color: redSupplies.length > 0 ? 'var(--red)' : 'var(--yellow)', tab: 'supplies',
          },
        ].map(c => (
          <div key={c.label} onClick={() => setActiveTab(c.tab)} style={{
            flexShrink: 0, width: 112,
            background: 'var(--card)', borderRadius: 16,
            padding: '13px 14px', cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
            transition: 'transform .15s',
          }}
            onTouchStart={e => e.currentTarget.style.transform = 'scale(.97)'}
            onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <div style={{ fontSize: 22, marginBottom: 7 }}>{c.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: c.color, lineHeight: 1, letterSpacing: -1 }}>{c.value}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>{c.label}</div>
            <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 2 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* 오늘 일정 + 내 잡무 통합 섹션 */}
      <div style={{ margin: '20px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: -.3 }}>오늘</span>
          <button onClick={() => setActiveTab('schedule')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--green)', fontWeight: 600, padding: 0 }}>
            전체 보기 ›
          </button>
        </div>

        <div style={{ background: 'var(--card)', borderRadius: 16, boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          {todayItems.length === 0 && upcomingMyTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text2)' }}>
              <div style={{ fontSize: 30, marginBottom: 8 }}>☀️</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>오늘은 여유로운 하루예요</div>
            </div>
          ) : (
            <>
              {/* 오늘 항목 */}
              {todayItems.map((s, i) => {
                const ts = typeStyle[s.type] || typeStyle.lab
                return (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    borderBottom: (i < todayItems.length - 1 || upcomingMyTasks.length > 0) ? '1px solid var(--border)' : 'none',
                  }}>
                    <div style={{ width: 4, height: 36, borderRadius: 2, flexShrink: 0, background: ts.bar }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
                        {s.time ? `${s.time} · ` : ''}{s.assignee}
                      </div>
                    </div>
                    <span className={`chip ${ts.chip}`} style={{ fontSize: 10, flexShrink: 0 }}>{ts.label}</span>
                  </div>
                )
              })}

              {/* 예정된 내 잡무 구분선 */}
              {upcomingMyTasks.length > 0 && (
                <>
                  {todayItems.length > 0 && (
                    <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)' }}>
                      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                      <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, whiteSpace: 'nowrap' }}>예정된 잡무</span>
                      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    </div>
                  )}
                  {upcomingMyTasks.map((task, i) => {
                    const dd = dday(task.date)
                    return (
                      <div key={task.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 16px',
                        borderBottom: i < upcomingMyTasks.length - 1 ? '1px solid var(--border)' : 'none',
                      }}>
                        <div style={{ width: 4, height: 36, borderRadius: 2, flexShrink: 0, background: 'var(--yellow)' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{task.date}</div>
                        </div>
                        {dd && <span style={{ fontSize: 11, fontWeight: 700, color: dd.color, flexShrink: 0 }}>{dd.label}</span>}
                      </div>
                    )
                  })}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* 실행 중 타이머 */}
      {timers.filter(t => t.running || t.done).length > 0 && (
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

      {/* 할 일 */}
      <div style={{ margin: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: -.3 }}>할 일</span>
          {visibleTodos.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text2)' }}>{doneTodos}/{visibleTodos.length} 완료</span>
          )}
        </div>

        {visibleTodos.length > 0 && (
          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: 'linear-gradient(90deg, var(--green-mid), var(--green))',
              width: `${(doneTodos / visibleTodos.length) * 100}%`, transition: 'width .35s ease',
            }} />
          </div>
        )}

        <div style={{ background: 'var(--card)', borderRadius: 16, boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          {visibleTodos.length === 0 && (
            <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text2)', fontSize: 13 }}>
              할 일을 추가해보세요
            </div>
          )}
          {visibleTodos.map((t, i) => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px',
              borderBottom: i < visibleTodos.length - 1 ? '1px solid var(--border)' : 'none',
              background: t.done ? 'var(--bg)' : 'var(--card)',
              transition: 'background .2s',
            }}>
              <div className={`todo-check${t.done ? ' done' : ''}`} onClick={() => toggle(t.id, !t.done)}>
                {t.done && <svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>}
              </div>
              <span style={{
                flex: 1, fontSize: 13,
                textDecoration: t.done ? 'line-through' : 'none',
                color: t.done ? 'var(--text2)' : 'var(--text)',
              }}>{t.text}</span>
              <button onClick={() => remove(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 18, padding: '0 2px', lineHeight: 1 }}>×</button>
            </div>
          ))}
          <div style={{ display: 'flex', borderTop: visibleTodos.length > 0 ? '1px solid var(--border)' : 'none' }}>
            <input
              className="form-input"
              style={{ flex: 1, padding: '12px 14px', fontSize: 13, border: 'none', background: 'transparent', borderRadius: 0, boxShadow: 'none' }}
              value={newTodo} onChange={e => setNewTodo(e.target.value)}
              placeholder="+ 할 일 추가..."
              onKeyDown={e => e.key === 'Enter' && addTodo()}
            />
            {newTodo.trim() && (
              <button onClick={addTodo} style={{ padding: '0 16px', background: 'var(--green)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>추가</button>
            )}
          </div>
        </div>
      </div>

      {/* 최근 공지 */}
      {shownNotices.length > 0 && (
        <div style={{ margin: '16px 16px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: -.3 }}>공지</span>
            <button onClick={() => setActiveTab('schedule')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--green)', fontWeight: 600, padding: 0 }}>전체 보기 ›</button>
          </div>
          <div style={{ background: 'var(--card)', borderRadius: 16, boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
            {shownNotices.map((n, i) => (
              <div key={n.id} style={{
                padding: '13px 14px',
                borderBottom: i < shownNotices.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                {n.pinned && <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 700, marginBottom: 3 }}>📌 고정</div>}
                <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.5 }}>{n.body}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 5 }}>{n.author}</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
