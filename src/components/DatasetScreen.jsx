import React, { useState } from 'react'
import { useCollection } from '../hooks/useSupabase'
import { toast } from '../utils/toast'
import { Icon } from './Icon'

export default function DatasetScreen({ labId, user }) {
  const hook = useCollection(labId, 'datasets', 'created_at')
  const [showAdd, setShowAdd] = useState(false)
  const [sel, setSel] = useState(null)
  const [form, setForm] = useState({ name: '', path: '', version: '', description: '' })

  const isAdmin = user.role === '교수'

  const addDataset = async () => {
    const name = form.name.trim()
    const path = form.path.trim()
    if (!name) { toast.error('데이터셋 이름을 입력해주세요.'); return }
    if (!path) { toast.error('경로를 입력해주세요.'); return }
    if (name.length > 100) { toast.error('이름은 100자 이내로 입력해주세요.'); return }
    try {
      await hook.add({
        name, path, version: form.version.trim() || 'v1', description: form.description.trim(), owner: user.name,
      })
      setShowAdd(false)
      setForm({ name: '', path: '', version: '', description: '' })
      toast.success('데이터셋을 등록했어요')
    } catch (e) { /* error shown by hook */ }
  }

  const deleteDataset = async () => {
    if (!window.confirm(`"${sel.name}"을 삭제하시겠습니까?`)) return
    try {
      await hook.remove(sel.id)
      setSel(null)
    } catch (e) { /* error shown by hook */ }
  }

  const copyPath = async (path) => {
    try {
      await navigator.clipboard.writeText(path)
      toast.success('경로를 복사했어요')
    } catch (e) { /* clipboard unavailable */ }
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="page-title">데이터셋</div>
          <button onClick={() => setShowAdd(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            <Icon.Plus size={14} strokeWidth={2.4} /> 등록
          </button>
        </div>
      </div>

      {hook.loading ? null : hook.data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text2)' }}>
          <Icon.Database size={30} strokeWidth={1.4} style={{ marginBottom: 12, opacity: .5 }} />
          <div style={{ fontWeight: 500 }}>등록된 데이터셋이 없습니다</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>+ 등록 버튼으로 공유 데이터셋을 추가하세요</div>
        </div>
      ) : hook.data.map(ds => (
        <div key={ds.id} className="equip-card" onClick={() => setSel(ds)}>
          <div className="equip-icon" style={{ background: 'var(--blue-light)', color: '#2259c4' }}><Icon.Database size={20} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ds.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ds.path}</div>
          </div>
          <span className="chip chip-blue">{ds.version}</span>
        </div>
      ))}

      {showAdd && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">데이터셋 등록</div>
            <div className="form-group">
              <label className="form-label">이름</label>
              <input className="form-input" value={form.name} maxLength={100}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="예: COCO-2017-cleaned" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">경로</label>
              <input className="form-input" value={form.path} maxLength={300}
                onChange={e => setForm(p => ({ ...p, path: e.target.value }))}
                placeholder="예: /data/shared/coco2017" />
            </div>
            <div className="form-group">
              <label className="form-label">버전 (선택)</label>
              <input className="form-input" value={form.version} maxLength={30}
                onChange={e => setForm(p => ({ ...p, version: e.target.value }))}
                placeholder="예: v2" />
            </div>
            <div className="form-group">
              <label className="form-label">설명 (선택)</label>
              <input className="form-input" value={form.description} maxLength={300}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="예: 라벨 오류 정리, train/val 재분할" />
            </div>
            <button className="btn-primary" onClick={addDataset}>등록하기</button>
          </div>
        </div>
      )}

      {sel && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setSel(null)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--blue-light)', color: '#2259c4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon.Database size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 17 }}>{sel.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>등록: {sel.owner}</div>
              </div>
              <span className="chip chip-blue">{sel.version}</span>
            </div>
            <div className="log-item" onClick={() => copyPath(sel.path)} style={{ cursor: 'pointer' }}>
              <span style={{ color: 'var(--text2)' }}>경로</span>
              <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{sel.path}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>탭하면 경로가 복사돼요</div>
            {sel.description && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: .5 }}>설명</div>
                <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>{sel.description}</div>
              </div>
            )}
            {(isAdmin || sel.owner === user.name) && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <button onClick={deleteDataset}
                  style={{ width: '100%', padding: 10, background: 'var(--red-light)', color: 'var(--red)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  데이터셋 삭제
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
