import React, { useState } from 'react'

type NavItem = {
  path: string
  label: string
  description: string
}

type AppShellProps = {
  currentPath: string
  title: string
  subtitle?: string
  actions?: React.ReactNode
  onNavigate: (path: string) => void
  children: React.ReactNode
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', description: 'Visão geral' },
  { path: '/clients', label: 'Clientes', description: 'Cadastro e histórico' },
  { path: '/equipment', label: 'Equipamentos', description: 'Dados técnicos' },
  { path: '/service-orders', label: 'Ordens de Serviço', description: 'Fila e laudos' },
  { path: '/reports', label: 'Laudos Técnicos', description: 'Relatórios e pareceres' },
  { path: '/components-photos', label: 'Componentes e Fotos', description: 'Itens e imagens' },
  { path: '/settings', label: 'Configurações', description: 'Assistência' },
]

export default function AppShell({ currentPath, title, subtitle, actions, onNavigate, children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const handleNavigate = (path: string) => {
    setIsSidebarOpen(false)
    onNavigate(path)
  }

  return (
    <div className="app-shell">
      <button type="button" className="mobile-nav-toggle" aria-label="Abrir menu" onClick={() => setIsSidebarOpen(true)}>
        ☰
      </button>
      <div className={`app-sidebar-overlay ${isSidebarOpen ? 'open' : ''}`} onClick={() => setIsSidebarOpen(false)} />
      <aside className={`app-sidebar app-shell-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-card">
          <button type="button" className="mobile-nav-close" aria-label="Fechar menu" onClick={() => setIsSidebarOpen(false)}>
            ✕
          </button>
          <p className="eyebrow">Assist Tech</p>
          <h2 style={{ marginBottom: 8 }}>Laudos</h2>
          <p style={{ marginBottom: 16 }}>Painel administrativo para gestão técnica.</p>

          <nav className="side-nav" aria-label="Menu principal">
            {navItems.map((item) => {
              const active = currentPath === item.path
              return (
                <a
                  key={item.path}
                  href={item.path}
                  className={`side-nav-link ${active ? 'active' : ''}`}
                  onClick={(event) => {
                    event.preventDefault()
                    handleNavigate(item.path)
                  }}
                >
                  <span className="side-nav-label">{item.label}</span>
                  <span className="side-nav-description">{item.description}</span>
                </a>
              )
            })}
          </nav>
        </div>
      </aside>

      <main className="app-main">
        <header className="page-header">
          <div>
            <p className="eyebrow">{subtitle || 'Assistência técnica'}</p>
            <h1>{title}</h1>
          </div>
          {actions ? <div className="page-actions">{actions}</div> : null}
        </header>

        <div className="page-content">{children}</div>
      </main>
    </div>
  )
}
