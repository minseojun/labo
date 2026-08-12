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
  return generateTaskDates(task.startDate || task.date, task.repeat, task.repeatDays, task.endDate, task.repeatWeekdays).length
}

// 잡무 하나를 맡을 수 있는 사람 목록 — 순서는 의미 없음 (누가 언제 맡을지는
// computeSchedule이 전체 잡무를 같이 보고 그때그때 정함).
// rotation이 없는 옛날 데이터는 assignee 한 명짜리로 취급해 하위 호환
export function taskRotation(task) {
  if (task.rotation && task.rotation.length > 0) return task.rotation
  return task.assignee ? [task.assignee] : []
}

// 랩의 잡무 전체를 한꺼번에 보고 발생일마다 담당자를 정하는 전역 스케줄러.
// 잡무마다 따로 "몇 일마다 고정 순환"을 강제하면(이전 방식) 서로 다른 잡무끼리
// 우연히 같은 날/연속일에 겹치는 걸 위상만으로는 다 못 피함 — 그래서 발생일을
// 시간순으로 하나로 합친 뒤, 그 시점까지 "가장 오래 쉰 사람"에게 배정하는 방식으로
// 바꿈. 특정 잡무가 매번 정확히 같은 사람에게 고정 주기로 가지는 않지만, 장기적으로는
// 누적 배정 수가 똑같이 맞춰지고(공평성 유지) 겹침·연속일은 훨씬 줄어듦
// task.overrides: { "YYYY-MM-DD": "대신 맡을 사람 이름" } — 당번 교체(스왑) 결과.
// 있으면 그 날짜만 자동 배정 대신 지정된 사람으로 확정하고, 이후 공평성 계산에도 반영함
export function computeSchedule(tasks) {
  const events = []
  tasks.forEach(task => {
    const eligible = taskRotation(task)
    if (eligible.length === 0) return
    generateTaskDates(task.startDate || task.date, task.repeat, task.repeatDays, task.endDate, task.repeatWeekdays)
      .forEach(date => events.push({ date, taskId: task.id, eligible, override: task.overrides && task.overrides[date] }))
  })
  events.sort((a, b) => a.date.localeCompare(b.date) || a.taskId.localeCompare(b.taskId))

  const lastAssigned = {}  // 사람 이름 -> 마지막으로 뭔가 맡은 날짜
  const totalCount = {}    // 사람 이름 -> 지금까지 누적 배정 수
  const assignedToday = {} // 날짜 -> 그날 이미 뭔가 맡은 사람들
  const byTask = {}        // taskId -> [{date, assignee, overridden}]
  const byTaskDate = {}    // "taskId|date" -> assignee (빠른 조회용)

  events.forEach(({ date, taskId, eligible, override }) => {
    if (!assignedToday[date]) assignedToday[date] = new Set()
    const chosen = override || [...eligible].sort((a, b) => {
      // 1순위: 오늘 아직 다른 잡무를 안 맡은 사람 (하루 중복 회피)
      const aBusy = assignedToday[date].has(a) ? 1 : 0
      const bBusy = assignedToday[date].has(b) ? 1 : 0
      if (aBusy !== bBusy) return aBusy - bBusy
      // 2순위: 마지막 배정일로부터 더 오래 쉰 사람 (연속일 회피)
      const aGap = lastAssigned[a] != null ? (new Date(date) - new Date(lastAssigned[a])) / 86400000 : Infinity
      const bGap = lastAssigned[b] != null ? (new Date(date) - new Date(lastAssigned[b])) / 86400000 : Infinity
      if (aGap !== bGap) return bGap - aGap
      // 3순위: 누적 배정 수가 더 적은 사람 (공평성)
      return (totalCount[a] || 0) - (totalCount[b] || 0)
    })[0]

    lastAssigned[chosen] = date
    totalCount[chosen] = (totalCount[chosen] || 0) + 1
    assignedToday[date].add(chosen)
    if (!byTask[taskId]) byTask[taskId] = []
    byTask[taskId].push({ date, assignee: chosen, overridden: !!override })
    byTaskDate[`${taskId}|${date}`] = chosen
  })

  return { byTask, byTaskDate, totalCount }
}

// schedule: computeSchedule()의 결과
export function scheduleOccurrences(schedule, taskId) {
  return schedule.byTask[taskId] || []
}
export function scheduleAssigneeOn(schedule, taskId, dateStr) {
  return schedule.byTaskDate[`${taskId}|${dateStr}`]
}
export function scheduleIsOverridden(schedule, taskId, dateStr) {
  return !!scheduleOccurrences(schedule, taskId).find(o => o.date === dateStr)?.overridden
}
export function scheduleMemberWorkload(schedule, memberName) {
  return schedule.totalCount[memberName] || 0
}

// 잡무 전체를 전원이 돌아가며 맡도록 재배정. 한 사람이 잡무 하나를 통째로 맡는
// 1:1 방식은 반복 주기가 서로 다른 잡무 사이에서 부담이 크게 벌어질 수밖에 없어서,
// 잡무마다 현재 구성원 전원을 후보로 묶어 놓으면 computeSchedule이 알아서
// 겹치지 않게, 그리고 고르게 나눠 배정함
export function redistributeTasks(tasks, members) {
  if (tasks.length === 0 || members.length === 0) return []
  const sortedMembers = [...members].sort((a, b) => (a.id || '').localeCompare(b.id || ''))
  const names = sortedMembers.map(m => m.name)
  return tasks.map(t => ({ id: t.id, rotation: names }))
}

// 잡무 반복 주기 → 다음 날짜들 생성 (기본 3개월치, endDate가 그보다 이르면 endDate까지만)
// repeatWeekdays: repeat === 'weekdays'일 때만 씀 — 0(일)~6(토) 요일 번호 배열
export function generateTaskDates(startDate, repeat, repeatDays, endDate, repeatWeekdays) {
  const dates = []
  const start = new Date(startDate)
  const end = new Date(start)
  end.setMonth(end.getMonth() + 3)
  if (endDate) {
    const endD = new Date(endDate)
    if (endD < end) end.setTime(endD.getTime())
  }

  if (repeat === 'weekdays' && repeatWeekdays && repeatWeekdays.length > 0) {
    // 시작일 자체의 요일이 선택한 요일이 아닐 수도 있어서, 시작일 이후 하루씩
    // 훑으며 선택된 요일에만 걸리는 날짜를 모음(예: 시작일이 화요일인데 월·금만
    // 골랐으면 첫 발생일은 그 주의 금요일)
    const days = new Set(repeatWeekdays)
    let cur = new Date(start)
    while (cur <= end) {
      if (days.has(cur.getDay())) dates.push(fmtDate(cur))
      cur.setDate(cur.getDate() + 1)
    }
    return dates
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
