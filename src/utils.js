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

// 잡무 하나를 담당하는 사람 목록 — 여러 명이면 발생할 때마다 순서대로 돌아가며 맡음.
// rotation이 없는 옛날 데이터는 assignee 한 명짜리 rotation으로 취급해 하위 호환
export function taskRotation(task) {
  if (task.rotation && task.rotation.length > 0) return task.rotation
  return task.assignee ? [task.assignee] : []
}

// 잡무의 각 발생일마다 실제로 누가 담당인지 계산 (라운드로빈으로 순서대로 순환)
export function taskOccurrences(task) {
  const rotation = taskRotation(task)
  if (rotation.length === 0) return []
  const dates = generateTaskDates(task.startDate || task.date, task.repeat, task.repeatDays, task.endDate)
  return dates.map((date, i) => ({ date, assignee: rotation[i % rotation.length] }))
}

// 특정 날짜에 이 잡무를 실제로 담당하는 사람
export function taskAssigneeOn(task, dateStr) {
  return taskOccurrences(task).find(o => o.date === dateStr)?.assignee
}

// 한 사람이 이 잡무에서 실제로 맡게 되는 횟수 (라운드로빈으로 나뉜 만큼만 셈)
export function memberWorkload(task, memberName) {
  return taskOccurrences(task).filter(o => o.assignee === memberName).length
}

function addDays(dateStr, delta) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + delta)
  return fmtDate(d)
}

function permutations(arr) {
  if (arr.length <= 1) return [arr]
  const result = []
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)]
    for (const p of permutations(rest)) result.push([arr[i], ...p])
  }
  return result
}

function shuffled(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 인원이 적으면(≤6명, ≤720가지) 순서를 전수조사, 많으면 계산량 때문에 무작위 셔플 다수로 대체
function candidateOrders(baseOrder) {
  if (baseOrder.length <= 6) return permutations(baseOrder)
  const candidates = [baseOrder]
  for (let i = 0; i < 300; i++) candidates.push(shuffled(baseOrder))
  return candidates
}

// rotation 인원 구성은 그대로 두고 "순환 순서"만 바꿔서, 이미 정해진 다른 잡무들과
// 같은 날 겹치거나 하루 간격으로 붙는 걸 최대한 피함. 같은 날 중복과 연속일을 똑같은
// 무게로 벌점을 줘야 함 — 한쪽에 더 무게를 두면 그쪽만 사라지고 반대쪽으로 몰림
// (예: 같은 날 중복을 훨씬 무겁게 벌점 주면 그건 0이 되지만 연속일이 오히려 폭증함).
// 인원 구성 자체를 바꾸지 않으므로 각자의 전체 담당 횟수(공평성)는 그대로 유지됨
export function bestRotationOrder(task, baseOrder, otherTasks) {
  if (baseOrder.length <= 1) return [...baseOrder]

  const occupied = {} // 사람 이름 -> 이미 다른 잡무로 잡혀있는 날짜 Set
  otherTasks.forEach(t => {
    taskOccurrences(t).forEach(({ date, assignee }) => {
      if (!occupied[assignee]) occupied[assignee] = new Set()
      occupied[assignee].add(date)
    })
  })

  let bestOrder = baseOrder
  let bestScore = Infinity
  for (const order of candidateOrders(baseOrder)) {
    let score = 0
    taskOccurrences({ ...task, rotation: order }).forEach(({ date, assignee }) => {
      const taken = occupied[assignee]
      if (!taken) return
      if (taken.has(date)) score += 1
      if (taken.has(addDays(date, -1))) score += 1
      if (taken.has(addDays(date, 1))) score += 1
    })
    if (score < bestScore) { bestScore = score; bestOrder = order }
  }
  return bestOrder
}

// 잡무 전체를 전원이 돌아가며 맡도록 재배정. 한 사람이 잡무 하나를 통째로 맡는
// 1:1 방식은 반복 주기가 서로 다른 잡무 사이에서 부담이 크게 벌어질 수밖에 없어서,
// 잡무마다 현재 구성원 전원을 로테이션으로 묶어 발생할 때마다 돌아가며 맡게 함.
// 순환이 시작되는 순서는 잡무별로 겹침·연속일이 가장 적은 쪽을 골라서, 한 사람이
// 하루에 잡무 두 개를 몰아 받거나 이틀 연속으로 걸리는 일을 최대한 줄임.
// 한 번 훑고 끝내지 않고 몇 차례 다시 훑어(좌표 하강) 잡무끼리 서로 맞춰가게 함
export function redistributeTasks(tasks, members) {
  if (tasks.length === 0 || members.length === 0) return []
  const sortedMembers = [...members].sort((a, b) => (a.id || '').localeCompare(b.id || ''))
  const baseOrder = sortedMembers.map(m => m.name)

  // 자주 도는(부담이 큰) 잡무일수록 겹칠 여지가 많으니 먼저 자리를 잡아줌
  const orderByFreq = [...tasks].sort((a, b) => taskWorkload(b) - taskWorkload(a) || String(a.id).localeCompare(String(b.id)))

  let current = tasks.map(t => ({ ...t, rotation: baseOrder }))
  const PASSES = 3
  for (let pass = 0; pass < PASSES; pass++) {
    orderByFreq.forEach(t => {
      const idx = current.findIndex(x => x.id === t.id)
      const rotation = bestRotationOrder(t, baseOrder, current.filter(x => x.id !== t.id))
      current[idx] = { ...current[idx], rotation }
    })
  }
  return current.map(t => ({ id: t.id, rotation: t.rotation }))
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
