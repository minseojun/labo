import React, { useState } from 'react'
import { useCollection } from '../hooks/useSupabase'
import { toast } from '../utils/toast'
import { Icon } from './Icon'

const toISO = (date, time) => new Date(`${date}T${time}:00`).toISOString()
const fmtRange = (startAt, endAt) => {
  const s = new Date(startAt), e = new Date(endAt)
  const d = s.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
  const t = x => x.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  return `${d} ${t(s)} ~ ${t(e)}`
}

export default function GpuReservationScreen({ labId, user }) {
  const serversHook = useCollection(labId, 'gpu_servers', 'created_at', true)
  const resHook = useCollection(labId, 'gpu_reservations', 'start_at', true)
  const [selServer, setSelServer] = useState(null)
  const [showAddServer, setShowAddServer] = useState(false)
  const [showReserve, setShowReserve] = useState(false)
  const [serverForm, setServerForm] = useState({ name: '', spec: '' })
  const now = new Date()
  const [resForm, setResForm] = useState({
    date: now.toISOString().slice(0, 10), startTime: '09:00', endTime: '18:00', memo: '',
  })

  const isAdmin = user.role === '교수'
  const servers = serversHook.data
  const reservations = resHook.data

  const activeOf = (serverId) => reservations.find(r =>
    r.serverId === serverId && new Date(r.startAt) <= now && now <= new Date(r.endAt))
  const upcomingOf = (serverId) => reservations
    .filter(r => r.serverId === serverId && new Date(r.endAt) > now)
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))

  const addServer = async () => {
    const name = serverForm.name.trim()
    if (!name) { toast.error('서버 이름을 입력해주세요.'); return }
    if (name.length > 60) { toast.error('이름은 60자 이내로 입력해주세요.'); return }
    try {
      await serversHook.add({ name, spec: serverForm.spec.trim() })
      setShowAddServer(false)
      setServerForm({ name: '', spec: '' })
    } catch (e) { /* error shown by hook */ }
  }

  const deleteServer = async (server) => {
    if (!window.confirm(`"${server.name}" 서버를 삭제하시겠습니까? 예약 내역도 함께 삭제돼요.`)) return
    try {
      await serversHook.remove(server.id)
      setSelServer(null)
    } catch (e) { /* error shown by hook */ }
  }

  const addReservation = async () => {
    const startAt = toISO(resForm.date, resForm.startTime)
    const endAt = toISO(resForm.date, resForm.endTime)
    if (new Date(startAt) >= new Date(endAt)) { toast.error('종료 시각이 시작 시각보다 늦어야 해요.'); return }
    const overlap = reservations.some(r => r.serverId === selServer.id &&
      new Date(startAt) < new Date(r.endAt) && new Date(endAt) > new Date(r.startAt))
    if (overlap) { toast.error('이미 예약된 시간대와 겹쳐요.'); return }
    try {
      await resHook.add({ serverId: selServer.id, userName: user.name, startAt, endAt, memo: resForm.memo.trim() })
      setShowReserve(false)
      setResForm({ date: now.toISOString().slice(0, 10), startTime: '09:00', endTime: '18:00', memo: '' })
      toast.success('예약했어요')
    } catch (e) { /* error shown by hook */ }
  }

  const cancelReservation = async (r) => {
    if (r.userName !== user.name && !isAdmin) return
    if (!window.confirm('이 예약을 취소하시겠습니까?')) return
    try { await resHook.remove(r.id) } catch (e) { /* error shown by hook */ }
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="page-title">GPU 서버 예약</div>
          {isAdmin && (
            <button onClick={() => setShowAddServer(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <Icon.Plus size={14} strokeWidth={2.4} /> 서버 추가
            </button>
          )}
        </div>
      </div>

      {serversHook.loading ? null : servers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text2)' }}>
          <Icon.Server size={30} strokeWidth={1.4} style={{ marginBottom: 12, opacity: .5 }} />
          <div style={{ fontWeight: 500 }}>등록된 서버가 없습니다</div>
          {isAdmin && <div style={{ fontSize: 12, marginTop: 4 }}>+ 서버 추가 버튼으로 등록하세요</div>}
        </div>
      ) : servers.map(sv => {
        const active = activeOf(sv.id)
        return (
          <div key={sv.id} className="equip-card" onClick={() => setSelServer(sv)}>
            <div className="equip-icon" style={{ background: active ? 'var(--red-light)' : 'var(--green-light)', color: active ? 'var(--red)' : 'var(--green)' }}>
              <Icon.Server size={20} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{sv.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
                {sv.spec || '스펙 미등록'}{active ? ` · ${active.userName} 사용중` : ''}
              </div>
            </div>
            <span className={`chip ${active ? 'chip-red' : 'chip-green'}`}>{active ? '사용중' : '예약가능'}</span>
          </div>
        )
      })}

      {selServer && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setSelServer(null)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--green-light)', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon.Server size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 17 }}>{selServer.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>{selServer.spec || '스펙 미등록'}</div>
              </div>
            </div>

            {activeOf(selServer.id) && (
              <div style={{ background: 'var(--red-light)', color: '#c42e2e', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14 }}>
                지금 <b>{activeOf(selServer.id).userName}</b>님이 사용중이에요 ({fmtRange(activeOf(selServer.id).startAt, activeOf(selServer.id).endAt)})
              </div>
            )}

            <button className="btn-primary" onClick={() => setShowReserve(true)}>예약하기</button>

            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', margin: '18px 0 8px', textTransform: 'uppercase', letterSpacing: .5 }}>다가오는 예약</div>
            {upcomingOf(selServer.id).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '10px 0', fontSize: 12, color: 'var(--text2)' }}>예약이 없습니다</div>
            ) : upcomingOf(selServer.id).map(r => (
              <div key={r.id} className="log-item" onClick={() => cancelReservation(r)} style={{ cursor: (r.userName === user.name || isAdmin) ? 'pointer' : 'default' }}>
                <div>
                  <span style={{ fontWeight: 500 }}>{r.userName}</span>
                  {r.memo && <span style={{ color: 'var(--text2)', marginLeft: 6 }}>{r.memo}</span>}
                </div>
                <div style={{ color: 'var(--text2)', whiteSpace: 'nowrap', marginLeft: 8, fontSize: 11 }}>{fmtRange(r.startAt, r.endAt)}</div>
              </div>
            ))}
            {upcomingOf(selServer.id).some(r => r.userName === user.name || isAdmin) && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>본인 예약(또는 관리자)은 눌러서 취소할 수 있어요</div>
            )}

            {isAdmin && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <button onClick={() => deleteServer(selServer)}
                  style={{ width: '100%', padding: 10, background: 'var(--red-light)', color: 'var(--red)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                  서버 삭제
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showReserve && selServer && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setShowReserve(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">{selServer.name} 예약</div>
            <div className="form-group">
              <label className="form-label">날짜</label>
              <input className="form-input" type="date" value={resForm.date}
                onChange={e => setResForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">시작</label>
                <input className="form-input" type="time" value={resForm.startTime}
                  onChange={e => setResForm(p => ({ ...p, startTime: e.target.value }))} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">종료</label>
                <input className="form-input" type="time" value={resForm.endTime}
                  onChange={e => setResForm(p => ({ ...p, endTime: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">메모 (선택)</label>
              <input className="form-input" value={resForm.memo} maxLength={100}
                onChange={e => setResForm(p => ({ ...p, memo: e.target.value }))}
                placeholder="예: 논문 학습 돌리기" />
            </div>
            <button className="btn-primary" onClick={addReservation}>예약 확정</button>
          </div>
        </div>
      )}

      {showAddServer && isAdmin && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setShowAddServer(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">서버 추가</div>
            <div className="form-group">
              <label className="form-label">서버 이름</label>
              <input className="form-input" value={serverForm.name} maxLength={60}
                onChange={e => setServerForm(p => ({ ...p, name: e.target.value }))}
                placeholder="예: GPU-01 (A100 x4)" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">스펙 (선택)</label>
              <input className="form-input" value={serverForm.spec} maxLength={120}
                onChange={e => setServerForm(p => ({ ...p, spec: e.target.value }))}
                placeholder="예: A100 80GB x4, RAM 512GB" />
            </div>
            <button className="btn-primary" onClick={addServer}>등록하기</button>
          </div>
        </div>
      )}
    </div>
  )
}
