import React, { useState } from 'react'
import { useCollection } from '../hooks/useSupabase'
import { toast } from '../utils/toast'
import { Icon } from './Icon'

const IMPORT_PLACEHOLDER = `COCO-2017-cleaned, /data/shared/coco2017, v2, 라벨 오류 정리
ImageNet-subset, s3://lab-bucket/imagenet-1k, v1

또는 JSON 배열도 붙여넣을 수 있어요:
[{"name":"COCO-2017-cleaned","path":"/data/shared/coco2017","version":"v2"}]`

// 콤마 구분 CSV 한 줄 또는 JSON 배열을 파싱 — 외부 스프레드시트/메모에 이미 정리해둔
// 데이터셋 목록을 하나씩 입력하지 않고 한 번에 붙여넣어 등록할 수 있게 함
function parseImportText(text) {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed)
      if (!Array.isArray(arr)) return []
      return arr.map(o => ({
        name: (o.name || o.title || '').toString().trim(),
        path: (o.path || o.url || '').toString().trim(),
        version: (o.version || '').toString().trim() || 'v1',
        description: (o.description || '').toString().trim(),
      })).filter(o => o.name && o.path)
    } catch (e) {
      return null // JSON 파싱 실패 신호
    }
  }
  return trimmed.split('\n').map(line => {
    const cols = line.split(',').map(c => c.trim())
    if (cols.length < 2 || !cols[0] || !cols[1]) return null
    return { name: cols[0], path: cols[1], version: cols[2] || 'v1', description: cols[3] || '' }
  }).filter(Boolean)
}

export default function DatasetScreen({ labId, user }) {
  const hook = useCollection(labId, 'datasets', 'created_at')
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [sel, setSel] = useState(null)
  const [query, setQuery] = useState('')
  const [form, setForm] = useState({ name: '', path: '', version: '', description: '' })

  const isAdmin = user.role === '교수'
  const q = query.trim().toLowerCase()
  const filtered = !q ? hook.data : hook.data.filter(ds =>
    [ds.name, ds.path, ds.description, ds.owner].some(v => v?.toLowerCase().includes(q)))

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

  const runImport = async () => {
    const rows = parseImportText(importText)
    if (rows === null) { toast.error('JSON 형식이 올바르지 않아요.'); return }
    if (rows.length === 0) { toast.error('가져올 항목이 없어요. 형식을 확인해주세요.'); return }
    setImporting(true)
    let ok = 0
    for (const row of rows) {
      try {
        await hook.add({ ...row, owner: user.name })
        ok++
      } catch (e) { /* 실패한 행은 건너뛰고 계속 진행 */ }
    }
    setImporting(false)
    setShowImport(false)
    setImportText('')
    if (ok === rows.length) toast.success(`${ok}개 데이터셋을 가져왔어요`)
    else toast.error(`${ok}/${rows.length}개만 가져왔어요. 나머지는 형식을 확인해주세요.`)
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="page-title">데이터셋</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowImport(true)}
              style={{ padding: '8px 12px', background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              외부 불러오기
            </button>
            <button onClick={() => setShowAdd(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <Icon.Plus size={14} strokeWidth={2.4} /> 등록
            </button>
          </div>
        </div>
      </div>

      {hook.data.length > 0 && (
        <div className="supply-summary">
          <div className="supply-stat">
            <div className="n">{hook.data.length}</div>
            <div className="l">전체 데이터셋</div>
          </div>
          <div className="supply-stat">
            <div className="n">{new Set(hook.data.map(d => d.owner)).size}</div>
            <div className="l">등록자 수</div>
          </div>
        </div>
      )}

      {hook.data.length > 0 && (
        <div style={{ padding: '0 16px 12px', position: 'relative' }}>
          <Icon.Search size={15} strokeWidth={2} style={{ position: 'absolute', left: 30, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
          <input className="form-input" style={{ paddingLeft: 34 }} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="이름, 경로, 설명으로 검색" />
        </div>
      )}

      {hook.loading ? null : hook.data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text2)' }}>
          <Icon.Database size={30} strokeWidth={1.4} style={{ marginBottom: 12, opacity: .5 }} />
          <div style={{ fontWeight: 500 }}>등록된 데이터셋이 없습니다</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>+ 등록 버튼으로 공유 데이터셋을 추가하세요</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text2)' }}>
          <Icon.Database size={30} strokeWidth={1.4} style={{ marginBottom: 12, opacity: .5 }} />
          <div style={{ fontWeight: 500 }}>검색 결과가 없습니다</div>
        </div>
      ) : filtered.map(ds => (
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

      {showImport && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setShowImport(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">외부에서 불러오기</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10, lineHeight: 1.6 }}>
              스프레드시트나 메모에 정리해둔 목록을 그대로 붙여넣으세요. 한 줄에 하나씩, <b>이름, 경로, 버전(선택), 설명(선택)</b> 순서로 콤마(,)로 구분하면 돼요. JSON 배열도 지원해요.
            </div>
            <div className="form-group">
              <textarea className="form-input" rows={8} value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder={IMPORT_PLACEHOLDER}
                style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} />
            </div>
            <button className="btn-primary" onClick={runImport} disabled={importing}>
              {importing ? '가져오는 중...' : '가져오기'}
            </button>
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
