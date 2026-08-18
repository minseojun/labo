import React, { useState, useMemo } from 'react'
import { fmtDate, memberColor, assignMemberColors, taskRotation, computeSchedule, scheduleAssigneeOn, scheduleIsOverridden, scheduleMemberWorkload, redistributeTasks, isTaskDone, isTaskOpen } from '../../utils'
import { DAYS } from '../../mockData'
import { toast } from '../../utils/toast'
import { Icon } from '../Icon'
import TaskCalendar from './TaskCalendar'

function repeatLabel(task) {
  if (task.repeat === 'weekly') return '매주'
  if (task.repeat === 'biweekly') return '격주'
  if (task.repeat === 'monthly') return '매월'
  if (task.repeat === 'custom') return `${task.repeatDays}일마다`
  if (task.repeat === 'weekdays' && task.repeatWeekdays?.length > 0) {
    return `매주 ${[...task.repeatWeekdays].sort((a, b) => a - b).map(d => DAYS[d]).join('·')}`
  }
  return '1회'
}

// 반복 UI(모드 + 요일/일수 입력) → 저장할 repeat/repeatDays/repeatWeekdays 값으로 변환
function resolveRepeat(f) {
  if (f.repeatMode === 'weekdays' && f.repeatWeekdays.length > 0) {
    return { repeat: 'weekdays', repeatDays: null, repeatWeekdays: [...f.repeatWeekdays].sort((a, b) => a - b) }
  }
  if (f.repeatMode === 'custom' && Number(f.repeatDays) > 0) {
    return { repeat: 'custom', repeatDays: Number(f.repeatDays), repeatWeekdays: null }
  }
  return { repeat: 'none', repeatDays: null, repeatWeekdays: null }
}

// 반복 모드 선택 + (요일마다면 요일 토글, N일마다면 숫자 입력) 공용 위젯
function RepeatPicker({ value, onChange }) {
  return (
    <div className="form-group">
      <label className="form-label">반복</label>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {[['none', '반복 없음'], ['weekdays', '요일마다'], ['custom', 'N일마다']].map(([v, l]) => (
          <button key={v} type="button" onClick={() => onChange({ ...value, repeatMode: v })}
            style={{ flex: 1, padding: '9px 4px', border: `1.5px solid ${value.repeatMode === v ? 'var(--green)' : 'var(--border)'}`, borderRadius: 8, background: value.repeatMode === v ? 'var(--green-light)' : 'var(--card)', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: value.repeatMode === v ? 'var(--green)' : 'var(--text2)' }}>
            {l}
          </button>
        ))}
      </div>
      {value.repeatMode === 'weekdays' && (
        <div style={{ display: 'flex', gap: 6 }}>
          {DAYS.map((d, i) => {
            const on = value.repeatWeekdays.includes(i)
            return (
              <button key={i} type="button"
                onClick={() => onChange({ ...value, repeatWeekdays: on ? value.repeatWeekdays.filter(x => x !== i) : [...value.repeatWeekdays, i] })}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: `1.5px solid ${on ? 'var(--green)' : 'var(--border)'}`, background: on ? 'var(--green-light)' : 'var(--card)', color: on ? 'var(--green)' : 'var(--text2)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {d}
              </button>
            )
          })}
        </div>
      )}
      {value.repeatMode === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input className="form-input" type="number" min="1" max="365" value={value.repeatDays}
            onChange={e => onChange({ ...value, repeatDays: e.target.value })}
            placeholder="숫자" style={{ flex: 1 }} />
          <span style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'nowrap' }}>일마다</span>
        </div>
      )}
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
        {value.repeatMode === 'none' && '반복 없이 한 번만 등록돼요.'}
        {value.repeatMode === 'weekdays' && '선택한 요일마다 반복돼요.'}
        {value.repeatMode === 'custom' && '시작일부터 입력한 일수마다 반복돼요.'}
      </div>
    </div>
  )
}

// 담당자가 여러 명이면 "이름, 이름 순환"으로 표시
function assigneeLabel(task) {
  const rotation = taskRotation(task)
  if (rotation.length <= 1) return rotation[0] || '-'
  return `${rotation.join(', ')} 순환`
}

const initial = name => name?.trim().slice(-1) || '?'

