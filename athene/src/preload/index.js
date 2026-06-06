import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('athene', {
  ping: () => ipcRenderer.invoke('athene:ping'),
  // AI control layer (β4): forward a built Anthropic Messages request to the
  // main process, which adds the key and makes the HTTPS call. Resolves to
  // { ok, data } or { ok:false, error }.
  llm: (request) => ipcRenderer.invoke('athene:llm', request)
})
