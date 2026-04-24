import { registerProductosHandlers } from './productos'
import { registerCategoriasHandlers } from './categorias'
import { registerUsuariosHandlers } from './usuarios'
import { registerNegocioHandlers } from './negocio'
import { registerCajaHandlers } from './caja'
import { registerVentasHandlers } from './ventas'
import { registerStockHandlers } from './stock'

export function registerAllHandlers(): void {
  registerProductosHandlers()
  registerCategoriasHandlers()
  registerUsuariosHandlers()
  registerNegocioHandlers()
  registerCajaHandlers()
  registerVentasHandlers()
  registerStockHandlers()
}
