export function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getWeekDates(base) {
  const d = new Date(base)
  const day = d.getDay()
  const sun = new Date(d)
  sun.setDate(d.getDate() - day)
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(sun)
    x.setDate(sun.getDate() + i)
    return x
  })
}

export function formatTime(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function statusLabel(s) {
  return s === 'green' ? '정상' : s === 'yellow' ? '곧 부족' : '재고 없음'
}
export function statusBg(s) {
  return s === 'green' ? 'var(--green-light)' : s === 'yellow' ? 'var(--yellow-light)' : 'var(--red-light)'
}
export function statusColor(s) {
  return s === 'green' ? '#1a7a52' : s === 'yellow' ? '#b97b10' : '#c23b3b'
}

// 멤버 이름 → 일관된 랜덤 컬러 (같은 이름은 항상 같은 색)
const COLOR_PALETTE = [
  '#2D9B6F', '#5B9BD5', '#F5A623', '#8B7ED8',
  '#E05252', '#3ABFBF', '#E8854A', '#A0C840',
  '#D45BAA', '#6C8EBF', '#C4A020', '#5BAD8F',
]
export function memberColor(name) {
  if (!name) return COLOR_PALETTE[0]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length]
}

// 잡무 반복 주기 → 다음 날짜들 생성 (3개월치)
export function generateTaskDates(startDate, repeat, repeatDays) {
  const dates = []
  const start = new Date(startDate)
  const end = new Date(start)
  end.setMonth(end.getMonth() + 3)

  let cur = new Date(start)
  while (cur <= end) {
    dates.push(fmtDate(cur))
    if (repeat === 'weekly')    cur.setDate(cur.getDate() + 7)
    else if (repeat === 'biweekly') cur.setDate(cur.getDate() + 14)
    else if (repeat === 'monthly')  cur.setMonth(cur.getMonth() + 1)
    else if (repeat === 'custom' && repeatDays) cur.setDate(cur.getDate() + repeatDays)
    else break // 1회
  }
  return dates
}
