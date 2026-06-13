import React, { useState, useMemo } from 'react'
import { fmtDate, memberColor, generateTaskDates } from '../../utils'
import { toast } from '../../utils/toast'
import TaskCalendar from './TaskCalendar'

function repeatLabel(task) {
  if (task.repeat === 'weekly') return '매주'
  if (task.repeat === 'biweekly') return '격주'
  if (task.repeat === 'monthly') return '매월'
  if (task.repeat === 'custom') return `${task.repeatDays}일마다`
  return '1회'
}

const initial = name => name?.trim().slice(-1) || '?'

// 구성원별 잡무 분담 현황 — 공정한 분배를 한눈에
function WorkloadPanel({ rows, total, nextAssignee }) {
  const max = Math.max(1, ...rows.map(r => r.count))
  return (
    <div className="wl-card">
      <div className="wl-top">
        <span className="wl-title">잡무 분담 현황</span>
        <span className="wl-meta">담당 잡무 {total}개</span>
      </div>
      {rows.map(m => (
        <div className="wl-row" key={m.id}>
          <span className="wl-dot" style={{ background: memberColor(m.name) }} />
          <span className="wl-name">{m.name}</span>
          <div className="wl-track">
            <div className="wl-fill" style={{ width: `${(m.count / max) * 100}%`, background: memberColor(m.name) }} />
          </div>
          <span className="wl-count">{m.count}</span>
        </div>
      ))}
      {nextAssignee && (
        <div className="wl-next">
          <span>자동 배정 시 다음 담당</span>
          <b>{nextAssignee}</b>
        </div>
      )}
    </div>
  )
}

