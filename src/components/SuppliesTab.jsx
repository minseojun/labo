import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { toCamelRow } from '../hooks/useSupabase'
import { statusLabel, statusBg, statusColor, fmtDate } from '../utils'
import { toast } from '../utils/toast'
import { Icon } from './Icon'

const daysUntil = (dateStr) => {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date(fmtDate(new Date()))) / 86400000)
}

// supply_history는 별도 테이블이라 필요한 만큼만 가져오면 되고, 소모품 하나를
// 오래 관리해서 이력이 아무리 쌓여도 여기 쿼리 비용은 그대로임
function useSupplyHistory(labId, supplyId) {
  const [history, setHistory] = useState([])

  const fetchHistory = useCallback(async () => {
    if (!labId || !supplyId) return
    const { data, error } = await supabase
      .from('supply_history').select('*').eq('supply_id', supplyId)
      .order('created_at', { ascending: false }).limit(8)
    if (error) { console.error(error); return }
    setHistory(data.map(toCamelRow))
  }, [labId, supplyId])

  useEffect(() => {
    if (!labId || !supplyId) return
    fetchHistory()
    const channel = supabase
      .channel(`supply_history-${supplyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supply_history', filter: `supply_id=eq.${supplyId}` }, fetchHistory)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [labId, supplyId, fetchHistory])

  return history
}

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
  const [form, setForm] = useState({ name: '', spec: '', status: 'green', location: '', expiresAt: '' })
  const [sel, setSel] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [query, setQuery] = useState('')
  const history = useSupplyHistory(labId, sel?.id)

  // 냉장고맵을 흡수하면서 소모품 전체를 랩 구성원 누구나 수정·삭제할 수 있게
  // 열어둠(예전엔 상태변경 대학원생 이상, 삭제는 교수만). DB의 supplies_update/
  // supplies_delete 정책도 is_lab_member로 같이 완화해뒀음
  const canEdit = true

  const changeStatus = async (id, newStatus, currentStatus) => {
    try {
      await suppliesHook.update(id, { status: newStatus })
      // 변경 이력은 supply_history 별도 테이블에 쌓음 — supplies 행 안에 배열로
      // 넣으면 오래 관리할수록 그 행 자체가 끝없이 커짐
      const { error: histError } = await supabase.from('supply_history').insert({
        supply_id: id, lab_id: labId,
        user_name: user.name, from_status: currentStatus, to_status: newStatus,
      })
      if (histError) console.error(histError)
      setSel(p => p && p.id === id ? { ...p, status: newStatus } : p)
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
      await suppliesHook.add({ ...form, name, location: form.location.trim() || null, expiresAt: form.expiresAt || null })
      setShowAdd(false)
      setForm({ name: '', spec: '', status: 'green', location: '', expiresAt: '' })
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

  const openEditSupply = (s) => {
    setEditTarget({ ...s, location: s.location || '', expiresAt: s.expiresAt || '' })
    setSel(null)
  }

  const saveEditSupply = async () => {
    const name = editTarget.name.trim()
    if (!name) { toast.error('품목 이름을 입력해주세요.'); return }
    if (name.length > 100) { toast.error('이름은 100자 이내로 입력해주세요.'); return }
    try {
      await suppliesHook.update(editTarget.id, {
        name, spec: editTarget.spec.trim(),
        location: editTarget.location.trim() || null, expiresAt: editTarget.expiresAt || null,
      })
      setEditTarget(null)
      toast.success('수정했어요')
    } catch (e) {
      // error shown by hook
    }
  }

  const green = supplies.filter(s => s.status === 'green').length
  const yellow = supplies.filter(s => s.status === 'yellow').length
  const red = supplies.filter(s => s.status === 'red').length

  const q = query.trim().toLowerCase()
  const filtered = !q ? supplies : supplies.filter(s =>
    s.name?.toLowerCase().includes(q) || s.spec?.toLowerCase().includes(q) || s.location?.toLowerCase().includes(q))

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

      {supplies.length > 0 && (
        <div style={{ padding: '0 16px 12px', position: 'relative' }}>
          <Icon.Search size={15} strokeWidth={2} style={{ position: 'absolute', left: 30, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
          <input className="form-input" style={{ paddingLeft: 34 }} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="품목 이름, 규격, 보관 위치로 검색" />
        </div>
      )}

      {suppliesHook.loading ? (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', margin: '0 16px 12px', overflow: 'hidden' }}>
          {[1,2,3,4].map(i => <SkeletonRow key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text2)' }}>
          <Icon.Package size={30} strokeWidth={1.4} style={{ marginBottom: 12, opacity: .5 }} />
          <div style={{ fontWeight: 500 }}>{q ? '검색 결과가 없습니다' : '등록된 소모품이 없습니다'}</div>
        </div>
      ) : (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', margin: '0 16px 12px', overflow: 'hidden' }}>
          {filtered.map(s => {
            const d = daysUntil(s.expiresAt)
            const soon = d !== null && d <= 14
            return (
              <div key={s.id} className="supply-row" onClick={() => setSel(s)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 13 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[s.spec, s.location].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {soon && <span className="chip chip-red">{d <= 0 ? '만료' : `D-${d}`}</span>}
                  <span style={{ fontSize: 11, fontWeight: 600, color: statusColor(s.status) }}>{statusLabel(s.status)}</span>
                  <div className="traffic-btns" onClick={e => e.stopPropagation()}>
                    <div className={`traffic-btn g${s.status === 'green' ? ' active' : ''}`} onClick={() => changeStatus(s.id, 'green', s.status)} />
                    <div className={`traffic-btn y${s.status === 'yellow' ? ' active' : ''}`} onClick={() => changeStatus(s.id, 'yellow', s.status)} />
                    <div className={`traffic-btn r${s.status === 'red' ? ' active' : ''}`} onClick={() => changeStatus(s.id, 'red', s.status)} />
                  </div>
                </div>
              </div>
            )
          })}
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
            {sel.location && <div className="log-item"><span style={{ color: 'var(--text2)' }}>보관 위치</span><span>{sel.location}</span></div>}
            {sel.expiresAt && (
              <div className="log-item">
                <span style={{ color: 'var(--text2)' }}>유효기한</span>
                <span>{sel.expiresAt}{daysUntil(sel.expiresAt) !== null && daysUntil(sel.expiresAt) <= 14 ? ` · ${daysUntil(sel.expiresAt) <= 0 ? '만료됨' : `D-${daysUntil(sel.expiresAt)}`}` : ''}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, margin: '16px 0' }}>
              {[['green', '정상'], ['yellow', '곧 부족'], ['red', '재고 없음']].map(([v, l]) => (
                <button key={v} onClick={() => changeStatus(sel.id, v, sel.status)}
                  style={{ flex: 1, padding: '10px 6px', border: `2px solid ${sel.status === v ? statusColor(v) : 'var(--border)'}`, borderRadius: 8, background: sel.status === v ? statusBg(v) : 'var(--card)', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: sel.status === v ? statusColor(v) : 'var(--text2)' }}>
                  {l}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: .5 }}>변경 이력</div>
            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 12, color: 'var(--text2)' }}>변경 이력이 없습니다</div>
            ) : history.map(h => (
              <div key={h.id} className="log-item">
                <div>
                  <span style={{ fontWeight: 500 }}>{h.userName}</span>
                  <span style={{ color: 'var(--text2)', marginLeft: 6 }}>{statusLabel(h.fromStatus)} → {statusLabel(h.toStatus)}</span>
                </div>
                <div style={{ color: 'var(--text2)', fontSize: 11 }}>
                  {new Date(h.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
              <button onClick={() => openEditSupply(sel)}
                style={{ flex: 1, padding: 10, background: 'var(--green-light)', color: 'var(--green)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                수정
              </button>
              <button onClick={deleteSupply}
                style={{ flex: 1, padding: 10, background: 'var(--red-light)', color: 'var(--red)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setEditTarget(null)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">소모품 수정</div>
            <div className="form-group">
              <label className="form-label">품목 이름</label>
              <input className="form-input" value={editTarget.name} maxLength={100}
                onChange={e => setEditTarget(p => ({ ...p, name: e.target.value }))} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">규격/단위 (선택)</label>
              <input className="form-input" value={editTarget.spec || ''} maxLength={100}
                onChange={e => setEditTarget(p => ({ ...p, spec: e.target.value }))}
                placeholder="예: 500ml, 10개입" />
            </div>
            <div className="form-group">
              <label className="form-label">보관 위치 (선택)</label>
              <input className="form-input" value={editTarget.location} maxLength={60}
                onChange={e => setEditTarget(p => ({ ...p, location: e.target.value }))}
                placeholder="예: 4℃ 냉장고 · 2번 칸" />
            </div>
            <div className="form-group">
              <label className="form-label">유효기한 (선택)</label>
              <input className="form-input" type="date" value={editTarget.expiresAt}
                onChange={e => setEditTarget(p => ({ ...p, expiresAt: e.target.value }))} />
            </div>
            <button className="btn-primary" onClick={saveEditSupply}>저장하기</button>
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
              <input className="form-input" value={form.name} maxLength={100}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="예: 포토레지스트 PR-100" />
            </div>
            <div className="form-group">
              <label className="form-label">규격/단위 (선택)</label>
              <input className="form-input" value={form.spec} maxLength={100}
                onChange={e => setForm(p => ({ ...p, spec: e.target.value }))}
                placeholder="예: 500ml, 10개입" />
            </div>
            <div className="form-group">
              <label className="form-label">보관 위치 (선택)</label>
              <input className="form-input" value={form.location} maxLength={60}
                onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                placeholder="예: 4℃ 냉장고 · 2번 칸" />
            </div>
            <div className="form-group">
              <label className="form-label">유효기한 (선택)</label>
              <input className="form-input" type="date" value={form.expiresAt}
                onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))} />
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
