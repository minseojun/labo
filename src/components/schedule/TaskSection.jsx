import React, { useState, useMemo } from 'react'
import { fmtDate, memberColor, assignMemberColors, generateTaskDates, redistributeTasks } from '../../utils'
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
function WorkloadPanel({ rows, total, nextAssignee, colorMap, onRedistribute }) {
  const max = Math.max(1, ...rows.map(r => r.count))
  return (
    <div className="wl-card">
      <div className="wl-top">
        <span className="wl-title">잡무 분담 현황</span>
        <span className="wl-meta">담당 잡무 {total}개</span>
      </div>
      {rows.map(m => (
        <div className="wl-row" key={m.id}>
          <span className="wl-dot" style={{ background: colorMap[m.name] || memberColor(m.name) }} />
          <span className="wl-name">{m.name}</span>
          <div className="wl-track">
            <div className="wl-fill" style={{ width: `${(m.count / max) * 100}%`, background: colorMap[m.name] || memberColor(m.name) }} />
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
      <button onClick={onRedistribute} style={{
        marginTop: 12, width: '100%', padding: '9px',
        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10,
        fontSize: 12.5, fontWeight: 600, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit',
      }}>
        🔄 전체 잡무 다시 고르게 배정하기
      </button>
    </div>
  )
}

export default function TaskSection({ labId, tasks, schedulesHook, members, user }) {
  const [showAdd, setShowAdd] = useState(false)
  const [editTask, setEditTask] = useState(null)
  const [selectedDate, setSelectedDate] = useState(fmtDate(new Date()))
  const [form, setForm] = useState({ name: '', repeatDays: '', startDate: fmtDate(new Date()), endDate: '', note: '', assignee: '' })

  const uniqueMembers = members.filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)
  const colorMap = assignMemberColors(uniqueMembers)

  const memberCounts = uniqueMembers.map(m => ({
    ...m, count: tasks.filter(t => t.assignee === m.name).length
  })).sort((a, b) => a.count - b.count)

  const getNextAssignee = () => memberCounts.length > 0 ? memberCounts[0].name : user.name

  // 분담 현황은 부담 큰 순으로 보여줘서 불균형이 바로 보이게
  const workloadRows = [...memberCounts].sort((a, b) => b.count - a.count)

  const tasksOnDate = useMemo(() => {
    return tasks.filter(task => {
      const dates = generateTaskDates(task.startDate || task.date, task.repeat, task.repeatDays, task.endDate)
      return dates.includes(selectedDate)
    })
  }, [tasks, selectedDate])

  const isToday = selectedDate === fmtDate(new Date())
  const dateLabel = isToday ? '오늘' : selectedDate.replace(/^\d{4}-/, '').replace('-', '. ')

  const addTask = async () => {
    const name = form.name.trim()
    if (!name) { toast.error('잡무 이름을 입력해주세요.'); return }
    if (name.length > 100) { toast.error('이름은 100자 이내로 입력해주세요.'); return }
    if (!form.assignee) { toast.error('담당자를 선택해주세요.'); return }
    if (form.repeatDays && Number(form.repeatDays) < 1) { toast.error('반복 주기는 1일 이상으로 입력해주세요.'); return }
    if (form.endDate && form.endDate < form.startDate) { toast.error('종료일은 시작일 이후여야 해요.'); return }
    const days = form.repeatDays ? Number(form.repeatDays) : 0
    const assignee = form.assignee
    try {
      await schedulesHook.add({
        name, type: 'task',
        date: form.startDate, startDate: form.startDate, endDate: form.endDate || null, time: '',
        assignee, repeat: days > 0 ? 'custom' : 'none',
        repeatDays: days > 0 ? days : null,
        note: form.note.trim(),
      })
      setShowAdd(false)
      setForm({ name: '', repeatDays: '', startDate: fmtDate(new Date()), endDate: '', note: '', assignee: '' })
      toast.success(`${assignee} 담당으로 배정됐어요`)
    } catch (e) {
      // error shown by hook
    }
  }

  const redistributeAll = async () => {
    if (tasks.length === 0 || uniqueMembers.length === 0) return
    if (!window.confirm('전체 잡무를 구성원 수에 맞게 다시 배정할까요? 기존 담당자 배정이 모두 바뀔 수 있어요.')) return
    try {
      const reassignments = redistributeTasks(tasks, uniqueMembers)
      await Promise.all(reassignments.map(r => schedulesHook.update(r.id, { assignee: r.assignee })))
      toast.success('잡무를 다시 배정했어요')
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

  const openEdit = (task) => {
    setEditTask({
      id: task.id,
      name: task.name,
      repeatDays: task.repeatDays ? String(task.repeatDays) : '',
      startDate: task.startDate || task.date,
      endDate: task.endDate || '',
      note: task.note || '',
      assignee: task.assignee,
    })
  }

  const saveEditTask = async () => {
    const name = editTask.name.trim()
    if (!name) { toast.error('잡무 이름을 입력해주세요.'); return }
    if (name.length > 100) { toast.error('이름은 100자 이내로 입력해주세요.'); return }
    if (!editTask.assignee) { toast.error('담당자를 선택해주세요.'); return }
    if (editTask.repeatDays && Number(editTask.repeatDays) < 1) { toast.error('반복 주기는 1일 이상으로 입력해주세요.'); return }
    if (editTask.endDate && editTask.endDate < editTask.startDate) { toast.error('종료일은 시작일 이후여야 해요.'); return }
    const days = editTask.repeatDays ? Number(editTask.repeatDays) : 0
    try {
      await schedulesHook.update(editTask.id, {
        name,
        date: editTask.startDate, startDate: editTask.startDate, endDate: editTask.endDate || null,
        assignee: editTask.assignee, repeat: days > 0 ? 'custom' : 'none',
        repeatDays: days > 0 ? days : null,
        note: editTask.note.trim(),
      })
      setEditTask(null)
      toast.success('잡무를 수정했어요')
    } catch (e) {
      // error shown by hook
    }
  }

  return (
    <div style={{ paddingBottom: 8 }}>
      {uniqueMembers.length > 0 && tasks.length > 0 && (
        <WorkloadPanel rows={workloadRows} total={tasks.length} nextAssignee={getNextAssignee()} colorMap={colorMap} onRedistribute={redistributeAll} />
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
          const color = colorMap[task.assignee] || memberColor(task.assignee)
          return (
            <div key={task.id} className="tsk-card" style={{ '--accent': color, cursor: 'pointer' }} onClick={() => openEdit(task)}>
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
              <button className="tsk-del" onClick={e => { e.stopPropagation(); deleteTask(task) }} aria-label="삭제">✕</button>
            </div>
          )
        })}

        {tasks.length > 0 && (
          <>
            <div className="tsk-all-label">전체 잡무 {tasks.length}개</div>
            {tasks.map(task => {
              const color = colorMap[task.assignee] || memberColor(task.assignee)
              return (
                <div key={task.id} className="tsk-row" style={{ cursor: 'pointer' }} onClick={() => openEdit(task)}>
                  <span className="tsk-row-bar" style={{ background: color }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="tsk-row-name">{task.name}</div>
                    <div className="tsk-row-meta">
                      {task.assignee} · {repeatLabel(task)} · {task.startDate}부터{task.endDate ? ` ${task.endDate}까지` : ''}
                    </div>
                  </div>
                  <button className="tsk-del" onClick={e => { e.stopPropagation(); deleteTask(task) }} aria-label="삭제">✕</button>
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
              <label className="form-label">기간</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input className="form-input" type="date" value={form.startDate}
                  onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>~</span>
                <input className="form-input" type="date" value={form.endDate} min={form.startDate}
                  onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} style={{ flex: 1 }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>종료일은 선택 사항이에요. 비워두면 계속 반복돼요.</div>
            </div>
            <div className="form-group">
              <label className="form-label">반복 주기</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input className="form-input" type="number" min="0" max="365" value={form.repeatDays}
                  onChange={e => setForm(p => ({ ...p, repeatDays: e.target.value }))}
                  placeholder="숫자" style={{ flex: 1 }} />
                <span style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'nowrap' }}>일마다</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>비워두거나 0이면 반복 없이 한 번만 등록돼요.</div>
            </div>
            <div className="form-group">
              <label className="form-label">담당자</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button type="button" className="opt-pill"
                  style={{ borderRadius: 20, borderColor: 'var(--green)', background: 'var(--green-light)', color: 'var(--green)', fontWeight: 700 }}
                  onClick={() => setForm(p => ({ ...p, assignee: getNextAssignee() }))}>
                  🔀 자동 배정
                </button>
                {uniqueMembers.map(m => (
                  <button key={m.id} className="opt-pill"
                    style={{ borderRadius: 20, borderColor: form.assignee === m.name ? colorMap[m.name] : 'var(--border)', background: form.assignee === m.name ? `${colorMap[m.name]}1A` : 'var(--card)', color: form.assignee === m.name ? colorMap[m.name] : 'var(--text2)' }}
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

      {editTask && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setEditTask(null)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">잡무 수정</div>
            <div className="form-group">
              <label className="form-label">잡무 이름</label>
              <input className="form-input" value={editTask.name} maxLength={100}
                onChange={e => setEditTask(p => ({ ...p, name: e.target.value }))}
                placeholder="예: 실험실 청소, 약품 주문" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">기간</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input className="form-input" type="date" value={editTask.startDate}
                  onChange={e => setEditTask(p => ({ ...p, startDate: e.target.value }))} style={{ flex: 1 }} />
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>~</span>
                <input className="form-input" type="date" value={editTask.endDate} min={editTask.startDate}
                  onChange={e => setEditTask(p => ({ ...p, endDate: e.target.value }))} style={{ flex: 1 }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>종료일은 선택 사항이에요. 비워두면 계속 반복돼요.</div>
            </div>
            <div className="form-group">
              <label className="form-label">반복 주기</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input className="form-input" type="number" min="0" max="365" value={editTask.repeatDays}
                  onChange={e => setEditTask(p => ({ ...p, repeatDays: e.target.value }))}
                  placeholder="숫자" style={{ flex: 1 }} />
                <span style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'nowrap' }}>일마다</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>비워두거나 0이면 반복 없이 한 번만 등록돼요.</div>
            </div>
            <div className="form-group">
              <label className="form-label">담당자</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button type="button" className="opt-pill"
                  style={{ borderRadius: 20, borderColor: 'var(--green)', background: 'var(--green-light)', color: 'var(--green)', fontWeight: 700 }}
                  onClick={() => setEditTask(p => ({ ...p, assignee: getNextAssignee() }))}>
                  🔀 자동 배정
                </button>
                {uniqueMembers.map(m => (
                  <button key={m.id} className="opt-pill"
                    style={{ borderRadius: 20, borderColor: editTask.assignee === m.name ? colorMap[m.name] : 'var(--border)', background: editTask.assignee === m.name ? `${colorMap[m.name]}1A` : 'var(--card)', color: editTask.assignee === m.name ? colorMap[m.name] : 'var(--text2)' }}
                    onClick={() => setEditTask(p => ({ ...p, assignee: m.name }))}>
                    {m.name}{memberCounts.find(c => c.name === m.name)?.count === 0 && ' · 신규'}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">메모 (선택)</label>
              <input className="form-input" value={editTask.note} maxLength={300}
                onChange={e => setEditTask(p => ({ ...p, note: e.target.value }))}
                placeholder="주의사항, 방법 등..." />
            </div>
            <button className="btn-primary" onClick={saveEditTask}>저장하기</button>
          </div>
        </div>
      )}
    </div>
  )
}
