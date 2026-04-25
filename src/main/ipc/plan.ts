import { handle } from './base'
import { getPlan, setPlanConfig, getModulosEstado, isModuloEnabled } from '../plan/plan.service'
import type { ModuloKey, PlanTipo } from '../../shared/modules'

export function registerPlanHandlers(): void {
  handle('plan:get', () => {
    return { plan: getPlan(), modulos: getModulosEstado() }
  })

  handle('plan:set', ({ plan, overrides }) => {
    setPlanConfig({ plan: plan as PlanTipo, overrides: (overrides ?? {}) as Partial<Record<ModuloKey, boolean>> })
  })

  handle('plan:moduloEnabled', ({ key }) => {
    return { enabled: isModuloEnabled(key as ModuloKey) }
  })
}
