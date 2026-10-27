(function () {
	if (!window.__agentPingModule || typeof window.__agentPingModule.createAgentPing !== "function") {
		console.error("[agent-ping] global client bundle did not load");
		return;
	}

	let currentTarget = null;
	let pendingOpen = null;
	const host = window.agentPingHost;

	function uid() {
		try {
			if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID();
		} catch {}
		return "global-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
	}

	const globalSession = {
		running: false,
		getSnapshot() {
			return { running: false };
		},
		beginSubmission(input) {
			return {
				requestId: uid(),
				abandon() {}
			};
		},
		async prompt(content) {
			const text = (content || [])
				.map((part) => (part && typeof part.text === "string" ? part.text : ""))
				.join("")
				.trim();
			if (!text) return { ok: false, error: { message: "empty prompt" } };
			const result = await host.sendSignal({
				id: "global-" + Date.now().toString(36),
				label: "全局信号",
				emoji: "🖥️",
				color: "#62b6ff",
				icon: "flag",
				prompt: text,
				target: currentTarget
			});
			if (result && result.ok) return result;
			return {
				ok: false,
				error: { message: (result && result.error) || "无法连接 DSH 桥接" }
			};
		}
	};

	const ctx = {
		sessions: {
			binding() {
				return { session: globalSession };
			}
		},
		slots: {
			inject() {},
			register() {
				return () => {};
			}
		}
	};

	const controller = window.__agentPingModule.createAgentPing(ctx, { globalMode: true });
	controller.mount();
	controller.bindSession("global-session");
	window.__GLOBAL_AGENT_PING__ = controller;

	const root = document.querySelector("[data-agent-ping-root]");
	let active = false;
	let idleTimer = null;

	function syncInteractive() {
		const isActive = Boolean(root && root.classList.contains("is-active"));
		if (isActive === active) return;
		active = isActive;
		window.clearTimeout(idleTimer);
		if (isActive) {
			host.setInteractive(true);
			return;
		}
		host.setInteractive(false);
	}

	if (root) {
		new MutationObserver(syncInteractive).observe(root, { attributes: true, attributeFilter: ["class"] });
	}

	function cancelPending() {
		if (pendingOpen) {
			window.removeEventListener("pointermove", pendingOpen.onMove, true);
			window.removeEventListener("pointerdown", pendingOpen.onMove, true);
			pendingOpen = null;
		}
	}

	function closeAll() {
		cancelPending();
		currentTarget = null;
		controller.closeWheel(true);
		controller.closeAsk();
		controller.closeSettings();
	}

	function localizeTarget(target, point) {
		if (!target) return null;
		return {
			...target,
			x: point.x,
			y: point.y,
			rect: { left: point.x - 72, top: point.y - 54, width: 144, height: 108 }
		};
	}

	// The OS cursor and the browser's client coordinates can disagree under DPI
	// scaling. Open the wheel from the first real pointer event so the wheel
	// center, laser line and cursor dot all share the same coordinate space.
	// We still show it immediately at the OS cursor so a stationary mouse can
	// see the wheel; the first pointer event then re-centers it exactly.
	function armWheel(payload) {
		if (!payload) return;
		closeAll();
		if (typeof controller.setGlobalSessions === "function") {
			controller.setGlobalSessions(Array.isArray(payload.sessions) ? payload.sessions : []);
		}
		currentTarget = payload.target || null;
		host.setInteractive(true);
		const mode = payload.mode === "emote" ? "emote" : "ping";
		const start = payload.point && Number.isFinite(payload.point.x) && Number.isFinite(payload.point.y)
			? { x: payload.point.x, y: payload.point.y }
			: null;
		if (start) {
			const target = localizeTarget(payload.target, start);
			currentTarget = target;
			controller.openWheel(mode, start, target);
		}
		const finish = (event) => {
			if (!pendingOpen) return;
			const point = { x: event.clientX, y: event.clientY };
			const target = localizeTarget(payload.target, point);
			cancelPending();
			currentTarget = target;
			controller.openWheel(mode, point, target);
		};
		pendingOpen = {
			onMove: (event) => {
				if (!pendingOpen) return;
				finish(event);
			}
		};
		window.addEventListener("pointermove", pendingOpen.onMove, true);
		window.addEventListener("pointerdown", pendingOpen.onMove, true);
	}

	host.onOpenWheel(armWheel);

	host.onOpenSettings(() => {
		closeAll();
		controller.openSettings();
	});

	host.onClose(() => {
		closeAll();
	});

	window.addEventListener("keydown", (event) => {
		if (event.key === "Escape") {
			event.preventDefault();
			cancelPending();
			closeAll();
			host.setInteractive(false);
			host.closeOverlay();
		}
	}, true);

	syncInteractive();
})();
