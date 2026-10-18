const api = window.agentPingSettings;
const $ = (selector) => document.querySelector(selector);
let state = null;
let toastTimer = null;

const LABELS = { ping: "信号轮盘", emote: "表情轮盘", settings: "设置" };

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("show"), 1800);
}

function render() {
  if (!state) return;
  $("#version").textContent = "v" + state.version;
  $("#paths").textContent = state.paths && state.paths.globalConfig ? state.paths.globalConfig : "";

  const target = state.target;
  document.querySelectorAll("[data-target]").forEach((button) => {
    const active = button.dataset.target === target;
    button.classList.toggle("active", active);
    button.setAttribute("aria-checked", active ? "true" : "false");
  });
  $("#target-pill").textContent = target === "hub" ? "独立 Hub" : target === "dsh" ? "DSH 桥接" : "未连接";
  $("#target-pill").classList.toggle("on", target === "hub" || target === "dsh");
  $("#target-hint").textContent =
    target === "hub"
      ? "信号进入本地 hub，任意 agent 都可以消费。"
      : target === "dsh"
        ? "信号进入 DSH 插件（agent-ping-bridge.json）。"
        : "没有找到可用的投递目标，请先启动 Hub 或 DSH。";

  const hub = state.hub;
  $("#hub-pill").textContent = hub.running ? (hub.embedded ? "运行中 · 内置" : "运行中 · 外部") : "未运行";
  $("#hub-pill").classList.toggle("on", hub.running);
  $("#hub-endpoint").textContent = hub.running ? hub.endpoint : "—";
  $("#hub-start").disabled = hub.running;
  $("#hub-stop").disabled = !hub.embedded;
  $("#hub-copy").disabled = !hub.running;

  $("#autostart").checked = Boolean(state.autostart);

  $("#keys").innerHTML = Object.entries(state.hotkeys)
    .map(([kind, value]) => `<span class="key"><b>${LABELS[kind] || kind}</b><code>${value || "未注册"}</code></span>`)
    .join("");
}

async function refresh() {
  try {
    state = await api.getState();
    render();
  } catch (error) {
    toast("读取状态失败");
  }
}

document.querySelectorAll("[data-target]").forEach((button) => {
  button.addEventListener("click", async () => {
    const result = await api.setTarget(button.dataset.target);
    if (result && result.state) state = result.state;
    render();
    toast(result && result.ok ? "投递目标已切换" : "切换失败");
  });
});

$("#hub-start").addEventListener("click", async () => {
  const result = await api.startHub();
  if (result && result.state) state = result.state;
  render();
  toast(result && result.ok ? "Hub 已启动" : "启动失败：" + ((result && result.error) || "未知错误"));
});

$("#hub-stop").addEventListener("click", async () => {
  const result = await api.stopHub();
  if (result && result.state) state = result.state;
  render();
  toast(result && result.ok ? "Hub 已停止" : "停止失败");
});

$("#hub-copy").addEventListener("click", async () => {
  if (!state || !state.hub.running) return;
  await api.copy(state.hub.endpoint);
  toast("地址已复制");
});

document.querySelectorAll("[data-copy]").forEach((button) => {
  button.addEventListener("click", async () => {
    await api.copy(button.dataset.copy);
    toast("命令已复制");
  });
});

$("#autostart").addEventListener("change", async (event) => {
  const enabled = await api.setAutostart(event.target.checked);
  if (state) state.autostart = enabled;
  render();
  toast(enabled ? "已开启开机启动" : "已关闭开机启动");
});

$("#close").addEventListener("click", () => api.close());
window.addEventListener("focus", refresh);
setInterval(refresh, 3000);
refresh();
