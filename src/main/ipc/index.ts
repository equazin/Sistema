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
import { registerMercadoPagoHandlers } from './mercadopago'
import { registerPromocionesHandlers } from './promociones'
import { registerPreciosHandlers } from './precios'
import { registerBackupHandlers } from './backup'
import { registerAuditoriaHandlers } from './auditoria'
import { registerPlanHandlers } from './plan'
import { registerApiConfigHandlers } from './api_config'
import { registerGDriveHandlers } from './gdrive'
import { registerSucursalesHandlers } from './sucursales'
import { registerTransferenciasHandlers } from './transferencias'
import { registerSyncHandlers } from './sync'

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
  registerMercadoPagoHandlers()
  registerPromocionesHandlers()
  registerPreciosHandlers()
  registerBackupHandlers()
  registerAuditoriaHandlers()
  registerPlanHandlers()
  registerApiConfigHandlers()
  registerGDriveHandlers()
  registerSucursalesHandlers()
  registerTransferenciasHandlers()
  registerSyncHandlers()
}
