import React, { useState } from 'react'
import { formatTime } from '../utils'
import { Icon } from './Icon'

const presets = [[5 * 60, '5분'], [15 * 60, '15분'], [30 * 60, '30분'], [60 * 60, '1시간']]

function TimerCard({ timer, onUpdate, onDelete }) {
  const [showMemo, setShowMemo] = useState(false)
  const [memo, setMemo] = useState(timer.memo || '')

  const total = timer.duration
  const timeLeft = timer.timeLeft
  const running = timer.running
  const done = timer.done

  const pct = timeLeft / total
  const r = 44
  const circ = 2 * Math.PI * r
  const dash = circ * pct
  const color = done ? 'var(--red)' : running ? 'var(--green)' : 'var(--yellow)'
  const bg    = done ? 'var(--red-light)' : running ? 'var(--green-light)' : 'var(--yellow-light)'

  return (
    <div className="timer-card" style={{ borderColor: done ? '#f8c5c5' : running ? '#a8dfc8' : 'var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
          <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="50" cy="50" r={r} fill="none" stroke={bg} strokeWidth="6" />
            <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="6"
              strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
              style={{ transition: 'stroke-dasharray .3s' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
            <div style={{ fontSize: 17, fontWeight: 600, color }}>{formatTime(timeLeft)}</div>
            <div style={{ fontSize: 9, color: 'var(--text2)', marginTop: 1 }}>
              {done ? '완료' : running ? '실행중' : '대기'}
            </div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{timer.name}</div>
          {timer.equipment && <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6 }}>{timer.equipment}</div>}
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>설정: {formatTime(total)}</div>
        </div>
      </div>

      <div className="timer-controls">
        {!done && (
          running ? (
            <button className="timer-btn btn-pause" onClick={() => onUpdate(timer.id, { running: false })}>⏸ 일시정지</button>
          ) : (
            <button className="timer-btn btn-play" onClick={() => onUpdate(timer.id, { running: true, done: false })}>
              ▶ {timeLeft < total ? '계속' : '시작'}
            </button>
          )
        )}
        <button className="timer-btn" style={{ background: 'var(--bg)', color: 'var(--text2)', flex: .5 }}
          onClick={() => onUpdate(timer.id, { running: false, done: false, timeLeft: total })}>↺</button>
        <button className="timer-btn" style={{ background: 'var(--red-light)', color: 'var(--red)', flex: .5 }}
          onClick={() => onDelete(timer.id)}>✕</button>
      </div>

      {/* 완료 메모 */}
      {done && !showMemo && (
        <button onClick={() => setShowMemo(true)} style={{
          marginTop: 10, width: '100%', padding: '8px',
          background: 'var(--green-light)', color: 'var(--green)',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer'
        }}>완료 — 메모 남기기</button>
      )}
      {showMemo && (
        <div style={{ marginTop: 12, padding: 12, background: 'var(--green-light)', borderRadius: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--green)', marginBottom: 8 }}>실험 메모</div>
          <textarea className="form-input" rows={2} value={memo} onChange={e => setMemo(e.target.value)}
            placeholder="실험 결과, 조건 등..." style={{ resize: 'none', marginBottom: 8 }} />
          <button className="btn-primary" style={{ padding: 8, fontSize: 13 }}
            onClick={() => { onUpdate(timer.id, { memo }); setShowMemo(false) }}>저장</button>
        </div>
      )}
      {timer.memo && !showMemo && (
        <div style={{ marginTop: 8, padding: '6px 10px', background: 'var(--bg)', borderRadius: 6, fontSize: 12, color: 'var(--text2)' }}>
          📝 {timer.memo}
        </div>
      )}
    </div>
  )
}

export default function TimerTab({ timers, onUpdate, onDelete, onAdd, equipment }) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', duration: 300, equipment: '' })
  const [preset, setPreset] = useState(300)
  const [custom, setCustom] = useState('')

  const addTimer = () => {
    if (!form.name) return
    onAdd({ ...form })
    setShowAdd(false)
    setForm({ name: '', duration: 300, equipment: '' })
    setCustom('')
    setPreset(300)
  }

  const runningCount = timers.filter(t => t.running).length

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="page-title">실험 타이머</div>
            <div className="page-subtitle">
              {runningCount > 0
                ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>{runningCount}개 실행 중</span>
                : `${timers.length}개 등록됨`}
            </div>
          </div>
          <button onClick={() => setShowAdd(true)}
            style={{ padding: '8px 14px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            + 추가
          </button>
        </div>
      </div>

      {timers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text2)' }}>
          <Icon.Timer size={34} strokeWidth={1.4} style={{ marginBottom: 12, opacity: .5 }} />
          <div style={{ fontWeight: 500 }}>타이머가 없습니다</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>+ 추가 버튼을 눌러 실험 타이머를 시작하세요</div>
        </div>
      ) : timers.map(t => (
        <TimerCard key={t.id} timer={t} onUpdate={onUpdate} onDelete={onDelete} />
      ))}

      {showAdd && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">타이머 추가</div>
            <div className="form-group">
              <label className="form-label">이름</label>
              <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="예: UV 노광, 소프트베이크" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">시간 프리셋</label>
              <div className="preset-row">
                {presets.map(([s, l]) => (
                  <div key={s} className={`preset-chip${preset === s ? ' sel' : ''}`}
                    onClick={() => { setPreset(s); setForm(p => ({ ...p, duration: s })); setCustom('') }}>
                    {l}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input className="form-input" style={{ flex: 1 }} type="number" placeholder="직접 입력 (초)"
                  value={custom} onChange={e => { setCustom(e.target.value); setForm(p => ({ ...p, duration: Number(e.target.value) || 300 })); setPreset(null) }} />
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>초</span>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">장비 연결 (선택)</label>
              <select className="form-select" value={form.equipment} onChange={e => setForm(p => ({ ...p, equipment: e.target.value }))}>
                <option value="">연결 안 함</option>
                {equipment.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
              </select>
            </div>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 28, fontWeight: 600, color: 'var(--green)' }}>{formatTime(form.duration)}</span>
            </div>
            <button className="btn-primary" onClick={addTimer}>타이머 시작</button>
          </div>
        </div>
      )}
    </div>
  )
}
