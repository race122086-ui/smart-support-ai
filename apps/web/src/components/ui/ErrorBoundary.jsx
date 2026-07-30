import { Component } from 'react'

export class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <main className="connection-state connection-state--error" role="alert">
          <h1>SmartSupport no pudo mostrar esta pantalla</h1>
          <p>{this.state.error.message}</p>
          <button className="btn btn--primary" type="button" onClick={() => window.location.reload()}>
            Recargar aplicación
          </button>
        </main>
      )
    }
    return this.props.children
  }
}
