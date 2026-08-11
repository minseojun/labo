// 기본 탭(홈 제외) — 랩마다 끄고 켤 수 있음. labs.disabled_tabs에 id가 들어가면 꺼짐(기본은 전부 켜짐)
export const CORE_TABS = [
  { id: 'schedule',  icon: '📅', label: '일정', description: '캘린더, 공지, 잡무 자동 배정' },
  { id: 'equipment', icon: '🔬', label: '장비', description: '장비 사용 현황·이력, QR 스캔' },
  { id: 'timer',     icon: '⏱', label: '타이머', description: '실험 타이머' },
  { id: 'supplies',  icon: '📦', label: '소모품', description: '시약·소모품 재고 신호등' },
]

// 도메인 모듈 레지스트리 — 랩마다 필요한 기능만 선택해서 켜는 "블록형 OS"의 확장 부분.
// 새 모듈을 추가할 땐 여기 항목 하나만 등록하면 사이드바 "모듈 관리" 토글에 자동으로 나타남.
export const MODULES = [
  {
    key: 'wet_lab_hazard_log',
    domain: 'Wet Lab',
    icon: '⚠️',
    label: '위험물 이력',
    description: '시약 유출·노출·화상 등 실험실 안전 사고를 기록하고 조회해요.',
  },
]

export function isModuleEnabled(labInfo, key) {
  return !!labInfo?.enabledModules?.includes(key)
}