export default function TaskSection({ labId, tasks, schedulesHook, members, user }) {
  const [showAdd, setShowAdd] = useState(false)
  const [selectedDate, setSelectedDate] = useState(fmtDate(new Date()))
  const [form, setForm] = useState({ name: '', repeat: 'weekly', customDays: '', startDate: fmtDate(new Date()), note: '', assignee: 'auto' })

  const uniqueMembers = members.filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)

  const memberCounts = uniqueMembers.map(m => ({
    ...m, count: tasks.filter(t => t.assignee === m.name).length
  })).sort((a, b) => a.count - b.count)

  const getNextAssignee = () => memberCounts.length > 0 ? memberCounts[0].name : user.name

  // 분담 현황은 부담 큰 순으로 보여줘서 불균형이 바로 보이게
  const workloadRows = [...memberCounts].sort((a, b) => b.count - a.count)

  const tasksOnDate = useMemo(() => {
    return tasks.filter(task => {
      const dates = generateTaskDates(task.startDate || task.date, task.repeat, task.repeatDays)
      return dates.includes(selectedDate)
    })
  }, [tasks, selectedDate])

  const isToday = selectedDate === fmtDate(new Date())
  const dateLabel = isToday ? '오늘' : selectedDate.replace(/^\d{4}-/, '').replace('-', '. ')

  const addTask = async () => {
    const name = form.name.trim()
    if (!name) { toast.error('잡무 이름을 입력해주세요.'); return }
    if (name.length > 100) { toast.error('이름은 100자 이내로 입력해주세요.'); return }
    if (form.repeat === 'custom' && (!form.customDays || Number(form.customDays) < 1)) {
      toast.error('반복 일수를 입력해주세요.'); return
    }
    const assignee = form.assignee === 'auto' ? getNextAssignee() : form.assignee
    try {
      await schedulesHook.add({
        name, type: 'task',
        date: form.startDate, startDate: form.startDate, time: '',
        assignee, repeat: form.repeat,
        repeatDays: form.repeat === 'custom' ? Number(form.customDays) : null,
        note: form.note.trim(),
      })
      setShowAdd(false)
      setForm({ name: '', repeat: 'weekly', customDays: '', startDate: fmtDate(new Date()), note: '', assignee: 'auto' })
      toast.success(`${assignee} 담당으로 배정됐어요`)
    } catch (e) {
      // error shown by hook
    }
  }

  const deleteTask = async (task) => {
    if (!window.confirm(`"${task.name}" 잡무를 삭제하시겠습니까?`)) return
    try {
      await schedulesHook.remove(task.id)
      toast.success('잡무를 삭제했어요')
    } catch (e) {
      // error shown by hook
    }
  }

  return (
    <div style={{ paddingBottom: 8 }}>
      {uniqueMembers.length > 0 && tasks.length > 0 && (
        <WorkloadPanel rows={workloadRows} total={tasks.length} nextAssignee={getNextAssignee()} />
      )}

      <TaskCalendar
        tasks={tasks} members={uniqueMembers}
        onSelectDate={setSelectedDate} selectedDate={selectedDate}
      />

      <div className="tsk-section">
        <div className="tsk-head">
          <div>
            <div className="tsk-h">{dateLabel} 잡무</div>
            <div className="tsk-sub">
              {tasksOnDate.length > 0 ? `${tasksOnDate.length}개 예정` : '예정된 잡무 없음'}
            </div>
          </div>
          <button className="tsk-add" onClick={() => setShowAdd(true)}>＋ 잡무 추가</button>
        </div>

        {tasksOnDate.length === 0 ? (
          <div className="tsk-empty">
            <div className="tsk-empty-emoji">🧹</div>
            <div className="tsk-empty-text">이 날은 배정된 잡무가 없어요</div>
          </div>
        ) : tasksOnDate.map(task => {
          const color = memberColor(task.assignee)
          return (
            <div key={task.id} className="tsk-card" style={{ '--accent': color }}>
              <div className="tsk-avatar" style={{ background: `${color}1A`, color }}>{initial(task.assignee)}</div>
              <div className="tsk-body">
                <div className="tsk-name">{task.name}</div>
                <div className="tsk-metarow">
                  <span className="tsk-strong" style={{ color }}>{task.assignee}</span>
                  <span className="tsk-sep" />
                  <span>{repeatLabel(task)}</span>
                </div>
                {task.note && <div className="tsk-note">{task.note}</div>}
              </div>
              <button className="tsk-del" onClick={() => deleteTask(task)} aria-label="삭제">✕</button>
            </div>
          )
        })}

        {tasks.length > 0 && (
          <>
            <div className="tsk-all-label">전체 잡무 {tasks.length}개</div>
            {tasks.map(task => {
              const color = memberColor(task.assignee)
              return (
                <div key={task.id} className="tsk-row">
                  <span className="tsk-row-bar" style={{ background: color }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="tsk-row-name">{task.name}</div>
                    <div className="tsk-row-meta">
                      {task.assignee} · {repeatLabel(task)} · {task.startDate}부터
                    </div>
                  </div>
                  <button className="tsk-del" onClick={() => deleteTask(task)} aria-label="삭제">✕</button>
                </div>
              )
            })}
          </>
        )}
      </div>

      {showAdd && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">잡무 추가</div>
            <div className="form-group">
              <label className="form-label">잡무 이름</label>
              <input className="form-input" value={form.name} maxLength={100}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="예: 실험실 청소, 약품 주문" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">시작 날짜</label>
              <input className="form-input" type="date" value={form.startDate}
                onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">반복 주기</label>
              <div className="opt-grid" style={{ marginBottom: 8 }}>
                {[['weekly','매주','7일 간격'], ['biweekly','격주','14일 간격'], ['monthly','매월','30일 간격'], ['none','1회','반복 없음']].map(([v,l,sub]) => (
                  <button key={v} className={`opt-card${form.repeat === v ? ' on' : ''}`} onClick={() => setForm(p => ({ ...p, repeat: v }))}>
                    <div className="opt-card-t" style={{ color: form.repeat === v ? 'var(--green)' : 'var(--text)' }}>{l}</div>
                    <div className="opt-card-s">{sub}</div>
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className={`opt-pill${form.repeat === 'custom' ? ' on' : ''}`}
                  style={{ whiteSpace: 'nowrap', borderColor: form.repeat === 'custom' ? 'var(--green)' : 'var(--border)', background: form.repeat === 'custom' ? 'var(--green-light)' : 'var(--card)', color: form.repeat === 'custom' ? 'var(--green)' : 'var(--text2)' }}
                  onClick={() => setForm(p => ({ ...p, repeat: 'custom' }))}>직접 입력</button>
                {form.repeat === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                    <input className="form-input" type="number" min="1" max="365" value={form.customDays}
                      onChange={e => setForm(p => ({ ...p, customDays: e.target.value }))}
                      placeholder="숫자" style={{ flex: 1 }} />
                    <span style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'nowrap' }}>일마다</span>
                  </div>
                )}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">담당자</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button className="opt-pill"
                  style={{ borderRadius: 20, borderColor: form.assignee === 'auto' ? 'var(--green)' : 'var(--border)', background: form.assignee === 'auto' ? 'var(--green-light)' : 'var(--card)', color: form.assignee === 'auto' ? 'var(--green)' : 'var(--text2)' }}
                  onClick={() => setForm(p => ({ ...p, assignee: 'auto' }))}>
                  자동 배정 · {getNextAssignee()}
                </button>
                {uniqueMembers.map(m => (
                  <button key={m.id} className="opt-pill"
                    style={{ borderRadius: 20, borderColor: form.assignee === m.name ? memberColor(m.name) : 'var(--border)', background: form.assignee === m.name ? `${memberColor(m.name)}1A` : 'var(--card)', color: form.assignee === m.name ? memberColor(m.name) : 'var(--text2)' }}
                    onClick={() => setForm(p => ({ ...p, assignee: m.name }))}>
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">메모 (선택)</label>
              <input className="form-input" value={form.note} maxLength={300}
                onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
                placeholder="주의사항, 방법 등..." />
            </div>
            <button className="btn-primary" onClick={addTask}>잡무 등록하기</button>
          </div>
        </div>
      )}
    </div>
  )
}
