const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("agentPingSettings", {
  getState: () => ipcRenderer.invoke("settings:get"),
  setTarget: (kind) => ipcRenderer.invoke("settings:set-target", kind),
  startHub: () => ipcRenderer.invoke("settings:start-hub"),
  stopHub: () => ipcRenderer.invoke("settings:stop-hub"),
  setAutostart: (value) => ipcRenderer.invoke("settings:set-autostart", value),
  copy: (text) => ipcRenderer.invoke("settings:copy", text),
  close: () => ipcRenderer.send("settings:close")
});
