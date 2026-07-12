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

// 현재 랩 구성원끼리는 색이 절대 겹치지 않도록 배정 (id 기준 안정 정렬 → 순서대로 팔레트 순환)
// memberColor는 이름 해시만 보기 때문에 팔레트가 12색뿐이라 3명만 모여도 흔히 충돌함
export function assignMemberColors(members) {
  const sorted = [...members].sort((a, b) => (a.id || '').localeCompare(b.id || ''))
  const map = {}
  sorted.forEach((m, i) => {
    map[m.name] = COLOR_PALETTE[i % COLOR_PALETTE.length]
  })
  return map
}

// 잡무 반복 주기 → 다음 날짜들 생성 (3개월치)
export function generateTaskDates(startDate, repeat, repeatDays) {
  const dates = []
  const start = new Date(startDate)
  const end = new Date(start)
  end.setMonth(end.getMonth() + 3)

  if (repeat === 'monthly') {
    // 매번 원래 시작일 기준으로 월만 더해서 계산 — setMonth를 반복 누적하면
    // 31일처럼 매달 없는 날짜에서 다음 달로 밀려버린 뒤 영영 원래 날짜로 못 돌아옴
    const day = start.getDate()
    for (let i = 0; ; i++) {
      const cur = new Date(start.getFullYear(), start.getMonth() + i, day)
      if (cur > end) break
      dates.push(fmtDate(cur))
    }
    return dates
  }

  let cur = new Date(start)
  while (cur <= end) {
    dates.push(fmtDate(cur))
    if (repeat === 'weekly')    cur.setDate(cur.getDate() + 7)
    else if (repeat === 'biweekly') cur.setDate(cur.getDate() + 14)
    else if (repeat === 'custom' && repeatDays) cur.setDate(cur.getDate() + repeatDays)
    else break // 1회
  }
  return dates
}
