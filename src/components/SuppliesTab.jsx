import React, { useState } from 'react'
import { statusLabel, statusBg, statusColor } from '../utils'

export default function SuppliesTab({ supplies, setSupplies, user }) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', spec: '', status: 'green' })
  const [sel, setSel] = useState(null)

  const changeStatus = (id, newStatus) => {
    const now = new Date().toLocaleString('ko-KR').slice(0, -3)
    setSupplies(p => p.map(s => s.id === id
      ? { ...s, status: newStatus, history: [{ user: user.name, from: s.status, to: newStatus, time: now }, ...s.history] }
      : s
    ))
    setSel(p => p && p.id === id
      ? { ...p, status: newStatus, history: [{ user: user.name, from: p.status, to: newStatus, time: now }, ...p.history] }
      : p
    )
    // TODO: Firebase FCM push notification when status → 'red'
    // if (newStatus === 'red') sendPushNotification(...)
  }

  const addSupply = () => {
    if (!form.name) return
    setSupplies(p => [...p, { id: 'p' + Date.now(), ...form, history: [] }])
    setShowAdd(false)
    setForm({ name: '', spec: '', status: 'green' })
  }

  const green = supplies.filter(s => s.status === 'green').length
  const yellow = supplies.filter(s => s.status === 'yellow').length
  const red = supplies.filter(s => s.status === 'red').length

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="page-title">소모품 재고</div>
          <button onClick={() => setShowAdd(true)}
            style={{ padding: '8px 14px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            + 추가
          </button>
        </div>
      </div>

      <div className="supply-summary">
        <div className="supply-stat">
          <div className="n" style={{ color: '#1a7a52' }}>{green}</div>
          <div className="l">정상</div>
        </div>
        <div className="supply-stat">
          <div className="n" style={{ color: '#b97b10' }}>{yellow}</div>
          <div className="l">곧 부족</div>
        </div>
        <div className="supply-stat" style={{ borderColor: red > 0 ? '#f8c5c5' : 'var(--border)' }}>
          <div className="n" style={{ color: '#c23b3b' }}>{red}</div>
          <div className="l">재고 없음</div>
        </div>
      </div>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', margin: '0 16px 12px', overflow: 'hidden' }}>
        {supplies.map(s => (
          <div key={s.id} className="supply-row" onClick={() => setSel(s)}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 13 }}>{s.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 1 }}>{s.spec}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: statusColor(s.status) }}>{statusLabel(s.status)}</span>
              <div className="traffic-btns" onClick={e => e.stopPropagation()}>
                <div className={`traffic-btn g${s.status === 'green' ? ' active' : ''}`} onClick={() => changeStatus(s.id, 'green')} />
                <div className={`traffic-btn y${s.status === 'yellow' ? ' active' : ''}`} onClick={() => changeStatus(s.id, 'yellow')} />
                <div className={`traffic-btn r${s.status === 'red' ? ' active' : ''}`} onClick={() => changeStatus(s.id, 'red')} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {sel && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setSel(null)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: statusBg(sel.status), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                {sel.status === 'green' ? '🟢' : sel.status === 'yellow' ? '🟡' : '🔴'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{sel.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{sel.spec}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[['green', '🟢 정상'], ['yellow', '🟡 곧 부족'], ['red', '🔴 재고 없음']].map(([v, l]) => (
                <button key={v} onClick={() => changeStatus(sel.id, v)}
                  style={{ flex: 1, padding: '10px 6px', border: `2px solid ${sel.status === v ? statusColor(v) : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', background: sel.status === v ? statusBg(v) : 'var(--card)', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: sel.status === v ? statusColor(v) : 'var(--text2)' }}>
                  {l}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: .5 }}>변경 이력</div>
            {sel.history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 12, color: 'var(--text2)' }}>변경 이력이 없습니다</div>
            ) : sel.history.map((h, i) => (
              <div key={i} className="log-item">
                <div>
                  <span style={{ fontWeight: 500 }}>{h.user}</span>
                  <span style={{ color: 'var(--text2)', marginLeft: 6 }}>{statusLabel(h.from)} → {statusLabel(h.to)}</span>
                </div>
                <div style={{ color: 'var(--text2)' }}>{h.time}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAdd && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">소모품 추가</div>
            <div className="form-group">
              <label className="form-label">품목 이름</label>
              <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="예: 포토레지스트 PR-100" />
            </div>
            <div className="form-group">
              <label className="form-label">규격/단위</label>
              <input className="form-input" value={form.spec} onChange={e => setForm(p => ({ ...p, spec: e.target.value }))} placeholder="예: 500ml, 10개입" />
            </div>
            <div className="form-group">
              <label className="form-label">초기 상태</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['green', '🟢 정상'], ['yellow', '🟡 곧 부족'], ['red', '🔴 재고 없음']].map(([v, l]) => (
                  <button key={v} onClick={() => setForm(p => ({ ...p, status: v }))}
                    style={{ flex: 1, padding: '9px 4px', border: `1.5px solid ${form.status === v ? statusColor(v) : 'var(--border)'}`, borderRadius: 'var(--radius-sm)', background: form.status === v ? statusBg(v) : 'var(--card)', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: form.status === v ? statusColor(v) : 'var(--text2)' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn-primary" onClick={addSupply}>추가하기</button>
          </div>
        </div>
      )}
    </div>
  )
}
