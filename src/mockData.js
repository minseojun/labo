export const MOCK_USER = { id: 'u1', name: '전민서', role: '학부인턴', labId: 'lab1' }
export const MOCK_LAB = { id: 'lab1', name: '나노과학 & 엔지니어링 연구실', code: 'NANO-042', profName: '김인수 교수님' }

export const DAYS = ['일', '월', '화', '수', '목', '금', '토']

export const MEMBERS = [
  { id: 'u1', name: '전민서', role: '학부인턴', count: 3 },
  { id: 'u2', name: '이준호', role: '대학원생', count: 5 },
  { id: 'u3', name: '박지현', role: '대학원생', count: 4 },
  { id: 'u4', name: '김민준', role: '학부인턴', count: 2 },
]

export const initSchedules = [
  { id: 's1', name: '주간 미팅', type: 'lab', date: '2026-05-21', time: '10:00', assignee: '전체', color: '#2D9B6F' },
  { id: 's2', name: 'UV 노광 실험', type: 'mine', date: '2026-05-21', time: '14:00', assignee: '전민서', color: '#8B7ED8' },
  { id: 's3', name: '실험실 청소 당번', type: 'task', date: '2026-05-22', time: '09:00', assignee: '전민서', color: '#F5A623' },
  { id: 's4', name: '세미나 발표', type: 'lab', date: '2026-05-23', time: '15:00', assignee: '전체', color: '#2D9B6F' },
  { id: 's5', name: '장비 점검', type: 'task', date: '2026-05-23', time: '11:00', assignee: '이준호', color: '#F5A623' },
]

export const initEquipment = [
  {
    id: 'e1', name: '전자현미경 SEM', code: 'SEM-001', status: 'available', lastUser: '박지현', icon: '🔬',
    logs: [
      { user: '박지현', action: '사용 종료', time: '2026-05-21 13:22', memo: 'Si 웨이퍼 표면 측정' },
      { user: '이준호', action: '사용 시작', time: '2026-05-20 10:15', memo: '' },
    ]
  },
  {
    id: 'e2', name: '스핀코터', code: 'SPN-002', status: 'in-use', lastUser: '전민서', icon: '⚙️',
    logs: [{ user: '전민서', action: '사용 시작', time: '2026-05-21 14:30', memo: 'PR 코팅 1500rpm' }]
  },
  {
    id: 'e3', name: 'UV 노광기', code: 'UVE-003', status: 'maintenance', lastUser: '이준호', icon: '💡',
    logs: [{ user: '이준호', action: '점검 시작', time: '2026-05-20 09:00', memo: '램프 교체 필요' }]
  },
  { id: 'e4', name: 'RIE 식각기', code: 'RIE-004', status: 'available', lastUser: '김민준', icon: '🔧', logs: [] },
]

export const initSupplies = [
  { id: 'p1', name: '포토레지스트 PR-100', spec: '500ml', status: 'green', history: [{ user: '전민서', from: 'yellow', to: 'green', time: '2026-05-20 15:00' }] },
  { id: 'p2', name: '아세톤', spec: '1L', status: 'yellow', history: [{ user: '이준호', from: 'green', to: 'yellow', time: '2026-05-21 09:30' }] },
  { id: 'p3', name: 'IPA (이소프로판올)', spec: '1L', status: 'red', history: [{ user: '박지현', from: 'yellow', to: 'red', time: '2026-05-21 11:00' }] },
  { id: 'p4', name: 'N2 가스', spec: '고압 실린더', status: 'green', history: [] },
  { id: 'p5', name: '알루미늄 타겟', spec: '99.99% 순도', status: 'yellow', history: [] },
  { id: 'p6', name: '실리콘 웨이퍼 4"', spec: 'P형 100', status: 'red', history: [] },
]

export const initNotices = [
  { id: 'n1', author: '김인수 교수님', body: '이번 주 금요일 14시에 논문 진행상황 발표가 있습니다. 모든 팀원 참석 필수.', pinned: true, time: '2026-05-20' },
  { id: 'n2', author: '박지현', body: 'SEM 사용 시 반드시 예약하고 사용해주세요. 이번 주 화요일 오전 제가 사용 예정입니다.', pinned: false, time: '2026-05-19' },
]

export const initTodos = [
  { id: 1, text: 'SEM 예약 확인', done: false },
  { id: 2, text: '실험노트 작성', done: true },
  { id: 3, text: '주간 보고서 제출', done: false },
]
