import React, { useState } from 'react'

function StatusChip({ status }) {
  if (status === 'available') return <span className="chip chip-green">가용</span>
  if (status === 'in-use') return <span className="chip chip-red">사용중</span>
  return <span className="chip chip-yellow">점검중</span>
}

function bgColor(s) {
  return s === 'available' ? 'var(--green-light)' : s === 'in-use' ? 'var(--red-light)' : 'var(--yellow-light)'
}

export default function EquipmentTab({ equipment, setEquipment, user }) {
  const [sel, setSel] = useState(null)
  const [showQR, setShowQR] = useState(false)
  const [memo, setMemo] = useState('')
  const [scanning, setScanning] = useState(false)
  const [filter, setFilter] = useState('all')

  const filtered = equipment.filter(e => filter === 'all' || e.status === filter)

  const toggleUse = (eq) => {
    const isUsing = eq.status === 'in-use' && eq.lastUser === user.name
    const newLog = {
      user: user.name,
      action: isUsing ? '사용 종료' : '사용 시작',
      time: new Date().toLocaleString('ko-KR').slice(0, -3),
      memo: isUsing ? memo : ''
    }
    const updated = {
      ...eq,
      status: isUsing ? 'available' : 'in-use',
      lastUser: user.name,
      logs: [newLog, ...eq.logs].slice(0, 10)
    }
    setEquipment(p => p.map(e => e.id === eq.id ? updated : e))
    setSel(updated)
    if (isUsing) setMemo('')
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="page-title">장비 관리</div>
          <button onClick={() => setScanning(true)}
            style={{ padding: '8px 14px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            📷 QR 스캔
          </button>
        </div>
      </div>

      <div className="filter-row">
        {[['all', '전체'], ['available', '가용'], ['in-use', '사용중'], ['maintenance', '점검중']].map(([v, l]) => (
          <div key={v} className={`filter-chip${filter === v ? ' active' : ''}`} onClick={() => setFilter(v)}>{l}</div>
        ))}
      </div>

      {filtered.map(eq => (
        <div key={eq.id} className="equip-card" onClick={() => setSel(eq)}>
          <div className="equip-icon" style={{ background: bgColor(eq.status) }}>{eq.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{eq.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>코드: {eq.code} · 최근: {eq.lastUser}</div>
          </div>
          <StatusChip status={eq.status} />
        </div>
      ))}

      {sel && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setSel(null)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div className="equip-icon" style={{ background: bgColor(sel.status), width: 48, height: 48, borderRadius: 12, fontSize: 24 }}>{sel.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{sel.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{sel.code}</div>
              </div>
              <StatusChip status={sel.status} />
            </div>

            {sel.status !== 'maintenance' && (
              <>
                {sel.status === 'in-use' && sel.lastUser === user.name && (
                  <div className="form-group">
                    <label className="form-label">실험 메모</label>
                    <textarea className="form-input" rows={2} value={memo} onChange={e => setMemo(e.target.value)}
                      placeholder="실험 조건, 주의사항 등..." style={{ resize: 'none' }} />
                  </div>
                )}
                <div className="timer-controls">
                  {sel.status === 'available' ? (
                    <button className="timer-btn btn-play" onClick={() => toggleUse(equipment.find(e => e.id === sel.id))}>▶ 사용 시작</button>
                  ) : (
                    sel.lastUser === user.name ? (
                      <button className="timer-btn btn-stop" onClick={() => toggleUse(equipment.find(e => e.id === sel.id))}>■ 사용 종료</button>
                    ) : (
                      <div style={{ flex: 1, textAlign: 'center', fontSize: 13, color: 'var(--text2)', padding: 10 }}>{sel.lastUser} 사용 중</div>
                    )
                  )}
                  <button className="timer-btn" style={{ background: 'var(--green-light)', color: 'var(--green)', flex: .5 }}
                    onClick={() => setShowQR(true)}>QR</button>
                </div>
              </>
            )}

            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', margin: '14px 0 8px', textTransform: 'uppercase', letterSpacing: .5 }}>사용 이력</div>
            {sel.logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 12, color: 'var(--text2)' }}>사용 이력이 없습니다</div>
            ) : sel.logs.map((l, i) => (
              <div key={i} className="log-item">
                <div>
                  <span style={{ fontWeight: 500 }}>{l.user}</span>
                  <span style={{ color: 'var(--text2)', marginLeft: 6 }}>{l.action}</span>
                  {l.memo && <div style={{ color: 'var(--text2)', marginTop: 1, fontSize: 11 }}>{l.memo}</div>}
                </div>
                <div style={{ color: 'var(--text2)', whiteSpace: 'nowrap', marginLeft: 8 }}>{l.time}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {scanning && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setScanning(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">QR 코드 스캔</div>
            <div className="qr-area">
              <div className="qr-scanner-frame" />
            </div>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
              카메라가 QR 코드를 감지하면 자동으로 인식됩니다
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {equipment.map(eq => (
                <button key={eq.id}
                  style={{ padding: '10px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--card)', cursor: 'pointer', fontSize: 12, fontWeight: 500, textAlign: 'left' }}
                  onClick={() => { setScanning(false); setSel(eq) }}>
                  {eq.icon} {eq.name.slice(0, 8)}...
                </button>
              ))}
            </div>
            <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text2)', marginTop: 12 }}>* 데모: 위 장비를 직접 선택하세요</p>
          </div>
        </div>
      )}

      {showQR && sel && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setShowQR(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">QR 코드 — {sel.name}</div>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
              <svg width="160" height="160" viewBox="0 0 160 160" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, background: '#fff' }}>
                {/* QR placeholder pattern */}
                {[0,1,2,3,4].map(r => [0,1,2,3,4].map(c => {
                  const p = [[1,1,1,1,1],[1,0,1,0,1],[1,0,1,0,1],[1,0,1,0,1],[1,1,1,1,1]]
                  return p[r][c] ? <rect key={`${r}${c}`} x={8+c*16} y={8+r*16} width={14} height={14} fill="#1A1A1A" rx={2} /> : null
                }))}
                <text x="80" y="152" textAnchor="middle" fontSize="10" fill="#6B7280">{sel.code}</text>
              </svg>
            </div>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 600 }}>{sel.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>{sel.code}</div>
            </div>
            <button className="btn-primary" onClick={() => window.print()}>🖨️ 인쇄 / 저장</button>
          </div>
        </div>
      )}
    </div>
  )
}
