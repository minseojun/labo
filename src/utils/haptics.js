import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { Capacitor } from '@capacitor/core'

// 웹에서는 그냥 조용히 무시됨 — 네이티브 앱(iOS/Android)에서만 실제 진동을 줌
const isNative = Capacitor.isNativePlatform()

export const haptic = {
  light: () => { if (isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {}) },
  medium: () => { if (isNative) Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {}) },
  selection: () => { if (isNative) Haptics.selectionChanged().catch(() => {}) },
}
