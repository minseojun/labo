import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, query, orderBy
} from 'firebase/firestore'
import { db } from '../firebase'

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
    })
    return unsub
  }, [labId, collectionName])

  const add = (item) => addDoc(
    collection(db, 'labs', labId, collectionName),
    { ...item, createdAt: serverTimestamp() }
  )

  const update = (id, item) => updateDoc(
    doc(db, 'labs', labId, collectionName, id), item
  )

  const remove = (id) => deleteDoc(
    doc(db, 'labs', labId, collectionName, id)
  )

  return { data, loading, add, update, remove }
}

export function useMembers(labId) {
  const [members, setMembers] = useState([])
  useEffect(() => {
    if (!labId) return
    const unsub = onSnapshot(collection(db, 'labs', labId, 'members'), snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
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
    })
    return unsub
  }, [userId])

  const add = (text) => addDoc(collection(db, 'users', userId, 'todos'), {
    text, done: false, createdAt: serverTimestamp()
  })
  const toggle = (id, done) => updateDoc(doc(db, 'users', userId, 'todos', id), { done })
  const remove = (id) => deleteDoc(doc(db, 'users', userId, 'todos', id))

  return { todos, add, toggle, remove }
}