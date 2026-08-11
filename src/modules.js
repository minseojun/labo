// 도메인 모듈 레지스트리 — 랩마다 필요한 기능만 켜고 끄는 "블록형 OS"의 기반.
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
