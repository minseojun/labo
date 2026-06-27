import React from 'react'
import { updateDoc, doc } from 'firebase/firestore'
import { db } from '../../firebase'
import { toast } from '../../utils/toast'
import NoticeComments from './NoticeComments'

export default function NoticeCard({ n, labId, user, noticesHook, hidden }) {
  const canAct = user.role === '교수' || n.author === user.name

  const handleTogglePin = async () => {
    try {
      await updateDoc(doc(db, 'labs', labId, 'notices', n.id), { pinned: !n.pinned })
    } catch (e) {
      console.error(e)
      toast.error('수정에 실패했어요.')
    }
  }

  const handleToggleHidden = async () => {
    try {
      await updateDoc(doc(db, 'labs', labId, 'notices', n.id), { hidden: !hidden, pinned: false })
    } catch (e) {
      console.error(e)
      toast.error('수정에 실패했어요.')
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('이 공지를 삭제하시겠습니까?')) return
    try {
      await noticesHook.remove(n.id)
    } catch (e) {
      // error already shown by hook
    }
  }

  return (
    <div className="notice-card" style={{ borderColor: n.pinned ? '#f8c5c5' : 'var(--border)', opacity: hidden ? .7 : 1, background: hidden ? 'var(--bg)' : 'var(--card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {n.pinned && <span style={{ fontSize: 10, color: 'var(--red)', fontWeight: 700, background: 'var(--red-light)', padding: '2px 7px', borderRadius: 20 }}>📌 고정</span>}
        {hidden && <span style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 600, background: 'var(--border)', padding: '2px 7px', borderRadius: 20 }}>숨김</span>}
      </div>
      <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 8, color: hidden ? 'var(--text2)' : 'var(--text)' }}>{n.body}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--text2)', display: 'flex', gap: 6 }}>
          <span>{n.author}</span>
          {n.date && <span>· {n.date.replace(/^\d{4}-/, '').replace('-', '/')}</span>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {user.role === '교수' && !hidden && (
            <button onClick={handleTogglePin}
              style={{ padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6, background: n.pinned ? 'var(--red-light)' : 'var(--bg)', color: n.pinned ? 'var(--red)' : 'var(--text2)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
              {n.pinned ? '📌 해제' : '📌 고정'}
            </button>
          )}
          {canAct && (
            <button onClick={handleToggleHidden}
              style={{ padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--text2)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
              {hidden ? '↩ 복원' : '✓ 완료'}
            </button>
          )}
          {user.role === '교수' && (
            <button onClick={handleDelete}
              style={{ padding: '3px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--red)', fontSize: 11, cursor: 'pointer' }}>
              🗑
            </button>
          )}
        </div>
      </div>
      {!hidden && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <NoticeComments labId={labId} noticeId={n.id} user={user} />
        </div>
      )}
    </div>
  )
}
