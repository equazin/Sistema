import { registerProductosHandlers } from './productos'
import { registerCategoriasHandlers } from './categorias'
import { registerUsuariosHandlers } from './usuarios'
import { registerUsuariosAdminHandlers } from './usuarios_admin'
import { registerNegocioHandlers } from './negocio'
import { registerCajaHandlers } from './caja'
import { registerVentasHandlers } from './ventas'
import { registerStockHandlers } from './stock'
import { registerClientesHandlers } from './clientes'
import { registerProveedoresHandlers } from './proveedores'
import { registerReportesHandlers } from './reportes'
import { registerImpresionHandlers } from './impresion'

export function registerAllHandlers(): void {
  registerProductosHandlers()
  registerCategoriasHandlers()
  registerUsuariosHandlers()
  registerUsuariosAdminHandlers()
  registerNegocioHandlers()
  registerCajaHandlers()
  registerVentasHandlers()
  registerStockHandlers()
  registerClientesHandlers()
  registerProveedoresHandlers()
  registerReportesHandlers()
  registerImpresionHandlers()
}
