import React, { useState } from 'react'
import { updateDoc, doc, arrayUnion, addDoc, collection, onSnapshot, serverTimestamp, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase'
import { useEffect } from 'react'

function StatusChip({ status }) {
  if (status === 'available') return <span className="chip chip-green">가용</span>
  if (status === 'in-use') return <span className="chip chip-red">사용중</span>
  return <span className="chip chip-yellow">점검중</span>
}

const ICONS = ['🔬', '⚙️', '💡', '🔧', '🧪', '🖥️', '📡', '⚗️']
const bgColor = s => s === 'available' ? 'var(--green-light)' : s === 'in-use' ? 'var(--red-light)' : 'var(--yellow-light)'

// 댓글 훅
function useComments(labId, equipmentId) {
  const [comments, setComments] = useState([])
  useEffect(() => {
    if (!labId || !equipmentId) return
    const q = query(
      collection(db, 'labs', labId, 'equipment', equipmentId, 'comments'),
      orderBy('createdAt', 'asc')
    )
    const unsub = onSnapshot(q, snap => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return unsub
  }, [labId, equipmentId])
  return comments
}

// 댓글 섹션
function CommentSection({ labId, equipmentId, user }) {
  const comments = useComments(labId, equipmentId)
  const [text, setText] = useState('')

  const addComment = async () => {
    if (!text.trim()) return
    await addDoc(collection(db, 'labs', labId, 'equipment', equipmentId, 'comments'), {
      author: user.name,
      role: user.role,
      text,
      createdAt: serverTimestamp()
    })
    setText('')
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: .5 }}>
        댓글 {comments.length > 0 ? `(${comments.length})` : ''}
      </div>

      {comments.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center', padding: '10px 0 14px' }}>첫 댓글을 남겨보세요</div>
      )}

      {comments.map(c => (
        <div key={c.id} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: c.role === '교수' ? 'var(--purple-light)' : 'var(--green-light)',
              color: c.role === '교수' ? 'var(--purple)' : 'var(--green)',
              fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>{c.author?.slice(-1)}</div>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{c.author}</span>
            <span style={{ fontSize: 10, color: 'var(--text2)' }}>{c.role}</span>
            <span style={{ fontSize: 10, color: 'var(--text2)', marginLeft: 'auto' }}>
              {c.createdAt?.toDate?.()?.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) || ''}
            </span>
          </div>
          <div style={{
            background: 'var(--bg)', borderRadius: '0 10px 10px 10px',
            padding: '8px 12px', fontSize: 13, marginLeft: 30
          }}>{c.text}</div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input className="form-input" style={{ flex: 1, padding: '8px 10px', fontSize: 13 }}
          value={text} onChange={e => setText(e.target.value)}
          placeholder="댓글 작성..." onKeyDown={e => e.key === 'Enter' && addComment()} />
        <button onClick={addComment}
          style={{ padding: '8px 14px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
          전송
        </button>
      </div>
    </div>
  )
}

export default function EquipmentTab({ labId, equipment, equipmentHook, user }) {
  const [sel, setSel] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [memo, setMemo] = useState('')
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState({ name: '', code: '', status: 'available', icon: '🔬' })

  const isAdmin = user.role === '교수'
  const filtered = equipment.filter(e => filter === 'all' || e.status === filter)

  const toggleUse = async (eq) => {
    const isUsing = eq.status === 'in-use' && eq.lastUser === user.name
    const newLog = {
      user: user.name,
      action: isUsing ? '사용 종료' : '사용 시작',
      time: new Date().toLocaleString('ko-KR'),
      memo: isUsing ? memo : ''
    }
    await updateDoc(doc(db, 'labs', labId, 'equipment', eq.id), {
      status: isUsing ? 'available' : 'in-use',
      lastUser: user.name,
      logs: arrayUnion(newLog)
    })
    setSel(p => p ? { ...p, status: isUsing ? 'available' : 'in-use', lastUser: user.name, logs: [newLog, ...(p.logs || [])] } : p)
    if (isUsing) setMemo('')
  }

  const addEquipment = async () => {
    if (!form.name || !form.code) return
    await equipmentHook.add({ ...form, lastUser: '-', logs: [] })
    setShowAdd(false)
    setForm({ name: '', code: '', status: 'available', icon: '🔬' })
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="page-title">장비 관리</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setScanning(true)}
              style={{ padding: '8px 12px', background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              📷 QR
            </button>
            {/* 교수만 장비 추가 가능 */}
            {isAdmin && (
              <button onClick={() => setShowAdd(true)}
                style={{ padding: '8px 12px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                + 추가
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="filter-row">
        {[['all', '전체'], ['available', '가용'], ['in-use', '사용중'], ['maintenance', '점검중']].map(([v, l]) => (
          <div key={v} className={`filter-chip${filter === v ? ' active' : ''}`} onClick={() => setFilter(v)}>{l}</div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text2)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔬</div>
          <div style={{ fontWeight: 500 }}>등록된 장비가 없습니다</div>
          {isAdmin && <div style={{ fontSize: 12, marginTop: 4 }}>+ 추가 버튼으로 장비를 등록하세요</div>}
        </div>
      )}

      {filtered.map(eq => (
        <div key={eq.id} className="equip-card" onClick={() => setSel(eq)}>
          <div className="equip-icon" style={{ background: bgColor(eq.status) }}>{eq.icon || '🔬'}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{eq.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>코드: {eq.code} · 최근: {eq.lastUser}</div>
          </div>
          <StatusChip status={eq.status} />
        </div>
      ))}

      {/* 장비 상세 시트 */}
      {sel && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setSel(null)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: bgColor(sel.status), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{sel.icon || '🔬'}</div>
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
                      placeholder="실험 조건, 주의사항..." style={{ resize: 'none' }} />
                  </div>
                )}
                <div className="timer-controls">
                  {sel.status === 'available' ? (
                    <button className="timer-btn btn-play" onClick={() => toggleUse(equipment.find(e => e.id === sel.id))}>▶ 사용 시작</button>
                  ) : sel.lastUser === user.name ? (
                    <button className="timer-btn btn-stop" onClick={() => toggleUse(equipment.find(e => e.id === sel.id))}>■ 사용 종료</button>
                  ) : (
                    <div style={{ flex: 1, textAlign: 'center', fontSize: 13, color: 'var(--text2)', padding: 10 }}>{sel.lastUser} 사용 중</div>
                  )}
                  <button className="timer-btn" style={{ background: 'var(--green-light)', color: 'var(--green)', flex: .5 }} onClick={() => setShowQR(true)}>QR</button>
                </div>
              </>
            )}

            {/* 교수만 점검 완료 / 삭제 가능 */}
            {sel.status === 'maintenance' && isAdmin && (
              <button className="timer-btn btn-play" style={{ marginBottom: 12 }}
                onClick={() => { updateDoc(doc(db, 'labs', labId, 'equipment', sel.id), { status: 'available' }); setSel(p => ({ ...p, status: 'available' })) }}>
                ✅ 점검 완료 처리
              </button>
            )}

            {/* 사용 이력 */}
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', margin: '14px 0 8px', textTransform: 'uppercase', letterSpacing: .5 }}>사용 이력</div>
            {(!sel.logs || sel.logs.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '10px 0', fontSize: 12, color: 'var(--text2)' }}>사용 이력이 없습니다</div>
            ) : [...sel.logs].slice(0, 8).map((l, i) => (
              <div key={i} className="log-item">
                <div>
                  <span style={{ fontWeight: 500 }}>{l.user}</span>
                  <span style={{ color: 'var(--text2)', marginLeft: 6 }}>{l.action}</span>
                  {l.memo && <div style={{ color: 'var(--text2)', marginTop: 1, fontSize: 11 }}>{l.memo}</div>}
                </div>
                <div style={{ color: 'var(--text2)', whiteSpace: 'nowrap', marginLeft: 8, fontSize: 11 }}>{l.time}</div>
              </div>
            ))}

            {/* 댓글 */}
            <CommentSection labId={labId} equipmentId={sel.id} user={user} />

            {/* 교수만 장비 삭제 */}
            {isAdmin && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <button onClick={() => { equipmentHook.remove(sel.id); setSel(null) }}
                  style={{ width: '100%', padding: 10, background: 'var(--red-light)', color: 'var(--red)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  장비 삭제
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR 스캔 */}
      {scanning && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setScanning(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">QR 코드 스캔</div>
            <div className="qr-area"><div className="qr-scanner-frame" /></div>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>장비를 선택해서 바로 열 수 있습니다</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {equipment.map(eq => (
                <button key={eq.id}
                  style={{ padding: '10px 8px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', cursor: 'pointer', fontSize: 12, fontWeight: 500, textAlign: 'left' }}
                  onClick={() => { setScanning(false); setSel(eq) }}>
                  {eq.icon || '🔬'} {eq.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* QR 출력 */}
      {showQR && sel && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setShowQR(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">QR 코드 — {sel.name}</div>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
              <svg width="160" height="160" viewBox="0 0 160 160" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, background: '#fff' }}>
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
            <button className="btn-primary" onClick={() => window.print()}>🖨️ 인쇄</button>
          </div>
        </div>
      )}

      {/* 장비 추가 (교수 전용) */}
      {showAdd && isAdmin && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">장비 추가</div>
            <div className="form-group">
              <label className="form-label">장비 이름</label>
              <input className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="예: 전자현미경 SEM" />
            </div>
            <div className="form-group">
              <label className="form-label">장비 코드</label>
              <input className="form-input" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))} placeholder="예: SEM-001" />
            </div>
            <div className="form-group">
              <label className="form-label">아이콘</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {ICONS.map(ic => (
                  <button key={ic} onClick={() => setForm(p => ({ ...p, icon: ic }))}
                    style={{ width: 40, height: 40, borderRadius: 10, border: `2px solid ${form.icon === ic ? 'var(--green)' : 'var(--border)'}`, background: form.icon === ic ? 'var(--green-light)' : 'var(--card)', fontSize: 20, cursor: 'pointer' }}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn-primary" onClick={addEquipment}>등록하기</button>
          </div>
        </div>
      )}
    </div>
  )
}
