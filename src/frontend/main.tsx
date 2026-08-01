import React, { useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import AppShell from './AppShell'
import ClientsPage from './ClientsPage'
import ServiceOrdersPage from './ServiceOrdersPage'
import './designSystem.css'

function AppRouter() {
  const [path, setPath] = useState(window.location.pathname)

  const pageContent = useMemo(() => {
    switch (path) {
      case '/clients':
        return <ClientsPage />
      case '/equipment':
        return <div className="sheet" style={{ padding: 24 }}><h3>Equipamentos</h3><p>Gerenciamento de equipamentos em fase de estruturação.</p></div>
      case '/reports':
        return <div className="sheet" style={{ padding: 24 }}><h3>Laudos Técnicos</h3><p>Painel de laudos técnicos em fase de estruturação.</p></div>
      case '/components-photos':
        return <div className="sheet" style={{ padding: 24 }}><h3>Componentes e Fotos</h3><p>Gestão de componentes e fotos dos laudos em fase de estruturação.</p></div>
      case '/settings':
        return <div className="sheet" style={{ padding: 24 }}><h3>Configurações da Assistência</h3><p>Configurações da operação em fase de estruturação.</p></div>
      case '/dashboard':
      default:
        return <ServiceOrdersPage />
    }
  }, [path])

  const pageTitle = (() => {
    switch (path) {
      case '/clients':
        return 'Clientes'
      case '/equipment':
        return 'Equipamentos'
      case '/reports':
        return 'Laudos Técnicos'
      case '/components-photos':
        return 'Componentes e Fotos'
      case '/settings':
        return 'Configurações da Assistência'
      case '/dashboard':
        return 'Dashboard'
      default:
        return 'Ordens de Serviço'
    }
  })()

  const subtitle = (() => {
    switch (path) {
      case '/clients':
        return 'Módulo de clientes'
      case '/equipment':
        return 'Módulo de equipamentos'
      case '/reports':
        return 'Módulo de laudos'
      case '/components-photos':
        return 'Módulo de componentes e fotos'
      case '/settings':
        return 'Preferências da assistência'
      case '/dashboard':
        return 'Visão geral operacional'
      default:
        return 'Fluxo operacional'
    }
  })()

  return (
    <AppShell
      currentPath={path}
      title={pageTitle}
      subtitle={subtitle}
      onNavigate={(nextPath) => {
        window.history.pushState({}, '', nextPath)
        setPath(nextPath)
      }}
    >
      {pageContent}
    </AppShell>
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>
)
