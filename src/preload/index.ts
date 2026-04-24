import { contextBridge, ipcRenderer } from 'electron'
import type { IpcChannels, IpcRequest, IpcResponse } from '../shared/ipc-channels'

function invoke<C extends keyof IpcChannels>(
  channel: C,
  request: IpcRequest<C>
): Promise<IpcResponse<C>> {
  return ipcRenderer.invoke(channel, request)
}

const api = {
  invoke,
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
