import { useState, useEffect, useCallback, useRef } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { supabase } from '../supabase'
import { toast } from '../utils/toast'
import { haptic } from '../utils/haptics'
import { notifications } from '../utils/notifications'

// DB 컬럼(snake_case) <-> 컴포넌트가 기대하는 필드명(camelCase) 변환.
// 중첩 jsonb(logs/history/overrides 내부)는 건드리지 않고 최상위 키만 변환함
export function toCamelRow(row) {
  if (!row) return row
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    out[camel] = v
  }
  return out
}
export function toSnakeItem(item) {
  const out = {}
  for (const [k, v] of Object.entries(item)) {
    const snake = k.replace(/[A-Z]/g, c => '_' + c.toLowerCase())
    out[snake] = v
  }
  return out
}

// labs/{labId}/{table} 성격의 컬렉션 — Firestore useCollection과 동일한 인터페이스.
// 도메인 모듈 화면(위험물/GPU예약/데이터셋/온보딩)처럼 그 탭을 보고 있을
// 때만 잠깐 켜지는 컬렉션에 씀 — 항상 켜져 있는 핵심 데이터는 아래 useLabRealtime이
// 채널을 공유해서 더 적은 연결로 처리함
//
// 실시간 갱신은 "뭐가 바뀌었든 전체를 다시 select" 하지 않고, 바뀐 행 하나만
// 로컬 배열에 patch함(추가/교체/삭제) — 랩에 접속한 사람이 많고 목록이 길어질수록
// 예전 방식은 매 변경마다 모두가 전체를 다시 불러와서 부담이 커졌음
export function useCollection(labId, table, orderColumn = 'created_at', ascending = false) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const sortRows = useCallback((rows) => {
    const key = orderColumn.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    const dir = ascending ? 1 : -1
    return [...rows].sort((a, b) => {
      const av = a[key], bv = b[key]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }, [orderColumn, ascending])

  const fetchAll = useCallback(async () => {
    if (!labId) return
    const { data: rows, error } = await supabase
      .from(table)
      .select('*')
      .eq('lab_id', labId)
      .order(orderColumn, { ascending })
    if (error) {
      console.error(error)
      toast.error('데이터를 불러오지 못했어요')
      setLoading(false)
      return
    }
    setData(rows.map(toCamelRow))
    setLoading(false)
  }, [labId, table, orderColumn, ascending])

  const handleChange = useCallback((payload) => {
    setData(prev => {
      if (payload.eventType === 'DELETE') {
        return prev.filter(row => row.id !== payload.old.id)
      }
      const row = toCamelRow(payload.new)
      const idx = prev.findIndex(r => r.id === row.id)
      const next = idx === -1 ? [...prev, row] : prev.map((r, i) => i === idx ? row : r)
      return sortRows(next)
    })
  }, [sortRows])

  useEffect(() => {
    if (!labId) return
    setLoading(true)
    fetchAll()
    const channel = supabase
      .channel(`${table}-${labId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter: `lab_id=eq.${labId}` }, handleChange)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [labId, table, fetchAll, handleChange])

  const add = async (item) => {
    try {
      const { data: row, error } = await supabase
        .from(table)
        .insert({ ...toSnakeItem(item), lab_id: labId })
        .select()
        .single()
      if (error) throw error
      return toCamelRow(row)
    } catch (e) {
      console.error(e)
      toast.error('저장에 실패했어요. 다시 시도해주세요.')
      throw e
    }
  }

  const update = async (id, item) => {
    try {
      const { error } = await supabase.from(table).update(toSnakeItem(item)).eq('id', id)
      if (error) throw error
    } catch (e) {
      console.error(e)
      toast.error('수정에 실패했어요. 다시 시도해주세요.')
      throw e
    }
  }

  const remove = async (id) => {
    try {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error
    } catch (e) {
      console.error(e)
      toast.error('삭제에 실패했어요. 다시 시도해주세요.')
      throw e
    }
  }

  return { data, loading, add, update, remove }
}

export function useUserTodos(userId) {
  const [todos, setTodos] = useState([])

  const fetchTodos = useCallback(async () => {
    if (!userId) return
    const { data, error } = await supabase
      .from('todos').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (error) { console.error(error); return }
    setTodos(data.map(toCamelRow))
  }, [userId])

  useEffect(() => {
    if (!userId) return
    fetchTodos()
    const channel = supabase
      .channel(`todos-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'todos', filter: `user_id=eq.${userId}` }, fetchTodos)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [userId, fetchTodos])

  const add = async (text) => {
    try {
      const { error } = await supabase.from('todos').insert({ user_id: userId, text, done: false })
      if (error) throw error
    } catch (e) {
      console.error(e)
      toast.error('할 일 추가에 실패했어요.')
      throw e
    }
  }

  const toggle = async (id, done) => {
    try {
      const today = new Date().toISOString().split('T')[0]
      const { error } = await supabase.from('todos').update({ done, done_date: done ? today : null }).eq('id', id)
      if (error) throw error
    } catch (e) {
      console.error(e)
      toast.error('상태 변경에 실패했어요.')
      throw e
    }
  }

  const remove = async (id) => {
    try {
      const { error } = await supabase.from('todos').delete().eq('id', id)
      if (error) throw error
    } catch (e) {
      console.error(e)
      toast.error('삭제에 실패했어요.')
      throw e
    }
  }

  return { todos, add, toggle, remove }
}

// endAt(완료 예정 절대 시각)을 서버에 저장해두고, 로컬에서는 매 초 그 값에서
// 남은 시간을 다시 계산만 함 — 그래서 다른 기기(랩 PC 등)에서 열어도 같은
// 시각에 똑같이 끝나고, 화면이 꺼졌다 켜져도 오차 없이 남은 시간이 맞음
function timeLeftFrom(t) {
  if (!t.running || !t.endAt) return t.timeLeft
  return Math.max(0, Math.round((new Date(t.endAt).getTime() - Date.now()) / 1000))
}

function notifyTimerDone(name) {
  // 네이티브에서는 타이머를 시작하는 시점에 이미 endAt으로 로컬 알림을 예약해뒀어서
  // (앱이 꺼져있어도 정확한 시각에 옴) 여기서 또 띄우면 중복이라 웹에서만 즉시 띄움
  if (!notifications.isNative) notifications.showNow(`${name} 완료!`, '실험이 완료되었습니다.')
  haptic.medium()
}

// 로컬 상태 + 정렬 + patch만 담당하는 조각 — useLabRealtime이 여러 테이블을
// 채널 하나로 묶을 때 테이블마다 하나씩 씀 (자체 채널/fetch는 안 갖고 있음)
function useTableSlice(orderColumn, ascending) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const sortRows = useCallback((rows) => {
    const key = orderColumn.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    const dir = ascending ? 1 : -1
    return [...rows].sort((a, b) => {
      const av = a[key], bv = b[key]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
  }, [orderColumn, ascending])

  const setAll = useCallback((rows) => {
    setData(sortRows(rows.map(toCamelRow)))
    setLoading(false)
  }, [sortRows])

  const patch = useCallback((payload) => {
    setData(prev => {
      if (payload.eventType === 'DELETE') return prev.filter(row => row.id !== payload.old.id)
      const row = toCamelRow(payload.new)
      const idx = prev.findIndex(r => r.id === row.id)
      const next = idx === -1 ? [...prev, row] : prev.map((r, i) => i === idx ? row : r)
      return sortRows(next)
    })
  }, [sortRows])

  return { data, loading, setAll, patch }
}

// ── 랩 화면 통합 실시간 구독 ──────────────────────────────────────────────
// App 레벨에서 로그인만 하면 항상 켜져 있는 5개 lab-scoped 컬렉션(schedules/
// equipment/supplies/notices/lab_members) + 1개 user-scoped 컬렉션(timers)을
// 채널 하나로 묶음. 예전엔 각자 자기 채널을 하나씩 열어서 로그인한 사람 한
// 명당 실시간 연결이 6개씩 떠 있었음 — 동시 접속자가 늘어날수록 이 연결 수
// 자체가 Supabase 프로젝트의 실시간 동시 접속 한도에 그대로 부담이 되기
// 때문에, 채널 하나에 postgres_changes 구독을 여러 개 붙여서 사용자 한
// 명당 연결을 1개로 줄임
export function useLabRealtime(userId, labId) {
  const schedules = useTableSlice('date', false)
  const equipment = useTableSlice('created_at', false)
  const supplies = useTableSlice('created_at', false)
  const notices = useTableSlice('created_at', false)
  const [members, setMembers] = useState([])

  const membersPatch = useCallback((payload) => {
    setMembers(prev => {
      if (payload.eventType === 'DELETE') return prev.filter(m => m.id !== payload.old.user_id)
      const row = { ...toCamelRow(payload.new), id: payload.new.user_id }
      const idx = prev.findIndex(m => m.id === row.id)
      return idx === -1 ? [...prev, row] : prev.map((m, i) => i === idx ? row : m)
    })
  }, [])

  // ── 타이머(본인 소유, user_id로 구독) ──
  const [timers, setTimers] = useState([])
  const intervalsRef = useRef({})
  const timersRef = useRef([])
  timersRef.current = timers

  const stopInterval = useCallback((id) => {
    clearInterval(intervalsRef.current[id])
    delete intervalsRef.current[id]
  }, [])

  const finishTimer = useCallback((t) => {
    stopInterval(t.id)
    notifications.cancel(`timer-${t.id}`)
    notifyTimerDone(t.name)
    setTimers(prev => prev.map(x => x.id === t.id ? { ...x, timeLeft: 0, running: false, done: true, endAt: null } : x))
    supabase.from('timers').update({ time_left: 0, running: false, done: true, end_at: null }).eq('id', t.id)
      .then(({ error }) => { if (error) console.error(error) })
  }, [stopInterval])

  const startInterval = useCallback((id) => {
    if (intervalsRef.current[id]) return
    intervalsRef.current[id] = setInterval(() => {
      const t = timersRef.current.find(x => x.id === id)
      if (!t || !t.running) { stopInterval(id); return }
      const next = timeLeftFrom(t)
      if (next <= 0) { finishTimer(t); return }
      if (next !== t.timeLeft) setTimers(prev => prev.map(x => x.id === id ? { ...x, timeLeft: next } : x))
    }, 1000)
  }, [stopInterval, finishTimer])

  const timersPatch = useCallback((payload) => {
    setTimers(prev => {
      if (payload.eventType === 'DELETE') return prev.filter(t => t.id !== payload.old.id)
      const row = toCamelRow(payload.new)
      const idx = prev.findIndex(t => t.id === row.id)
      return idx === -1 ? [...prev, row] : prev.map((t, i) => i === idx ? row : t)
    })
  }, [])

  // 실행 중 표시된 타이머엔 로컬 tick을 붙이고 아니면 뗌 — 이 기기에서 직접
  // 시작했든, 다른 기기에서 시작해서 실시간으로 넘어왔든 똑같이 동작함
  useEffect(() => {
    timers.forEach(t => { t.running ? startInterval(t.id) : stopInterval(t.id) })
  }, [timers, startInterval, stopInterval])

  // 화면/탭이 백그라운드에 있던 동안 setInterval 자체가 멈췄을 수 있어서,
  // 복귀 즉시 한 번 다시 계산해서 몰래 끝나 있던 타이머를 바로 잡아냄
  useEffect(() => {
    const recompute = () => {
      if (document.hidden) return
      timersRef.current.forEach(t => {
        if (!t.running) return
        const next = timeLeftFrom(t)
        if (next <= 0) finishTimer(t)
        else if (next !== t.timeLeft) setTimers(prev => prev.map(x => x.id === t.id ? { ...x, timeLeft: next } : x))
      })
    }
    document.addEventListener('visibilitychange', recompute)
    let sub
    if (Capacitor.isNativePlatform()) sub = CapacitorApp.addListener('resume', recompute)
    return () => {
      document.removeEventListener('visibilitychange', recompute)
      sub?.then(s => s.remove())
    }
  }, [finishTimer])

  useEffect(() => () => Object.values(intervalsRef.current).forEach(clearInterval), [])

  // ── 초기 로드 + 채널 하나로 통합 구독 ──
  useEffect(() => {
    if (!labId) return

    const fetchTable = async (table, orderColumn, ascending, onData) => {
      const { data, error } = await supabase.from(table).select('*').eq('lab_id', labId).order(orderColumn, { ascending })
      if (error) { console.error(error); toast.error('데이터를 불러오지 못했어요'); return }
      onData(data)
    }

    fetchTable('schedules', 'date', false, schedules.setAll)
    fetchTable('equipment', 'created_at', false, equipment.setAll)
    fetchTable('supplies', 'created_at', false, supplies.setAll)
    fetchTable('notices', 'created_at', false, notices.setAll)
    supabase.from('lab_members').select('*').eq('lab_id', labId).then(({ data, error }) => {
      if (error) { console.error(error); return }
      setMembers(data.map(m => ({ ...toCamelRow(m), id: m.user_id })))
    })
    if (userId) {
      supabase.from('timers').select('*').eq('user_id', userId).order('created_at', { ascending: true }).then(({ data, error }) => {
        if (error) { console.error(error); return }
        setTimers(data.map(toCamelRow))
      })
    }

    const channel = supabase.channel(`lab-${labId}-${userId || 'anon'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedules', filter: `lab_id=eq.${labId}` }, schedules.patch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment', filter: `lab_id=eq.${labId}` }, equipment.patch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supplies', filter: `lab_id=eq.${labId}` }, supplies.patch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notices', filter: `lab_id=eq.${labId}` }, notices.patch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lab_members', filter: `lab_id=eq.${labId}` }, membersPatch)
    if (userId) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'timers', filter: `user_id=eq.${userId}` }, timersPatch)
    }
    channel.subscribe()

    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labId, userId])

  const makeHook = (table, slice) => ({
    data: slice.data,
    loading: slice.loading,
    add: async (item) => {
      try {
        const { data: row, error } = await supabase.from(table).insert({ ...toSnakeItem(item), lab_id: labId }).select().single()
        if (error) throw error
        return toCamelRow(row)
      } catch (e) {
        console.error(e)
        toast.error('저장에 실패했어요. 다시 시도해주세요.')
        throw e
      }
    },
    update: async (id, item) => {
      try {
        const { error } = await supabase.from(table).update(toSnakeItem(item)).eq('id', id)
        if (error) throw error
      } catch (e) {
        console.error(e)
        toast.error('수정에 실패했어요. 다시 시도해주세요.')
        throw e
      }
    },
    remove: async (id) => {
      try {
        const { error } = await supabase.from(table).delete().eq('id', id)
        if (error) throw error
      } catch (e) {
        console.error(e)
        toast.error('삭제에 실패했어요. 다시 시도해주세요.')
        throw e
      }
    },
  })

  const addTimer = useCallback(async (config) => {
    if (!userId) return
    const { error } = await supabase.from('timers').insert({
      user_id: userId, lab_id: labId || null,
      name: config.name, duration: config.duration, time_left: config.duration,
      equipment: config.equipment || '', running: false, done: false, memo: '',
    })
    if (error) { console.error(error); toast.error('타이머 추가에 실패했어요.') }
    notifications.ensurePermission()
  }, [userId, labId])

  const updateTimer = useCallback(async (id, patch) => {
    const t = timersRef.current.find(x => x.id === id)
    if (!t) return
    const next = { ...patch }
    // 시작/재개 시점의 실제 시각으로 endAt을 다시 잡아야 일시정지했다가
    // 이어서 돌려도, 다른 기기에서 봐도 오차가 안 생김
    if (patch.running === true) {
      const endAt = new Date(Date.now() + t.timeLeft * 1000)
      next.endAt = endAt.toISOString()
      // 앱이 백그라운드에 있거나 완전히 꺼져 있어도 정확한 시각에 알림이 오도록
      // 시작(재개) 시점에 바로 예약함 — 화면을 계속 보고 있어야만 동작하던
      // 기존 방식(포그라운드 setInterval)과 달리 실제로 "닫아놔도 오는" 알림
      notifications.scheduleAt(`timer-${id}`, `${t.name} 완료!`, '실험이 완료됐어요.', endAt)
    }
    if (patch.running === false) {
      next.endAt = null
      notifications.cancel(`timer-${id}`)
    }
    if (patch.timeLeft === t.duration) next.endAt = null // 리셋
    setTimers(prev => prev.map(x => x.id === id ? { ...x, ...next } : x))
    const { error } = await supabase.from('timers').update(toSnakeItem(next)).eq('id', id)
    if (error) { console.error(error); toast.error('타이머 상태 변경에 실패했어요.') }
  }, [])

  const deleteTimer = useCallback(async (id) => {
    stopInterval(id)
    notifications.cancel(`timer-${id}`)
    setTimers(prev => prev.filter(t => t.id !== id))
    const { error } = await supabase.from('timers').delete().eq('id', id)
    if (error) { console.error(error); toast.error('타이머 삭제에 실패했어요.') }
  }, [stopInterval])

  return {
    schedulesHook: makeHook('schedules', schedules),
    equipmentHook: makeHook('equipment', equipment),
    suppliesHook: makeHook('supplies', supplies),
    noticesHook: makeHook('notices', notices),
    members,
    timers,
    addTimer,
    updateTimer,
    deleteTimer,
  }
}
