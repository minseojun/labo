import React, { useState } from 'react'
import { DAYS } from '../mockData'
import { fmtDate, formatTime } from '../utils'
import { useUserTodos } from '../hooks/useFirestore'

export default function HomeTab({ user, schedules, supplies, notices, setActiveTab, timers = [] }) {
  const today = new Date()
  const todayStr = fmtDate(today)
  const todayScheds = schedules
    .filter(s => s.date === todayStr)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  const myTasks = schedules.filter(s => s.type === 'task' && s.assignee === user.name)
  const upcomingTasks = [...myTasks].sort((a, b) => (a.date || '').localeCompare(b.date || '')).slice(0, 2)
  const redSupplies = supplies.filter(s => s.status === 'red')
  const yellowSupplies = supplies.filter(s => s.status === 'yellow')

  const { todos, add, toggle, remove } = useUserTodos(user.id)
  const [newTodo, setNewTodo] = useState('')
  const doneTodos = todos.filter(t => t.done).length

  const addTodo = async () => {
    if (!newTodo.trim()) return
    await add(newTodo)
    setNewTodo('')
  }

  // 시간대별 인사말
  const hour = today.getHours()
  const greeting = hour < 12 ? '좋은 아침이에요 ☀️' : hour < 18 ? '좋은 오후예요 🌤' : '수고했어요 🌙'

  // 역할 색상
  const roleStyle = r => r === '교수'
    ? { bg: 'rgba(255,255,255,0.25)', color: '#fff' }
    : r === '대학원생'
    ? { bg: 'rgba(255,255,255,0.2)', color: '#fff' }
    : { bg: 'rgba(255,255,255,0.18)', color: '#fff' }

  const rs = roleStyle(user.role)

  // 공지 (고정 우선, 최대 2개)
  const pinnedNotices = notices.filter(n => n.pinned)
  const shownNotices = pinnedNotices.length > 0
    ? [...pinnedNotices, ...notices.filter(n => !n.pinned)].slice(0, 2)
    : notices.slice(0, 2)

  // D-day 계산
  const dday = (dateStr) => {
    if (!dateStr) return null
    const diff = Math.ceil((new Date(dateStr) - new Date().setHours(0,0,0,0)) / 86400000)
    if (diff < 0) return { label: `D+${Math.abs(diff)}`, color: 'var(--text2)' }
    if (diff === 0) return { label: 'D-Day', color: 'var(--red)' }
    if (diff <= 3) return { label: `D-${diff}`, color: 'var(--yellow)' }
    return { label: `D-${diff}`, color: 'var(--green)' }
  }

  return (
    <div style={{ paddingBottom: 24 }}>

      {/* ① 히어로 헤더 */}
      <div style={{
        margin: '0 0 0',
        background: 'linear-gradient(135deg, #2D9B6F 0%, #1e7a55 100%)',
        padding: '52px 20px 24px',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* 배경 장식 */}
        <div style={{
          position: 'absolute', top: -30, right: -30,
          width: 140, height: 140, borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)'
        }} />
        <div style={{
          position: 'absolute', bottom: -20, right: 40,
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)'
        }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
          {/* 아바타 */}
          <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            border: '2px solid rgba(255,255,255,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, flexShrink: 0
          }}>{user.avatar || user.name?.slice(-1)}</div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, opacity: .8, marginBottom: 3 }}>{greeting}</div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -.3 }}>{user.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 9px',
                background: rs.bg, borderRadius: 20, color: rs.color
              }}>{user.role}</span>
              <span style={{ fontSize: 11, opacity: .7 }}>
                {today.getMonth() + 1}월 {today.getDate()}일 {DAYS[today.getDay()]}요일
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 재고 알림 배너 */}
      {redSupplies.length > 0 && (
        <div onClick={() => setActiveTab('supplies')} style={{
          margin: '12px 16px 0',
          padding: '11px 14px',
          background: 'var(--red-light)', border: '1px solid #f8c5c5',
          borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer'
        }}>
          <span style={{ fontSize: 16 }}>🚨</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 12, color: '#c23b3b' }}>재고 없음 — 즉시 확인 필요</div>
            <div style={{ fontSize: 11, color: '#c23b3b', opacity: .8, marginTop: 1 }}>{redSupplies.map(s => s.name).join(', ')}</div>
          </div>
          <span style={{ color: '#c23b3b' }}>›</span>
        </div>
      )}

      {/* ② 빠른 현황 카드 (가로 스크롤) */}
      <div style={{ display: 'flex', gap: 10, padding: '16px 16px 0', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {[
          {
            icon: '📅', label: '오늘 일정', value: todayScheds.length,
            sub: todayScheds.length > 0 ? `다음: ${todayScheds[0]?.time || ''}` : '일정 없음',
            color: 'var(--green)', bg: 'var(--green-light)', tab: 'schedule'
          },
          {
            icon: '🧹', label: '내 잡무', value: myTasks.length,
            sub: myTasks.length > 0 ? `${upcomingTasks[0]?.name?.slice(0, 8)}...` : '없음',
            color: 'var(--yellow)', bg: 'var(--yellow-light)', tab: 'schedule'
          },
          {
            icon: '📦', label: '재고 주의', value: redSupplies.length + yellowSupplies.length,
            sub: redSupplies.length > 0 ? `없음 ${redSupplies.length}개` : '정상',
            color: redSupplies.length > 0 ? 'var(--red)' : 'var(--yellow)',
            bg: redSupplies.length > 0 ? 'var(--red-light)' : 'var(--yellow-light)', tab: 'supplies'
          },
        ].map(c => (
          <div key={c.label} onClick={() => setActiveTab(c.tab)} style={{
            flexShrink: 0, width: 110,
            background: 'var(--card)', border: `1.5px solid ${c.bg}`,
            borderRadius: 14, padding: '12px 14px', cursor: 'pointer',
            transition: 'transform .15s',
          }}
            onTouchStart={e => e.currentTarget.style.transform = 'scale(.97)'}
            onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <div style={{ fontSize: 22, marginBottom: 6 }}>{c.icon}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: c.color, lineHeight: 1 }}>{c.value}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginTop: 3 }}>{c.label}</div>
            <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 2 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ③ 오늘 일정 타임라인 */}
      <div style={{ margin: '20px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>오늘 일정</span>
          <button onClick={() => setActiveTab('schedule')} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, color: 'var(--green)', fontWeight: 600, padding: 0
          }}>전체 보기 ›</button>
        </div>

        <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {todayScheds.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 16px', color: 'var(--text2)' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>☀️</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>오늘은 여유로운 하루예요</div>
            </div>
          ) : todayScheds.map((s, i) => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px',
              borderBottom: i < todayScheds.length - 1 ? '1px solid var(--border)' : 'none'
            }}>
              <div style={{
                width: 4, height: 36, borderRadius: 2, flexShrink: 0,
                background: s.type === 'lab' ? 'var(--green)' : s.type === 'mine' ? 'var(--purple)' : 'var(--yellow)'
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
                  {s.time && `${s.time} · `}{s.assignee}
                </div>
              </div>
              {s.type === 'task' && <span className="chip chip-yellow" style={{ fontSize: 10 }}>잡무</span>}
              {s.type === 'mine' && <span className="chip chip-purple" style={{ fontSize: 10 }}>개인</span>}
              {s.type === 'lab' && <span className="chip chip-green" style={{ fontSize: 10 }}>공용</span>}
            </div>
          ))}
        </div>
      </div>

      {/* ④ 내 잡무 (있을 때만) */}
      {upcomingTasks.length > 0 && (
        <div style={{ margin: '16px 16px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>내 잡무</span>
            <button onClick={() => setActiveTab('schedule')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: 'var(--green)', fontWeight: 600, padding: 0
            }}>전체 보기 ›</button>
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {upcomingTasks.map(task => {
              const dd = dday(task.date)
              return (
                <div key={task.id} style={{
                  flexShrink: 0, width: 160,
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '12px 14px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <span style={{ fontSize: 18 }}>🧹</span>
                    {dd && <span style={{ fontSize: 10, fontWeight: 700, color: dd.color }}>{dd.label}</span>}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>{task.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text2)' }}>{task.date}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ④-2 실행 중 타이머 */}
      {timers.filter(t => t.running || t.done).length > 0 && (
        <div style={{ margin: '16px 16px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>실행 중 타이머</span>
            <button onClick={() => setActiveTab('timer')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--green)', fontWeight: 600, padding: 0 }}>전체 보기 ›</button>
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {timers.filter(t => t.running || t.done).map(t => (
              <div key={t.id} onClick={() => setActiveTab('timer')} style={{
                flexShrink: 0, width: 130, background: 'var(--card)',
                border: `1.5px solid ${t.done ? 'var(--red)' : 'var(--green)'}`,
                borderRadius: 12, padding: '12px 14px', cursor: 'pointer'
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: t.done ? 'var(--red)' : 'var(--green)', marginBottom: 4 }}>
                  {t.done ? '✅ 완료' : '⏱ 실행중'}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, lineHeight: 1.3 }}>{t.name}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: t.done ? 'var(--red)' : 'var(--green)' }}>
                  {formatTime(t.timeLeft)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ⑤ 할 일 체크리스트 */}
      <div style={{ margin: '16px 16px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>할 일</span>
          {todos.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text2)' }}>{doneTodos}/{todos.length} 완료</span>
          )}
        </div>

        {/* 진행 바 */}
        {todos.length > 0 && (
          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2, background: 'var(--green)',
              width: `${(doneTodos / todos.length) * 100}%`, transition: 'width .3s ease'
            }} />
          </div>
        )}

        <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {todos.length === 0 && (
            <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text2)', fontSize: 13 }}>
              할 일을 추가해보세요
            </div>
          )}
          {todos.map((t, i) => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 14px',
              borderBottom: i < todos.length - 1 ? '1px solid var(--border)' : 'none',
              background: t.done ? 'var(--bg)' : 'var(--card)',
              transition: 'background .2s'
            }}>
              <div className={`todo-check${t.done ? ' done' : ''}`} onClick={() => toggle(t.id, !t.done)}>
                {t.done && <svg width="10" height="8" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>}
              </div>
              <span style={{
                flex: 1, fontSize: 13,
                textDecoration: t.done ? 'line-through' : 'none',
                color: t.done ? 'var(--text2)' : 'var(--text)'
              }}>{t.text}</span>
              <button onClick={() => remove(t.id)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--border)', fontSize: 16, padding: '0 2px',
                lineHeight: 1
              }}>×</button>
            </div>
          ))}
          {/* 인라인 입력 */}
          <div style={{ display: 'flex', gap: 0, borderTop: todos.length > 0 ? '1px solid var(--border)' : 'none' }}>
            <input
              className="form-input"
              style={{ flex: 1, padding: '11px 14px', fontSize: 13, border: 'none', background: 'transparent', borderRadius: 0 }}
              value={newTodo} onChange={e => setNewTodo(e.target.value)}
              placeholder="+ 할 일 추가..."
              onKeyDown={e => e.key === 'Enter' && addTodo()}
            />
            {newTodo.trim() && (
              <button onClick={addTodo} style={{
                padding: '0 16px', background: 'var(--green)', color: '#fff',
                border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600
              }}>추가</button>
            )}
          </div>
        </div>
      </div>

      {/* ⑥ 최근 공지 */}
      {shownNotices.length > 0 && (
        <div style={{ margin: '16px 16px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>최근 공지</span>
            <button onClick={() => setActiveTab('schedule')} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: 'var(--green)', fontWeight: 600, padding: 0
            }}>전체 보기 ›</button>
          </div>
          <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
            {shownNotices.map((n, i) => (
              <div key={n.id} style={{
                padding: '12px 14px',
                borderBottom: i < shownNotices.length - 1 ? '1px solid var(--border)' : 'none'
              }}>
                {n.pinned && <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 700, marginRight: 6 }}>📌</span>}
                <span style={{ fontSize: 13, fontWeight: 500 }}>{n.body}</span>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>{n.author}</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
