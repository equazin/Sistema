import { contextBridge, ipcRenderer } from 'electron'
import type { IpcChannels, IpcRequest, IpcResponse } from '../shared/ipc-channels'

function invoke<C extends keyof IpcChannels>(
  channel: C,
  request: IpcRequest<C>
): Promise<IpcResponse<C>> {
  return ipcRenderer.invoke(channel, request)
}

function invokeRaw(channel: string, ...args: unknown[]): Promise<unknown> {
  return ipcRenderer.invoke(channel, ...args)
}

function on(channel: string, listener: (...args: unknown[]) => void): () => void {
  const wrapped = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => listener(...args)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

const api = {
  invoke,
  invokeRaw,
  on,
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
