import React, { useState } from 'react'
import CalendarSection from './schedule/CalendarSection'
import TaskSection from './schedule/TaskSection'

export default function ScheduleTab({ labId, schedules, schedulesHook, notices, noticesHook, members, user }) {
  const [section, setSection] = useState('calendar')
  const tasks = schedules.filter(s => s.type === 'task')

  return (
    <div>
      <div className="page-header">
        <div className="page-title">일정 &amp; 잡무</div>
        <div className="seg">
          <button className={`seg-btn${section === 'calendar' ? ' on' : ''}`} onClick={() => setSection('calendar')}>
            일정
          </button>
          <button className={`seg-btn${section === 'tasks' ? ' on' : ''}`} onClick={() => setSection('tasks')}>
            잡무
            {tasks.length > 0 && <span className="seg-badge">{tasks.length}</span>}
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
