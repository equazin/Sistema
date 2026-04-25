import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../stores/auth.store'
import { PuntoVentaPage } from './PuntoVentaPage'
import { ProductosPage } from './ProductosPage'
import { StockPage } from './StockPage'
import { CajaPage } from './CajaPage'
import { ConfigPage } from './ConfigPage'
import { ReportesPage } from './ReportesPage'
import { ClientesPage } from './ClientesPage'
import { ProveedoresPage } from './ProveedoresPage'
import { UsuariosPage } from './UsuariosPage'
import { PromocionesPage } from './PromocionesPage'
import { PreciosMasivoPage } from './PreciosMasivoPage'

type Section = 'pos' | 'productos' | 'stock' | 'caja' | 'config' | 'reportes' | 'clientes' | 'proveedores' | 'usuarios' | 'promociones' | 'precios'

const NAV_ITEMS: { key: Section; label: string; icon: string; shortcut: string; fkey: string; adminOnly?: boolean }[] = [
  { key: 'pos',         label: 'Punto de Venta', icon: '🛒', shortcut: 'F1',  fkey: 'F1'  },
  { key: 'productos',   label: 'Productos',       icon: '📦', shortcut: 'F2',  fkey: 'F2'  },
  { key: 'stock',       label: 'Stock',           icon: '📊', shortcut: 'F3',  fkey: 'F3'  },
  { key: 'caja',        label: 'Caja',            icon: '💰', shortcut: 'F4',  fkey: 'F4'  },
  { key: 'clientes',    label: 'Clientes',        icon: '👥', shortcut: 'F5',  fkey: 'F5'  },
  { key: 'proveedores', label: 'Proveedores',     icon: '🏭', shortcut: 'F6',  fkey: 'F6'  },
  { key: 'reportes',    label: 'Reportes',        icon: '📈', shortcut: 'F7',  fkey: 'F7'  },
  { key: 'usuarios',    label: 'Usuarios',        icon: '👤', shortcut: 'F8',  fkey: 'F8',  adminOnly: true },
  { key: 'promociones', label: 'Promociones',     icon: '🏷️', shortcut: 'F9',  fkey: 'F9'  },
  { key: 'precios',     label: 'Precios masivos', icon: '💲', shortcut: '',    fkey: '',    adminOnly: true },
  { key: 'config',      label: 'Configuración',   icon: '⚙️', shortcut: 'F10', fkey: 'F10' },
]

export function MainLayout(): JSX.Element {
  const [section, setSection] = useState<Section>('pos')
  const { usuario, logout } = useAuthStore()

  const handleKey = useCallback((e: KeyboardEvent) => {
    const item = NAV_ITEMS.find((n) => n.fkey === e.key)
    if (item) { e.preventDefault(); setSection(item.key) }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  const visibleItems = NAV_ITEMS.filter(item => !item.adminOnly || usuario?.rol === 'admin')

  return (
    <div className="flex h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className="w-52 bg-slate-900 flex flex-col flex-shrink-0">
        <div className="px-4 py-5 border-b border-slate-700">
          <p className="text-white font-bold text-sm">Sistema POS</p>
          <p className="text-slate-400 text-xs mt-1">{usuario?.nombre}</p>
          <span className="inline-block mt-1 text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded capitalize">
            {usuario?.rol}
          </span>
        </div>

        <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
          {visibleItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setSection(item.key)}
              className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2 text-sm transition-colors ${
                section === item.key
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              <span className="text-xs opacity-40">{item.shortcut}</span>
            </button>
          ))}
        </nav>

        <button
          onClick={logout}
          className="mx-2 mb-4 px-3 py-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg text-sm text-left"
        >
          🚪 Cerrar sesión
        </button>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto p-6">
        {section === 'pos'         && <PuntoVentaPage />}
        {section === 'productos'   && <ProductosPage />}
        {section === 'stock'       && <StockPage />}
        {section === 'caja'        && <CajaPage />}
        {section === 'clientes'    && <ClientesPage />}
        {section === 'proveedores' && <ProveedoresPage />}
        {section === 'reportes'    && <ReportesPage />}
        {section === 'usuarios'    && <UsuariosPage />}
        {section === 'promociones' && <PromocionesPage />}
        {section === 'precios'     && <PreciosMasivoPage />}
        {section === 'config'      && <ConfigPage />}
      </main>
    </div>
  )
}
