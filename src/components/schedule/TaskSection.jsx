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

export default function TaskSection({ labId, tasks, schedulesHook, members, user }) {
  const [showAdd, setShowAdd] = useState(false)
  const [selectedDate, setSelectedDate] = useState(fmtDate(new Date()))
  const [form, setForm] = useState({ name: '', repeat: 'weekly', customDays: '', startDate: fmtDate(new Date()), note: '', assignee: 'auto' })

  const uniqueMembers = members.filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)

  const memberCounts = uniqueMembers.map(m => ({
    ...m, count: tasks.filter(t => t.assignee === m.name).length
  })).sort((a, b) => a.count - b.count)

  const getNextAssignee = () => memberCounts.length > 0 ? memberCounts[0].name : user.name

  const tasksOnDate = useMemo(() => {
    return tasks.filter(task => {
      const dates = generateTaskDates(task.startDate || task.date, task.repeat, task.repeatDays)
      return dates.includes(selectedDate)
    })
  }, [tasks, selectedDate])

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
      toast.success(`✅ ${assignee}에게 배정됐어요`)
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
    <div>
      <TaskCalendar
        tasks={tasks} members={uniqueMembers}
        onSelectDate={setSelectedDate} selectedDate={selectedDate}
      />

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
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{task.name}</div>
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
              <button onClick={() => deleteTask(task)}
                style={{ flex: 1, padding: '9px', background: 'none', border: 'none', color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}>
                🗑 삭제
              </button>
            </div>
          </div>
        ))}

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
                <button onClick={() => deleteTask(task)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 16 }}>×</button>
              </div>
            ))}
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
