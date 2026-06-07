import React, { useState, useEffect } from 'react'
import { toast } from '../utils/toast'

const TOAST_STYLE = `@keyframes toastIn{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}`

export default function ToastContainer() {
  const [items, setItems] = useState([])

  useEffect(() => {
    return toast.subscribe(item => {
      setItems(prev => [...prev, item])
      setTimeout(() => setItems(prev => prev.filter(i => i.id !== item.id)), 3000)
    })
  }, [])

  if (!items.length) return null

  return (
    <>
      <style>{TOAST_STYLE}</style>
      <div style={{
        position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center',
        pointerEvents: 'none'
      }}>
        {items.map(item => (
          <div key={item.id} style={{
            background: item.type === 'error' ? '#c23b3b' : item.type === 'success' ? '#2D9B6F' : '#1A1A1A',
            color: '#fff', padding: '10px 20px', borderRadius: 24,
            fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(0,0,0,.25)', animation: 'toastIn .2s ease'
          }}>
            {item.message}
          </div>
        ))}
      </div>
    </>
  )
}
