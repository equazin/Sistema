import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcChannels, IpcRequest, IpcResponse, ApiResult } from '../../shared/ipc-channels'

export function handle<C extends keyof IpcChannels>(
  channel: C,
  handler: (request: IpcRequest<C>) => Promise<IpcResponse<C>> | IpcResponse<C>
): void {
  ipcMain.handle(channel, async (_event: IpcMainInvokeEvent, request: IpcRequest<C>): Promise<ApiResult<IpcResponse<C>>> => {
    try {
      const data = await handler(request)
      return { success: true, data }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[IPC] Error in ${channel}:`, message)
      return { success: false, error: message }
    }
  })
}
