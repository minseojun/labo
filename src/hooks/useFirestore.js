import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy
} from 'firebase/firestore'
import { db } from '../firebase'
import { toast } from '../utils/toast'

export function useCollection(labId, collectionName, orderField = 'createdAt') {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!labId) return
    const q = query(
      collection(db, 'labs', labId, collectionName),
      orderBy(orderField, 'desc')
    )
    const unsub = onSnapshot(q, snap => {
      setData(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, err => {
      console.error(err)
      setLoading(false)
      toast.error('데이터를 불러오지 못했어요')
    })
    return unsub
  }, [labId, collectionName])

  const add = async (item) => {
    try {
      return await addDoc(
        collection(db, 'labs', labId, collectionName),
        { ...item, createdAt: serverTimestamp() }
      )
    } catch (e) {
      console.error(e)
      toast.error('저장에 실패했어요. 다시 시도해주세요.')
      throw e
    }
  }

  const update = async (id, item) => {
    try {
      return await updateDoc(doc(db, 'labs', labId, collectionName, id), item)
    } catch (e) {
      console.error(e)
      toast.error('수정에 실패했어요. 다시 시도해주세요.')
      throw e
    }
  }

  const remove = async (id) => {
    try {
      return await deleteDoc(doc(db, 'labs', labId, collectionName, id))
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
  useEffect(() => {
    if (!labId) return
    const unsub = onSnapshot(collection(db, 'labs', labId, 'members'), snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }, err => console.error(err))
    return unsub
  }, [labId])
  return members
}

export function useUserTodos(userId) {
  const [todos, setTodos] = useState([])

  useEffect(() => {
    if (!userId) return
    const q = query(collection(db, 'users', userId, 'todos'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setTodos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }, err => console.error(err))
    return unsub
  }, [userId])

  const add = async (text) => {
    try {
      return await addDoc(collection(db, 'users', userId, 'todos'), {
        text, done: false, createdAt: serverTimestamp()
      })
    } catch (e) {
      console.error(e)
      toast.error('할 일 추가에 실패했어요.')
      throw e
    }
  }

  const toggle = async (id, done) => {
    try {
      const today = new Date().toISOString().split('T')[0]
      return await updateDoc(doc(db, 'users', userId, 'todos', id), {
        done,
        doneDate: done ? today : null,
      })
    } catch (e) {
      console.error(e)
      toast.error('상태 변경에 실패했어요.')
      throw e
    }
  }

  const remove = async (id) => {
    try {
      return await deleteDoc(doc(db, 'users', userId, 'todos', id))
    } catch (e) {
      console.error(e)
      toast.error('삭제에 실패했어요.')
      throw e
    }
  }

  return { todos, add, toggle, remove }
}
