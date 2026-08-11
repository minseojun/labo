import React, { useState } from 'react'
import { statusLabel, statusBg, statusColor } from '../utils'
import { toast } from '../utils/toast'
import { Icon } from './Icon'

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)', gap: 12 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="skeleton" style={{ height: 13, width: '50%' }} />
        <div className="skeleton" style={{ height: 11, width: '30%' }} />
      </div>
      <div className="skeleton" style={{ width: 60, height: 24, borderRadius: 6 }} />
    </div>
  )
}

export default function SuppliesTab({ labId, supplies, suppliesHook, user }) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', spec: '', status: 'green' })
  const [sel, setSel] = useState(null)

  const isAdmin = user.role === '교수'
  const canEdit = user.role === '교수' || user.role === '대학원생'

  const changeStatus = async (id, newStatus, currentStatus) => {
    if (!canEdit) return
    const entry = { user: user.name, from: currentStatus, to: newStatus, time: new Date().toLocaleString('ko-KR') }
    const current = supplies.find(s => s.id === id) || sel
    try {
      await suppliesHook.update(id, {
        status: newStatus,
        history: [...(current?.history || []), entry],
      })
      setSel(p => p && p.id === id ? { ...p, status: newStatus, history: [...(p.history || []), entry] } : p)
    } catch (e) {
      console.error(e)
      toast.error('상태 변경에 실패했어요.')
    }
  }

  const addSupply = async () => {
    const name = form.name.trim()
    if (!name) { toast.error('품목 이름을 입력해주세요.'); return }
    if (name.length > 100) { toast.error('이름은 100자 이내로 입력해주세요.'); return }
    try {
      await suppliesHook.add({ ...form, name, history: [] })
      setShowAdd(false)
      setForm({ name: '', spec: '', status: 'green' })
    } catch (e) {
      // error shown by hook
    }
  }

  const deleteSupply = async () => {
    if (!window.confirm(`소모품 "${sel.name}"을 삭제하시겠습니까?`)) return
    try {
      await suppliesHook.remove(sel.id)
      setSel(null)
    } catch (e) {
      // error shown by hook
    }
  }

  const green = supplies.filter(s => s.status === 'green').length
  const yellow = supplies.filter(s => s.status === 'yellow').length
  const red = supplies.filter(s => s.status === 'red').length

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="page-title">소모품 재고</div>
          {canEdit && (
            <button onClick={() => setShowAdd(true)}
              style={{ padding: '8px 14px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              + 추가
            </button>
          )}
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

      {!canEdit && (
        <div style={{ margin: '0 16px 12px', padding: '10px 14px', background: 'var(--yellow-light)', borderRadius: 8, fontSize: 12, color: '#b97b10' }}>
          조회만 가능합니다. 상태 변경은 대학원생 이상만 가능해요.
        </div>
      )}

      {suppliesHook.loading ? (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', margin: '0 16px 12px', overflow: 'hidden' }}>
          {[1,2,3,4].map(i => <SkeletonRow key={i} />)}
        </div>
      ) : supplies.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text2)' }}>
          <Icon.Package size={30} strokeWidth={1.4} style={{ marginBottom: 12, opacity: .5 }} />
          <div style={{ fontWeight: 500 }}>등록된 소모품이 없습니다</div>
        </div>
      ) : (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', margin: '0 16px 12px', overflow: 'hidden' }}>
          {supplies.map(s => (
            <div key={s.id} className="supply-row" onClick={() => setSel({ ...s, history: s.history || [] })}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{s.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 1 }}>{s.spec}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: statusColor(s.status) }}>{statusLabel(s.status)}</span>
                {canEdit ? (
                  <div className="traffic-btns" onClick={e => e.stopPropagation()}>
                    <div className={`traffic-btn g${s.status === 'green' ? ' active' : ''}`} onClick={() => changeStatus(s.id, 'green', s.status)} />
                    <div className={`traffic-btn y${s.status === 'yellow' ? ' active' : ''}`} onClick={() => changeStatus(s.id, 'yellow', s.status)} />
                    <div className={`traffic-btn r${s.status === 'red' ? ' active' : ''}`} onClick={() => changeStatus(s.id, 'red', s.status)} />
                  </div>
                ) : (
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor(s.status) }} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {sel && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setSel(null)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: statusBg(sel.status), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: statusColor(sel.status) }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 17 }}>{sel.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{sel.spec}</div>
              </div>
            </div>
            {canEdit && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[['green', '정상'], ['yellow', '곧 부족'], ['red', '재고 없음']].map(([v, l]) => (
                  <button key={v} onClick={() => changeStatus(sel.id, v, sel.status)}
                    style={{ flex: 1, padding: '10px 6px', border: `2px solid ${sel.status === v ? statusColor(v) : 'var(--border)'}`, borderRadius: 8, background: sel.status === v ? statusBg(v) : 'var(--card)', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: sel.status === v ? statusColor(v) : 'var(--text2)' }}>
                    {l}
                  </button>
                ))}
              </div>
            )}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: .5 }}>변경 이력</div>
            {sel.history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 12, color: 'var(--text2)' }}>변경 이력이 없습니다</div>
            ) : [...sel.history].reverse().map((h, i) => (
              <div key={i} className="log-item">
                <div>
                  <span style={{ fontWeight: 500 }}>{h.user}</span>
                  <span style={{ color: 'var(--text2)', marginLeft: 6 }}>{statusLabel(h.from)} → {statusLabel(h.to)}</span>
                </div>
                <div style={{ color: 'var(--text2)', fontSize: 11 }}>{h.time}</div>
              </div>
            ))}
            {isAdmin && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <button onClick={deleteSupply}
                  style={{ width: '100%', padding: 10, background: 'var(--red-light)', color: 'var(--red)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  소모품 삭제
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showAdd && canEdit && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">소모품 추가</div>
            <div className="form-group">
              <label className="form-label">품목 이름</label>
              <input className="form-input" value={form.name} maxLength={100}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="예: 포토레지스트 PR-100" />
            </div>
            <div className="form-group">
              <label className="form-label">규격/단위</label>
              <input className="form-input" value={form.spec} maxLength={100}
                onChange={e => setForm(p => ({ ...p, spec: e.target.value }))}
                placeholder="예: 500ml, 10개입" />
            </div>
            <div className="form-group">
              <label className="form-label">초기 상태</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['green', '정상'], ['yellow', '곧 부족'], ['red', '재고 없음']].map(([v, l]) => (
                  <button key={v} onClick={() => setForm(p => ({ ...p, status: v }))}
                    style={{ flex: 1, padding: '9px 4px', border: `1.5px solid ${form.status === v ? statusColor(v) : 'var(--border)'}`, borderRadius: 8, background: form.status === v ? statusBg(v) : 'var(--card)', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: form.status === v ? statusColor(v) : 'var(--text2)' }}>
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
