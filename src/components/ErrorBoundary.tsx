import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  stack: string
}

/**
 * A crash anywhere in the tree used to blank the page to pure black, which is the
 * worst possible failure mode for a dark WebGL app. Show the reason instead, using
 * inline styles so it still renders if the stylesheet never loaded.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, stack: '' }

  static getDerivedStateFromError(error: Error): State {
    return { error, stack: '' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Pipeline Flux crashed during mount:', error)
    this.setState({ stack: info.componentStack ?? '' })
  }

  render() {
    const { error, stack } = this.state
    if (!error) return this.props.children

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          overflow: 'auto',
          padding: '2rem',
          background: '#08090b',
          color: '#ebe8e2',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 12,
          lineHeight: 1.7,
        }}
      >
        <p style={{ color: '#f5a524', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          Pipeline Flux failed to start
        </p>
        <pre style={{ whiteSpace: 'pre-wrap', color: '#ebe8e2' }}>
          {error.name}: {error.message}
        </pre>
        {error.stack && (
          <pre style={{ whiteSpace: 'pre-wrap', color: '#6b6b78', marginTop: '1rem' }}>{error.stack}</pre>
        )}
        {stack && <pre style={{ whiteSpace: 'pre-wrap', color: '#6b6b78', marginTop: '1rem' }}>{stack}</pre>}
      </div>
    )
  }
}
