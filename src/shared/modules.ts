export const MODULOS = {
  api_local: { label: 'API Local', descripcion: 'Servidor REST para integración con dispositivos y app mobile', plan: 'free' },
  mobile_app: { label: 'App Mobile', descripcion: 'Dashboard y consultas desde el celular', plan: 'free' },
  multisucursal: { label: 'Multisucursal', descripcion: 'Sincronización y reportes consolidados entre sucursales', plan: 'pro' },
  cloud_backup: { label: 'Backup en la nube', descripcion: 'Respaldo automático en Google Drive', plan: 'pro' },
  reportes_avanzados: { label: 'Reportes avanzados', descripcion: 'Gráficos, filtros y exportación extendida', plan: 'free' },
  mp_qr: { label: 'MercadoPago QR', descripcion: 'Cobros con QR dinámico', plan: 'free' },
  promociones: { label: 'Promociones', descripcion: 'Descuentos, 2x1, 3x2 y monto fijo', plan: 'free' },
} as const

export type ModuloKey = keyof typeof MODULOS
export type PlanTipo = 'free' | 'pro' | 'enterprise'

export const PLAN_MODULOS: Record<PlanTipo, ModuloKey[]> = {
  free: ['api_local', 'mobile_app', 'reportes_avanzados', 'mp_qr', 'promociones'],
  pro: ['api_local', 'mobile_app', 'multisucursal', 'cloud_backup', 'reportes_avanzados', 'mp_qr', 'promociones'],
  enterprise: Object.keys(MODULOS) as ModuloKey[],
}

export function moduloHabilitadoPorPlan(plan: PlanTipo, key: ModuloKey): boolean {
  return PLAN_MODULOS[plan].includes(key)
}
