import React, { useState } from 'react'
import { useCollection } from '../hooks/useSupabase'
import { fmtDate } from '../utils'
import { toast } from '../utils/toast'
import { Icon } from './Icon'

const CATEGORIES = [
  ['spill', '유출'],
  ['exposure', '노출'],
  ['burn', '화상'],
  ['equipment', '장비 손상'],
  ['other', '기타'],
]
const SEVERITIES = [
  ['low', '경미', 'var(--green)', 'var(--green-light)', '#c8ecd9'],
  ['medium', '보통', '#b97b10', 'var(--yellow-light)', '#f5dfa0'],
  ['high', '심각', 'var(--red)', 'var(--red-light)', '#f5c0c0'],
]
const categoryLabel = v => CATEGORIES.find(c => c[0] === v)?.[1] || v
const severityInfo = v => SEVERITIES.find(s => s[0] === v) || SEVERITIES[0]

export default function HazardLogScreen({ labId, user }) {
  const hook = useCollection(labId, 'hazard_incidents', 'occurred_at')
  const [showAdd, setShowAdd] = useState(false)
  const [sel, setSel] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [query, setQuery] = useState('')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [form, setForm] = useState({
    title: '', category: 'spill', severity: 'low',
    location: '', actionTaken: '', occurredAt: fmtDate(new Date()),
  })

  const isAdmin = user.role === '교수'
  const counts = { low: 0, medium: 0, high: 0 }
  hook.data.forEach(inc => { if (counts[inc.severity] != null) counts[inc.severity]++ })

  const q = query.trim().toLowerCase()
  const filtered = hook.data
    .filter(inc => !q || [inc.title, inc.location, categoryLabel(inc.category)].some(v => v?.toLowerCase().includes(q)))
    .filter(inc => severityFilter === 'all' || inc.severity === severityFilter)

  const addIncident = async () => {
    const title = form.title.trim()
    if (!title) { toast.error('사고 내용을 입력해주세요.'); return }
    if (title.length > 150) { toast.error('제목은 150자 이내로 입력해주세요.'); return }
    try {
      await hook.add({
        title, category: form.category, severity: form.severity,
        location: form.location.trim(), actionTaken: form.actionTaken.trim(),
        occurredAt: form.occurredAt, reporter: user.name,
      })
      setShowAdd(false)
      setForm({ title: '', category: 'spill', severity: 'low', location: '', actionTaken: '', occurredAt: fmtDate(new Date()) })
      toast.success('위험물 이력을 기록했어요')
    } catch (e) {
      // error shown by hook
    }
  }

  const deleteIncident = async () => {
    if (!window.confirm('이 기록을 삭제하시겠습니까?')) return
    try {
      await hook.remove(sel.id)
      setSel(null)
    } catch (e) {
      // error shown by hook
    }
  }

  const openEditIncident = (inc) => {
    setEditTarget({ ...inc })
    setSel(null)
  }

  const saveEditIncident = async () => {
    const title = editTarget.title.trim()
    if (!title) { toast.error('사고 내용을 입력해주세요.'); return }
    if (title.length > 150) { toast.error('제목은 150자 이내로 입력해주세요.'); return }
    try {
      await hook.update(editTarget.id, {
        title, category: editTarget.category, severity: editTarget.severity,
        location: editTarget.location.trim(), actionTaken: editTarget.actionTaken.trim(),
        occurredAt: editTarget.occurredAt,
      })
      setEditTarget(null)
      toast.success('수정했어요')
    } catch (e) {
      // error shown by hook
    }
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="page-title">위험물 이력</div>
          <button onClick={() => setShowAdd(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Icon.Plus size={14} strokeWidth={2.4} /> 기록
          </button>
        </div>
      </div>

      {hook.data.length > 0 && (
        <div className="supply-summary">
          <div className="supply-stat">
            <div className="n" style={{ color: '#1a7a52' }}>{counts.low}</div>
            <div className="l">경미</div>
          </div>
          <div className="supply-stat">
            <div className="n" style={{ color: '#b97b10' }}>{counts.medium}</div>
            <div className="l">보통</div>
          </div>
          <div className="supply-stat" style={{ borderColor: counts.high > 0 ? '#f8c5c5' : 'var(--border)' }}>
            <div className="n" style={{ color: '#c23b3b' }}>{counts.high}</div>
            <div className="l">심각</div>
          </div>
        </div>
      )}

      {hook.data.length > 0 && (
        <div style={{ padding: '0 16px 12px', position: 'relative' }}>
          <Icon.Search size={15} strokeWidth={2} style={{ position: 'absolute', left: 30, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
          <input className="form-input" style={{ paddingLeft: 34 }} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="내용, 장소, 유형으로 검색" />
        </div>
      )}

      {hook.data.length > 0 && (
        <div className="filter-row">
          {[['all', '전체'], ['low', '경미'], ['medium', '보통'], ['high', '심각']].map(([v, l]) => (
            <div key={v} className={`filter-chip${severityFilter === v ? ' active' : ''}`} onClick={() => setSeverityFilter(v)}>{l}</div>
          ))}
        </div>
      )}

      {hook.loading ? null : hook.data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text2)' }}>
          <Icon.AlertTriangle size={32} strokeWidth={1.5} style={{ marginBottom: 12, opacity: .5 }} />
          <div style={{ fontWeight: 500 }}>기록된 위험물 이력이 없습니다</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>+ 기록 버튼으로 사고를 기록하세요</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text2)' }}>
          <Icon.AlertTriangle size={32} strokeWidth={1.5} style={{ marginBottom: 12, opacity: .5 }} />
          <div style={{ fontWeight: 500 }}>검색 결과가 없습니다</div>
        </div>
      ) : filtered.map(inc => {
        const sev = severityInfo(inc.severity)
        return (
          <div key={inc.id} className="equip-card" onClick={() => setSel(inc)}>
            <div className="equip-icon" style={{ background: sev[3], color: sev[2] }}><Icon.AlertTriangle size={20} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inc.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{categoryLabel(inc.category)} · {inc.occurredAt} · {inc.reporter}</div>
            </div>
            <span className="chip" style={{ background: sev[3], color: sev[2], borderColor: sev[4] }}>{sev[1]}</span>
          </div>
        )
      })}

      {showAdd && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">위험물 이력 기록</div>
            <div className="form-group">
              <label className="form-label">사고 내용</label>
              <input className="form-input" value={form.title} maxLength={150}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="예: 아세톤 500ml 유출" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">유형</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {CATEGORIES.map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setForm(p => ({ ...p, category: v }))}
                    style={{ padding: '8px 12px', border: `1.5px solid ${form.category === v ? 'var(--green)' : 'var(--border)'}`, borderRadius: 20, background: form.category === v ? 'var(--green-light)' : 'var(--card)', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: form.category === v ? 'var(--green)' : 'var(--text2)' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">심각도</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {SEVERITIES.map(([v, l, color, bg]) => (
                  <button key={v} type="button" onClick={() => setForm(p => ({ ...p, severity: v }))}
                    style={{ flex: 1, padding: '9px 4px', border: `1.5px solid ${form.severity === v ? color : 'var(--border)'}`, borderRadius: 8, background: form.severity === v ? bg : 'var(--card)', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: form.severity === v ? color : 'var(--text2)' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">발생일</label>
              <input className="form-input" type="date" value={form.occurredAt}
                onChange={e => setForm(p => ({ ...p, occurredAt: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">장소 (선택)</label>
              <input className="form-input" value={form.location} maxLength={100}
                onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                placeholder="예: 306호 흄후드" />
            </div>
            <div className="form-group">
              <label className="form-label">조치 사항 (선택)</label>
              <input className="form-input" value={form.actionTaken} maxLength={300}
                onChange={e => setForm(p => ({ ...p, actionTaken: e.target.value }))}
                placeholder="예: 환기 후 흡착포로 처리" />
            </div>
            <button className="btn-primary" onClick={addIncident}>기록하기</button>
          </div>
        </div>
      )}

      {sel && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setSel(null)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: severityInfo(sel.severity)[3], color: severityInfo(sel.severity)[2], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon.AlertTriangle size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 17 }}>{sel.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{categoryLabel(sel.category)} · {sel.occurredAt}</div>
              </div>
              <span className="chip" style={{ background: severityInfo(sel.severity)[3], color: severityInfo(sel.severity)[2], borderColor: severityInfo(sel.severity)[4] }}>{severityInfo(sel.severity)[1]}</span>
            </div>
            {sel.location && (
              <div className="log-item"><span style={{ color: 'var(--text2)' }}>장소</span><span>{sel.location}</span></div>
            )}
            <div className="log-item"><span style={{ color: 'var(--text2)' }}>작성자</span><span>{sel.reporter}</span></div>
            {sel.actionTaken && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>조치 사항</div>
                <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>{sel.actionTaken}</div>
              </div>
            )}
            {(isAdmin || sel.reporter === user.name) && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                <button onClick={() => openEditIncident(sel)}
                  style={{ flex: 1, padding: 10, background: 'var(--green-light)', color: 'var(--green)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  수정
                </button>
                {/* 삭제는 DB 정책상 교수만 가능 — 작성자 본인이어도 delete는 막혀있음 */}
                {isAdmin && (
                  <button onClick={deleteIncident}
                    style={{ flex: 1, padding: 10, background: 'var(--red-light)', color: 'var(--red)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                    기록 삭제
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {editTarget && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setEditTarget(null)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">위험물 이력 수정</div>
            <div className="form-group">
              <label className="form-label">사고 내용</label>
              <input className="form-input" value={editTarget.title} maxLength={150}
                onChange={e => setEditTarget(p => ({ ...p, title: e.target.value }))}
                placeholder="예: 아세톤 500ml 유출" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">유형</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {CATEGORIES.map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setEditTarget(p => ({ ...p, category: v }))}
                    style={{ padding: '8px 12px', border: `1.5px solid ${editTarget.category === v ? 'var(--green)' : 'var(--border)'}`, borderRadius: 20, background: editTarget.category === v ? 'var(--green-light)' : 'var(--card)', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: editTarget.category === v ? 'var(--green)' : 'var(--text2)' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">심각도</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {SEVERITIES.map(([v, l, color, bg]) => (
                  <button key={v} type="button" onClick={() => setEditTarget(p => ({ ...p, severity: v }))}
                    style={{ flex: 1, padding: '9px 4px', border: `1.5px solid ${editTarget.severity === v ? color : 'var(--border)'}`, borderRadius: 8, background: editTarget.severity === v ? bg : 'var(--card)', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: editTarget.severity === v ? color : 'var(--text2)' }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">발생일</label>
              <input className="form-input" type="date" value={editTarget.occurredAt}
                onChange={e => setEditTarget(p => ({ ...p, occurredAt: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">장소 (선택)</label>
              <input className="form-input" value={editTarget.location || ''} maxLength={100}
                onChange={e => setEditTarget(p => ({ ...p, location: e.target.value }))}
                placeholder="예: 306호 흄후드" />
            </div>
            <div className="form-group">
              <label className="form-label">조치 사항 (선택)</label>
              <input className="form-input" value={editTarget.actionTaken || ''} maxLength={300}
                onChange={e => setEditTarget(p => ({ ...p, actionTaken: e.target.value }))}
                placeholder="예: 환기 후 흡착포로 처리" />
            </div>
            <button className="btn-primary" onClick={saveEditIncident}>저장하기</button>
          </div>
        </div>
      )}
    </div>
  )
}
