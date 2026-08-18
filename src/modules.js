import { Icon } from './components/Icon'
import HazardLogScreen from './components/HazardLogScreen'
import GpuReservationScreen from './components/GpuReservationScreen'
import DatasetScreen from './components/DatasetScreen'
import OnboardingChecklistScreen from './components/OnboardingChecklistScreen'

// 기본 탭(홈 제외) — 각자 자기 탭바에서 개인적으로 끄고 켤 수 있음 (Sidebar의 "모듈 관리" 참고)
export const CORE_TABS = [
  { id: 'schedule',  icon: Icon.Calendar, label: '일정', description: '캘린더, 공지, 잡무 자동 배정' },
  { id: 'equipment', icon: Icon.Flask,    label: '장비', description: '장비 사용 현황·이력, QR 스캔' },
  { id: 'timer',     icon: Icon.Timer,    label: '타이머', description: '실험 타이머' },
  { id: 'supplies',  icon: Icon.Package,  label: '소모품', description: '시약·소모품 재고 신호등' },
]

// 도메인 모듈 레지스트리 — 필요한 기능만 골라 쓰는 "블록형 OS"의 확장 부분.
// 모든 모듈은 항상 존재하고, 각자 자기 탭바에 보일지만 개인적으로 고름(Sidebar "모듈 관리").
// 새 모듈을 추가할 땐 여기 항목 하나만 등록하면 사이드바 토글과 탭바에 자동으로 나타남.
export const MODULES = [
  {
    key: 'wet_lab_hazard_log',
    domain: 'Wet Lab',
    icon: Icon.AlertTriangle,
    label: '위험물',
    description: '시약 유출·노출·화상 등 실험실 안전 사고를 기록하고 조회해요.',
    Screen: HazardLogScreen,
  },
  {
    key: 'dry_lab_gpu_reservation',
    domain: 'Dry Lab',
    icon: Icon.Server,
    label: 'GPU 예약',
    description: 'GPU 서버별 예약 캘린더와 사용중 알림을 확인해요.',
    Screen: GpuReservationScreen,
  },
  {
    key: 'dry_lab_datasets',
    domain: 'Dry Lab',
    icon: Icon.Database,
    label: '데이터셋',
    description: '공유 데이터셋의 경로·버전을 등록하고 조회해요.',
    Screen: DatasetScreen,
  },
  {
    key: 'lab_ops_onboarding',
    domain: 'Lab Ops',
    icon: Icon.ClipboardCheck,
    label: '온보딩',
    description: '신입 구성원용 안전교육·장비 이수 체크리스트를 관리해요.',
    Screen: OnboardingChecklistScreen,
  },
]
