import React, { useState } from 'react'
import { useMembers } from '../hooks/useFirestore'
import CalendarSection from './schedule/CalendarSection'
import TaskSection from './schedule/TaskSection'

export default function ScheduleTab({ labId, schedules, schedulesHook, notices, noticesHook, user }) {
  const [section, setSection] = useState('calendar')
  const members = useMembers(labId)
  const tasks = schedules.filter(s => s.type === 'task')

  return (
    <div>
      <div className="page-header">
        <div className="page-title">일정 & 잡무</div>
        <div style={{ display: 'flex', gap: 0, marginTop: 12, background: 'var(--border)', borderRadius: 10, padding: 3 }}>
          <button
            onClick={() => setSection('calendar')}
            style={{ flex: 1, padding: '8px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .2s', background: section === 'calendar' ? 'var(--card)' : 'transparent', color: section === 'calendar' ? 'var(--text)' : 'var(--text2)' }}>
            📅 일정
          </button>
          <button
            onClick={() => setSection('tasks')}
            style={{ flex: 1, padding: '8px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .2s', background: section === 'tasks' ? 'var(--card)' : 'transparent', color: section === 'tasks' ? 'var(--text)' : 'var(--text2)', position: 'relative' }}>
            🧹 잡무
            {tasks.length > 0 && (
              <span style={{ marginLeft: 4, background: 'var(--green)', color: '#fff', borderRadius: 10, fontSize: 10, padding: '1px 5px' }}>{tasks.length}</span>
            )}
          </button>
        </div>
      </div>

      {section === 'calendar' ? (
        <CalendarSection
          labId={labId} schedules={schedules} schedulesHook={schedulesHook}
          notices={notices} noticesHook={noticesHook} members={members} user={user}
        />
      ) : (
        <TaskSection
          labId={labId} tasks={tasks} schedulesHook={schedulesHook}
          members={members} user={user}
        />
      )}
    </div>
  )
}
