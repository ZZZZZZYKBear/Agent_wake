import { startBridge } from "./bridge.js";

/**
 * Host half: run the loopback bridge for the global desktop overlay.
 *
 * The bridge is optional for the in-page wheel. If it cannot start (for
 * example because loopback networking is blocked), the plugin still mounts and
 * the client-side wheel keeps working.
 */
export function apply(ctx) {
  let stop = null;
  try {
    stop = startBridge();
  } catch (error) {
    console.error("[agent-ping] bridge host failed", error);
    return;
  }
  if (ctx && typeof ctx.effect === "function") {
    ctx.effect(() => () => {
      try {
        stop?.();
      } catch (error) {
        console.error("[agent-ping] bridge stop failed", error);
      }
    }, "agent-ping: loopback bridge");
    return;
  }
  if (ctx && typeof ctx.on === "function") {
    ctx.on("dispose", () => {
      try {
        stop?.();
      } catch {}
    });
  }
}
