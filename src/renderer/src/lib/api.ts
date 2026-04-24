import type { IpcChannels, IpcRequest, IpcResponse, ApiResult } from '../../../shared/ipc-channels'

declare global {
  interface Window {
    api: {
      invoke<C extends keyof IpcChannels>(
        channel: C,
        request: IpcRequest<C>
      ): Promise<ApiResult<IpcResponse<C>>>
    }
  }
}

export async function invoke<C extends keyof IpcChannels>(
  channel: C,
  request: IpcRequest<C>
): Promise<IpcResponse<C>> {
  const result = await window.api.invoke(channel, request)
  if (!result.success) {
    throw new Error(result.error)
  }
  return result.data
}
