import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../supabase'
import { toCamelRow } from '../../hooks/useSupabase'
import { toast } from '../../utils/toast'

export default function NoticeComments({ labId, noticeId, user }) {
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)

  const fetchComments = useCallback(async () => {
    if (!labId || !noticeId) return
    const { data, error } = await supabase
      .from('notice_comments').select('*').eq('notice_id', noticeId).order('created_at', { ascending: true })
    if (error) { console.error(error); return }
    setComments(data.map(toCamelRow))
  }, [labId, noticeId])

  useEffect(() => {
    if (!open || !labId || !noticeId) return
    fetchComments()
    const channel = supabase
      .channel(`notice_comments-${noticeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notice_comments', filter: `notice_id=eq.${noticeId}` }, fetchComments)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [open, labId, noticeId, fetchComments])

  const addComment = async () => {
    const trimmed = text.trim()
    if (!trimmed || trimmed.length > 500) return
    try {
      const { error } = await supabase.from('notice_comments').insert({
        notice_id: noticeId, lab_id: labId,
        author: user.name, avatar: user.avatar || '', role: user.role, text: trimmed,
      })
      if (error) throw error
      setText('')
    } catch (e) {
      console.error(e)
      toast.error('댓글 저장에 실패했어요.')
    }
  }

  const deleteComment = async (commentId) => {
    try {
      const { error } = await supabase.from('notice_comments').delete().eq('id', commentId)
      if (error) throw error
    } catch (e) {
      console.error(e)
      toast.error('댓글 삭제에 실패했어요.')
    }
  }

  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setOpen(p => !p)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text2)', padding: '2px 0', display: 'flex', alignItems: 'center', gap: 4 }}>
        댓글 {open ? '접기' : '보기'}
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          {comments.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text2)', padding: '6px 0 10px' }}>첫 댓글을 남겨보세요</div>
          )}
          {comments.map(c => (
            <div key={c.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text2)', fontSize: c.avatar ? 14 : 10, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {c.avatar || c.author?.slice(-1)}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{c.author}</span>
                <span style={{ fontSize: 10, color: 'var(--text2)' }}>{c.role}</span>
                <span style={{ fontSize: 10, color: 'var(--text2)', marginLeft: 'auto' }}>
                  {c.createdAt ? new Date(c.createdAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
                {(c.author === user.name || user.role === '교수') && (
                  <button onClick={() => deleteComment(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 13, padding: '0 2px' }}>×</button>
                )}
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: '0 10px 10px 10px', padding: '7px 10px', fontSize: 13, marginLeft: 30 }}>
                {c.text}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <input
              className="form-input"
              style={{ flex: 1, padding: '7px 10px', fontSize: 13 }}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="댓글 작성..."
              maxLength={500}
              onKeyDown={e => e.key === 'Enter' && addComment()}
            />
            <button onClick={addComment} style={{ padding: '7px 14px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              전송
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
