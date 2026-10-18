const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("agentPingHost", {
  onOpenWheel(callback) {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("open-wheel", listener);
    return () => ipcRenderer.removeListener("open-wheel", listener);
  },
  onOpenSettings(callback) {
    const listener = () => callback();
    ipcRenderer.on("open-settings", listener);
    return () => ipcRenderer.removeListener("open-settings", listener);
  },
  onClose(callback) {
    const listener = () => callback();
    ipcRenderer.on("close-overlay", listener);
    return () => ipcRenderer.removeListener("close-overlay", listener);
  },
  setInteractive(active) {
    ipcRenderer.send("overlay-state", { active: Boolean(active) });
  },
  sendSignal(payload) {
    return ipcRenderer.invoke("send-signal", payload);
  },
  closeOverlay() {
    ipcRenderer.send("close-overlay-request");
  }
});
