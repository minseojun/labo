import React from 'react'

// 이모지 대신 쓰는 미니멀 라인 아이콘 세트 — 24x24, stroke 기반, 색은 currentColor를 따름
function Base({ size = 22, strokeWidth = 1.8, children, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {children}
    </svg>
  )
}

export const Icon = {
  Home: (p) => <Base {...p}><path d="M4 11.5 12 4l8 7.5" /><path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" /><path d="M10 20v-6h4v6" /></Base>,
  Calendar: (p) => <Base {...p}><rect x="3.5" y="5" width="17" height="16" rx="3" /><path d="M8 3v4M16 3v4M3.5 10h17" /></Base>,
  Flask: (p) => <Base {...p}><path d="M9 3h6M10 3v6l-5.2 9a1.7 1.7 0 0 0 1.5 2.5h11.4a1.7 1.7 0 0 0 1.5-2.5L14 9V3" /><path d="M7.5 15h9" /></Base>,
  Timer: (p) => <Base {...p}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2M9.5 2h5" /></Base>,
  Package: (p) => <Base {...p}><path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16z" /><path d="M3.5 8 12 12.5 20.5 8M12 12.5V20.5" /></Base>,
  AlertTriangle: (p) => <Base {...p}><path d="M11.06 3.7a1.1 1.1 0 0 1 1.88 0l8.32 14.2A1.1 1.1 0 0 1 20.32 19.6H3.68a1.1 1.1 0 0 1-.94-1.7z" /><path d="M12 9.5v4M12 16.7h.01" /></Base>,
  ChevronDown: (p) => <Base {...p}><path d="M6 9.5 12 15l6-5.5" /></Base>,
  ChevronRight: (p) => <Base {...p}><path d="M9 5.5 15.5 12 9 18.5" /></Base>,
  X: (p) => <Base {...p}><path d="M6 6l12 12M18 6 6 18" /></Base>,
  Bell: (p) => <Base {...p}><path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10Z" /><path d="M10 18.5a2 2 0 0 0 4 0" /></Base>,
  HelpCircle: (p) => <Base {...p}><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.4a2.4 2.4 0 1 1 3.4 2.2c-.9.5-1 1-1 1.9" /><path d="M12 16.7h.01" /></Base>,
  Info: (p) => <Base {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.2M12 7.6h.01" /></Base>,
  Pencil: (p) => <Base {...p}><path d="M4 20h4L18.5 9.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 15.5Z" /><path d="M13 6.5 17.5 11" /></Base>,
  Plus: (p) => <Base {...p}><path d="M12 5v14M5 12h14" /></Base>,
  Users: (p) => <Base {...p}><circle cx="9" cy="8.5" r="3.2" /><path d="M3 19.5c0-3 2.7-5.2 6-5.2s6 2.2 6 5.2" /><path d="M16 5.4a3.2 3.2 0 0 1 0 6.2M21 19.5c0-2.6-2-4.6-4.5-5.1" /></Base>,
  LogOut: (p) => <Base {...p}><path d="M9 20H5.5a1.5 1.5 0 0 1-1.5-1.5v-13A1.5 1.5 0 0 1 5.5 4H9" /><path d="M16 16.5 20.5 12 16 7.5M20.5 12H9" /></Base>,
  Menu: (p) => <Base {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Base>,
  Sparkle: (p) => <Base {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></Base>,
  Refresh: (p) => <Base {...p}><path d="M4.5 12a7.5 7.5 0 0 1 12.6-5.4M19.5 12a7.5 7.5 0 0 1-12.6 5.4" /><path d="M17.5 3.5v3.6h-3.6M6.5 20.5v-3.6h3.6" /></Base>,
  Key: (p) => <Base {...p}><circle cx="8" cy="15" r="4" /><path d="M11 12 19 4M16 4h4v4M13.5 9.5l2.5 2.5" /></Base>,
  Building: (p) => <Base {...p}><rect x="5" y="3.5" width="14" height="17" rx="1.5" /><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" /></Base>,
  Server: (p) => <Base {...p}><rect x="4" y="4" width="16" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="16" height="6.5" rx="1.5" /><path d="M7.5 7.2h.01M7.5 16.7h.01" /></Base>,
  Database: (p) => <Base {...p}><path d="M4.5 6c0-1.4 3.4-2.5 7.5-2.5s7.5 1.1 7.5 2.5-3.4 2.5-7.5 2.5-7.5-1.1-7.5-2.5Z" /><path d="M4.5 6v12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5V6" /><path d="M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5" /></Base>,
  Snowflake: (p) => <Base {...p}><path d="M12 2.5v19M4.5 7.2l15 9.6M4.5 16.8l15-9.6" /><path d="M8 4.7 12 7l4-2.3M8 19.3 12 17l4 2.3M4.8 9.8 7.3 12l-2.5 2.2M19.2 9.8 16.7 12l2.5 2.2" /></Base>,
  ClipboardCheck: (p) => <Base {...p}><rect x="5.5" y="4.5" width="13" height="17" rx="2.2" /><path d="M9 4.5v-.7A1.3 1.3 0 0 1 10.3 2.5h3.4A1.3 1.3 0 0 1 15 3.8v.7" /><path d="M9 13.3 11 15.3 15.2 10.7" /></Base>,
  Search: (p) => <Base {...p}><circle cx="10.5" cy="10.5" r="6.5" /><path d="M19.5 19.5 15 15" /></Base>,
  Grid: (p) => <Base {...p}><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.8" /><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.8" /><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.8" /><rect x="13" y="13" width="7.5" height="7.5" rx="1.8" /></Base>,
}
