import React, { useState } from 'react'
import { useCollection } from '../hooks/useSupabase'
import { fmtDate } from '../utils'
import { toast } from '../utils/toast'
import { Icon } from './Icon'

const NO_LOCATION = '위치 미지정'

const daysUntil = (dateStr) => {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date(fmtDate(new Date()))) / 86400000)
}

// fridgeName·location 문자열은 자유 입력이라 매번 순서가 흔들리면 칸 위치가 계속 바뀌어
// 보여서 헷갈림 — 로케일 정렬로 고정
const sortKo = (arr) => [...arr].sort((a, b) => a.localeCompare(b, 'ko'))

export default function FridgeMapScreen({ labId, user }) {
  const hook = useCollection(labId, 'fridge_items', 'created_at')
  const [showAdd, setShowAdd] = useState(false)
  const [sel, setSel] = useState(null)
  const [query, setQuery] = useState('')
  const [selectedFridge, setSelectedFridge] = useState(null)
  const [listOpen, setListOpen] = useState(false)
  const [form, setForm] = useState({ fridgeName: '', location: '', itemName: '', quantity: '', expiresAt: '' })

  const isAdmin = user.role === '교수'
  const allFridgeNames = sortKo([...new Set(hook.data.map(it => it.fridgeName))])

  const q = query.trim().toLowerCase()
  const searched = q ? hook.data.filter(it =>
    [it.itemName, it.fridgeName, it.location, it.owner].some(v => v?.toLowerCase().includes(q))
  ) : hook.data
  const scoped = selectedFridge ? searched.filter(it => it.fridgeName === selectedFridge) : searched
  const fridgeNamesToShow = sortKo([...new Set(scoped.map(it => it.fridgeName))])

  const addItem = async () => {
    const fridgeName = form.fridgeName.trim()
    const itemName = form.itemName.trim()
    if (!fridgeName) { toast.error('냉장고/냉동고 이름을 입력해주세요.'); return }
    if (!itemName) { toast.error('시약/보관품 이름을 입력해주세요.'); return }
    if (itemName.length > 100) { toast.error('이름은 100자 이내로 입력해주세요.'); return }
    try {
      await hook.add({
        fridgeName, location: form.location.trim(), itemName,
        quantity: form.quantity.trim(), expiresAt: form.expiresAt || null, owner: user.name,
      })
      setShowAdd(false)
      setForm({ fridgeName: '', location: '', itemName: '', quantity: '', expiresAt: '' })
      toast.success('보관 위치를 등록했어요')
    } catch (e) { /* error shown by hook */ }
  }

  const deleteItem = async () => {
    if (!window.confirm(`"${sel.itemName}" 기록을 삭제하시겠습니까?`)) return
    try {
      await hook.remove(sel.id)
      setSel(null)
    } catch (e) { /* error shown by hook */ }
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="page-title">냉장/냉동고 맵</div>
          <button onClick={() => setShowAdd(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Icon.Plus size={14} strokeWidth={2.4} /> 등록
          </button>
        </div>
      </div>

      <div style={{ padding: '0 16px 12px' }}>
        <input className="form-input" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="시약, 칸, 냉장고 이름으로 검색" />
      </div>

      {allFridgeNames.length > 1 && (
        <div className="filter-row">
          <div className={`filter-chip${!selectedFridge ? ' active' : ''}`} onClick={() => setSelectedFridge(null)}>전체</div>
          {allFridgeNames.map(name => (
            <div key={name} className={`filter-chip${selectedFridge === name ? ' active' : ''}`}
              onClick={() => setSelectedFridge(p => p === name ? null : name)}>{name}</div>
          ))}
        </div>
      )}

      {hook.loading ? null : scoped.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text2)' }}>
          <Icon.Snowflake size={30} strokeWidth={1.4} style={{ marginBottom: 12, opacity: .5 }} />
          <div style={{ fontWeight: 500 }}>{q || selectedFridge ? '검색 결과가 없습니다' : '등록된 보관 위치가 없습니다'}</div>
          {!q && !selectedFridge && <div style={{ fontSize: 12, marginTop: 4 }}>+ 등록 버튼으로 "어디에 뭐가 있는지" 기록하세요</div>}
        </div>
      ) : (
        <div style={{ padding: '0 16px' }}>
          {fridgeNamesToShow.map(fridgeName => {
            const items = scoped.filter(it => it.fridgeName === fridgeName)
            const locations = sortKo([...new Set(items.map(it => it.location || NO_LOCATION))])
            return (
              <div key={fridgeName} style={{
                background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 18,
                padding: '14px 16px 16px', marginBottom: 14, boxShadow: 'var(--shadow-xs)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10, marginBottom: 10, borderBottom: '2px solid var(--border)' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--blue-light)', color: '#2259c4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon.Snowflake size={16} />
                  </div>
                  <div style={{ fontWeight: 650, fontSize: 15, flex: 1 }}>{fridgeName}</div>
                  <span className="chip chip-blue">{items.length}개</span>
                </div>

                {locations.map((loc, i) => {
                  const shelfItems = [...items.filter(it => (it.location || NO_LOCATION) === loc)]
                    .sort((a, b) => {
                      const da = daysUntil(a.expiresAt), db = daysUntil(b.expiresAt)
                      const sa = da !== null && da <= 14 ? 0 : 1, sb = db !== null && db <= 14 ? 0 : 1
                      return sa - sb || a.itemName.localeCompare(b.itemName, 'ko')
                    })
                  return (
                    <div key={loc} style={{ paddingTop: i === 0 ? 0 : 10, marginTop: i === 0 ? 0 : 10, borderTop: i === 0 ? 'none' : '1px dashed var(--border)' }}>
                      <div style={{ fontSize: 10.5, fontWeight: 650, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>{loc}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {shelfItems.map(it => {
                          const d = daysUntil(it.expiresAt)
                          const soon = d !== null && d <= 14
                          return (
                            <button key={it.id} onClick={() => setSel(it)} style={{
                              display: 'flex', alignItems: 'center', gap: 5, padding: '7px 10px', borderRadius: 10,
                              border: `1px solid ${soon ? '#f5c0c0' : 'var(--border)'}`,
                              background: soon ? 'var(--red-light)' : 'var(--bg)',
                              color: soon ? 'var(--red)' : 'var(--text)',
                              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                            }}>
                              {it.itemName}
                              {soon && <span style={{ fontSize: 10, fontWeight: 700 }}>{d <= 0 ? '만료' : `D-${d}`}</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {scoped.length > 0 && (
        <div style={{ margin: '4px 16px 16px' }}>
          <div onClick={() => setListOpen(p => !p)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 2px', cursor: 'pointer', color: 'var(--text2)', fontSize: 12.5, fontWeight: 600 }}>
            <Icon.ChevronDown size={13} strokeWidth={2} style={{ transform: listOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            전체 목록으로 보기 ({scoped.length})
          </div>
          {listOpen && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              {scoped.map(it => {
                const d = daysUntil(it.expiresAt)
                const soon = d !== null && d <= 14
                return (
                  <div key={it.id} className="equip-card" onClick={() => setSel(it)}>
                    <div className="equip-icon" style={{ background: soon ? 'var(--red-light)' : 'var(--blue-light)', color: soon ? 'var(--red)' : '#2259c4' }}>
                      <Icon.Snowflake size={20} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.itemName}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{it.fridgeName}{it.location ? ` · ${it.location}` : ''}</div>
                    </div>
                    {soon && <span className="chip chip-red">{d <= 0 ? '만료됨' : `D-${d}`}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">보관 위치 등록</div>
            <div className="form-group">
              <label className="form-label">냉장고/냉동고</label>
              <input className="form-input" value={form.fridgeName} maxLength={40} list="fridge-name-options"
                onChange={e => setForm(p => ({ ...p, fridgeName: e.target.value }))}
                placeholder="예: 4℃ 냉장고" autoFocus />
              <datalist id="fridge-name-options">
                {allFridgeNames.map(name => <option key={name} value={name} />)}
              </datalist>
            </div>
            <div className="form-group">
              <label className="form-label">칸/위치 (선택)</label>
              <input className="form-input" value={form.location} maxLength={40}
                onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                placeholder="예: 2번 칸" />
            </div>
            <div className="form-group">
              <label className="form-label">시약/보관품</label>
              <input className="form-input" value={form.itemName} maxLength={100}
                onChange={e => setForm(p => ({ ...p, itemName: e.target.value }))}
                placeholder="예: FBS (소태아혈청)" />
            </div>
            <div className="form-group">
              <label className="form-label">수량 (선택)</label>
              <input className="form-input" value={form.quantity} maxLength={40}
                onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
                placeholder="예: 500ml x2" />
            </div>
            <div className="form-group">
              <label className="form-label">유효기한 (선택)</label>
              <input className="form-input" type="date" value={form.expiresAt}
                onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))} />
            </div>
            <button className="btn-primary" onClick={addItem}>등록하기</button>
          </div>
        </div>
      )}

      {sel && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setSel(null)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--blue-light)', color: '#2259c4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon.Snowflake size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 17 }}>{sel.itemName}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{sel.fridgeName}{sel.location ? ` · ${sel.location}` : ''}</div>
              </div>
            </div>
            {sel.quantity && <div className="log-item"><span style={{ color: 'var(--text2)' }}>수량</span><span>{sel.quantity}</span></div>}
            {sel.expiresAt && <div className="log-item"><span style={{ color: 'var(--text2)' }}>유효기한</span><span>{sel.expiresAt}</span></div>}
            <div className="log-item"><span style={{ color: 'var(--text2)' }}>등록자</span><span>{sel.owner}</span></div>
            {(isAdmin || sel.owner === user.name) && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <button onClick={deleteItem}
                  style={{ width: '100%', padding: 10, background: 'var(--red-light)', color: 'var(--red)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  기록 삭제
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
