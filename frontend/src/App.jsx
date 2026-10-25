import { useEffect, useState } from 'react'

async function fetchHealth() {
  const response = await fetch('/api/health/')
  if (!response.ok) throw new Error('La API no respondió correctamente')
  return response.json()
}

export default function App() {
  const [health, setHealth] = useState({ state: 'loading', service: '' })

  async function checkApi() {
    setHealth({ state: 'loading', service: '' })
    try {
      const result = await fetchHealth()
      setHealth({ state: 'online', service: result.service })
    } catch {
      setHealth({ state: 'offline', service: '' })
    }
  }

  useEffect(() => {
    checkApi()
  }, [])

  const statusText = {
    loading: 'Comprobando conexión',
    online: 'API conectada',
    offline: 'API no disponible',
  }[health.state]

  return (
    <main className="shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="proyecto-lenguaje, inicio">
          <span className="wordmark-mark">pl</span>
          <span>proyecto-lenguaje</span>
        </a>
        <span className="topbar-label">ENTORNO DE DESARROLLO</span>
      </header>

      <section className="content" aria-labelledby="page-title">
        <p className="eyebrow"><span /> ESPACIO DE TRABAJO</p>
        <h1 id="page-title">Todo listo para<br />empezar.</h1>
        <p className="intro">
          Tu espacio de proyecto ya está en marcha. Revisa la conexión entre la
          interfaz y el servidor para continuar.
        </p>

        <section className={`status-panel status-${health.state}`} aria-live="polite">
          <div className="status-icon" aria-hidden="true">
            {health.state === 'loading' ? '…' : health.state === 'online' ? '✓' : '!' }
          </div>
          <div className="status-copy">
            <p className="status-title">{statusText}</p>
            <p className="status-detail">
              {health.state === 'online'
                ? health.service
                : health.state === 'offline'
                  ? 'Inicia Django en el puerto 8000 y vuelve a comprobar.'
                  : 'Conectando con el backend Django…'}
            </p>
          </div>
          <button className="refresh-button" onClick={checkApi} disabled={health.state === 'loading'}>
            Comprobar
          </button>
        </section>

        <div className="stack-line" aria-label="Tecnologías">
          <span>Django</span><i /> <span>React</span><i /> <span>Vite</span>
        </div>
      </section>

      <footer className="footer">
        <span>proyecto-lenguaje</span>
        <span>BACKEND + FRONTEND</span>
      </footer>
    </main>
  )
}