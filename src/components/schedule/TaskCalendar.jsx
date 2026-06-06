import React, { useState, useMemo } from 'react'
import { DAYS } from '../../mockData'
import { fmtDate, memberColor, generateTaskDates } from '../../utils'

export default function TaskCalendar({ tasks, members, onSelectDate, selectedDate }) {
  const [baseDate, setBaseDate] = useState(new Date())
  const today = new Date()

  const colorMap = useMemo(() => {
    const map = {}
    members.forEach(m => { map[m.name] = memberColor(m.name) })
    return map
  }, [members])

  const tasksByDate = useMemo(() => {
    const map = {}
    tasks.forEach(task => {
      const dates = generateTaskDates(task.startDate || task.date, task.repeat, task.repeatDays)
      dates.forEach(d => {
        if (!map[d]) map[d] = []
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
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div style={{ margin: '0 16px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={() => { const d = new Date(baseDate); d.setMonth(d.getMonth() - 1); setBaseDate(d) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text2)', padding: '4px 8px' }}>‹</button>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{year}년 {month + 1}월</span>
        <button onClick={() => { const d = new Date(baseDate); d.setMonth(d.getMonth() + 1); setBaseDate(d) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text2)', padding: '4px 8px' }}>›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, color: 'var(--text2)', fontWeight: 600, padding: '4px 0' }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const ds = fmtDate(new Date(year, month, day))
          const isToday = ds === fmtDate(today)
          const isSel = ds === selectedDate
          const dots = tasksByDate[ds] || []
          const shownDots = dots.slice(0, 3)
          return (
            <div key={i} onClick={() => onSelectDate(ds)} style={{
              padding: '6px 2px 4px', borderRadius: 8, cursor: 'pointer',
              background: isSel ? 'var(--green-light)' : isToday ? 'var(--card)' : 'transparent',
              border: isToday ? '1.5px solid var(--green)' : isSel ? '1.5px solid var(--green)' : '1.5px solid transparent',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minHeight: 48
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: isToday ? 'var(--green)' : 'transparent',
                color: isToday ? '#fff' : 'var(--text)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: isToday ? 700 : 400
              }}>{day}</div>
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
