import React from 'react'
import { Icon } from './Icon'

// 화면 하나가 렌더링 중 에러를 던지면 앱 전체가 하얗게 날아가는 걸 막는 안전망.
// activeTab이 바뀔 때마다 App.jsx에서 key를 새로 줘서 다음 탭으로 이동하면 저절로 복구됨
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('화면 렌더링 중 오류:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ textAlign: 'center', padding: '64px 24px', color: 'var(--text2)' }}>
          <Icon.AlertTriangle size={32} strokeWidth={1.5} style={{ marginBottom: 12, opacity: .6 }} />
          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>이 화면을 불러오지 못했어요</div>
          <div style={{ fontSize: 12, marginBottom: 16 }}>잠시 후 다시 시도하거나 다른 탭으로 이동해보세요</div>
          <button onClick={() => this.setState({ error: null })}
            style={{ padding: '9px 18px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            다시 시도
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
