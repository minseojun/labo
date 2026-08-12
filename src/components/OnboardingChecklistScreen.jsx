import React, { useState } from 'react'
import { useCollection, useMembers } from '../hooks/useSupabase'
import { toast } from '../utils/toast'
import { Icon } from './Icon'

export default function OnboardingChecklistScreen({ labId, user }) {
  const itemsHook = useCollection(labId, 'onboarding_items', 'created_at', true)
  const progressHook = useCollection(labId, 'onboarding_progress', 'created_at')
  const members = useMembers(labId)
  const [showAddItem, setShowAddItem] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [viewMember, setViewMember] = useState(null)

  const isAdmin = user.role === '교수'
  const items = itemsHook.data

  const progressFor = (userId) => progressHook.data.filter(p => p.userId === userId && p.done)
  const isDone = (userId, itemId) => progressHook.data.some(p => p.userId === userId && p.itemId === itemId && p.done)

  const toggleItem = async (itemId) => {
    const existing = progressHook.data.find(p => p.userId === user.id && p.itemId === itemId)
    try {
      if (existing) {
        await progressHook.update(existing.id, { done: !existing.done, doneAt: !existing.done ? new Date().toISOString() : null })
      } else {
        await progressHook.add({ itemId, userId: user.id, done: true, doneAt: new Date().toISOString() })
      }
    } catch (e) { /* error shown by hook */ }
  }

  const addItem = async () => {
    const title = newTitle.trim()
    if (!title) { toast.error('체크리스트 항목을 입력해주세요.'); return }
    if (title.length > 100) { toast.error('제목은 100자 이내로 입력해주세요.'); return }
    try {
      await itemsHook.add({ title, description: newDesc.trim() })
      setShowAddItem(false)
      setNewTitle('')
      setNewDesc('')
    } catch (e) { /* error shown by hook */ }
  }

  const deleteItem = async (item) => {
    if (!window.confirm(`"${item.title}" 항목을 삭제하시겠습니까?`)) return
    try { await itemsHook.remove(item.id) } catch (e) { /* error shown by hook */ }
  }

  const myDoneCount = items.filter(it => isDone(user.id, it.id)).length

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="page-title">온보딩 체크리스트</div>
          {isAdmin && (
            <button onClick={() => setShowAddItem(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 14px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <Icon.Plus size={14} strokeWidth={2.4} /> 항목 추가
            </button>
          )}
        </div>
      </div>

      {itemsHook.loading ? null : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text2)' }}>
          <Icon.ClipboardCheck size={30} strokeWidth={1.4} style={{ marginBottom: 12, opacity: .5 }} />
          <div style={{ fontWeight: 500 }}>등록된 체크리스트 항목이 없습니다</div>
          {isAdmin && <div style={{ fontSize: 12, marginTop: 4 }}>+ 항목 추가 버튼으로 신입 온보딩 항목을 만드세요</div>}
        </div>
      ) : (
        <>
          <div style={{ margin: '0 16px 14px', background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              <span>내 진행률</span><span style={{ color: 'var(--green)' }}>{myDoneCount}/{items.length}</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${items.length ? (myDoneCount / items.length) * 100 : 0}%`, background: 'var(--green)', transition: 'width .2s' }} />
            </div>
          </div>

          {items.map(item => {
            const done = isDone(user.id, item.id)
            return (
              <div key={item.id} className="equip-card" onClick={() => toggleItem(item.id)}>
                <div className="equip-icon" style={{ background: done ? 'var(--green-light)' : 'var(--bg)', color: done ? 'var(--green)' : 'var(--text3)' }}>
                  <Icon.ClipboardCheck size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, textDecoration: done ? 'line-through' : 'none', color: done ? 'var(--text2)' : 'var(--text)' }}>{item.title}</div>
                  {item.description && <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{item.description}</div>}
                </div>
                {isAdmin && (
                  <button onClick={e => { e.stopPropagation(); deleteItem(item) }}
                    style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4 }}>
                    <Icon.X size={14} strokeWidth={2} />
                  </button>
                )}
              </div>
            )
          })}

          {isAdmin && (
            <>
              <div className="page-header" style={{ paddingTop: 24 }}>
                <div className="page-title" style={{ fontSize: 16 }}>구성원별 진행 현황</div>
              </div>
              {members.filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i).map(m => {
                const doneCount = progressFor(m.id).length
                return (
                  <div key={m.id} className="equip-card" onClick={() => setViewMember(m)}>
                    <div className="equip-icon" style={{ background: 'var(--green-light)', color: 'var(--green)', fontSize: 16, fontWeight: 600 }}>
                      {m.avatar || m.name?.slice(-1)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>{m.role}</div>
                    </div>
                    <span className={`chip ${doneCount === items.length ? 'chip-green' : 'chip-yellow'}`}>{doneCount}/{items.length}</span>
                  </div>
                )
              })}
            </>
          )}
        </>
      )}

      {showAddItem && isAdmin && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setShowAddItem(false)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">체크리스트 항목 추가</div>
            <div className="form-group">
              <label className="form-label">제목</label>
              <input className="form-input" value={newTitle} maxLength={100}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="예: 안전교육 이수" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">설명 (선택)</label>
              <input className="form-input" value={newDesc} maxLength={200}
                onChange={e => setNewDesc(e.target.value)}
                placeholder="예: 교내 시스템에서 실험실 안전교육 영상 시청" />
            </div>
            <button className="btn-primary" onClick={addItem}>추가하기</button>
          </div>
        </div>
      )}

      {viewMember && (
        <div className="sheet-backdrop" onClick={e => e.target === e.currentTarget && setViewMember(null)}>
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-title">{viewMember.name}님의 체크리스트</div>
            {items.map(item => {
              const done = isDone(viewMember.id, item.id)
              return (
                <div key={item.id} className="log-item">
                  <span style={{ color: done ? 'var(--text)' : 'var(--text2)', textDecoration: done ? 'line-through' : 'none' }}>{item.title}</span>
                  <span style={{ color: done ? 'var(--green)' : 'var(--text3)', fontSize: 11, fontWeight: 600 }}>{done ? '완료' : '미완료'}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
