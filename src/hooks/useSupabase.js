import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'
import { toast } from '../utils/toast'

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

// labs/{labId}/{table} 성격의 컬렉션 — Firestore useCollection과 동일한 인터페이스
export function useCollection(labId, table, orderColumn = 'created_at', ascending = false) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

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

  useEffect(() => {
    if (!labId) return
    setLoading(true)
    fetchAll()
    const channel = supabase
      .channel(`${table}-${labId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter: `lab_id=eq.${labId}` }, fetchAll)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [labId, table, fetchAll])

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

export function useMembers(labId) {
  const [members, setMembers] = useState([])

  const fetchMembers = useCallback(async () => {
    if (!labId) return
    const { data, error } = await supabase.from('lab_members').select('*').eq('lab_id', labId)
    if (error) { console.error(error); return }
    setMembers(data.map(m => ({ ...toCamelRow(m), id: m.user_id })))
  }, [labId])

  useEffect(() => {
    if (!labId) return
    fetchMembers()
    const channel = supabase
      .channel(`lab_members-${labId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lab_members', filter: `lab_id=eq.${labId}` }, fetchMembers)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [labId, fetchMembers])

  return members
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
