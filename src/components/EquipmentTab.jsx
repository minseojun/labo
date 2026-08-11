import React, { useState, useEffect, useRef, useCallback } from 'react'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { supabase } from '../supabase'
import { toCamelRow } from '../hooks/useSupabase'
import { toast } from '../utils/toast'
import { Icon } from './Icon'

const QR_PREFIX = 'LABO-EQUIP:'
const qrPayload = code => `${QR_PREFIX}${code}`

function StatusChip({ status }) {
  if (status === 'available') return <span className="chip chip-green">가용</span>
  if (status === 'in-use') return <span className="chip chip-red">사용중</span>
  return <span className="chip chip-yellow">점검중</span>
}

const ICONS = ['🔬', '⚙️', '💡', '🔧', '🧪', '🖥️', '📡', '⚗️']
const bgColor = s => s === 'available' ? 'var(--green-light)' : s === 'in-use' ? 'var(--red-light)' : 'var(--yellow-light)'

function SkeletonCard() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
      <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="skeleton" style={{ height: 14, width: '60%' }} />
        <div className="skeleton" style={{ height: 11, width: '40%' }} />
      </div>
      <div className="skeleton" style={{ width: 48, height: 22, borderRadius: 20 }} />
    </div>
  )
}

// 실제로 스캔 가능한 QR 코드를 캔버스에 그림 — "LABO-EQUIP:코드" 형태로 인코딩해서
// 아무 QR 리더 앱으로 찍어도 코드가 보이고, 앱 안에서 찍으면 바로 그 장비로 이동함
function QRCanvas({ value, size = 168 }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, value, {
      width: size, margin: 1,
      color: { dark: '#1A1A1A', light: '#FFFFFF' },
    }).catch(err => console.error(err))
  }, [value, size])
  return <canvas ref={canvasRef} style={{ borderRadius: 8, display: 'block' }} />
}

// 실제 카메라로 QR을 읽는 스캐너. getUserMedia로 후면 카메라를 열고,
// 매 프레임을 캔버스에 그려서 jsQR로 디코딩함
function QRScanner({ onDetect }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const streamRef = useRef(null)
  const pausedRef = useRef(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    function tick() {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)
        if (code?.data && !pausedRef.current) {
          pausedRef.current = true
          onDetect(code.data)
          setTimeout(() => { pausedRef.current = false }, 1500)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        tick()
      } catch (e) {
        console.error(e)
        setError('카메라를 사용할 수 없어요. 권한을 확인하거나 아래 목록에서 직접 골라주세요.')
      }
    }

    if (navigator.mediaDevices?.getUserMedia) start()
    else setError('이 브라우저에서는 카메라를 지원하지 않아요. 아래 목록에서 직접 골라주세요.')

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [onDetect])

  return (
    <div>
      <div className="qr-area">
        <video ref={videoRef} playsInline muted />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <div className="qr-scanner-frame" />
      </div>
      {error && <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--red)', margin: '8px 0 0' }}>{error}</p>}
    </div>
  )
}