// 구성원별 잡무 분담 현황 — 공정한 분배를 한눈에
function WorkloadPanel({ rows, total, colorMap, onRedistribute }) {
  const max = Math.max(1, ...rows.map(r => r.count))
  return (
    <div className="wl-card">
      <div className="wl-top">
        <span className="wl-title">잡무 분담 현황</span>
        <span className="wl-meta">등록 잡무 {total}개</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: -8, marginBottom: 13 }}>
        같은 잡무를 여러 명이 나눠 맡는 경우까지 반영해, 다음 90일 예상 수행 횟수로 부담을 계산해요.
      </div>
      {rows.map(m => (
        <div className="wl-row" key={m.id}>
          <span className="wl-dot" style={{ background: colorMap[m.name] || memberColor(m.name) }} />
          <span className="wl-name">{m.name}</span>
          <div className="wl-track">
            <div className="wl-fill" style={{ width: `${(m.count / max) * 100}%`, background: colorMap[m.name] || memberColor(m.name) }} />
          </div>
          <span className="wl-count">{m.count}회</span>
        </div>
      ))}
      <button onClick={onRedistribute} style={{
        marginTop: 12, width: '100%', padding: '9px',
        background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10,
        fontSize: 12.5, fontWeight: 600, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit',
      }}>
        전체 잡무 다시 고르게 배정하기
      </button>
    </div>
  )
}

