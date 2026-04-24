import { useAuthStore } from './stores/auth.store'
import { LoginPage } from './pages/LoginPage'
import { MainLayout } from './pages/MainLayout'

export function App(): JSX.Element {
  const usuario = useAuthStore((s) => s.usuario)
  return usuario ? <MainLayout /> : <LoginPage />
}
