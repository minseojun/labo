import React from 'react'

export const isImageAvatar = (v) => typeof v === 'string' && /^https?:\/\//.test(v)

// avatar 값이 업로드된 사진(URL)이면 이미지로, 아니면(이모지·이니셜) 텍스트 그대로 보여줌 —
// 부모가 이미 원형 컨테이너(width/height/overflow:hidden)를 잡아준다고 가정함
export function Avatar({ value, fallback }) {
  if (isImageAvatar(value)) {
    return <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
  }
  return <>{value || fallback || ''}</>
}
