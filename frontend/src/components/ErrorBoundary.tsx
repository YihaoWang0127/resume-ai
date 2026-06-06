import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import ServerError from '@/pages/ServerError'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return <ServerError />
    }
    return this.props.children
  }
}
