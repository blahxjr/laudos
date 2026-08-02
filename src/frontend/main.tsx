import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import AppShell from './AppShell.js'
import ClientsPage from './ClientsPage.js'
import ServiceOrdersPage from './ServiceOrdersPage.js'
import CatalogPage from './CatalogPage.js'
import InvoicesPage from './InvoicesPage.js'
import TechnicalReportDocument from './TechnicalReportDocument.js'
import DashboardPage from './DashboardPage.js'
import SettingsPage from './SettingsPage.js'
import ConversationsInboxPage from './pages/ConversationsInboxPage.js'
import './designSystem.css'

function AppRouter() {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const reportDocumentId = path.startsWith('/reports/') && path.endsWith('/document')
    ? path.split('/')[2]
    : null

  const serviceOrderRouteOrderId = path.startsWith('/service-orders/')
    ? path.split('/')[2] || null
    : null

  const pageContent = useMemo(() => {
    if (reportDocumentId) {
      return <TechnicalReportDocument reportId={reportDocumentId} />
    }

    switch (path) {
      case '/clients':
        return <ClientsPage />
      case '/equipment':
        return <div className="sheet" style={{ padding: 24 }}><h3>Equipamentos</h3><p>Gerenciamento de equipamentos em fase de estruturação.</p></div>
      case '/service-orders':
        return <ServiceOrdersPage />
      case '/communications':
      case '/inbox':
        return <ConversationsInboxPage />
      case '/services':
        return <CatalogPage
          title="Serviços"
          subtitle="Catálogo de serviços"
          apiList="/services/catalog"
          apiCreate="/services/catalog"
          apiUpdate="/services/catalog/:id"
          apiDelete="/services/catalog/:id"
          typeLabel="Serviço"
        />
      case '/parts':
        return <CatalogPage
          title="Peças / Materiais"
          subtitle="Catálogo de peças e materiais"
          apiList="/parts/catalog"
          apiCreate="/parts/catalog"
          apiUpdate="/parts/catalog/:id"
          apiDelete="/parts/catalog/:id"
          typeLabel="Peça"
        />
      case '/invoices':
        return <InvoicesPage />
      case '/reports':
        return <div className="sheet" style={{ padding: 24 }}><h3>Laudos Técnicos</h3><p>Painel de laudos técnicos em fase de estruturação.</p></div>
      case '/components-photos':
        return <div className="sheet" style={{ padding: 24 }}><h3>Componentes e Fotos</h3><p>Gestão de componentes e fotos dos laudos em fase de estruturação.</p></div>
      case '/settings':
        return <SettingsPage />
      case '/dashboard':
        return <DashboardPage />
      default:
        if (serviceOrderRouteOrderId) {
          return <ServiceOrdersPage initialOrderId={serviceOrderRouteOrderId} />
        }
        return <DashboardPage />
    }
  }, [path, serviceOrderRouteOrderId])

  const pageTitle = (() => {
    switch (path) {
      case '/clients':
        return 'Clientes'
      case '/equipment':
        return 'Equipamentos'
      case '/service-orders':
        return 'Ordens de Serviço'
      case '/communications':
      case '/inbox':
        return 'Inbox WhatsApp'
      case '/services':
        return 'Serviços'
      case '/parts':
        return 'Peças / Materiais'
      case '/invoices':
        return 'Cobranças'
      case '/reports':
        return 'Laudos Técnicos'
      case '/components-photos':
        return 'Componentes e Fotos'
      case '/settings':
        return 'Configurações da Assistência'
      case '/dashboard':
        return 'Dashboard'
      default:
        if (reportDocumentId) return 'Laudo técnico completo'
        if (serviceOrderRouteOrderId) return 'Ordens de Serviço'
        return 'Ordens de Serviço'
    }
  })()

  const subtitle = (() => {
    switch (path) {
      case '/clients':
        return 'Módulo de clientes'
      case '/equipment':
        return 'Módulo de equipamentos'
      case '/service-orders':
        return 'Fluxo operacional'
      case '/communications':
      case '/inbox':
        return 'Atendimento de conversas'
      case '/services':
        return 'Catálogo de serviços'
      case '/parts':
        return 'Catálogo de peças e materiais'
      case '/invoices':
        return 'Faturamento e invoices'
      case '/reports':
        return 'Módulo de laudos'
      case '/components-photos':
        return 'Módulo de componentes e fotos'
      case '/settings':
        return 'Preferências da assistência'
      case '/dashboard':
        return 'Visão geral operacional'
      default:
        if (reportDocumentId) return 'Documento visualizável para impressão'
        if (serviceOrderRouteOrderId) return 'Fluxo operacional'
        return 'Fluxo operacional'
    }
  })()

  return (
    <AppShell
      currentPath={path}
      title={pageTitle}
      subtitle={subtitle}
      onNavigate={(nextPath: string) => {
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