export default function TaskSection({ labId, tasks, schedulesHook, members, user }) {
  const [showAdd, setShowAdd] = useState(false)
  const [editTask, setEditTask] = useState(null)
  const [swapTask, setSwapTask] = useState(null)
  const [selectedDate, setSelectedDate] = useState(fmtDate(new Date()))
  const [form, setForm] = useState({ name: '', repeatMode: 'none', repeatDays: '', repeatWeekdays: [], startDate: fmtDate(new Date()), endDate: '', note: '', assignees: [] })

  const uniqueMembers = members.filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)
  const colorMap = assignMemberColors(uniqueMembers)

  // 랩의 잡무 전체를 한꺼번에 보고 발생일마다 담당자를 정하는 전역 스케줄러
  // (겹치는 날·연속일을 최대한 피하면서 장기적으로 누적 배정 수는 공평하게 맞춤)
  const schedule = useMemo(() => computeSchedule(tasks), [tasks])

  // count = "잡무 개수"가 아니라 다음 90일 기준 예상 수행 횟수 합
  const memberCounts = uniqueMembers.map(m => ({
    ...m, count: scheduleMemberWorkload(schedule, m.name)
  })).sort((a, b) => a.count - b.count)

  // 분담 현황은 부담 큰 순으로 보여줘서 불균형이 바로 보이게
  const workloadRows = [...memberCounts].sort((a, b) => b.count - a.count)

  const tasksOnDate = useMemo(() => {
    return tasks
      .map(task => {
        const todayAssignee = scheduleAssigneeOn(schedule, task.id, selectedDate)
        return todayAssignee ? { ...task, todayAssignee } : null
      })
      .filter(Boolean)
  }, [tasks, schedule, selectedDate])

  const isToday = selectedDate === fmtDate(new Date())
  const dateLabel = isToday ? '오늘' : selectedDate.replace(/^\d{4}-/, '').replace('-', '. ')

  const toggleFormAssignee = (name) => {
    setForm(p => ({
      ...p,
      assignees: p.assignees.includes(name) ? p.assignees.filter(n => n !== name) : [...p.assignees, name]
    }))
  }
  const toggleEditAssignee = (name) => {
    setEditTask(p => ({
      ...p,
      assignees: p.assignees.includes(name) ? p.assignees.filter(n => n !== name) : [...p.assignees, name]
    }))
  }

  const addTask = async () => {
    const name = form.name.trim()
    if (!name) { toast.error('잡무 이름을 입력해주세요.'); return }
    if (name.length > 100) { toast.error('이름은 100자 이내로 입력해주세요.'); return }
    if (form.repeatMode === 'custom' && form.repeatDays && Number(form.repeatDays) < 1) { toast.error('반복 주기는 1일 이상으로 입력해주세요.'); return }
    if (form.repeatMode === 'weekdays' && form.repeatWeekdays.length === 0) { toast.error('반복할 요일을 하나 이상 선택해주세요.'); return }
    if (form.endDate && form.endDate < form.startDate) { toast.error('종료일은 시작일 이후여야 해요.'); return }
    if (uniqueMembers.length === 0) { toast.error('먼저 랩 구성원이 있어야 해요.'); return }
    const rotation = form.assignees.length > 0 ? form.assignees : uniqueMembers.map(m => m.name)
    const { repeat, repeatDays, repeatWeekdays } = resolveRepeat(form)
    try {
      await schedulesHook.add({
        name, type: 'task',
        date: form.startDate, startDate: form.startDate, endDate: form.endDate || null, time: '',
        assignee: rotation[0], rotation,
        repeat, repeatDays, repeatWeekdays,
        note: form.note.trim(),
      })
      setShowAdd(false)
      setForm({ name: '', repeatMode: 'none', repeatDays: '', repeatWeekdays: [], startDate: fmtDate(new Date()), endDate: '', note: '', assignees: [] })
      toast.success(rotation.length > 1 ? `${rotation.length}명이 돌아가며 맡아요` : `${rotation[0]} 담당으로 배정됐어요`)
    } catch (e) {
      // error shown by hook
    }
  }

  const redistributeAll = async () => {
    if (tasks.length === 0 || uniqueMembers.length === 0) return
    if (!window.confirm('전체 잡무를 모든 구성원이 돌아가며 맡도록 재배정할까요? 기존 담당자 배정이 모두 바뀔 수 있어요.')) return
    try {
      const reassignments = redistributeTasks(tasks, uniqueMembers)
      await Promise.all(reassignments.map(r => schedulesHook.update(r.id, { assignee: r.rotation[0], rotation: r.rotation })))
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

  const openSwap = (task) => {
    setSwapTask({ id: task.id, name: task.name, date: selectedDate, current: task.todayAssignee })
  }

  const confirmSwap = async (newName) => {
    if (!swapTask) return
    const task = tasks.find(t => t.id === swapTask.id)
    try {
      await schedulesHook.update(swapTask.id, { overrides: { ...(task?.overrides || {}), [swapTask.date]: newName } })
      toast.success(`${dateLabel} ${swapTask.name} 담당을 ${newName}(으)로 바꿨어요`)
      setSwapTask(null)
    } catch (e) {
      // error shown by hook
    }
  }

  const revertSwap = async () => {
    if (!swapTask) return
    const task = tasks.find(t => t.id === swapTask.id)
    const nextOverrides = { ...(task?.overrides || {}) }
    delete nextOverrides[swapTask.date]
    try {
      await schedulesHook.update(swapTask.id, { overrides: nextOverrides })
      toast.success('원래 배정으로 되돌렸어요')
      setSwapTask(null)
    } catch (e) {
      // error shown by hook
    }
  }

  // 완료 체크 — 발생일이 실제 행이 아니라 매번 계산되는 가상의 날짜라서
  // doneDates 배열에 그 날짜가 있는지로 완료 여부를 표시함
  const toggleTaskDone = async (task, e) => {
    e.stopPropagation()
    const dates = task.doneDates || []
    const done = dates.includes(selectedDate)
    try {
      await schedulesHook.update(task.id, { doneDates: done ? dates.filter(d => d !== selectedDate) : [...dates, selectedDate] })
    } catch (e) {
      // error shown by hook
    }
  }

  // "오늘 못해요" — 당번 본인이 이 날짜를 openDates에 올려두면, 다른 팀원
  // 누구나 자원해서 바로 가져갈 수 있음(claimOpenTask)
  const markTaskUnable = async (task, e) => {
    e.stopPropagation()
    const opens = task.openDates || []
    if (opens.includes(selectedDate)) return
    try {
      await schedulesHook.update(task.id, { openDates: [...opens, selectedDate] })
      toast.success('다른 팀원이 대신 맡을 수 있도록 열어뒀어요')
    } catch (e) {
      // error shown by hook
    }
  }

  const claimOpenTask = async (task, e) => {
    e.stopPropagation()
    const opens = (task.openDates || []).filter(d => d !== selectedDate)
    const nextOverrides = { ...(task.overrides || {}), [selectedDate]: user.name }
    try {
      await schedulesHook.update(task.id, { openDates: opens, overrides: nextOverrides })
      toast.success(`${dateLabel} ${task.name} 담당을 맡았어요`)
    } catch (e) {
      // error shown by hook
    }
  }

  const openEdit = (task) => {
    setEditTask({
      id: task.id,
      name: task.name,
      repeatMode: task.repeat === 'weekdays' ? 'weekdays' : task.repeat === 'custom' ? 'custom' : 'none',
      repeatDays: task.repeatDays ? String(task.repeatDays) : '',
      repeatWeekdays: task.repeatWeekdays || [],
      startDate: task.startDate || task.date,
      endDate: task.endDate || '',
      note: task.note || '',
      assignees: taskRotation(task),
    })
  }

  const saveEditTask = async () => {
    const name = editTask.name.trim()
    if (!name) { toast.error('잡무 이름을 입력해주세요.'); return }
    if (name.length > 100) { toast.error('이름은 100자 이내로 입력해주세요.'); return }
    if (editTask.repeatMode === 'custom' && editTask.repeatDays && Number(editTask.repeatDays) < 1) { toast.error('반복 주기는 1일 이상으로 입력해주세요.'); return }
    if (editTask.repeatMode === 'weekdays' && editTask.repeatWeekdays.length === 0) { toast.error('반복할 요일을 하나 이상 선택해주세요.'); return }
    if (editTask.endDate && editTask.endDate < editTask.startDate) { toast.error('종료일은 시작일 이후여야 해요.'); return }
    const rotation = editTask.assignees.length > 0 ? editTask.assignees : uniqueMembers.map(m => m.name)
    const { repeat, repeatDays, repeatWeekdays } = resolveRepeat(editTask)
    try {
      await schedulesHook.update(editTask.id, {
        name,
        date: editTask.startDate, startDate: editTask.startDate, endDate: editTask.endDate || null,
        assignee: rotation[0], rotation,
        repeat, repeatDays, repeatWeekdays,
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
        <WorkloadPanel rows={workloadRows} total={tasks.length} colorMap={colorMap} onRedistribute={redistributeAll} />
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
            <Icon.Sparkle size={26} strokeWidth={1.5} style={{ opacity: .5, marginBottom: 8 }} />
            <div className="tsk-empty-text">이 날은 배정된 잡무가 없어요</div>
          </div>
        ) : tasksOnDate.map(task => {
          const color = colorMap[task.todayAssignee] || memberColor(task.todayAssignee)
          const rotation = taskRotation(task)
          const overridden = scheduleIsOverridden(schedule, task.id, selectedDate)
          const done = isTaskDone(task, selectedDate)
          const open = isTaskOpen(task, selectedDate)
          const isMine = task.todayAssignee === user.name
          const accent = open ? 'var(--yellow)' : color
          return (
            <div key={task.id} className="tsk-card" style={{ '--accent': accent, cursor: 'pointer', opacity: done ? .6 : 1 }} onClick={() => openEdit(task)}>
              <div className="tsk-avatar"
                style={{ background: done ? 'var(--green-light)' : `${color}1A`, color: done ? 'var(--green)' : color, cursor: isMine && !open ? 'pointer' : 'default' }}
                onClick={isMine && !open ? e => toggleTaskDone(task, e) : undefined}
                aria-label={isMine && !open ? (done ? '완료 취소' : '완료 체크') : undefined}>
                {done ? <Icon.ClipboardCheck size={16} strokeWidth={2} /> : initial(task.todayAssignee)}
              </div>
              <div className="tsk-body">
                <div className="tsk-name" style={{ textDecoration: done ? 'line-through' : 'none' }}>{task.name}</div>
                <div className="tsk-metarow">
                  {open ? (
                    <span style={{ fontSize: 11.5, color: '#b97b10', fontWeight: 700 }}>담당자 구함 — {task.todayAssignee}님이 오늘 어려움</span>
                  ) : (
                    <>
                      <span className="tsk-strong" style={{ color }}>{task.todayAssignee}</span>
                      {done && <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 600 }}>완료</span>}
                      {!done && overridden && <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 600 }}>교체됨</span>}
                      {!done && !overridden && rotation.length > 1 && <span style={{ fontSize: 10, color: 'var(--text3)' }}>({rotation.length}명 순환)</span>}
                    </>
                  )}
                  <span className="tsk-sep" />
                  <span>{repeatLabel(task)}</span>
                </div>
                {task.note && <div className="tsk-note">{task.note}</div>}
              </div>
              {open ? (
                <>
                  <button onClick={e => claimOpenTask(task, e)} style={{
                    flexShrink: 0, padding: '7px 12px', background: 'var(--green)', color: '#fff',
                    border: 'none', borderRadius: 20, fontSize: 11.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}>제가 할게요</button>
                  <button className="tsk-del" onClick={e => { e.stopPropagation(); deleteTask(task) }} aria-label="삭제">✕</button>
                </>
              ) : (
                <>
                  {isMine && !done && (
                    <button className="tsk-del" onClick={e => markTaskUnable(task, e)} aria-label="오늘 못해요" title="오늘 못해요">
                      <Icon.AlertTriangle size={14} strokeWidth={1.8} />
                    </button>
                  )}
                  <button className="tsk-del" onClick={e => { e.stopPropagation(); openSwap(task) }} aria-label="담당자 바꾸기"><Icon.Refresh size={14} strokeWidth={1.8} /></button>
                  <button className="tsk-del" onClick={e => { e.stopPropagation(); deleteTask(task) }} aria-label="삭제">✕</button>
                </>
              )}
            </div>
          )
        })}

        {tasks.length > 0 && (
          <>
            <div className="tsk-all-label">전체 잡무 {tasks.length}개</div>
            {tasks.map(task => {
              const rotation = taskRotation(task)
              const color = colorMap[rotation[0]] || memberColor(rotation[0])
              return (
                <div key={task.id} className="tsk-row" style={{ cursor: 'pointer' }} onClick={() => openEdit(task)}>
                  <span className="tsk-row-bar" style={{ background: color }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="tsk-row-name">{task.name}</div>
                    <div className="tsk-row-meta">
                      {assigneeLabel(task)} · {repeatLabel(task)} · {task.startDate}부터{task.endDate ? ` ${task.endDate}까지` : ''}
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
            <RepeatPicker value={form} onChange={setForm} />
            <div className="form-group">
              <label className="form-label">담당자 (여러 명 고르면 발생할 때마다 돌아가며 맡아요)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button type="button" className="opt-pill"
                  style={{ borderRadius: 20, borderColor: 'var(--green)', background: 'var(--green-light)', color: 'var(--green)', fontWeight: 600 }}
                  onClick={() => setForm(p => ({ ...p, assignees: uniqueMembers.map(m => m.name) }))}>
                  전체 인원
                </button>
                {uniqueMembers.map(m => (
                  <button key={m.id} type="button" className="opt-pill"
                    style={{ borderRadius: 20, borderColor: form.assignees.includes(m.name) ? colorMap[m.name] : 'var(--border)', background: form.assignees.includes(m.name) ? `${colorMap[m.name]}1A` : 'var(--card)', color: form.assignees.includes(m.name) ? colorMap[m.name] : 'var(--text2)' }}
                    onClick={() => toggleFormAssignee(m.name)}>
                    {form.assignees.includes(m.name) ? '✓ ' : ''}{m.name}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>아무도 선택하지 않으면 전체 인원이 돌아가며 맡아요.</div>
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
            <RepeatPicker value={editTask} onChange={setEditTask} />
            <div className="form-group">
              <label className="form-label">담당자 (여러 명 고르면 발생할 때마다 돌아가며 맡아요)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button type="button" className="opt-pill"
                  style={{ borderRadius: 20, borderColor: 'var(--green)', background: 'var(--green-light)', color: 'var(--green)', fontWeight: 600 }}
                  onClick={() => setEditTask(p => ({ ...p, assignees: uniqueMembers.map(m => m.name) }))}>
                  전체 인원
                </button>
                {uniqueMembers.map(m => (
                  <button key={m.id} type="button" className="opt-pill"
                    style={{ borderRadius: 20, borderColor: editTask.assignees.includes(m.name) ? colorMap[m.name] : 'var(--border)', background: editTask.assignees.includes(m.name) ? `${colorMap[m.name]}1A` : 'var(--card)', color: editTask.assignees.includes(m.name) ? colorMap[m.name] : 'var(--text2)' }}
                    onClick={() => toggleEditAssignee(m.name)}>
                    {editTask.assignees.includes(m.name) ? '✓ ' : ''}{m.name}{memberCounts.find(c => c.name === m.name)?.count === 0 && ' · 신규'}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>아무도 선택하지 않으면 전체 인원이 돌아가며 맡아요.</div>
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

      {swapTask && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setSwapTask(null)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">{dateLabel} 담당 바꾸기</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
              <b style={{ color: 'var(--text)' }}>{swapTask.name}</b> · 현재 담당: <b style={{ color: 'var(--text)' }}>{swapTask.current}</b>
            </div>
            <div className="form-group">
              <label className="form-label">대신 맡을 사람</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {uniqueMembers.filter(m => m.name !== swapTask.current).map(m => (
                  <button key={m.id} type="button" className="opt-pill"
                    style={{ borderRadius: 20, borderColor: colorMap[m.name] || 'var(--border)', color: colorMap[m.name] || 'var(--text2)' }}
                    onClick={() => confirmSwap(m.name)}>
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
            {scheduleIsOverridden(schedule, swapTask.id, swapTask.date) && (
              <button className="btn-primary" style={{ background: 'var(--bg)', color: 'var(--text2)', boxShadow: 'none' }} onClick={revertSwap}>
                ↩ 원래 배정으로 되돌리기
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