function useComments(labId, equipmentId) {
  const [comments, setComments] = useState([])

  const fetchComments = useCallback(async () => {
    if (!labId || !equipmentId) return
    const { data, error } = await supabase
      .from('equipment_comments').select('*').eq('equipment_id', equipmentId).order('created_at', { ascending: true })
    if (error) { console.error(error); return }
    setComments(data.map(toCamelRow))
  }, [labId, equipmentId])

  useEffect(() => {
    if (!labId || !equipmentId) return
    fetchComments()
    const channel = supabase
      .channel(`equipment_comments-${equipmentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment_comments', filter: `equipment_id=eq.${equipmentId}` }, fetchComments)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [labId, equipmentId, fetchComments])

  return comments
}

function CommentSection({ labId, equipmentId, user }) {
  const comments = useComments(labId, equipmentId)
  const [text, setText] = useState('')

  const addComment = async () => {
    const trimmed = text.trim()
    if (!trimmed || trimmed.length > 500) return
    try {
      const { error } = await supabase.from('equipment_comments').insert({
        equipment_id: equipmentId, lab_id: labId,
        author: user.name, role: user.role, text: trimmed,
      })
      if (error) throw error
      setText('')
    } catch (e) {
      console.error(e)
      toast.error('댓글 저장에 실패했어요.')
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: .5 }}>
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
              background: 'var(--bg)', border: '1px solid var(--border)',
              color: 'var(--text2)',
              fontSize: 10, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>{c.author?.slice(-1)}</div>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{c.author}</span>
            <span style={{ fontSize: 10, color: 'var(--text2)' }}>{c.role}</span>
            <span style={{ fontSize: 10, color: 'var(--text2)', marginLeft: 'auto' }}>
              {c.createdAt ? new Date(c.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>
          <div style={{ background: 'var(--bg)', borderRadius: '0 10px 10px 10px', padding: '8px 12px', fontSize: 13, marginLeft: 30 }}>
            {c.text}
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input className="form-input" style={{ flex: 1, padding: '8px 10px', fontSize: 13 }}
          value={text} onChange={e => setText(e.target.value)}
          placeholder="댓글 작성..." maxLength={500}
          onKeyDown={e => e.key === 'Enter' && addComment()} />
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
  const [scanning, setScanning] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [showBulkQR, setShowBulkQR] = useState(false)
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
    try {
      await equipmentHook.update(eq.id, {
        status: isUsing ? 'available' : 'in-use',
        lastUser: user.name,
        logs: [...(eq.logs || []), newLog],
      })
      setSel(p => p ? { ...p, status: isUsing ? 'available' : 'in-use', lastUser: user.name, logs: [...(p.logs || []), newLog] } : p)
      if (isUsing) setMemo('')
    } catch (e) {
      console.error(e)
      toast.error('상태 변경에 실패했어요.')
    }
  }

  const addEquipment = async () => {
    const name = form.name.trim()
    const code = form.code.trim()
    if (!name) { toast.error('장비 이름을 입력해주세요.'); return }
    if (!code) { toast.error('장비 코드를 입력해주세요.'); return }
    if (name.length > 100) { toast.error('이름은 100자 이내로 입력해주세요.'); return }
    if (code.length > 30) { toast.error('코드는 30자 이내로 입력해주세요.'); return }
    try {
      await equipmentHook.add({ ...form, name, code, lastUser: '-', logs: [] })
      setShowAdd(false)
      setForm({ name: '', code: '', status: 'available', icon: '🔬' })
    } catch (e) {
      // error shown by hook
    }
  }

  const deleteEquipment = async () => {
    if (!window.confirm(`장비 "${sel.name}"을 삭제하시겠습니까?`)) return
    try {
      await equipmentHook.remove(sel.id)
      setSel(null)
    } catch (e) {
      // error shown by hook
    }
  }

  const setMaintenance = async (eq, status) => {
    try {
      await equipmentHook.update(eq.id, { status })
      setSel(p => p ? { ...p, status } : p)
    } catch (e) {
      console.error(e)
      toast.error('상태 변경에 실패했어요.')
    }
  }

  const handleQRDetect = (data) => {
    const code = data.startsWith(QR_PREFIX) ? data.slice(QR_PREFIX.length) : data
    const found = equipment.find(e => e.code?.toLowerCase() === code.toLowerCase())
    if (found) {
      setScanning(false)
      setSel(found)
      toast.success(`${found.name} 스캔했어요`)
    } else {
      toast.error('등록되지 않은 장비 QR이에요.')
    }
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="page-title">장비 관리</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setScanning(true)}
              style={{ padding: '8px 12px', background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              QR 스캔
            </button>
            {isAdmin && equipment.length > 0 && (
              <button onClick={() => setShowBulkQR(true)}
                style={{ padding: '8px 12px', background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                QR 전체
              </button>
            )}
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

      {equipmentHook.loading ? (
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', margin: '0 16px', overflow: 'hidden' }}>
          {[1,2,3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text2)' }}>
          <Icon.Flask size={30} strokeWidth={1.4} style={{ marginBottom: 12, opacity: .5 }} />
          <div style={{ fontWeight: 500 }}>등록된 장비가 없습니다</div>
          {isAdmin && <div style={{ fontSize: 12, marginTop: 4 }}>+ 추가 버튼으로 장비를 등록하세요</div>}
        </div>
      ) : (
        filtered.map(eq => (
          <div key={eq.id} className="equip-card" onClick={() => setSel(eq)}>
            <div className="equip-icon" style={{ background: bgColor(eq.status) }}>{eq.icon || '🔬'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{eq.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>코드: {eq.code} · 최근: {eq.lastUser}</div>
            </div>
            <StatusChip status={eq.status} />
          </div>
        ))
      )}

      {sel && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setSel(null)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: bgColor(sel.status), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{sel.icon || '🔬'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 17 }}>{sel.name}</div>
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
                      placeholder="실험 조건, 주의사항..." maxLength={500} style={{ resize: 'none' }} />
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

            {isAdmin && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {sel.status === 'maintenance' ? (
                  <button className="timer-btn btn-play" style={{ flex: 1 }}
                    onClick={() => setMaintenance(sel, 'available')}>
                    점검 완료 처리
                  </button>
                ) : (
                  <button className="timer-btn" style={{ flex: 1, background: 'var(--yellow-light)', color: '#b97b10' }}
                    onClick={() => setMaintenance(sel, 'maintenance')}>
                    점검 중으로 변경
                  </button>
                )}
              </div>
            )}

            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', margin: '14px 0 8px', textTransform: 'uppercase', letterSpacing: .5 }}>사용 이력</div>
            {(!sel.logs || sel.logs.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '10px 0', fontSize: 12, color: 'var(--text2)' }}>사용 이력이 없습니다</div>
            ) : [...sel.logs].reverse().slice(0, 8).map((l, i) => (
              <div key={i} className="log-item">
                <div>
                  <span style={{ fontWeight: 500 }}>{l.user}</span>
                  <span style={{ color: 'var(--text2)', marginLeft: 6 }}>{l.action}</span>
                  {l.memo && <div style={{ color: 'var(--text2)', marginTop: 1, fontSize: 11 }}>{l.memo}</div>}
                </div>
                <div style={{ color: 'var(--text2)', whiteSpace: 'nowrap', marginLeft: 8, fontSize: 11 }}>{l.time}</div>
              </div>
            ))}

            <CommentSection labId={labId} equipmentId={sel.id} user={user} />

            {isAdmin && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <button onClick={deleteEquipment}
                  style={{ width: '100%', padding: 10, background: 'var(--red-light)', color: 'var(--red)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  장비 삭제
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {scanning && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setScanning(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">QR 코드 스캔</div>
            <QRScanner onDetect={handleQRDetect} />
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text2)', margin: '12px 0' }}>카메라를 QR 코드에 비추거나, 아래에서 직접 골라도 돼요</p>
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

      {showQR && sel && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setShowQR(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">QR 코드 — {sel.name}</div>
            <div className="print-area">
              <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: '#fff' }}>
                  <QRCanvas value={qrPayload(sel.code)} />
                </div>
              </div>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontWeight: 600 }}>{sel.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{sel.code}</div>
              </div>
            </div>
            <button className="btn-primary" onClick={() => window.print()}>인쇄</button>
          </div>
        </div>
      )}

      {showBulkQR && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setShowBulkQR(false)}>
          <div className="sheet" style={{ maxWidth: 480 }}>
            <div className="sheet-handle" />
            <div className="sheet-title">전체 장비 QR ({equipment.length}개)</div>
            <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>인쇄한 뒤 점선을 따라 잘라서 장비에 붙이세요.</p>
            <div className="print-area">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {equipment.map(eq => (
                  <div key={eq.id} style={{ border: '1px dashed var(--border)', borderRadius: 10, padding: 10, textAlign: 'center', breakInside: 'avoid' }}>
                    <QRCanvas value={qrPayload(eq.code)} size={120} />
                    <div style={{ fontWeight: 600, fontSize: 12, marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eq.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text2)' }}>{eq.code}</div>
                  </div>
                ))}
              </div>
            </div>
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => window.print()}>전체 인쇄</button>
          </div>
        </div>
      )}

      {showAdd && isAdmin && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">장비 추가</div>
            <div className="form-group">
              <label className="form-label">장비 이름</label>
              <input className="form-input" value={form.name} maxLength={100}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="예: 전자현미경 SEM" />
            </div>
            <div className="form-group">
              <label className="form-label">장비 코드</label>
              <input className="form-input" value={form.code} maxLength={30}
                onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                placeholder="예: SEM-001" />
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
