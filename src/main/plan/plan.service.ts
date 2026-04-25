import { getSqlite } from '../db/database'
import { PLAN_MODULOS, moduloHabilitadoPorPlan, type ModuloKey, type PlanTipo } from '../../shared/modules'

interface PlanConfig {
  plan: PlanTipo
  overrides: Partial<Record<ModuloKey, boolean>>
}

function getPlanConfig(): PlanConfig {
  try {
    const db = getSqlite()
    const negocio = db.prepare('SELECT id FROM negocios LIMIT 1').get() as { id: number } | undefined
    if (!negocio) return { plan: 'free', overrides: {} }
    const row = db.prepare(
      "SELECT valor FROM configuracion WHERE negocio_id = ? AND clave = 'plan_config'"
    ).get(negocio.id) as { valor: string } | undefined
    if (!row) return { plan: 'free', overrides: {} }
    return JSON.parse(row.valor) as PlanConfig
  } catch {
    return { plan: 'free', overrides: {} }
  }
}

export function isModuloEnabled(key: ModuloKey): boolean {
  const config = getPlanConfig()
  if (Object.prototype.hasOwnProperty.call(config.overrides, key)) {
    return config.overrides[key] === true
  }
  return moduloHabilitadoPorPlan(config.plan, key)
}

export function getPlan(): PlanTipo {
  return getPlanConfig().plan
}

export function setPlanConfig(config: PlanConfig): void {
  const db = getSqlite()
  const negocio = db.prepare('SELECT id FROM negocios LIMIT 1').get() as { id: number }
  db.prepare(`
    INSERT INTO configuracion (negocio_id, clave, valor) VALUES (?, 'plan_config', ?)
    ON CONFLICT(negocio_id, clave) DO UPDATE SET valor = excluded.valor
  `).run(negocio.id, JSON.stringify(config))
}

export function getModulosEstado(): Record<ModuloKey, boolean> {
  const config = getPlanConfig()
  const keys = Object.keys(PLAN_MODULOS.enterprise) as ModuloKey[]
  const all = Object.keys({ api_local: 1, mobile_app: 1, multisucursal: 1, cloud_backup: 1, reportes_avanzados: 1, mp_qr: 1, promociones: 1 }) as ModuloKey[]
  return Object.fromEntries(
    all.map(k => [k, Object.prototype.hasOwnProperty.call(config.overrides, k) ? config.overrides[k] === true : moduloHabilitadoPorPlan(config.plan, k)])
  ) as Record<ModuloKey, boolean>
}
