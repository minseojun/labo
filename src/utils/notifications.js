import { LocalNotifications } from '@capacitor/local-notifications'
import { Capacitor } from '@capacitor/core'

const isNative = Capacitor.isNativePlatform()

// Local Notifications는 32비트 정수 id만 받아서, "timer-abc123" 같은 문자열 키를
// 안정적인 정수로 변환해 씀 — 같은 키는 항상 같은 id가 나와서 취소할 때도 그대로 계산하면 됨
function idFrom(key) {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
  return Math.abs(hash) % 2147483647
}

let webPermissionAsked = false

export const notifications = {
  isNative,

  // 실험실에서 앱을 백그라운드로 보내거나 아예 꺼둔 상태에서도 정확한 시각에
  // 알림이 오게 하려면 네이티브 앱에서는 반드시 이 권한이 있어야 함.
  // 웹은 즉시 발송(Notification API)만 가능해서 예약은 못 하지만, 앱이 열려있는
  // 동안엔 여전히 알림을 띄울 수 있어서 별도로 권한을 물어봄
  async ensurePermission() {
    if (isNative) {
      const status = await LocalNotifications.checkPermissions()
      if (status.display === 'granted') return true
      const req = await LocalNotifications.requestPermissions()
      return req.display === 'granted'
    }
    if (typeof Notification === 'undefined') return false
    if (Notification.permission === 'granted') return true
    if (Notification.permission === 'denied') return false
    webPermissionAsked = true
    const r = await Notification.requestPermission()
    return r === 'granted'
  },

  async permissionState() {
    if (isNative) {
      const status = await LocalNotifications.checkPermissions()
      return status.display // 'granted' | 'denied' | 'prompt'
    }
    if (typeof Notification === 'undefined') return 'unsupported'
    return Notification.permission
  },

  // key: 나중에 취소할 때도 똑같이 쓸 안정적인 문자열(예: `timer-${timer.id}`)
  // at: 발송할 시각(Date) — 과거 시각이면 아무것도 하지 않음
  async scheduleAt(key, title, body, at) {
    if (!isNative) return // 웹은 백그라운드 예약 발송을 지원하지 않음
    if (!(at instanceof Date) || at.getTime() <= Date.now()) return
    try {
      const status = await LocalNotifications.checkPermissions()
      if (status.display !== 'granted') return
      await LocalNotifications.schedule({
        notifications: [{ id: idFrom(key), title, body, schedule: { at }, sound: undefined }],
      })
    } catch (e) { console.error(e) }
  },

  async cancel(key) {
    if (!isNative) return
    try { await LocalNotifications.cancel({ notifications: [{ id: idFrom(key) }] }) } catch (e) { console.error(e) }
  },

  // 앱이 열려 있는 동안 즉시 알려주고 싶을 때(타이머가 포그라운드에서 끝난 경우 등)
  async showNow(title, body) {
    if (isNative) {
      try {
        const status = await LocalNotifications.checkPermissions()
        if (status.display !== 'granted') return
        await LocalNotifications.schedule({
          notifications: [{ id: idFrom(`now-${Date.now()}-${Math.random()}`), title, body, schedule: { at: new Date(Date.now() + 300) } }],
        })
      } catch (e) { console.error(e) }
      return
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body })
    }
  },
}
