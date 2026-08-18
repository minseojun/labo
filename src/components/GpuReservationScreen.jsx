import React, { useState } from 'react'
import { useCollection } from '../hooks/useSupabase'
import { supabase } from '../supabase'
import { toast } from '../utils/toast'
import { notifications } from '../utils/notifications'
import { Icon } from './Icon'
import { fmtDate, getWeekDates } from '../utils'
import { DAYS } from '../mockData'

const toISO = (date, time) => new Date(`${date}T${time}:00`).toISOString()
const fmtRange = (startAt, endAt) => {
  const s = new Date(startAt), e = new Date(endAt)
  const d = s.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
  const t = x => x.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  return `${d} ${t(s)} ~ ${t(e)}`
}

// 서버별로 흩어져 있던 예약을 날짜 하나로 모아서 보여주는 주간 캘린더 —
// "이번 주에 언제가 비어있지"를 서버를 하나씩 눌러보지 않고 한눈에 보려고 둠.
// 예약은 항상 같은 날 안에서 시작·종료하므로(addReservation 참고) 날짜 하나로
// 묶어도 걸치는 예약을 놓치지 않음
function GpuCalendar({ servers, reservations, onSelectServer }) {
  const [baseDate, setBaseDate] = useState(new Date())
  const [selDate, setSelDate] = useState(fmtDate(new Date()))
  const weekDates = getWeekDates(baseDate)

  const onDate = (ds) => reservations
    .filter(r => fmtDate(new Date(r.startAt)) === ds)
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))

  const dayReservations = onDate(selDate)
  const isToday = selDate === fmtDate(new Date())

  return (
    <div>
      <div className="week-nav">
        <span style={{ fontWeight: 600, fontSize: 15 }}>{baseDate.getFullYear()}년 {baseDate.getMonth() + 1}월</span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button onClick={() => { const d = new Date(baseDate); d.setDate(d.getDate() - 7); setBaseDate(d) }}
            style={{ background: 'var(--bg)', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text2)', width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
          <button onClick={() => { const t = new Date(); setBaseDate(t); setSelDate(fmtDate(t)) }}
            style={{ background: 'var(--bg)', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: 'var(--text2)', padding: '0 11px', height: 30, borderRadius: 9 }}>오늘</button>
          <button onClick={() => { const d = new Date(baseDate); d.setDate(d.getDate() + 7); setBaseDate(d) }}
            style={{ background: 'var(--bg)', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text2)', width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
        </div>
      </div>

      <div className="week-days">
        {weekDates.map((d, i) => {
          const ds = fmtDate(d)
          const today = ds === fmtDate(new Date())
          const sel = ds === selDate
          const count = onDate(ds).length
          return (
            <div key={i} className="day-col" onClick={() => setSelDate(ds)}>
              <div className="day-label">{DAYS[d.getDay()]}</div>
              <div className={`day-num${today ? ' today' : sel ? ' selected' : ''}`}>{d.getDate()}</div>
              <div style={{ display: 'flex', gap: 3, justifyContent: 'center', minHeight: 8 }}>
                {count > 0 && !today && <div className="day-dot" />}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ padding: '12px 16px 4px', fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>
        {isToday ? '오늘' : selDate.replace(/^\d{4}-/, '').replace('-', '/')} 예약 {dayReservations.length > 0 ? `${dayReservations.length}건` : ''}
      </div>

      {dayReservations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--text2)' }}>
          <Icon.Server size={26} strokeWidth={1.4} style={{ marginBottom: 10, opacity: .5 }} />
          <div style={{ fontSize: 13, fontWeight: 500 }}>이 날은 예약이 없어요</div>
        </div>
      ) : dayReservations.map(r => {
        const server = servers.find(sv => sv.id === r.serverId)
        return (
          <div key={r.id} className="sched-item" onClick={() => server && onSelectServer(server)}>
            <div className="sched-bar" style={{ background: 'var(--purple)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 14 }}>{server?.name || '삭제된 서버'}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
                {r.userName}{r.memo ? ` · ${r.memo}` : ''}
              </div>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
              {new Date(r.startAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} ~ {new Date(r.endAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function GpuReservationScreen({ labId, user }) {
  const serversHook = useCollection(labId, 'gpu_servers', 'created_at', true)
  const resHook = useCollection(labId, 'gpu_reservations', 'start_at', true)
  const [view, setView] = useState('servers')
  const [selServer, setSelServer] = useState(null)
  const [showAddServer, setShowAddServer] = useState(false)
  const [showReserve, setShowReserve] = useState(false)
  const [serverForm, setServerForm] = useState({ name: '', spec: '' })
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
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

  const availableCount = servers.filter(sv => !activeOf(sv.id)).length
  const busyCount = servers.length - availableCount

  const q = query.trim().toLowerCase()
  const filteredServers = servers
    .filter(sv => !q || sv.name?.toLowerCase().includes(q) || sv.spec?.toLowerCase().includes(q))
    .filter(sv => filter === 'all' || (filter === 'available' ? !activeOf(sv.id) : !!activeOf(sv.id)))

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
      const created = await resHook.add({ serverId: selServer.id, userName: user.name, startAt, endAt, memo: resForm.memo.trim() })
      setShowReserve(false)
      setResForm({ date: now.toISOString().slice(0, 10), startTime: '09:00', endTime: '18:00', memo: '' })
      toast.success('예약했어요')
      // 예약 시작 시각에 맞춰 알림을 예약해둠 — 다른 사람이 쓰고 있어서 잊고 있다가도
      // 내 차례가 되면 앱을 안 열어도 알 수 있음
      if (created) {
        await notifications.ensurePermission()
        notifications.scheduleAt(`gpu-res-${created.id}`, `${selServer.name} 예약 시작`,
          '예약하신 GPU 서버 사용 시간이 시작됐어요.', new Date(startAt))

        // 예약 내용을 내 개인 일정에도 자동으로 남겨둠 — 일정탭에서 다른 할 일이랑
        // 같이 한눈에 보이게. 기본 비공개(나만 보임)라 다른 사람 일정엔 안 나타남.
        // 나중에 예약을 취소할 때 이 일정도 같이 지우려고 schedule_id로 연결해둠
        const { data: schedRow, error: schedError } = await supabase.from('schedules').insert({
          lab_id: labId, name: `GPU 예약 · ${selServer.name}`, type: 'mine',
          date: resForm.date, time: resForm.startTime, assignee: user.name, user_id: user.id, visible: false,
        }).select().single()
        if (schedError) console.error(schedError)
        else await supabase.from('gpu_reservations').update({ schedule_id: schedRow.id }).eq('id', created.id)
      }
    } catch (e) { /* error shown by hook */ }
  }

  const cancelReservation = async (r) => {
    if (r.userName !== user.name && !isAdmin) return
    if (!window.confirm('이 예약을 취소하시겠습니까?')) return
    try {
      await resHook.remove(r.id)
      notifications.cancel(`gpu-res-${r.id}`)
      if (r.scheduleId) await supabase.from('schedules').delete().eq('id', r.scheduleId)
    } catch (e) { /* error shown by hook */ }
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

      {servers.length > 0 && (
        <div className="seg" style={{ margin: '0 16px 14px' }}>
          <button className={`seg-btn${view === 'servers' ? ' on' : ''}`} onClick={() => setView('servers')}>서버</button>
          <button className={`seg-btn${view === 'calendar' ? ' on' : ''}`} onClick={() => setView('calendar')}>캘린더</button>
        </div>
      )}

      {view === 'calendar' && servers.length > 0 ? (
        <GpuCalendar servers={servers} reservations={reservations} onSelectServer={setSelServer} />
      ) : (
        <>
          {servers.length > 0 && (
            <div className="supply-summary">
              <div className="supply-stat">
                <div className="n">{servers.length}</div>
                <div className="l">전체 서버</div>
              </div>
              <div className="supply-stat">
                <div className="n" style={{ color: '#1a7a52' }}>{availableCount}</div>
                <div className="l">예약가능</div>
              </div>
              <div className="supply-stat" style={{ borderColor: busyCount > 0 ? '#f8c5c5' : 'var(--border)' }}>
                <div className="n" style={{ color: '#c23b3b' }}>{busyCount}</div>
                <div className="l">사용중</div>
              </div>
            </div>
          )}

          {servers.length > 0 && (
            <div style={{ padding: '0 16px 12px', position: 'relative' }}>
              <Icon.Search size={15} strokeWidth={2} style={{ position: 'absolute', left: 30, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
              <input className="form-input" style={{ paddingLeft: 34 }} value={query} onChange={e => setQuery(e.target.value)}
                placeholder="서버 이름, 스펙으로 검색" />
            </div>
          )}

          {servers.length > 0 && (
            <div className="filter-row">
              {[['all', '전체'], ['available', '예약가능'], ['busy', '사용중']].map(([v, l]) => (
                <div key={v} className={`filter-chip${filter === v ? ' active' : ''}`} onClick={() => setFilter(v)}>{l}</div>
              ))}
            </div>
          )}

          {serversHook.loading ? null : servers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text2)' }}>
              <Icon.Server size={30} strokeWidth={1.4} style={{ marginBottom: 12, opacity: .5 }} />
              <div style={{ fontWeight: 500 }}>등록된 서버가 없습니다</div>
              {isAdmin && <div style={{ fontSize: 12, marginTop: 4 }}>+ 서버 추가 버튼으로 등록하세요</div>}
            </div>
          ) : filteredServers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text2)' }}>
              <Icon.Server size={30} strokeWidth={1.4} style={{ marginBottom: 12, opacity: .5 }} />
              <div style={{ fontWeight: 500 }}>검색 결과가 없습니다</div>
            </div>
          ) : filteredServers.map(sv => {
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
        </>
      )}

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
