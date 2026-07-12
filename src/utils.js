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

// 잡무 하나의 실제 "부담"을 계산 — 다음 90일(3개월) 동안 몇 번 발생하는지로 측정.
// 잡무 개수를 1개씩 세면 2일마다 도는 잡무와 14일마다 도는 잡무가 똑같이 취급되는데,
// 실제로는 전자가 훨씬 자주 돌아오므로 반복 횟수 기준으로 부담을 재야 공평함
export function taskWorkload(task) {
  return generateTaskDates(task.startDate || task.date, task.repeat, task.repeatDays, task.endDate).length
}

// 잡무 전체를 구성원 사이에 "발생 횟수" 총합이 고르게 맞춰지도록 재배정.
// 부담이 큰(자주 도는) 잡무부터 순서대로, 그 시점에 누적 부담이 가장 적은 사람에게 배정하는
// 그리디(LPT) 방식 — 잡무 개수가 아니라 실제 반복 횟수 기준으로 균형을 맞춤
export function redistributeTasks(tasks, members) {
  if (tasks.length === 0 || members.length === 0) return []
  const sortedMembers = [...members].sort((a, b) => (a.id || '').localeCompare(b.id || ''))
  const loads = sortedMembers.map(() => 0)
  const weighted = tasks
    .map(t => ({ id: t.id, weight: taskWorkload(t) }))
    .sort((a, b) => b.weight - a.weight || String(a.id).localeCompare(String(b.id)))

  return weighted.map(t => {
    let minIdx = 0
    for (let i = 1; i < loads.length; i++) {
      if (loads[i] < loads[minIdx]) minIdx = i
    }
    loads[minIdx] += t.weight
    return { id: t.id, assignee: sortedMembers[minIdx].name }
  })
}

// 잡무 반복 주기 → 다음 날짜들 생성 (기본 3개월치, endDate가 그보다 이르면 endDate까지만)
export function generateTaskDates(startDate, repeat, repeatDays, endDate) {
  const dates = []
  const start = new Date(startDate)
  const end = new Date(start)
  end.setMonth(end.getMonth() + 3)
  if (endDate) {
    const endD = new Date(endDate)
    if (endD < end) end.setTime(endD.getTime())
  }

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
