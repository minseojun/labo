import React, { useState, useMemo } from 'react'
import { DAYS } from '../../mockData'
import { fmtDate, assignMemberColors, generateTaskDates } from '../../utils'

export default function TaskCalendar({ tasks, members, onSelectDate, selectedDate }) {
  const [baseDate, setBaseDate] = useState(new Date())
  const today = new Date()

  const colorMap = useMemo(() => assignMemberColors(members), [members])

  const tasksByDate = useMemo(() => {
    const map = {}
    tasks.forEach(task => {
      const dates = generateTaskDates(task.startDate || task.date, task.repeat, task.repeatDays, task.endDate)
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
    <div style={{ margin: '0 16px 18px', background: 'var(--card)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)', padding: '14px 14px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-.3px' }}>{year}년 {month + 1}월</span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button onClick={() => { const d = new Date(baseDate); d.setMonth(d.getMonth() - 1); setBaseDate(d) }}
            style={{ background: 'var(--bg)', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text2)', width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <button onClick={() => setBaseDate(new Date())}
            style={{ background: 'var(--bg)', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', padding: '0 11px', height: 30, borderRadius: 9 }}>오늘</button>
          <button onClick={() => { const d = new Date(baseDate); d.setMonth(d.getMonth() + 1); setBaseDate(d) }}
            style={{ background: 'var(--bg)', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text2)', width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
        {DAYS.map((d, i) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, padding: '4px 0', color: i === 0 ? 'var(--red)' : i === 6 ? '#5B9BD5' : 'var(--text2)' }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const ds = fmtDate(new Date(year, month, day))
          const isToday = ds === fmtDate(today)
          const isSel = ds === selectedDate
          const dow = (firstDay + day - 1) % 7
          const dots = tasksByDate[ds] || []
          const shownDots = dots.slice(0, 3)
          const numColor = isToday ? '#fff' : isSel ? 'var(--green)' : dow === 0 ? 'var(--red)' : dow === 6 ? '#5B9BD5' : 'var(--text)'
          return (
            <div key={i} onClick={() => onSelectDate(ds)} style={{
              padding: '5px 2px 4px', borderRadius: 10, cursor: 'pointer',
              background: isSel && !isToday ? 'var(--green-light)' : 'transparent',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minHeight: 46,
              transition: 'background .15s'
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: isToday ? 'var(--green)' : 'transparent',
                color: numColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12.5, fontWeight: isToday || isSel ? 700 : 500,
                boxShadow: isToday ? 'var(--shadow-green)' : 'none'
              }}>{day}</div>
              {shownDots.length > 0 && (
                <div style={{ display: 'flex', gap: 2.5, alignItems: 'center', justifyContent: 'center' }}>
                  {shownDots.map((dot, j) => (
                    <div key={j} style={{ width: 5, height: 5, borderRadius: '50%', background: dot.color, flexShrink: 0 }} />
                  ))}
                  {dots.length > 3 && <div style={{ fontSize: 8, color: 'var(--text2)', fontWeight: 600 }}>+{dots.length - 3}</div>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
