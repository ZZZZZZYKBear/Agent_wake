window.__ModuleLoader__.load({
	id: "dsh-agent-ping",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

		const VERSION = "0.2.0";
		const STORAGE_KEY = "dsh-agent-ping:v1";
		const ROOT_ATTR = "data-agent-ping-root";
		const MAX_EMOTES = 8;
		const PING_COUNT = 8;

		const COLORS = ["#8b7bff", "#ff5b5b", "#f0a33c", "#9aa4b2", "#22d3c5", "#e8c15a", "#62b6ff", "#7ee787"];

		const PINGS = [
			{
				id: "question",
				label: "提问",
				sub: "QUESTION",
				color: "#8b7bff",
				icon: "question",
				command: "",
				ask: true
			},
			{
				id: "danger",
				label: "危险",
				sub: "DANGER",
				color: "#ff5b5b",
				icon: "danger",
				command: "注意这里，这里可能有问题。先检查这个位置，告诉我风险在哪里。"
			},
			{
				id: "push",
				label: "推进",
				sub: "PUSH",
				color: "#f0a33c",
				icon: "push",
				command: "继续推进这个位置，把这里的改动做完。"
			},
			{
				id: "retreat",
				label: "撤退",
				sub: "RETREAT",
				color: "#9aa4b2",
				icon: "retreat",
				command: "先停手，不要继续改这个位置。等我确认后再动。"
			},
			{
				id: "vision",
				label: "看这里",
				sub: "VISION",
				color: "#22d3c5",
				icon: "eye",
				command: "看一下我标记的位置，先观察并说明这里现在是什么状态。"
			},
			{
				id: "wait",
				label: "等一下",
				sub: "WAIT",
				color: "#e8c15a",
				icon: "wait",
				command: "先等一下，暂时不要继续执行。保持当前状态，等我的下一步指令。"
			},
			{
				id: "flag",
				label: "标记",
				sub: "FLAG",
				color: "#62b6ff",
				icon: "flag",
				command: "记住这个位置，稍后回到这里处理。不要现在修改。"
			},
			{
				id: "praise",
				label: "干得好",
				sub: "PRAISE",
				color: "#7ee787",
				icon: "praise",
				command: "这里做得不错，保留这个方向，继续。"
			}
		];

		const DEFAULT_EMOTES = [
			{ emoji: "▶️", label: "继续工作", command: "继续工作，不用等我确认。把当前任务推进到可验收的状态。" },
			{ emoji: "⏸️", label: "先停一下", command: "先停一下，暂时不要继续修改。告诉我你停在哪里。" },
			{ emoji: "🧠", label: "解释一下", command: "解释一下你刚才做的改动、原因和影响范围。" },
			{ emoji: "🧪", label: "跑测试", command: "运行相关测试，定位并修复失败项，然后汇报结果。" },
			{ emoji: "🔍", label: "看这里", command: "看一下我标记的位置，指出这里的问题或可以改进的地方。" },
			{ emoji: "📦", label: "提交吧", command: "检查当前改动，确认没有遗漏后提交，并告诉我提交信息。" },
			{ emoji: "🔁", label: "再来一次", command: "刚才的结果不对，重新做一次。先说明你准备怎么改。" },
			{ emoji: "✅", label: "收尾", command: "总结当前进展，列出剩余事项和风险。" }
		];

		const DEFAULT_SETTINGS = {
			pingKey: "Shift+Alt+Q",
			emoteKey: "Shift+Alt+E",
			settingsKey: "Shift+Alt+P",
			hotkeyVersion: 2,
			sound: true,
			volume: 0.45,
			steerWhenRunning: true,
			includeContext: true,
			showFeed: true,
			emotes: DEFAULT_EMOTES,
			feed: []
		};

		const ICONS = {
			question: '<text x="12" y="17.4" text-anchor="middle" font-size="17" font-weight="700" fill="currentColor" stroke="none">?</text>',
			danger: '<path d="M12 3.2 2.7 20.2h18.6L12 3.2Z"/><path d="M12 9v4.4"/><circle cx="12" cy="16.8" r=".9" fill="currentColor" stroke="none"/>',
			push: '<path d="M3.6 12h15.2"/><path d="m13.4 6.2 5.8 5.8-5.8 5.8"/>',
			retreat: '<path d="M20.4 12H5.2"/><path d="M10.6 6.2 4.8 12l5.8 5.8"/>',
			eye: '<path d="M2.2 12s3.5-6.2 9.8-6.2 9.8 6.2 9.8 6.2-3.5 6.2-9.8 6.2S2.2 12 2.2 12Z"/><circle cx="12" cy="12" r="2.7"/>',
			wait: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.3V12l3.1 1.9"/>',
			flag: '<path d="M5.2 21V3.8"/><path d="M5.2 5.2h11.4l-2.1 4.1 2.1 4.1H5.2"/>',
			praise: '<path d="m12 2.8 2.8 5.8 6.4.9-4.6 4.5 1.1 6.4L12 17.2l-5.7 3.2 1.1-6.4L2.8 9.5l6.4-.9L12 2.8Z"/>'
		};

		function clamp(value, min, max) {
			return Math.max(min, Math.min(max, value));
		}

		function esc(value) {
			return String(value == null ? "" : value)
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/"/g, "&quot;")
				.replace(/'/g, "&#39;");
		}

		function oneLine(value, limit) {
			const text = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
			return text.length > limit ? text.slice(0, limit - 1) + "…" : text;
		}

		function uid() {
			try {
				if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
					return globalThis.crypto.randomUUID();
				}
			} catch {}
			return "ap-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
		}

		function clone(value) {
			return JSON.parse(JSON.stringify(value));
		}

		function deepMerge(base, value) {
			if (value == null || typeof value !== "object" || Array.isArray(value)) return clone(base);
			const result = clone(base);
			for (const key of Object.keys(value)) {
				if (key in result) {
					if (Array.isArray(result[key])) {
						if (Array.isArray(value[key])) result[key] = value[key].slice();
					} else if (result[key] && typeof result[key] === "object") {
						result[key] = deepMerge(result[key], value[key]);
					} else {
						result[key] = value[key];
					}
				}
			}
			return result;
		}

		function loadSettings() {
			let stored = null;
			try {
				const raw = localStorage.getItem(STORAGE_KEY);
				if (raw) stored = JSON.parse(raw);
			} catch {}
			const settings = deepMerge(DEFAULT_SETTINGS, stored || {});
			if (!Array.isArray(settings.emotes)) settings.emotes = clone(DEFAULT_EMOTES);
			settings.emotes = settings.emotes
				.filter((emote) => emote && typeof emote === "object")
				.slice(0, MAX_EMOTES)
				.map((emote, index) => ({
					emoji: String(emote.emoji || DEFAULT_EMOTES[index % DEFAULT_EMOTES.length].emoji).slice(0, 8),
					label: String(emote.label || "快捷指令").slice(0, 24),
					command: String(emote.command || "").slice(0, 500)
				}));
			if (settings.emotes.length === 0) settings.emotes = clone(DEFAULT_EMOTES);
			if (!Array.isArray(settings.feed)) settings.feed = [];
			settings.feed = settings.feed.filter((item) => item && item.prompt).slice(0, 20);
			settings.volume = clamp(Number(settings.volume) || 0.45, 0, 1);
			// Migrate 0.2.x single-key preferences to the unified Shift+Alt set.
			if (!stored || Number(stored.hotkeyVersion || 0) < 2) {
				settings.pingKey = DEFAULT_SETTINGS.pingKey;
				settings.emoteKey = DEFAULT_SETTINGS.emoteKey;
				settings.settingsKey = DEFAULT_SETTINGS.settingsKey;
				settings.hotkeyVersion = 2;
			}
			settings.pingKey = normalizeCombo(settings.pingKey || DEFAULT_SETTINGS.pingKey) || DEFAULT_SETTINGS.pingKey;
			settings.emoteKey = normalizeCombo(settings.emoteKey || DEFAULT_SETTINGS.emoteKey) || DEFAULT_SETTINGS.emoteKey;
			settings.settingsKey = normalizeCombo(settings.settingsKey || DEFAULT_SETTINGS.settingsKey) || DEFAULT_SETTINGS.settingsKey;
			if (settings.pingKey === settings.emoteKey) settings.emoteKey = DEFAULT_SETTINGS.emoteKey;
			if (settings.settingsKey === settings.pingKey || settings.settingsKey === settings.emoteKey) {
				settings.settingsKey = DEFAULT_SETTINGS.settingsKey;
			}
			return settings;
		}

		function saveSettings(settings) {
			try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
			} catch {}
		}

		const MODIFIER_NAMES = ["Control", "Alt", "Shift", "Meta"];
		const MODIFIER_ALIASES = {
			ctrl: "Ctrl",
			control: "Ctrl",
			alt: "Alt",
			shift: "Shift",
			meta: "Meta",
			win: "Meta"
		};

		function normalizeKey(key) {
			if (!key) return "";
			if (key === " " || key === "Spacebar") return "Space";
			if (key === "Esc") return "Escape";
			if (key === "AltGraph" || key === "AltGr") return "Alt";
			if (key.length === 1) return key.toLowerCase();
			return key;
		}

		function comboParts(value) {
			return String(value || "")
				.split("+")
				.map((part) => part.trim())
				.filter(Boolean);
		}

		function isCombo(value) {
			return String(value || "").includes("+");
		}

		function normalizeCombo(value) {
			const raw = String(value || "").trim();
			if (!raw) return "";
			const parts = comboParts(raw);
			if (parts.length === 1) return normalizeKey(parts[0]);
			let keyName = "";
			const mods = { Shift: false, Alt: false, Ctrl: false, Meta: false };
			for (const part of parts) {
				const alias = MODIFIER_ALIASES[part.toLowerCase()];
				if (alias) mods[alias] = true;
				else keyName = normalizeKey(part);
			}
			if (!keyName) return "";
			const ordered = [];
			if (mods.Shift) ordered.push("Shift");
			if (mods.Alt) ordered.push("Alt");
			if (mods.Ctrl) ordered.push("Ctrl");
			if (mods.Meta) ordered.push("Meta");
			ordered.push(displayKey(keyName));
			return ordered.join("+");
		}

		function displayKey(key) {
			const raw = String(key || "");
			if (raw.includes("+")) {
				return comboParts(raw).map((part) => displayKey(part)).join("+");
			}
			const normalized = normalizeKey(raw);
			if (normalized === "Alt") return "Alt";
			if (normalized === "Control" || normalized === "Ctrl") return "Ctrl";
			if (normalized === "Meta") return "Meta";
			if (normalized === "Shift") return "Shift";
			if (normalized === "Space") return "Space";
			if (normalized.length === 1) return normalized.toUpperCase();
			return normalized;
		}

		function keyNameMatches(event, keyName) {
			const normalized = normalizeKey(keyName);
			if (normalized === "Alt") return event.key === "Alt";
			if (normalized === "Control" || normalized === "Ctrl") return event.key === "Control";
			if (normalized === "Meta") return event.key === "Meta";
			if (normalized === "Shift") return event.key === "Shift";
			if (normalized === "Space") return event.code === "Space" || event.key === " ";
			if (normalized.length === 1) return String(event.key || "").toLowerCase() === normalized;
			return event.key === normalized;
		}

		function keyMatches(event, value) {
			const raw = String(value || "");
			if (!raw) return false;
			const parts = comboParts(raw);
			const keyName = parts.pop();
			if (!keyName) return false;
			const mods = { Shift: false, Alt: false, Ctrl: false, Meta: false };
			for (const part of parts) {
				const alias = MODIFIER_ALIASES[part.toLowerCase()];
				if (alias) mods[alias] = true;
			}
			const wantsModifiers = mods.Shift || mods.Alt || mods.Ctrl || mods.Meta;
			if (wantsModifiers) {
				if (event.shiftKey !== mods.Shift || event.altKey !== mods.Alt || event.ctrlKey !== mods.Ctrl || event.metaKey !== mods.Meta) {
					return false;
				}
			} else if (event.ctrlKey || event.altKey || event.metaKey) {
				return false;
			}
			return keyNameMatches(event, keyName);
		}

		function comboFromEvent(event) {
			if (MODIFIER_NAMES.includes(event.key)) return "";
			const keyName = normalizeKey(event.key);
			if (!keyName) return "";
			const mods = [];
			if (event.shiftKey) mods.push("Shift");
			if (event.altKey) mods.push("Alt");
			if (event.ctrlKey) mods.push("Ctrl");
			if (event.metaKey) mods.push("Meta");
			if (mods.length === 0) return "";
			mods.push(displayKey(keyName));
			return mods.join("+");
		}

		function isEditable(element) {
			if (!element || element.nodeType !== 1) return false;
			const tag = element.tagName;
			return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || element.isContentEditable;
		}

		function escapeSelector(value) {
			if (globalThis.CSS && typeof globalThis.CSS.escape === "function") return globalThis.CSS.escape(value);
			return String(value).replace(/([^\w-])/g, "\\$1");
		}

		function cssPath(element) {
			if (!element || element.nodeType !== 1) return "";
			if (element === document.body) return "body";
			if (element.id) {
				const id = escapeSelector(element.id);
				try {
					if (document.querySelectorAll("#" + id).length === 1) return "#" + id;
				} catch {}
			}
			const parts = [];
			let node = element;
			while (node && node.nodeType === 1 && node !== document.body && parts.length < 5) {
				let part = node.tagName.toLowerCase();
				const classes = Array.from(node.classList || [])
					.filter((name) => name && !name.startsWith("ap-") && name.length < 40)
					.slice(0, 2);
				if (classes.length) part += "." + classes.map(escapeSelector).join(".");
				const parent = node.parentElement;
				if (parent) {
					const siblings = Array.from(parent.children).filter((child) => child.tagName === node.tagName);
					if (siblings.length > 1) part += ":nth-of-type(" + (siblings.indexOf(node) + 1) + ")";
				}
				parts.unshift(part);
				node = parent;
			}
			return parts.join(" > ") || element.tagName.toLowerCase();
		}

		function cleanCodeText(source) {
			const raw = source && (source.innerText || source.textContent) || "";
			const hasLineNumbers = source && source.querySelector
				? source.querySelector('[class~="ln"], [class*="line-number"], [class*="lineno"], [data-line-number]')
				: null;
			return (hasLineNumbers ? raw.replace(/^\s*\d+\s?/gm, "") : raw).trim();
		}

		function targetText(element) {
			if (!element || element.nodeType !== 1) return "";
			const tag = element.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
				return oneLine(element.getAttribute("placeholder") || element.getAttribute("aria-label") || "", 180);
			}
			const code = element.closest("pre, code");
			const source = code || element;
			const raw = source.innerText || source.textContent || "";
			return oneLine(code ? cleanCodeText(code) : raw, 260);
		}

		function targetLabel(element) {
			if (!element || element.nodeType !== 1) return "页面空白处";
			const tag = element.tagName.toLowerCase();
			const code = element.closest("pre") || element.closest("code");
			if (code) {
				const firstLine = oneLine(cleanCodeText(code), 52);
				return "代码块" + (firstLine ? " · " + firstLine : "");
			}
			const aria = element.getAttribute("aria-label");
			const title = element.getAttribute("title");
			const placeholder = element.getAttribute("placeholder");
			const alt = element.getAttribute("alt");
			if (aria) return oneLine(aria, 80);
			if (title) return oneLine(title, 80);
			if (placeholder) return oneLine(placeholder, 80);
			if (alt) return oneLine(alt, 80);
			if (tag === "input" && element.type === "password") return "密码输入框";
			const text = targetText(element);
			if (text) return text.slice(0, 80);
			return "<" + tag + ">";
		}

		function captureTarget(x, y) {
			const fallback = {
				x,
				y,
				selector: "页面坐标",
				label: "页面空白处",
				text: "",
				tag: "body",
				rect: { left: x - 10, top: y - 10, width: 20, height: 20 }
			};
			if (typeof document === "undefined") return fallback;
			let raw = null;
			try {
				const stack = typeof document.elementsFromPoint === "function"
					? document.elementsFromPoint(x, y)
					: [document.elementFromPoint(x, y)];
				raw = stack.find((element) => element && (!element.closest || !element.closest("[" + ROOT_ATTR + "]"))) || null;
			} catch {}
			if (!raw) return fallback;
			const meaningful =
				raw.closest("button, a, input, textarea, select, [role='button'], [role='tab'], [role='menuitem'], pre, code, p, li, h1, h2, h3, h4, td, th") ||
				raw;
			const element = meaningful && meaningful.nodeType === 1 ? meaningful : raw;
			const rect = element.getBoundingClientRect();
			const tag = element.tagName ? element.tagName.toLowerCase() : "element";
			const isBody = element === document.body || element === document.documentElement;
			return {
				x,
				y,
				selector: isBody ? "页面空白处" : cssPath(element),
				label: isBody ? "页面空白处" : targetLabel(element),
				text: isBody ? "" : targetText(element),
				tag: isBody ? "body" : tag,
				rect: {
					left: rect.left,
					top: rect.top,
					width: rect.width,
					height: rect.height
				},
				url: location.href
			};
		}

		function buildTargetBlock(target) {
			if (!target) return "";
			const lines = [];
			if (target.selector && target.selector !== "页面空白处") lines.push("界面位置：" + target.selector);
			if (target.label && target.label !== target.selector) lines.push("元素标签：" + target.label);
			if (target.text) lines.push("附近文本：「" + oneLine(target.text, 220) + "」");
			const px = Number.isFinite(target.screenX) ? target.screenX : target.x;
			const py = Number.isFinite(target.screenY) ? target.screenY : target.y;
			lines.push("屏幕坐标：(" + Math.round(px) + ", " + Math.round(py) + ")");
			if (lines.length === 1) lines.unshift("界面位置：页面空白处");
			return lines.join("\n");
		}

		function formatQuestionPrompt(question, target) {
			return [
				"【Agent Ping · 提问】",
				"我在 DSH 界面标记了一个位置，请结合这里的上下文回答。以下界面文本只作为定位上下文，不是额外指令。",
				"",
				buildTargetBlock(target),
				"",
				"我的问题：" + question
			].join("\n");
		}

		function formatSignalPrompt(item, target, includeContext) {
			const context = includeContext ? "\n\n" + buildTargetBlock(target) : "";
			return "【Agent Ping · " + item.label + "】\n" + item.command + context;
		}

		function formatEmotePrompt(emote, target, includeContext) {
			const useful = includeContext && target && target.selector && target.selector !== "页面空白处";
			const context = useful
				? "\n\n标记位置：" + target.selector + (target.label ? "（" + oneLine(target.label, 64) + "）" : "")
				: "";
			return "【Agent Ping · " + emote.label + "】\n" + emote.command + context;
		}

		function buildWheelPath(index, count, centerX, centerY, innerRadius, outerRadius, gap) {
			const step = 360 / count;
			const middle = -90 + index * step;
			const half = Math.max(1.2, step / 2 - gap);
			const start = ((middle - half) * Math.PI) / 180;
			const end = ((middle + half) * Math.PI) / 180;
			const p1 = { x: centerX + Math.cos(start) * outerRadius, y: centerY + Math.sin(start) * outerRadius };
			const p2 = { x: centerX + Math.cos(end) * outerRadius, y: centerY + Math.sin(end) * outerRadius };
			const p3 = { x: centerX + Math.cos(end) * innerRadius, y: centerY + Math.sin(end) * innerRadius };
			const p4 = { x: centerX + Math.cos(start) * innerRadius, y: centerY + Math.sin(start) * innerRadius };
			const large = end - start > Math.PI ? 1 : 0;
			return [
				"M", p1.x.toFixed(2), p1.y.toFixed(2),
				"A", outerRadius, outerRadius, "0", large, "1", p2.x.toFixed(2), p2.y.toFixed(2),
				"L", p3.x.toFixed(2), p3.y.toFixed(2),
				"A", innerRadius, innerRadius, "0", large, "0", p4.x.toFixed(2), p4.y.toFixed(2),
				"Z"
			].join(" ");
		}

		function iconHtml(name) {
			if (!name) return "";
			if (name.length === 1) {
				return '<svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="18" text-anchor="middle" font-size="19" font-weight="700" fill="currentColor" stroke="none">' + esc(name) + "</text></svg>";
			}
			const path = ICONS[name] || ICONS.praise;
			return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + "</svg>";
		}

		function injectStyles() {
			const previous = document.getElementById("dsh-agent-ping-styles");
			if (previous) previous.remove();
			const style = document.createElement("style");
			style.id = "dsh-agent-ping-styles";
			style.textContent = `
.ap-root {
	--ap-gold: #c8aa6e;
	--ap-gold-bright: #f0e6d2;
	--ap-teal: #0ac8b9;
	--ap-ink: #f0e6d2;
	position: fixed;
	inset: 0;
	z-index: 2147483000;
	pointer-events: none;
	color: var(--ap-ink);
	font-family: "Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif;
	font-size: 14px;
	line-height: 1.45;
	-webkit-font-smoothing: antialiased;
	text-rendering: optimizeLegibility;
}
.ap-root *, .ap-root *::before, .ap-root *::after { box-sizing: border-box; }
.ap-root button, .ap-root input, .ap-root textarea { font: inherit; color: inherit; }
.ap-root button { border: 0; background: none; cursor: pointer; }
.ap-root svg { display: block; }
.ap-root .ap-scrim {
	position: absolute;
	inset: 0;
	opacity: 0;
	pointer-events: none;
	background:
		radial-gradient(circle at var(--ap-x, 50%) var(--ap-y, 50%), rgba(8, 26, 34, .06), rgba(2, 7, 12, .52) 48%, rgba(0, 0, 0, .66) 100%);
	backdrop-filter: blur(1.5px) saturate(.8);
	transition: opacity .18s ease;
}
.ap-root.is-active .ap-scrim { opacity: 1; pointer-events: auto; }
.ap-root.is-wheel { cursor: none; }
.ap-root.is-wheel * { cursor: none !important; }

/* ---- spotlight: keep the marked area crisp, frost everything around it ---- */
.ap-root .ap-spot {
	position: absolute;
	inset: 0;
	display: none;
	pointer-events: none;
}
.ap-root.is-spot .ap-spot { display: block; }
.ap-root.is-spot .ap-scrim {
	background: transparent;
	backdrop-filter: none;
	-webkit-backdrop-filter: none;
}
.ap-spot-panel {
	position: absolute;
	background: rgba(1, 6, 10, .5);
	backdrop-filter: blur(6px) saturate(.82);
	-webkit-backdrop-filter: blur(6px) saturate(.82);
}
.ap-root.ap-global .ap-spot { display: none !important; }

/* ---- session picker ---- */
.ap-picker {
	position: fixed;
	inset: 0;
	z-index: 5;
	opacity: 0;
	pointer-events: none;
	transition: opacity .15s ease;
}
.ap-root.is-picker .ap-picker { opacity: 1; pointer-events: auto; }
.ap-picker-card {
	position: absolute;
	left: 0;
	top: 0;
	width: min(420px, calc(100vw - 32px));
	max-height: min(74vh, 560px);
	display: flex;
	flex-direction: column;
}
.ap-picker-card .ap-card-head { cursor: grab; }
.ap-picker-card.is-dragging .ap-card-head { cursor: grabbing; }
.ap-picker-list {
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: 8px;
	overflow: auto;
}
.ap-picker-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	padding: 9px 11px;
	border: 1px solid transparent;
	border-radius: 8px;
	text-align: left;
	color: var(--ap-ink);
}
.ap-picker-row:hover { background: rgba(200, 170, 110, .08); border-color: rgba(200, 170, 110, .3); }
.ap-picker-row.is-current { border-color: rgba(10, 200, 185, .4); background: rgba(10, 200, 185, .06); }
.ap-picker-title {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 13px;
}
.ap-picker-meta {
	flex: 0 0 auto;
	font-size: 10px;
	color: rgba(240, 230, 210, .45);
	letter-spacing: .04em;
}

/* ---- target ring ---- */
.ap-target {
	position: fixed;
	z-index: 1;
	pointer-events: none;
	opacity: 0;
	border: 1px solid color-mix(in srgb, var(--ap-color, #c8aa6e) 72%, transparent);
	box-shadow: 0 0 0 1px rgba(0, 0, 0, .28), 0 0 28px color-mix(in srgb, var(--ap-color, #c8aa6e) 22%, transparent);
	transition: opacity .18s ease, transform .18s ease;
	transform: scale(1.02);
}
.ap-target.is-visible { opacity: 1; transform: scale(1); }
.ap-target .ap-resize {
	position: absolute;
	z-index: 2;
	width: 13px;
	height: 13px;
	border: 2px solid var(--ap-color, #c8aa6e);
	border-radius: 3px;
	background: rgba(3, 10, 16, .92);
	box-shadow: 0 0 6px color-mix(in srgb, var(--ap-color, #c8aa6e) 55%, transparent);
	pointer-events: none;
	opacity: 0;
	transition: opacity .15s ease;
}
.ap-resize.tl { left: -7px; top: -7px; cursor: nwse-resize; }
.ap-resize.tr { right: -7px; top: -7px; cursor: nesw-resize; }
.ap-resize.bl { left: -7px; bottom: -7px; cursor: nesw-resize; }
.ap-resize.br { right: -7px; bottom: -7px; cursor: nwse-resize; }
.ap-root.is-ask .ap-target.is-visible {
	pointer-events: auto;
	touch-action: none;
	cursor: grab;
}
.ap-root.is-ask .ap-target.is-visible .ap-resize { pointer-events: auto; opacity: 1; }
.ap-root.is-ask .ap-target.is-visible .ap-corner { opacity: 0; }
.ap-target.is-adjusting { cursor: grabbing; }
.ap-target.is-adjusting .ap-resize { cursor: grabbing; }
.ap-target .ap-corner {
	position: absolute;
	width: 12px;
	height: 12px;
	border-color: var(--ap-color, #c8aa6e);
	border-style: solid;
	filter: drop-shadow(0 0 4px color-mix(in srgb, var(--ap-color, #c8aa6e) 70%, transparent));
}
.ap-target .ap-corner.tl { left: -2px; top: -2px; border-width: 2px 0 0 2px; }
.ap-target .ap-corner.tr { right: -2px; top: -2px; border-width: 2px 2px 0 0; }
.ap-target .ap-corner.bl { left: -2px; bottom: -2px; border-width: 0 0 2px 2px; }
.ap-target .ap-corner.br { right: -2px; bottom: -2px; border-width: 0 2px 2px 0; }
.ap-target .ap-target-tag {
	position: absolute;
	left: 0;
	top: -25px;
	max-width: 320px;
	padding: 3px 7px;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
	background: rgba(3, 10, 16, .9);
	border: 1px solid color-mix(in srgb, var(--ap-color, #c8aa6e) 40%, transparent);
	color: var(--ap-color, #c8aa6e);
	font-size: 10px;
	letter-spacing: .06em;
}

/* ---- wheel ---- */
.ap-wheel {
	position: absolute;
	width: calc(var(--ap-r, 240px) * 2);
	height: calc(var(--ap-r, 240px) * 2);
	left: var(--ap-x, 50%);
	top: var(--ap-y, 50%);
	transform: translate(-50%, -50%) scale(.82);
	opacity: 0;
	pointer-events: none;
	transition: opacity .16s ease, transform .2s cubic-bezier(.2, .9, .25, 1.1);
	z-index: 3;
}
.ap-root.is-wheel .ap-wheel {
	opacity: 1;
	pointer-events: auto;
	transform: translate(-50%, -50%) scale(1);
}
.ap-wheel::before {
	content: "";
	position: absolute;
	inset: 4%;
	border-radius: 50%;
	background:
		radial-gradient(circle at 50% 38%, rgba(17, 40, 52, .72), rgba(2, 9, 14, .9) 62%, rgba(0, 3, 6, .94));
	box-shadow:
		0 0 0 1px rgba(200, 170, 110, .2),
		0 0 70px rgba(10, 200, 185, .08),
		inset 0 0 80px rgba(0, 0, 0, .75);
	backdrop-filter: blur(8px);
}
.ap-orbit {
	position: absolute;
	border-radius: 50%;
	pointer-events: none;
}
.ap-orbit.one {
	inset: -1.2%;
	border: 1px solid rgba(200, 170, 110, .28);
	box-shadow: 0 0 20px rgba(200, 170, 110, .08);
	animation: ap-spin 46s linear infinite;
}
.ap-orbit.one::before {
	content: "";
	position: absolute;
	inset: 4px;
	border-radius: 50%;
	background: conic-gradient(from 0deg, transparent 0 12%, rgba(200, 170, 110, .35) 12.4%, transparent 13.2% 37%, rgba(10, 200, 185, .24) 37.4%, transparent 38.2% 66%, rgba(200, 170, 110, .3) 66.4%, transparent 67.2% 100%);
	-webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1px));
	mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1px));
	opacity: .8;
}
.ap-orbit.two {
	inset: 5.2%;
	border: 1px dashed rgba(200, 170, 110, .16);
	animation: ap-spin-reverse 70s linear infinite;
}
.ap-sectors {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	overflow: visible;
}
.ap-sector {
	fill: rgba(7, 17, 24, .72);
	stroke: var(--ap-color, #c8aa6e);
	stroke-opacity: .26;
	stroke-width: 1;
	transition: fill .14s ease, stroke-opacity .14s ease, filter .14s ease;
}
.ap-sector.is-hover {
	fill: var(--ap-color, #c8aa6e);
	fill-opacity: .16;
	stroke-opacity: .86;
	filter: drop-shadow(0 0 10px color-mix(in srgb, var(--ap-color, #c8aa6e) 38%, transparent));
}
.ap-sector-item {
	position: absolute;
	width: 126px;
	transform: translate(-50%, -50%);
	text-align: center;
	pointer-events: none;
	color: var(--ap-color, #c8aa6e);
	transition: transform .14s ease, color .14s ease, opacity .14s ease;
	opacity: .9;
}
.ap-sector-item.is-hover { transform: translate(-50%, -50%) scale(1.1); color: #fff; opacity: 1; }
.ap-sector-item.is-empty { opacity: .35; }
.ap-sector-icon {
	width: 30px;
	height: 30px;
	margin: 0 auto 2px;
	display: flex;
	align-items: center;
	justify-content: center;
	filter: drop-shadow(0 0 8px color-mix(in srgb, var(--ap-color, #c8aa6e) 34%, transparent));
}
.ap-sector-icon svg { width: 26px; height: 26px; }
.ap-sector-icon .ap-emoji { font-size: 25px; line-height: 1; filter: drop-shadow(0 2px 4px rgba(0,0,0,.45)); }
.ap-sector-label {
	display: block;
	font-size: 12.5px;
	font-weight: 600;
	letter-spacing: .06em;
	white-space: nowrap;
	text-shadow: 0 1px 4px rgba(0, 0, 0, .8);
}
.ap-sector-sub {
	display: block;
	margin-top: 1px;
	font-size: 7.5px;
	letter-spacing: .19em;
	opacity: .55;
	white-space: nowrap;
}
.ap-pointer {
	position: absolute;
	left: 50%;
	top: 50%;
	height: 2px;
	width: 0;
	transform-origin: 0 50%;
	background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--ap-color, #c8aa6e) 72%, transparent));
	box-shadow: 0 0 10px color-mix(in srgb, var(--ap-color, #c8aa6e) 55%, transparent);
	opacity: .85;
	pointer-events: none;
}
.ap-cursor {
	position: fixed;
	width: 13px;
	height: 13px;
	margin: -6.5px 0 0 -6.5px;
	border-radius: 50%;
	border: 1.5px solid var(--ap-color, #c8aa6e);
	background: rgba(2, 8, 12, .55);
	box-shadow: 0 0 12px color-mix(in srgb, var(--ap-color, #c8aa6e) 60%, transparent);
	pointer-events: none;
	z-index: 8;
	opacity: 0;
	transition: opacity .12s ease;
}
.ap-root.is-wheel .ap-cursor { opacity: 1; }
.ap-hub {
	position: absolute;
	left: 50%;
	top: 50%;
	width: calc(var(--ap-r, 240px) * .58);
	height: calc(var(--ap-r, 240px) * .58);
	transform: translate(-50%, -50%);
	border-radius: 50%;
	background:
		radial-gradient(circle at 50% 35%, rgba(29, 52, 61, .98), rgba(5, 15, 21, .98) 66%, rgba(1, 7, 11, .98));
	border: 1px solid rgba(200, 170, 110, .55);
	box-shadow:
		0 0 0 5px rgba(200, 170, 110, .05),
		0 0 30px rgba(0, 0, 0, .55),
		inset 0 0 22px rgba(10, 200, 185, .06);
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	text-align: center;
	pointer-events: none;
}
.ap-root.is-wheel .ap-hub { pointer-events: auto; }
.ap-hub-kicker {
	font-size: 7.5px;
	letter-spacing: .26em;
	color: var(--ap-teal);
	opacity: .9;
}
.ap-hub-title {
	margin-top: 3px;
	font-size: clamp(14px, calc(var(--ap-r, 240px) * .07), 19px);
	font-weight: 600;
	letter-spacing: .06em;
	color: var(--ap-gold-bright);
	white-space: nowrap;
	max-width: 92%;
	overflow: hidden;
	text-overflow: ellipsis;
}
.ap-hub-sub {
	margin-top: 2px;
	max-width: 86%;
	font-size: 9px;
	line-height: 1.25;
	letter-spacing: .04em;
	color: rgba(240, 230, 210, .52);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.ap-hub-gear {
	position: absolute;
	bottom: 9%;
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 2px 7px;
	border: 1px solid rgba(200, 170, 110, .18);
	border-radius: 999px;
	background: rgba(3, 10, 15, .6);
	color: rgba(200, 170, 110, .7);
	font-size: 8px;
	letter-spacing: .1em;
	transition: color .12s ease, border-color .12s ease;
}
.ap-hub-gear:hover { color: var(--ap-gold-bright); border-color: rgba(200, 170, 110, .55); }
.ap-hub-gear svg { width: 9px; height: 9px; }
.ap-wheel-hint {
	position: absolute;
	left: 50%;
	bottom: calc(var(--ap-r, 240px) * -.13);
	transform: translateX(-50%);
	white-space: nowrap;
	padding: 3px 9px;
	border-radius: 999px;
	background: rgba(2, 8, 12, .52);
	backdrop-filter: blur(6px);
	font-size: 10px;
	letter-spacing: .12em;
	color: rgba(240, 230, 210, .68);
	text-shadow: 0 1px 6px #000;
}
.ap-wheel-hint b { color: rgba(200, 170, 110, .8); font-weight: 600; }
.ap-wheel .ap-wheel-mode {
	position: absolute;
	left: 50%;
	top: calc(var(--ap-r, 240px) * -1 - 18px);
	transform: translateX(-50%);
	font-size: 9px;
	letter-spacing: .32em;
	color: rgba(10, 200, 185, .7);
	white-space: nowrap;
}

/* ---- cards ---- */
.ap-card {
	background:
		linear-gradient(155deg, rgba(16, 31, 40, .985), rgba(4, 11, 17, .99) 58%, rgba(7, 16, 22, .99));
	border: 1px solid rgba(200, 170, 110, .42);
	border-radius: 10px;
	box-shadow:
		0 30px 100px rgba(0, 0, 0, .7),
		0 0 0 1px rgba(10, 200, 185, .07) inset,
		0 0 40px rgba(10, 200, 185, .03);
	overflow: hidden;
}
.ap-ask-card {
	max-height: calc(100vh - 24px);
	overflow-y: auto;
	scrollbar-width: thin;
}
.ap-card-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 13px 16px 10px;
	border-bottom: 1px solid rgba(200, 170, 110, .12);
	background: linear-gradient(90deg, rgba(200, 170, 110, .06), transparent 62%);
}
.ap-kicker {
	font-size: 8.5px;
	letter-spacing: .24em;
	color: var(--ap-teal);
	opacity: .85;
}
.ap-card-title {
	margin-top: 2px;
	font-size: 15px;
	font-weight: 600;
	color: var(--ap-gold-bright);
	letter-spacing: .02em;
}
.ap-icon-btn {
	width: 26px;
	height: 26px;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 1px solid transparent;
	border-radius: 4px;
	color: rgba(240, 230, 210, .5);
	font-size: 18px;
	line-height: 1;
	transition: color .12s ease, border-color .12s ease, background .12s ease;
}
.ap-icon-btn:hover { color: var(--ap-gold-bright); border-color: rgba(200, 170, 110, .35); background: rgba(200, 170, 110, .06); }

.ap-ask {
	position: fixed;
	z-index: 4;
	width: 392px;
	max-width: calc(100vw - 24px);
	opacity: 0;
	transform: translateY(9px) scale(.985);
	pointer-events: none;
	transition: opacity .16s ease, transform .18s cubic-bezier(.2, .9, .25, 1.1);
}
.ap-root.is-ask .ap-ask { opacity: 1; transform: none; pointer-events: auto; }
.ap-ask-target {
	display: flex;
	align-items: flex-start;
	gap: 9px;
	margin: 12px 16px 0;
	padding: 8px 10px;
	border: 1px solid rgba(139, 123, 255, .2);
	background: rgba(139, 123, 255, .045);
	border-radius: 6px;
}
.ap-ask-target-icon {
	width: 20px;
	height: 20px;
	flex: 0 0 20px;
	color: #8b7bff;
	margin-top: 1px;
}
.ap-ask-target-icon svg { width: 18px; height: 18px; }
.ap-ask-target-main { min-width: 0; }
.ap-ask-target-label {
	font-size: 11px;
	color: rgba(240, 230, 210, .82);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.ap-ask-target-text {
	margin-top: 2px;
	font-size: 10px;
	color: rgba(240, 230, 210, .38);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.ap-ask-preview {
	margin: 8px 16px 0;
	max-height: 138px;
	overflow: hidden;
	border: 1px solid rgba(200, 170, 110, .16);
	border-radius: 5px;
	background: #01070b;
}
.ap-ask-preview img {
	display: block;
	width: 100%;
	max-height: 138px;
	object-fit: cover;
}
.ap-ask textarea {
	display: block;
	width: calc(100% - 32px);
	height: 92px;
	margin: 10px 16px 0;
	padding: 10px 11px;
	resize: none;
	border: 1px solid rgba(200, 170, 110, .18);
	border-radius: 5px;
	outline: none;
	background: rgba(1, 7, 11, .72);
	color: var(--ap-gold-bright);
	font-size: 13px;
	line-height: 1.55;
	transition: border-color .14s ease, box-shadow .14s ease;
}
.ap-ask textarea::placeholder { color: rgba(240, 230, 210, .26); }
.ap-ask textarea:focus {
	border-color: rgba(10, 200, 185, .56);
	box-shadow: 0 0 0 2px rgba(10, 200, 185, .08);
}
.ap-chips {
	display: flex;
	flex-wrap: wrap;
	gap: 5px;
	padding: 9px 16px 0;
}
.ap-chip {
	padding: 3px 8px;
	border: 1px solid rgba(200, 170, 110, .16);
	border-radius: 999px;
	background: rgba(200, 170, 110, .035);
	color: rgba(240, 230, 210, .56);
	font-size: 10px;
	letter-spacing: .02em;
	transition: color .12s ease, border-color .12s ease, background .12s ease;
	white-space: nowrap;
}
.ap-chip:hover { color: var(--ap-gold-bright); border-color: rgba(200, 170, 110, .5); background: rgba(200, 170, 110, .08); }
.ap-ask-session {
	padding: 0 16px 6px;
	font-size: 10px;
	letter-spacing: .03em;
	color: rgba(240, 230, 210, .45);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.ap-ask-session-select {
	max-width: 240px;
	margin-left: 4px;
	padding: 2px 6px;
	border: 1px solid rgba(200, 170, 110, .3);
	border-radius: 6px;
	background: rgba(3, 10, 16, .92);
	color: var(--ap-ink);
	font: inherit;
	font-size: 10px;
	vertical-align: middle;
}
.ap-ask-session-select:disabled { opacity: .55; }
.ap-ask-foot {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	padding: 12px 16px 14px;
}
.ap-ask-hint { font-size: 9.5px; color: rgba(240, 230, 210, .3); letter-spacing: .03em; }
.ap-send {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 7px 13px;
	border-radius: 4px;
	background: linear-gradient(135deg, #d8bc82, #a9864d);
	color: #071019;
	font-weight: 650;
	font-size: 11.5px;
	letter-spacing: .04em;
	box-shadow: 0 0 20px rgba(200, 170, 110, .12);
	transition: filter .12s ease, transform .12s ease;
}
.ap-send:hover { filter: brightness(1.08); }
.ap-send:active { transform: translateY(1px); }
.ap-send:disabled { opacity: .45; cursor: wait; filter: grayscale(.4); }
.ap-send svg { width: 13px; height: 13px; }
.ap-send .ap-spinner {
	width: 11px;
	height: 11px;
	border: 1.5px solid rgba(7, 16, 25, .28);
	border-top-color: #071019;
	border-radius: 50%;
	animation: ap-spin .7s linear infinite;
}

/* ---- settings ---- */
.ap-settings {
	position: fixed;
	left: 50%;
	top: 50%;
	z-index: 4;
	width: min(760px, calc(100vw - 26px));
	max-height: min(86vh, 820px);
	display: flex;
	flex-direction: column;
	opacity: 0;
	transform: translate(-50%, -48%) scale(.985);
	pointer-events: none;
	transition: opacity .16s ease, transform .18s cubic-bezier(.2, .9, .25, 1.1);
}
.ap-root.is-settings .ap-settings { opacity: 1; transform: translate(-50%, -50%); pointer-events: auto; }
.ap-settings .ap-card { display: flex; flex-direction: column; max-height: min(86vh, 820px); }
.ap-settings-body {
	flex: 1 1 auto;
	overflow: auto;
	padding: 4px 20px 20px;
	scrollbar-width: thin;
	scrollbar-color: rgba(200, 170, 110, .3) transparent;
}
.ap-settings-body::-webkit-scrollbar { width: 8px; }
.ap-settings-body::-webkit-scrollbar-thumb { background: rgba(200, 170, 110, .24); border-radius: 8px; }
.ap-section { padding: 16px 0 2px; border-bottom: 1px solid rgba(200, 170, 110, .1); }
.ap-section:last-child { border-bottom: 0; }
.ap-section-title {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 10px;
	font-size: 9px;
	letter-spacing: .24em;
	color: rgba(10, 200, 185, .8);
	text-transform: uppercase;
}
.ap-section-title::after { content: ""; flex: 1; height: 1px; background: linear-gradient(90deg, rgba(10, 200, 185, .16), transparent); }
.ap-field-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
	min-height: 38px;
	padding: 4px 0;
}
.ap-field-label { font-size: 12px; color: rgba(240, 230, 210, .78); }
.ap-field-note { margin-top: 1px; font-size: 9.5px; color: rgba(240, 230, 210, .3); }
.ap-key-btn {
	min-width: 64px;
	padding: 5px 10px;
	border: 1px solid rgba(200, 170, 110, .26);
	border-radius: 4px;
	background: rgba(200, 170, 110, .05);
	color: var(--ap-gold-bright);
	font-size: 11px;
	letter-spacing: .06em;
	transition: border-color .12s ease, background .12s ease;
}
.ap-key-btn:hover { border-color: rgba(200, 170, 110, .6); background: rgba(200, 170, 110, .1); }
.ap-key-btn.is-capturing { color: var(--ap-teal); border-color: rgba(10, 200, 185, .55); animation: ap-pulse 1s ease-in-out infinite; }
.ap-switch { position: relative; display: inline-flex; width: 34px; height: 18px; flex: 0 0 34px; }
.ap-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
.ap-switch span {
	position: absolute;
	inset: 0;
	border-radius: 999px;
	border: 1px solid rgba(200, 170, 110, .24);
	background: rgba(1, 7, 11, .72);
	transition: background .14s ease, border-color .14s ease;
}
.ap-switch span::after {
	content: "";
	position: absolute;
	left: 3px;
	top: 3px;
	width: 10px;
	height: 10px;
	border-radius: 50%;
	background: rgba(240, 230, 210, .42);
	transition: transform .14s ease, background .14s ease;
}
.ap-switch input:checked + span { background: rgba(10, 200, 185, .16); border-color: rgba(10, 200, 185, .55); }
.ap-switch input:checked + span::after { transform: translateX(16px); background: var(--ap-teal); box-shadow: 0 0 8px rgba(10, 200, 185, .6); }
.ap-range { width: 128px; accent-color: #c8aa6e; }
.ap-emote-list { display: flex; flex-direction: column; gap: 6px; }
.ap-emote-row {
	display: grid;
	grid-template-columns: 42px minmax(0, 1fr) auto;
	gap: 7px;
	align-items: center;
	padding: 6px;
	border: 1px solid rgba(200, 170, 110, .1);
	border-radius: 5px;
	background: rgba(200, 170, 110, .02);
}
.ap-emote-row.is-dragging { opacity: .5; }
.ap-emoji-input {
	width: 42px;
	height: 34px;
	text-align: center;
	font-size: 19px;
	border: 1px solid rgba(200, 170, 110, .14);
	border-radius: 4px;
	background: rgba(1, 7, 11, .6);
	outline: none;
}
.ap-emoji-input:focus { border-color: rgba(10, 200, 185, .5); }
.ap-emote-main { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.ap-input {
	width: 100%;
	padding: 5px 8px;
	border: 1px solid rgba(200, 170, 110, .12);
	border-radius: 3px;
	background: rgba(1, 7, 11, .56);
	color: rgba(240, 230, 210, .82);
	font-size: 11px;
	outline: none;
}
.ap-input:focus { border-color: rgba(10, 200, 185, .45); }
.ap-emote-actions { display: flex; gap: 2px; align-items: center; }
.ap-mini-btn {
	width: 24px;
	height: 26px;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 3px;
	color: rgba(240, 230, 210, .4);
	font-size: 12px;
	transition: color .12s ease, background .12s ease;
}
.ap-mini-btn:hover { color: var(--ap-gold-bright); background: rgba(200, 170, 110, .08); }
.ap-mini-btn.danger:hover { color: #ff7b7b; background: rgba(255, 91, 91, .08); }
.ap-mini-btn:disabled { opacity: .25; cursor: default; }
.ap-btn-row { display: flex; gap: 8px; flex-wrap: wrap; padding: 12px 0 16px; }
.ap-ghost-btn {
	padding: 6px 11px;
	border: 1px solid rgba(200, 170, 110, .22);
	border-radius: 4px;
	color: rgba(240, 230, 210, .66);
	font-size: 10.5px;
	letter-spacing: .02em;
	transition: color .12s ease, border-color .12s ease, background .12s ease;
}
.ap-ghost-btn:hover { color: var(--ap-gold-bright); border-color: rgba(200, 170, 110, .5); background: rgba(200, 170, 110, .05); }
.ap-ghost-btn.danger { color: rgba(255, 123, 123, .7); border-color: rgba(255, 91, 91, .18); }
.ap-ghost-btn.danger:hover { color: #ff9a9a; border-color: rgba(255, 91, 91, .45); background: rgba(255, 91, 91, .05); }
.ap-settings-foot {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 11px 20px;
	border-top: 1px solid rgba(200, 170, 110, .12);
	background: rgba(1, 7, 11, .4);
	font-size: 9.5px;
	color: rgba(240, 230, 210, .3);
}
.ap-done {
	padding: 6px 14px;
	border-radius: 4px;
	background: linear-gradient(135deg, #d8bc82, #a9864d);
	color: #071019;
	font-weight: 650;
	font-size: 11px;
}

/* ---- feed ---- */
.ap-feed {
	position: fixed;
	right: 14px;
	bottom: 14px;
	z-index: 2;
	pointer-events: auto;
	opacity: 0;
	transform: translateY(6px);
	transition: opacity .16s ease, transform .16s ease;
}
.ap-root.is-feed .ap-feed { opacity: 1; transform: none; }
.ap-root.is-active .ap-feed { opacity: 0; pointer-events: none; }
.ap-feed-toggle {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	padding: 5px 9px;
	border: 1px solid rgba(200, 170, 110, .2);
	border-radius: 999px;
	background: rgba(2, 9, 14, .78);
	backdrop-filter: blur(8px);
	color: rgba(240, 230, 210, .55);
	font-size: 9.5px;
	letter-spacing: .08em;
	box-shadow: 0 5px 20px rgba(0, 0, 0, .3);
	transition: color .12s ease, border-color .12s ease;
}
.ap-feed-toggle:hover { color: var(--ap-gold-bright); border-color: rgba(200, 170, 110, .5); }
.ap-feed-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--ap-teal); box-shadow: 0 0 7px var(--ap-teal); }
.ap-feed-count { color: var(--ap-gold); }
.ap-feed-list {
	position: absolute;
	right: 0;
	bottom: 32px;
	width: 248px;
	max-height: 270px;
	overflow: auto;
	padding: 5px;
	border: 1px solid rgba(200, 170, 110, .2);
	border-radius: 6px;
	background: rgba(3, 10, 15, .92);
	backdrop-filter: blur(10px);
	box-shadow: 0 18px 50px rgba(0, 0, 0, .55);
	opacity: 0;
	transform: translateY(4px);
	pointer-events: none;
	transition: opacity .12s ease, transform .12s ease;
}
.ap-feed:hover .ap-feed-list, .ap-feed.is-open .ap-feed-list { opacity: 1; transform: none; pointer-events: auto; }
.ap-feed-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	padding: 3px 5px 6px;
	font-size: 9px;
	letter-spacing: .12em;
	color: rgba(240, 230, 210, .38);
}
.ap-feed-clear {
	flex: 0 0 auto;
	padding: 2px 8px;
	border: 1px solid rgba(200, 170, 110, .22);
	border-radius: 999px;
	font-size: 9px;
	letter-spacing: .04em;
	color: rgba(240, 230, 210, .5);
	transition: color .12s ease, border-color .12s ease, background .12s ease;
}
.ap-feed-clear:hover { color: var(--ap-gold-bright); border-color: rgba(200, 170, 110, .5); background: rgba(200, 170, 110, .08); }
.ap-feed-row {
	display: flex;
	align-items: center;
	gap: 8px;
	width: 100%;
	padding: 6px 7px;
	border-radius: 4px;
	text-align: left;
	transition: background .12s ease;
}
.ap-feed-row:hover { background: rgba(200, 170, 110, .07); }
.ap-feed-emoji { width: 22px; flex: 0 0 22px; font-size: 14px; text-align: center; }
.ap-feed-icon { width: 22px; flex: 0 0 22px; display: flex; justify-content: center; color: var(--ap-color, #c8aa6e); }
.ap-feed-icon svg { width: 15px; height: 15px; }
.ap-feed-main { min-width: 0; flex: 1; }
.ap-feed-label { font-size: 10.5px; color: rgba(240, 230, 210, .74); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ap-feed-time { font-size: 8.5px; color: rgba(240, 230, 210, .28); }
.ap-feed-empty { padding: 10px; font-size: 10px; color: rgba(240, 230, 210, .3); text-align: center; }

/* ---- toast / ripple ---- */
.ap-toast {
	position: fixed;
	left: 50%;
	bottom: 26px;
	z-index: 10;
	transform: translate(-50%, 8px);
	max-width: min(520px, calc(100vw - 28px));
	padding: 8px 14px;
	border: 1px solid rgba(10, 200, 185, .28);
	border-radius: 5px;
	background: rgba(2, 10, 15, .94);
	backdrop-filter: blur(10px);
	box-shadow: 0 10px 40px rgba(0, 0, 0, .5);
	color: rgba(240, 230, 210, .85);
	font-size: 11px;
	letter-spacing: .02em;
	opacity: 0;
	pointer-events: none;
	transition: opacity .16s ease, transform .18s ease;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.ap-toast.is-visible { opacity: 1; transform: translate(-50%, 0); }
.ap-toast.is-error { border-color: rgba(255, 91, 91, .42); color: #ffb1b1; }
.ap-ripple { position: fixed; z-index: 2; pointer-events: none; }
.ap-ripple-ring {
	position: absolute;
	left: 0;
	top: 0;
	width: 18px;
	height: 18px;
	margin: -9px;
	border: 2px solid var(--ap-color, #c8aa6e);
	border-radius: 50%;
	opacity: 0;
	animation: ap-ripple 1.35s cubic-bezier(.17, .67, .3, 1) forwards;
}
.ap-ripple-ring:nth-child(2) { animation-delay: .12s; }
.ap-ripple-ring:nth-child(3) { animation-delay: .24s; }
.ap-ripple-icon {
	position: absolute;
	left: -18px;
	top: -18px;
	width: 36px;
	height: 36px;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
	border: 1px solid color-mix(in srgb, var(--ap-color, #c8aa6e) 65%, transparent);
	background: rgba(2, 9, 14, .88);
	color: var(--ap-color, #c8aa6e);
	box-shadow: 0 0 24px color-mix(in srgb, var(--ap-color, #c8aa6e) 28%, transparent);
	animation: ap-pop .28s cubic-bezier(.2, .9, .25, 1.25);
}
.ap-ripple-icon svg { width: 20px; height: 20px; }
.ap-ripple-icon .ap-emoji { font-size: 19px; line-height: 1; }
.ap-ripple-label {
	position: absolute;
	left: 50%;
	top: 28px;
	transform: translateX(-50%);
	white-space: nowrap;
	padding: 2px 6px;
	border-radius: 2px;
	background: rgba(2, 8, 12, .72);
	font-size: 9px;
	letter-spacing: .08em;
	color: var(--ap-color, #c8aa6e);
	animation: ap-fade-up .3s ease;
}

@keyframes ap-spin { to { transform: rotate(360deg); } }
@keyframes ap-spin-reverse { to { transform: rotate(-360deg); } }
@keyframes ap-ripple {
	0% { transform: scale(.55); opacity: .95; }
	70% { opacity: .22; }
	100% { transform: scale(6.8); opacity: 0; }
}
@keyframes ap-pop { from { transform: scale(.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes ap-fade-up { from { opacity: 0; transform: translate(-50%, 4px); } to { opacity: 1; transform: translate(-50%, 0); } }
@keyframes ap-pulse { 50% { box-shadow: 0 0 0 3px rgba(10, 200, 185, .08); } }

/* The global overlay is a transparent full-screen window. Keep the same look
   but drop expensive compositing: no backdrop blur, no rotating rune rings,
   no per-sector drop shadows. */
.ap-root.ap-global .ap-scrim { backdrop-filter: none; }
.ap-root.ap-global .ap-wheel::before { backdrop-filter: none; }
.ap-root.ap-global .ap-orbit.one,
.ap-root.ap-global .ap-orbit.two { animation: none; }
.ap-root.ap-global .ap-sector { transition: fill .08s linear, stroke-opacity .08s linear; }
.ap-root.ap-global .ap-sector.is-hover { filter: none; }
.ap-root.ap-global .ap-sector-item { transition: transform .08s linear, color .08s linear; }
.ap-root.ap-global .ap-sector-icon { filter: none; }
.ap-root.ap-global .ap-pointer { box-shadow: none; }
.ap-root.ap-global .ap-target { box-shadow: none; }
.ap-root.ap-global .ap-hub { box-shadow: 0 0 0 4px rgba(200, 170, 110, .04), 0 0 16px rgba(0, 0, 0, .4); }
.ap-root.ap-global .ap-ripple-icon { box-shadow: none; }
.ap-root.ap-global .ap-card { box-shadow: 0 18px 50px rgba(0, 0, 0, .55); }

@media (max-width: 560px) {
	.ap-ask { width: calc(100vw - 18px); }
	.ap-settings { width: calc(100vw - 16px); }
	.ap-emote-row { grid-template-columns: 38px minmax(0, 1fr) auto; }
	.ap-feed-list { width: 220px; }
}
@media (prefers-reduced-motion: reduce) {
	.ap-root *, .ap-root *::before, .ap-root *::after {
		animation-duration: .001ms !important;
		animation-iteration-count: 1 !important;
		transition-duration: .001ms !important;
	}
}
`;
			document.head.appendChild(style);
		}

		class AgentPing {
			constructor(ctx, options = {}) {
				this.ctx = ctx;
				this.globalMode = Boolean(options.globalMode);
				this.settings = loadSettings();
				this.sessionId = null;
				this.globalSessions = [];
				this.bridgeStarted = false;
				this.bridgeEpoch = 0;
				this.bridgeSource = null;
				this.bridgeTimer = null;
				this.externalQueue = [];
				this.root = null;
				this.lastPointer = { x: innerWidth / 2, y: innerHeight / 2 };
				this.wheel = null;
				this.askState = null;
				this.pickerState = null;
				this.pickerPos = null;
				this.targetDrag = null;
				this.settingsOpen = false;
				this.pending = null;
				this.toastTimer = null;
				this.audio = null;
				this.capturingKey = null;
				this.pointerRaf = null;
				this.pointerPending = null;
				this.bridgePort = 0;
				this.focusTimer = null;
				this.recent = this.settings.feed.slice(0, 20);
				this.bound = {
					keydown: (event) => this.onKeyDown(event),
					keyup: (event) => this.onKeyUp(event),
					pointermove: (event) => this.onPointerMove(event),
					pointerdown: (event) => this.onPointerDown(event),
					pointerup: (event) => this.onPointerUp(event),
					contextmenu: (event) => this.onContextMenu(event),
					resize: () => this.onResize(),
					blur: () => this.onBlur(),
					focus: () => this.onWindowFocus(),
					windowBlur: () => this.onWindowBlur(),
					visibility: () => this.onVisibility(),
					targetDown: (event) => this.onTargetPointerDown(event),
					targetMove: (event) => this.onTargetPointerMove(event),
					targetUp: (event) => this.onTargetPointerUp(event)
				};
			}

			mount() {
				if (this.root) return;
				injectStyles();
				const root = document.createElement("div");
				root.setAttribute(ROOT_ATTR, "");
				root.className = this.globalMode ? "ap-root ap-global" : "ap-root";
				root.innerHTML = `
<div class="ap-scrim" data-ap-scrim></div>
<div class="ap-spot" data-ap-spot>
	<div class="ap-spot-panel" data-ap-spot-panel="top"></div>
	<div class="ap-spot-panel" data-ap-spot-panel="bottom"></div>
	<div class="ap-spot-panel" data-ap-spot-panel="left"></div>
	<div class="ap-spot-panel" data-ap-spot-panel="right"></div>
</div>
<div class="ap-target" data-ap-target>
	<span class="ap-corner tl"></span><span class="ap-corner tr"></span><span class="ap-corner bl"></span><span class="ap-corner br"></span>
	<span class="ap-resize tl" data-ap-resize="tl"></span><span class="ap-resize tr" data-ap-resize="tr"></span>
	<span class="ap-resize bl" data-ap-resize="bl"></span><span class="ap-resize br" data-ap-resize="br"></span>
	<span class="ap-target-tag" data-ap-target-tag></span>
</div>
<div class="ap-wheel" data-ap-wheel>
	<div class="ap-orbit one"></div>
	<div class="ap-orbit two"></div>
	<svg class="ap-sectors" data-ap-sectors viewBox="0 0 520 520" aria-hidden="true"></svg>
	<div class="ap-sector-items" data-ap-items></div>
	<div class="ap-pointer" data-ap-pointer></div>
	<div class="ap-hub" data-ap-hub>
		<div class="ap-hub-kicker" data-ap-hub-kicker>AGENT PING</div>
		<div class="ap-hub-title" data-ap-hub-title>PING</div>
		<div class="ap-hub-sub" data-ap-hub-sub>移动选择 · 点击释放</div>
		<button class="ap-hub-gear" type="button" data-ap-settings-trigger title="设置">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.62 1.62-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-2.3v-.08a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.62-1.62.06-.06A1.7 1.7 0 0 0 8.4 15a1.7 1.7 0 0 0-1.56-1.03H6.7v-2.3h.14A1.7 1.7 0 0 0 8.4 10.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.62-1.62.06.06A1.7 1.7 0 0 0 11.56 7.4 1.7 1.7 0 0 0 12.6 5.84V5.7h2.3v.14a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.62 1.62-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03h.14v2.3h-.14A1.7 1.7 0 0 0 19.4 15Z"/></svg>
			<span>设置</span>
		</button>
	</div>
	<div class="ap-wheel-mode" data-ap-mode>SMART PING</div>
	<div class="ap-wheel-hint" data-ap-hint><b>移动</b> 选择 · <b>点击</b> 释放 · <b>Esc</b> 取消</div>
</div>
<div class="ap-cursor" data-ap-cursor></div>
<div class="ap-ask" data-ap-ask role="dialog" aria-modal="true" aria-label="对标记位置提问"></div>
<div class="ap-picker" data-ap-picker role="dialog" aria-modal="true" aria-label="选择会话"></div>
<div class="ap-settings" data-ap-settings role="dialog" aria-modal="true" aria-label="信号轮盘设置"></div>
<div class="ap-feed" data-ap-feed></div>
<div class="ap-toast" data-ap-toast role="status" aria-live="polite"></div>
<div class="ap-ripples" data-ap-ripples></div>
`;
				document.body.appendChild(root);
				this.root = root;
				this.el = {
					scrim: root.querySelector("[data-ap-scrim]"),
					spot: root.querySelector("[data-ap-spot]"),
					target: root.querySelector("[data-ap-target]"),
					targetTag: root.querySelector("[data-ap-target-tag]"),
					wheel: root.querySelector("[data-ap-wheel]"),
					sectors: root.querySelector("[data-ap-sectors]"),
					items: root.querySelector("[data-ap-items]"),
					pointer: root.querySelector("[data-ap-pointer]"),
					hub: root.querySelector("[data-ap-hub]"),
					hubKicker: root.querySelector("[data-ap-hub-kicker]"),
					hubTitle: root.querySelector("[data-ap-hub-title]"),
					hubSub: root.querySelector("[data-ap-hub-sub]"),
					mode: root.querySelector("[data-ap-mode]"),
					hint: root.querySelector("[data-ap-hint]"),
					cursor: root.querySelector("[data-ap-cursor]"),
					ask: root.querySelector("[data-ap-ask]"),
					picker: root.querySelector("[data-ap-picker]"),
					settings: root.querySelector("[data-ap-settings]"),
					feed: root.querySelector("[data-ap-feed]"),
					toast: root.querySelector("[data-ap-toast]"),
					ripples: root.querySelector("[data-ap-ripples]")
				};
				window.addEventListener("keydown", this.bound.keydown, true);
				window.addEventListener("keyup", this.bound.keyup, true);
				window.addEventListener("pointermove", this.bound.pointermove, true);
				window.addEventListener("pointerdown", this.bound.pointerdown, true);
				window.addEventListener("pointerup", this.bound.pointerup, true);
				window.addEventListener("contextmenu", this.bound.contextmenu, true);
				window.addEventListener("resize", this.bound.resize);
				window.addEventListener("blur", this.bound.blur);
				document.addEventListener("visibilitychange", this.bound.visibility);
				window.addEventListener("focus", this.bound.focus);
				window.addEventListener("blur", this.bound.windowBlur);
				this.el.target.addEventListener("pointerdown", this.bound.targetDown);
				window.addEventListener("pointermove", this.bound.targetMove, true);
				window.addEventListener("pointerup", this.bound.targetUp, true);
				this.renderFeed();
				this.updateFeedVisibility();
			}

			dispose() {
				this.stopBridge();
				this.reportFocus(false);
				this.stopKeyCapture();
				if (this.focusTimer) clearInterval(this.focusTimer);
				this.focusTimer = null;
				window.removeEventListener("focus", this.bound.focus);
				window.removeEventListener("blur", this.bound.windowBlur);
				window.removeEventListener("pointermove", this.bound.targetMove, true);
				window.removeEventListener("pointerup", this.bound.targetUp, true);
				if (this.pointerRaf != null) cancelAnimationFrame(this.pointerRaf);
				this.pointerRaf = null;
				this.pointerPending = null;
				if (this.pending) clearTimeout(this.pending.timer);
				if (this.toastTimer) clearTimeout(this.toastTimer);
				if (this.audio) {
					try { this.audio.close(); } catch {}
					this.audio = null;
				}
				if (this.root) {
					this.root.remove();
					this.root = null;
				}
				window.removeEventListener("keydown", this.bound.keydown, true);
				window.removeEventListener("keyup", this.bound.keyup, true);
				window.removeEventListener("pointermove", this.bound.pointermove, true);
				window.removeEventListener("pointerdown", this.bound.pointerdown, true);
				window.removeEventListener("pointerup", this.bound.pointerup, true);
				window.removeEventListener("contextmenu", this.bound.contextmenu, true);
				window.removeEventListener("resize", this.bound.resize);
				window.removeEventListener("blur", this.bound.blur);
				document.removeEventListener("visibilitychange", this.bound.visibility);
			}

			bindSession(sessionId) {
				if (typeof sessionId !== "string" || !sessionId) return;
				this.sessionId = sessionId;
				this.updateFeedVisibility();
				this.flushExternal();
				this.publishSessions();
			}

			startBridge() {
				if (this.globalMode || this.bridgeStarted) return;
				this.bridgeStarted = true;
				this.bridgeEpoch += 1;
				this.connectBridge(this.bridgeEpoch);
			}

			stopBridge() {
				this.bridgeEpoch += 1;
				if (this.sessionTimer) {
					clearInterval(this.sessionTimer);
					this.sessionTimer = null;
				}
				if (this.focusTimer) {
					clearInterval(this.focusTimer);
					this.focusTimer = null;
				}
				if (this.bridgeTimer) {
					clearTimeout(this.bridgeTimer);
					this.bridgeTimer = null;
				}
				if (this.bridgeSource) {
					try { this.bridgeSource.close(); } catch {}
					this.bridgeSource = null;
				}
			}

			async findBridgePort() {
				const ports = [];
				for (let index = 0; index < 12; index += 1) ports.push(47654 + index);
				const pagePort = Number(location.port) || (location.protocol === "https:" ? 443 : 80);
				const probes = ports.map(async (port) => {
					const controller = typeof AbortController === "function" ? new AbortController() : null;
					const timer = setTimeout(() => {
						try { controller?.abort(); } catch {}
					}, 420);
					try {
						const response = await fetch("http://127.0.0.1:" + port + "/health", {
							cache: "no-store",
							signal: controller ? controller.signal : undefined
						});
						const data = await response.json();
						if (!data || data.service !== "dsh-agent-ping") return 0;
						if (data.webPort && pagePort && Number(data.webPort) !== pagePort) return 0;
						return port;
					} catch {
						return 0;
					} finally {
						clearTimeout(timer);
					}
				});
				const found = await Promise.all(probes);
				return found.find((port) => port > 0) || 0;
			}

			async connectBridge(epoch) {
				if (epoch !== this.bridgeEpoch || this.globalMode) return;
				if (typeof EventSource !== "function") return;
				const port = await this.findBridgePort();
				if (epoch !== this.bridgeEpoch) return;
				if (!port) {
					this.bridgeTimer = setTimeout(() => this.connectBridge(epoch), 4500);
					return;
				}
				this.bridgePort = port;
				this.publishSessions();
				if (!this.sessionTimer) {
					this.sessionTimer = setInterval(() => this.publishSessions(), 8000);
				}
				this.reportFocus(this.pageFocused());
				try {
					const source = new EventSource("http://127.0.0.1:" + port + "/events");
					this.bridgeSource = source;
					source.onmessage = (event) => {
						try {
							const data = JSON.parse(event.data);
							if (data && data.type === "signal") this.receiveExternalSignal(data);
						} catch {}
					};
					source.onerror = () => {
						try { source.close(); } catch {}
						if (this.bridgeSource === source) this.bridgeSource = null;
						if (epoch === this.bridgeEpoch) {
							this.bridgeTimer = setTimeout(() => this.connectBridge(epoch), 4000);
						}
					};
				} catch {
					this.bridgeTimer = setTimeout(() => this.connectBridge(epoch), 4500);
				}
			}

			receiveExternalSignal(payload) {
				if (!payload || typeof payload.prompt !== "string" || !payload.prompt.trim()) return;
				const item = {
					id: payload.id || "global",
					label: payload.label || "全局信号",
					emoji: payload.emoji || "🖥️",
					color: payload.color || "#62b6ff",
					icon: payload.icon || "flag",
					command: ""
				};
				const target = payload.target && typeof payload.target === "object" ? payload.target : {};
				this.ripple(target, item);
				if (!this.sessionId) {
					this.externalQueue.push({ payload, target, item });
					while (this.externalQueue.length > 20) this.externalQueue.shift();
					this.toast("全局信号已排队 · 等待活动会话");
					return;
				}
				this.toast("收到全局信号 · " + item.label);
				this.sendPrompt(payload.prompt, item, target, payload.sessionId || this.sessionId);
			}

			flushExternal() {
				if (!this.sessionId || this.externalQueue.length === 0) return;
				const queued = this.externalQueue.splice(0);
				for (const entry of queued) {
					this.sendPrompt(entry.payload.prompt, entry.item, entry.target, entry.payload.sessionId || this.sessionId);
				}
			}

			setRootState(kind) {
				if (!this.root) return;
				this.root.classList.toggle("is-active", Boolean(kind));
				this.root.classList.toggle("is-wheel", kind === "wheel");
				this.root.classList.toggle("is-ask", kind === "ask");
				this.root.classList.toggle("is-picker", kind === "picker");
				this.root.classList.toggle("is-settings", kind === "settings");
			}

			openWheel(mode, point, target) {
				if (!this.root) return;
				this.hideToast();
				if (this.askState) this.closeAsk();
				if (this.settingsOpen) this.closeSettings();
				if (this.wheel) this.closeWheel(true);
				const now = Date.now();
				const centerPoint = point || this.lastPointer || { x: innerWidth / 2, y: innerHeight / 2 };
				const radius = this.getRadiusForPoint(centerPoint);
				// The wheel center is always the pointer. Near a screen edge the
				// radius shrinks a little instead of moving the center away.
				const center = { x: centerPoint.x, y: centerPoint.y };
				const items = mode === "emote" ? this.getEmoteItems() : PINGS.slice();
				const captured = target || captureTarget(centerPoint.x, centerPoint.y);
				this.wheel = {
					mode,
					key: mode === "emote" ? this.settings.emoteKey : this.settings.pingKey,
					items,
					center,
					radius,
					point: centerPoint,
					target: captured,
					hover: -1,
					down: false,
					fired: false,
					startedAt: now
				};
				this.renderWheel();
				this.el.wheel.style.setProperty("--ap-r", radius + "px");
				this.el.wheel.style.setProperty("--ap-x", center.x + "px");
				this.el.wheel.style.setProperty("--ap-y", center.y + "px");
				this.el.cursor.style.left = centerPoint.x + "px";
				this.el.cursor.style.top = centerPoint.y + "px";
				this.root.style.setProperty("--ap-x", center.x + "px");
				this.root.style.setProperty("--ap-y", center.y + "px");
				this.showTarget(captured, items[0] && items[0].color);
				this.setRootState("wheel");
				this.renderFeed();
				this.playSound("open", mode);
				this.setHover(this.getHovered(centerPoint.x, centerPoint.y));
			}

			getRadius() {
				return Math.max(132, Math.min(246, innerWidth / 2 - 18, innerHeight / 2 - 24));
			}

			getRadiusForPoint(point) {
				const base = this.getRadius();
				const edge = Math.min(point.x, innerWidth - point.x, point.y, innerHeight - point.y) - 10;
				return Math.max(118, Math.min(base, edge));
			}

			clampPoint(point, radius) {
				const margin = radius + 16;
				let x = Number(point.x);
				let y = Number(point.y);
				if (!Number.isFinite(x)) x = innerWidth / 2;
				if (!Number.isFinite(y)) y = innerHeight / 2;
				if (innerWidth < margin * 2) x = innerWidth / 2;
				else x = clamp(x, margin, innerWidth - margin);
				if (innerHeight < margin * 2) y = innerHeight / 2;
				else y = clamp(y, margin, innerHeight - margin);
				return { x, y };
			}

			getEmoteItems() {
				const result = [];
				for (let index = 0; index < MAX_EMOTES; index += 1) {
					const emote = this.settings.emotes[index];
					if (emote) {
						result.push({
							id: "emote-" + index,
							label: emote.label,
							sub: "EMOTE",
							color: COLORS[index % COLORS.length],
							emoji: emote.emoji,
							command: emote.command,
							emote,
							index
						});
					} else {
						result.push({
							id: "emote-empty-" + index,
							label: "添加",
							sub: "EMPTY",
							color: "#5e6875",
							emoji: "＋",
							command: "",
							empty: true,
							index
						});
					}
				}
				return result;
			}

			renderWheel() {
				const wheel = this.wheel;
				if (!wheel) return;
				const { items, mode } = wheel;
				const count = items.length;
				const gap = count > 1 ? 2.4 : 2;
				const paths = [];
				for (let index = 0; index < count; index += 1) {
					const item = items[index];
					paths.push(
						'<path class="ap-sector" data-ap-sector="' + index + '" d="' +
						buildWheelPath(index, count, 260, 260, 86, 246, gap) +
						'" style="--ap-color:' + esc(item.color) + '"></path>'
					);
				}
				this.el.sectors.innerHTML = paths.join("");
				const itemRadius = wheel.radius * 0.585;
				const itemMarkup = items.map((item, index) => {
					const angle = (-90 + index * (360 / count)) * (Math.PI / 180);
					const left = wheel.radius + Math.cos(angle) * itemRadius;
					const top = wheel.radius + Math.sin(angle) * itemRadius;
					const icon = item.emoji
						? '<span class="ap-emoji">' + esc(item.emoji) + "</span>"
						: iconHtml(item.icon);
					return (
						'<div class="ap-sector-item' + (item.empty ? " is-empty" : "") + '" data-ap-item="' + index + '" style="left:' + left + "px;top:" + top + "px;--ap-color:" + esc(item.color) + '">' +
						'<div class="ap-sector-icon">' + icon + "</div>" +
						'<span class="ap-sector-label">' + esc(item.label) + "</span>" +
						'<span class="ap-sector-sub">' + esc(item.sub) + "</span>" +
						"</div>"
					);
				});
				this.el.items.innerHTML = itemMarkup.join("");
				this.sectorNodes = Array.from(this.el.sectors.querySelectorAll("[data-ap-sector]"));
				this.itemNodes = Array.from(this.el.items.querySelectorAll("[data-ap-item]"));
				const clickMode = this.globalMode || isCombo(wheel.key);
				this.el.mode.textContent = mode === "emote" ? "EMOTE WHEEL" : "SMART PING";
				this.el.hint.innerHTML = clickMode
					? mode === "emote"
						? "<b>移动</b> 选择 · <b>点击</b> 执行快捷指令 · <b>Esc</b> 取消"
						: "<b>移动</b> 选择 · <b>点击</b> 释放信号 · <b>Esc</b> 取消"
					: mode === "emote"
						? "<b>拖动</b> 选择 · <b>松开</b> 执行快捷指令 · <b>Esc</b> 取消"
						: "<b>拖动</b> 选择 · <b>松开</b> 释放信号 · <b>Esc</b> 取消";
				this.el.hubKicker.textContent = mode === "emote" ? "AGENT EMOTE" : "AGENT PING";
				this.el.hubTitle.textContent = mode === "emote" ? "表情指令" : displayKey(wheel.key);
				this.el.hubSub.textContent = clickMode
					? mode === "emote" ? "点击执行" : "移动选择"
					: mode === "emote" ? "松开执行" : "拖动选择";
				this.el.wheel.querySelector(".ap-hub-gear").style.display = "";
			}

			setHover(index) {
				const wheel = this.wheel;
				if (!wheel) return;
				if (index < 0 || index >= wheel.items.length) index = -1;
				if (wheel.hover === index) return;
				wheel.hover = index;
				const sectors = this.sectorNodes || (this.sectorNodes = Array.from(this.el.sectors.querySelectorAll("[data-ap-sector]")));
				const items = this.itemNodes || (this.itemNodes = Array.from(this.el.items.querySelectorAll("[data-ap-item]")));
				sectors.forEach((node, i) => node.classList.toggle("is-hover", i === index));
				items.forEach((node, i) => node.classList.toggle("is-hover", i === index));
				const item = index >= 0 ? wheel.items[index] : null;
				const clickMode = this.globalMode || isCombo(wheel.key);
				if (item) {
					this.el.hubTitle.textContent = item.label;
					this.el.hubSub.textContent = item.empty
						? "点击打开设置"
						: wheel.mode === "emote"
							? clickMode ? "点击执行" : "松开执行"
							: item.ask
								? clickMode ? "点击后提问" : "松开后提问"
								: clickMode ? "点击释放" : "松开释放";
					this.el.cursor.style.setProperty("--ap-color", item.color);
					this.el.pointer.style.setProperty("--ap-color", item.color);
					this.el.wheel.style.setProperty("--ap-color", item.color);
					if (this.el.target.classList.contains("is-visible")) this.el.target.style.setProperty("--ap-color", item.color);
					if (index !== wheel.lastSoundHover) {
						wheel.lastSoundHover = index;
						if (!this.globalMode) this.playSound("hover", wheel.mode);
					}
				} else {
					this.el.hubTitle.textContent = wheel.mode === "emote" ? "表情指令" : displayKey(wheel.key);
					this.el.hubSub.textContent = clickMode
						? wheel.mode === "emote" ? "点击执行" : "移动选择"
						: wheel.mode === "emote" ? "松开执行" : "拖动选择";
					this.el.cursor.style.removeProperty("--ap-color");
					this.el.pointer.style.removeProperty("--ap-color");
					this.el.wheel.style.removeProperty("--ap-color");
				}
			}

			getHovered(x, y) {
				const wheel = this.wheel;
				if (!wheel) return -1;
				const dx = x - wheel.center.x;
				const dy = y - wheel.center.y;
				const distance = Math.hypot(dx, dy);
				if (distance < wheel.radius * 0.28) return -1;
				const step = 360 / wheel.items.length;
				const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
				let index = Math.round((angle + 90) / step);
				index = ((index % wheel.items.length) + wheel.items.length) % wheel.items.length;
				return index;
			}

			updatePointer(x, y) {
				const wheel = this.wheel;
				if (!wheel) return;
				const dx = x - wheel.center.x;
				const dy = y - wheel.center.y;
				const distance = Math.min(Math.hypot(dx, dy), wheel.radius * 0.96);
				const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
				this.el.pointer.style.width = distance + "px";
				this.el.pointer.style.transform = "rotate(" + angle + "deg)";
				this.el.cursor.style.left = x + "px";
				this.el.cursor.style.top = y + "px";
			}

			onPointerMove(event) {
				this.lastPointer = { x: event.clientX, y: event.clientY };
				if (!this.wheel || this.askState || this.settingsOpen) return;
				this.pointerPending = { x: event.clientX, y: event.clientY };
				if (this.pointerRaf != null) return;
				this.pointerRaf = requestAnimationFrame(() => {
					this.pointerRaf = null;
					const point = this.pointerPending;
					this.pointerPending = null;
					if (!point || !this.wheel || this.askState || this.settingsOpen) return;
					this.updatePointer(point.x, point.y);
					this.setHover(this.getHovered(point.x, point.y));
				});
			}

			onPointerDown(event) {
				if (!this.wheel) return;
				if (event.button === 2) {
					this.closeWheel();
					return;
				}
				if (event.button !== 0) return;
				const target = event.target;
				if (target && target.closest && target.closest("[data-ap-settings-trigger]")) return;
				if (target && target.closest && target.closest("[data-ap-scrim]")) return;
				this.wheel.down = true;
				event.preventDefault();
			}

			onPointerUp(event) {
				if (event.button !== 0) {
					if (event.button === 2) {
						if (this.wheel) this.closeWheel();
						else if (this.askState) this.closeAsk();
						else if (this.settingsOpen) this.closeSettings();
					}
					return;
				}
				const target = event.target;
				if (!this.wheel) {
					if (target && target.closest && target.closest("[data-ap-scrim]")) {
						if (this.pickerState) this.closePicker();
						else if (this.askState) this.closeAsk();
						else if (this.settingsOpen) this.closeSettings();
					}
					return;
				}
				if (target && target.closest && target.closest("[data-ap-settings-trigger]")) {
					this.openSettings();
					return;
				}
				if (this.wheel.down) {
					if (this.wheel.hover >= 0) this.fireWheel();
					else this.closeWheel();
					return;
				}
				if (target && target.closest && target.closest("[data-ap-scrim]")) this.closeWheel();
			}

			onContextMenu(event) {
				if (!this.wheel && !this.askState && !this.settingsOpen) return;
				event.preventDefault();
				event.stopPropagation();
				if (this.wheel) this.closeWheel();
				else if (this.askState) this.closeAsk();
				else this.closeSettings();
			}

			onKeyDown(event) {
				if (event.key === "Escape") {
					if (this.pickerState) {
						event.preventDefault();
						event.stopPropagation();
						this.closePicker();
						return;
					}
					if (this.settingsOpen) {
						event.preventDefault();
						event.stopPropagation();
						this.closeSettings();
						return;
					}
					if (this.askState) {
						event.preventDefault();
						event.stopPropagation();
						this.closeAsk();
						return;
					}
					if (this.wheel) {
						event.preventDefault();
						event.stopPropagation();
						this.closeWheel();
						return;
					}
				}

				if (this.globalMode) return;
				if (this.capturingKey) return;

				if (keyMatches(event, this.settings.settingsKey)) {
					event.preventDefault();
					event.stopPropagation();
					this.openSettings();
					return;
				}

				if (this.settingsOpen || this.askState) return;

				if (this.wheel) {
					if (event.repeat) return;
					if (event.key === "ArrowRight" || event.key === "ArrowDown") {
						event.preventDefault();
						event.stopPropagation();
						this.setHover((this.wheel.hover + 1 + this.wheel.items.length) % this.wheel.items.length);
						return;
					}
					if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
						event.preventDefault();
						event.stopPropagation();
						this.setHover((this.wheel.hover - 1 + this.wheel.items.length) % this.wheel.items.length);
						return;
					}
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						event.stopPropagation();
						if (this.wheel.hover >= 0) this.fireWheel();
						return;
					}
					if (keyMatches(event, this.wheel.key)) {
						event.preventDefault();
						event.stopPropagation();
					}
					return;
				}

				if (this.pending && !keyMatches(event, this.pending.key)) {
					this.cancelPending();
				}
				if (event.repeat) return;
				if (keyMatches(event, this.settings.pingKey)) {
					const key = this.settings.pingKey;
					if (!isCombo(key) && normalizeKey(key) !== "Alt" && isEditable(document.activeElement)) return;
					event.preventDefault();
					event.stopPropagation();
					if (isCombo(key)) this.openFromHotkey("ping", key);
					else this.startPending("ping", key);
					return;
				}
				if (keyMatches(event, this.settings.emoteKey)) {
					const key = this.settings.emoteKey;
					if (!isCombo(key) && isEditable(document.activeElement)) return;
					event.preventDefault();
					event.stopPropagation();
					if (isCombo(key)) this.openFromHotkey("emote", key);
					else this.startPending("emote", key);
				}
			}

			openFromHotkey(mode, key) {
				if (document.visibilityState === "hidden") return;
				const target = captureTarget(this.lastPointer.x, this.lastPointer.y);
				this.openWheel(mode, this.lastPointer, target);
			}

			onKeyUp(event) {
				if (this.globalMode) return;
				if (this.pending && keyMatches(event, this.pending.key)) {
					this.cancelPending();
					event.preventDefault();
					event.stopPropagation();
					return;
				}
				if (!this.wheel) return;
				if (isCombo(this.wheel.key)) return;
				if (keyMatches(event, this.wheel.key)) {
					event.preventDefault();
					event.stopPropagation();
					if (this.wheel.hover >= 0) this.fireWheel();
					else this.closeWheel();
				}
			}

			startPending(mode, key) {
				this.cancelPending();
				this.pending = {
					mode,
					key,
					startedAt: Date.now(),
					timer: setTimeout(() => {
						const pending = this.pending;
						this.pending = null;
						if (!pending) return;
						if (document.visibilityState === "hidden") return;
						const target = captureTarget(this.lastPointer.x, this.lastPointer.y);
						this.openWheel(pending.mode, this.lastPointer, target);
					}, 125)
				};
			}

			cancelPending() {
				if (this.pending) {
					clearTimeout(this.pending.timer);
					this.pending = null;
				}
			}

			onResize() {
				if (this.wheel) this.closeWheel();
				if (this.askState) this.positionAsk();
				this.updateSpotlight();
			}

			onBlur() {
				this.cancelPending();
				if (this.wheel) this.closeWheel();
			}

			onVisibility() {
				if (document.visibilityState === "hidden") {
					this.cancelPending();
					if (this.wheel) this.closeWheel();
					this.reportFocus(false);
				} else if (document.hasFocus()) {
					this.reportFocus(true);
				}
			}

			onWindowFocus() {
				this.reportFocus(true);
			}

			onWindowBlur() {
				this.reportFocus(false);
			}

			pageFocused() {
				return document.visibilityState === "visible" && document.hasFocus();
			}

			reportFocus(focused) {
				if (this.globalMode || !this.bridgePort) return;
				// Keep a single heartbeat: a focus event that fires before this
				// listener is attached (or before the bridge port is known) would
				// otherwise leave the global overlay thinking DSH is unfocused
				// forever, so it would never yield the OS-wide hotkeys.
				if (!this.focusTimer) {
					this.focusTimer = setInterval(() => this.reportFocus(this.pageFocused()), 5000);
				}
				try {
					fetch("http://127.0.0.1:" + this.bridgePort + "/focus", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ focused: Boolean(focused) }),
						keepalive: true
					}).catch(() => {});
				} catch {}
			}

			showTarget(target, color) {
				if (!target || !target.rect || target.selector === "页面空白处") {
					this.el.target.classList.remove("is-visible");
					return;
				}
				const rect = target.rect;
				if (!rect || rect.width < 2 || rect.height < 2 || rect.width > innerWidth * 0.96 || rect.height > innerHeight * 0.9) {
					this.el.target.classList.remove("is-visible");
					return;
				}
				this.el.target.style.left = rect.left - 5 + "px";
				this.el.target.style.top = rect.top - 5 + "px";
				this.el.target.style.width = rect.width + 10 + "px";
				this.el.target.style.height = rect.height + 10 + "px";
				this.el.target.style.setProperty("--ap-color", color || (this.wheel && this.wheel.items[0] ? this.wheel.items[0].color : "#c8aa6e"));
				this.el.targetTag.textContent = target.label || target.selector || "标记位置";
				this.el.target.classList.add("is-visible");
				this.updateSpotlight();
			}

			hideTarget() {
				this.el.target.classList.remove("is-visible");
				this.el.target.classList.remove("is-adjusting");
				this.targetDrag = null;
				this.updateSpotlight();
			}

			updateSpotlight() {
				if (!this.root || !this.el || !this.el.spot) return;
				const box = this.el.target;
				const live = Boolean(this.askState) && !this.globalMode && box && box.classList.contains("is-visible");
				this.root.classList.toggle("is-spot", Boolean(live));
				if (!live) return;
				const rect = box.getBoundingClientRect();
				const pad = 2;
				const left = Math.max(0, rect.left - pad);
				const top = Math.max(0, rect.top - pad);
				const right = Math.min(innerWidth, rect.right + pad);
				const bottom = Math.min(innerHeight, rect.bottom + pad);
				const areas = {
					top: [0, 0, innerWidth, top],
					bottom: [0, bottom, innerWidth, innerHeight - bottom],
					left: [0, top, left, bottom - top],
					right: [right, top, innerWidth - right, bottom - top]
				};
				for (const [name, [x, y, width, height]] of Object.entries(areas)) {
					const panel = this.el.spot.querySelector(`[data-ap-spot-panel="${name}"]`);
					if (!panel) continue;
					panel.style.left = Math.round(x) + "px";
					panel.style.top = Math.round(y) + "px";
					panel.style.width = Math.max(0, Math.round(width)) + "px";
					panel.style.height = Math.max(0, Math.round(height)) + "px";
				}
			}

			onTargetPointerDown(event) {
				if (!this.askState) return;
				if (event.button !== 0) return;
				const box = this.el.target;
				if (!box || !box.classList.contains("is-visible")) return;
				const handle = event.target && event.target.closest ? event.target.closest("[data-ap-resize]") : null;
				const rect = box.getBoundingClientRect();
				if (!rect.width || !rect.height) return;
				this.targetDrag = {
					mode: handle ? "resize" : "move",
					corner: handle ? handle.getAttribute("data-ap-resize") || "" : "",
					startX: event.clientX,
					startY: event.clientY,
					box: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
				};
				box.classList.add("is-adjusting");
				try { box.setPointerCapture(event.pointerId); } catch {}
				event.preventDefault();
				event.stopPropagation();
			}

			onTargetPointerMove(event) {
				const drag = this.targetDrag;
				if (!drag) return;
				const dx = event.clientX - drag.startX;
				const dy = event.clientY - drag.startY;
				let { left, top, width, height } = drag.box;
				const minWidth = 46;
				const minHeight = 34;
				if (drag.mode === "move") {
					left += dx;
					top += dy;
				} else {
					if (drag.corner.includes("l")) { left += dx; width -= dx; }
					if (drag.corner.includes("r")) { width += dx; }
					if (drag.corner.includes("t")) { top += dy; height -= dy; }
					if (drag.corner.includes("b")) { height += dy; }
					if (width < minWidth) {
						if (drag.corner.includes("l")) left -= minWidth - width;
						width = minWidth;
					}
					if (height < minHeight) {
						if (drag.corner.includes("t")) top -= minHeight - height;
						height = minHeight;
					}
				}
				const maxWidth = Math.max(minWidth, Math.floor(innerWidth * 0.94));
				const maxHeight = Math.max(minHeight, Math.floor(innerHeight * 0.86));
				width = Math.min(width, maxWidth);
				height = Math.min(height, maxHeight);
				left = Math.max(0, Math.min(innerWidth - width, left));
				top = Math.max(0, Math.min(innerHeight - height, top));
				this.el.target.style.left = Math.round(left) + "px";
				this.el.target.style.top = Math.round(top) + "px";
				this.el.target.style.width = Math.round(width) + "px";
				this.el.target.style.height = Math.round(height) + "px";
				this.updateSpotlight();
				event.preventDefault();
			}

			onTargetPointerUp(event) {
				if (!this.targetDrag) return;
				this.targetDrag = null;
				const box = this.el.target;
				if (!box) return;
				box.classList.remove("is-adjusting");
				try { box.releasePointerCapture(event.pointerId); } catch {}
				if (!this.askState) return;
				const rect = box.getBoundingClientRect();
				if (rect.width < 20 || rect.height < 16) return;
				const area = {
					left: rect.left + 5,
					top: rect.top + 5,
					width: Math.max(12, rect.width - 10),
					height: Math.max(12, rect.height - 10)
				};
				if (this.globalMode) {
					this.applyDesktopTarget(area).catch(() => {});
					return;
				}
				const x = Math.round(area.left + area.width / 2);
				const y = Math.round(area.top + area.height / 2);
				const captured = captureTarget(x, y) || {};
				const meaningful = captured.selector && captured.selector !== "页面空白处";
				const target = {
					...captured,
					x,
					y,
					selector: meaningful ? captured.selector : "手动框选区域",
					label: meaningful ? captured.label : "手动框选的区域",
					text: meaningful ? captured.text || "" : "",
					rect: area
				};
				this.askState.target = target;
				this.showTarget(target, this.askState.item && this.askState.item.color);
				this.refreshAskTarget(target);
			}

			/**
			 * Desktop marks live in screen coordinates, so moving/resizing the box
			 * also needs a fresh screenshot and a rebuilt selector/context block.
			 */
			async applyDesktopTarget(area) {
				const previous = this.askState && this.askState.target;
				if (!previous) return;
				const centerX = Math.round(area.left + area.width / 2);
				const centerY = Math.round(area.top + area.height / 2);
				const originX = (Number.isFinite(previous.screenX) ? previous.screenX : previous.x) - previous.x;
				const originY = (Number.isFinite(previous.screenY) ? previous.screenY : previous.y) - previous.y;
				const screenX = Math.round(originX + centerX);
				const screenY = Math.round(originY + centerY);
				let shot = null;
				try {
					if (window.agentPingHost && typeof window.agentPingHost.captureTarget === "function") {
						shot = await window.agentPingHost.captureTarget({ x: screenX, y: screenY });
					}
				} catch {}
				const displayLabel = previous.displayLabel
					|| String(previous.label || "").replace(/^桌面标记 · /, "")
					|| "桌面";
				const path = (shot && shot.path) || previous.screenshotPath || "";
				const text = [
					path ? `屏幕截图：${path}` : "屏幕截图：捕获失败（仍可按坐标和用户问题处理）",
					"截图是标记点周围约 430×300 的桌面区域。",
					`全局屏幕坐标：(${screenX}, ${screenY})`
				].join("\n");
				const target = {
					...previous,
					x: centerX,
					y: centerY,
					screenX,
					screenY,
					selector: `桌面 / ${displayLabel} / (${screenX}, ${screenY})`,
					label: `桌面标记 · ${displayLabel}`,
					text,
					rect: area,
					displayLabel,
					screenshotPath: path,
					preview: shot && shot.dataUrl ? shot.dataUrl : previous.preview || ""
				};
				this.askState.target = target;
				this.showTarget(target, this.askState.item && this.askState.item.color);
				this.refreshAskTarget(target);
			}

			refreshAskTarget(target) {
				if (!this.el.ask || !target) return;
				const label = this.el.ask.querySelector(".ap-ask-target-label");
				const text = this.el.ask.querySelector(".ap-ask-target-text");
				const contextLine = target.selector && target.selector !== "页面空白处"
					? target.selector
					: target.text
						? oneLine(target.text, 90)
						: "页面空白处";
				if (label) label.textContent = target.label || "页面空白处";
				if (text) text.textContent = contextLine;
				const previewImage = this.el.ask.querySelector(".ap-ask-preview img");
				if (previewImage && target.preview) previewImage.src = target.preview;
			}

			closeWheel(silent) {
				if (this.pending) this.cancelPending();
				const hadWheel = Boolean(this.wheel);
				this.wheel = null;
				if (!this.root) return;
				this.root.classList.remove("is-wheel");
				this.hideTarget();
				if (!this.askState && !this.settingsOpen) this.setRootState(null);
				if (hadWheel && !silent) this.playSound("close");
			}

			fireWheel() {
				const wheel = this.wheel;
				if (!wheel || wheel.fired) return;
				const item = wheel.items[wheel.hover];
				if (!item) {
					this.closeWheel();
					return;
				}
				wheel.fired = true;
				const target = wheel.target;
				const mode = wheel.mode;
				this.closeWheel(true);
				if (item.empty) {
					this.openSettings();
					return;
				}
				if (mode === "ping" && item.ask) {
					this.playSound("question");
					this.openAsk(target, item);
					return;
				}
				const prompt =
					mode === "emote"
						? formatEmotePrompt(item.emote, target, this.settings.includeContext)
						: formatSignalPrompt(item, target, this.settings.includeContext);
				this.playSound("send");
				if (this.globalMode) {
					this.fetchGlobalSessions().then((rows) => {
						const options = rows.map((row) => ({
							id: row.id,
							title: row.title || row.id,
							running: Boolean(row.running),
							current: Boolean(row.current)
						}));
						if (options.length <= 1) {
							this.ripple(target, item);
							this.sendPrompt(prompt, item, target, options[0] && options[0].id);
							return;
						}
						this.openSessionPicker(options, (sessionId) => {
							this.ripple(target, item);
							this.sendPrompt(prompt, item, target, sessionId);
						}, target, item.color, false);
					});
					return;
				}
				this.chooseSession(target, item.color, (sessionId) => {
					this.ripple(target, item);
					this.sendPrompt(prompt, item, target, sessionId);
				});
			}

			/** Session rows published by the DSH page and relayed through the bridge. */
			setGlobalSessions(rows) {
				this.globalSessions = Array.isArray(rows)
					? rows
						.filter((row) => row && typeof row.id === "string" && row.id && row.id !== "global-session")
						.map((row) => ({
							id: row.id,
							title: typeof row.title === "string" && row.title ? row.title : row.id,
							running: Boolean(row.running),
							current: Boolean(row.current),
							updatedAt: Number(row.updatedAt) || 0
						}))
						.slice(0, 60)
					: [];
			}

			sessionOptions() {
				if (this.globalMode && this.globalSessions.length > 0) {
					return this.globalSessions
						.slice()
						.sort((a, b) => Number(b.current) - Number(a.current) || b.updatedAt - a.updatedAt);
				}
				const state = this.sessionListState();
				const rows = [];
				if (state && Array.isArray(state.ids)) {
					for (const id of state.ids) {
						const row = state.byId && state.byId[id];
						if (!row) continue;
						if (row.parentId || row.parentSessionId || row.origin === "subagent") continue;
						rows.push({
							id,
							title: row.displayTitle || id,
							running: Boolean(row.running),
							current: id === this.sessionId,
							updatedAt: Number(row.updatedAt) || 0
						});
					}
				}
				if (this.sessionId && !rows.some((row) => row.current)) {
					rows.unshift({
						id: this.sessionId,
						title: "当前会话",
						running: false,
						current: true,
						updatedAt: Date.now()
					});
				}
				return rows.sort((a, b) => Number(b.current) - Number(a.current) || b.updatedAt - a.updatedAt);
			}

			sessionListState() {
				try {
					const list = this.ctx && this.ctx.sessions && this.ctx.sessions.list;
					if (list && typeof list.getSnapshot === "function") return list.getSnapshot();
				} catch {}
				return null;
			}

			/** Publish titles to the bridge so the global overlay can offer a picker. */
			publishSessions() {
				if (this.globalMode || !this.bridgePort) return;
				let rows = [];
				try {
					rows = this.sessionOptions().map((row) => ({
						id: row.id,
						title: row.title,
						running: row.running,
						current: row.current,
						updatedAt: row.updatedAt
					}));
				} catch {}
				if (rows.length === 0) return;
				try {
					fetch("http://127.0.0.1:" + this.bridgePort + "/sessions", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ sessions: rows }),
						keepalive: true
					}).catch(() => {});
				} catch {}
			}

			chooseSession(anchor, color, onPick, keepTarget = false) {
				const options = this.sessionOptions();
				if (options.length <= 1) {
					onPick(options.length === 1 ? options[0].id : "");
					return;
				}
				this.openSessionPicker(options, onPick, anchor, color, keepTarget);
			}

			openSessionPicker(options, onPick, anchor, color, keepTarget = false, onCancel = null) {
				this.hideToast();
				this.pickerState = { onPick, keepTarget, onCancel };
				if (anchor && anchor.rect) this.showTarget(anchor, color);
				this.el.picker.innerHTML = `
<div class="ap-card ap-picker-card">
	<div class="ap-card-head">
		<div>
			<div class="ap-kicker">AGENT PING // TARGET</div>
			<div class="ap-card-title">发送到哪个会话</div>
		</div>
		<button class="ap-icon-btn" type="button" data-ap-picker-close aria-label="关闭">×</button>
	</div>
	<div class="ap-picker-list">
		${options.map((row) => `<button class="ap-picker-row${row.current ? " is-current" : ""}" type="button" data-ap-picker-id="${esc(row.id)}">
			<span class="ap-picker-title">${esc(row.title)}</span>
			<span class="ap-picker-meta">${row.current ? "当前" : row.running ? "运行中" : "空闲"}</span>
		</button>`).join("")}
	</div>
	<div class="ap-ask-foot">
		<span class="ap-ask-hint">拖动标题栏可移动 · Esc 取消 · 选中后立即发送</span>
	</div>
</div>`;
				this.setRootState("picker");
				const card = this.el.picker.querySelector(".ap-picker-card");
				if (card) {
					const rect = card.getBoundingClientRect();
					const avoid = this.pickerPos ? null : (anchor && anchor.rect ? anchor.rect : null);
					const preferred = this.pickerPos
						? { x: this.pickerPos.x, y: this.pickerPos.y }
						: { x: (innerWidth - rect.width) / 2, y: (innerHeight - rect.height) / 2 };
					const spot = this.placeCard(rect.width, rect.height, avoid, preferred);
					card.style.left = spot.left + "px";
					card.style.top = spot.top + "px";
					this.bindPickerDrag(card);
				}
				this.el.picker.querySelectorAll("[data-ap-picker-id]").forEach((row) => {
					row.addEventListener("click", () => {
						const id = row.getAttribute("data-ap-picker-id");
						const pick = this.pickerState && this.pickerState.onPick;
						const keep = Boolean(this.pickerState && this.pickerState.keepTarget);
						this.closePicker(keep, true);
						if (pick) pick(id);
					});
				});
				const close = this.el.picker.querySelector("[data-ap-picker-close]");
				if (close) close.addEventListener("click", () => this.closePicker());
				const first = this.el.picker.querySelector(".ap-picker-row");
				if (first) setTimeout(() => { try { first.focus({ preventScroll: true }); } catch {} }, 20);
			}

			bindPickerDrag(card) {
				const head = card.querySelector(".ap-card-head");
				if (!head) return;
				head.addEventListener("pointerdown", (event) => {
					if (event.button !== 0) return;
					if (event.target && event.target.closest && event.target.closest("[data-ap-picker-close]")) return;
					const rect = card.getBoundingClientRect();
					const drag = { startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top, width: rect.width, height: rect.height };
					const move = (moveEvent) => {
						const left = Math.max(4, Math.min(innerWidth - drag.width - 4, drag.left + moveEvent.clientX - drag.startX));
						const top = Math.max(4, Math.min(innerHeight - drag.height - 4, drag.top + moveEvent.clientY - drag.startY));
						card.style.left = left + "px";
						card.style.top = top + "px";
						this.pickerPos = { x: left, y: top };
					};
					const up = () => {
						card.classList.remove("is-dragging");
						card.removeEventListener("pointermove", move);
						card.removeEventListener("pointerup", up);
						try { card.releasePointerCapture(event.pointerId); } catch {}
					};
					card.classList.add("is-dragging");
					try { card.setPointerCapture(event.pointerId); } catch {}
					card.addEventListener("pointermove", move);
					card.addEventListener("pointerup", up);
					event.preventDefault();
					event.stopPropagation();
				});
			}

			/** Clamp a card inside the viewport, preferring a spot outside `avoid`. */
			placeCard(width, height, avoid, preferred) {
				const margin = 12;
				const gap = 16;
				const clampX = (x) => Math.max(margin, Math.min(innerWidth - width - margin, x));
				const clampY = (y) => Math.max(margin, Math.min(innerHeight - height - margin, y));
				const overlaps = (left, top) => Boolean(
					avoid
					&& left < avoid.left + avoid.width
					&& left + width > avoid.left
					&& top < avoid.top + avoid.height
					&& top + height > avoid.top
				);
				const attempt = (x, y) => {
					const left = clampX(x);
					const top = clampY(y);
					return overlaps(left, top) ? null : { left, top };
				};
				if (preferred) {
					const spot = attempt(preferred.x, preferred.y);
					if (spot) return spot;
				}
				if (avoid) {
					const candidates = [
						{ x: avoid.left + avoid.width + gap, y: avoid.top },
						{ x: avoid.left - width - gap, y: avoid.top },
						{ x: avoid.left, y: avoid.top + avoid.height + gap },
						{ x: avoid.left, y: avoid.top - height - gap }
					];
					for (const candidate of candidates) {
						const spot = attempt(candidate.x, candidate.y);
						if (spot) return spot;
					}
				}
				return {
					left: clampX(preferred ? preferred.x : (innerWidth - width) / 2),
					top: clampY(preferred ? preferred.y : (innerHeight - height) / 2)
				};
			}

			closePicker(keepTarget = false, picked = false) {
				const state = this.pickerState;
				this.pickerState = null;
				if (this.el.picker) this.el.picker.innerHTML = "";
				if (!this.wheel && !this.settingsOpen) {
					this.setRootState(this.askState ? "ask" : null);
					if (!keepTarget && !this.askState) this.hideTarget();
				}
				if (!picked && state && typeof state.onCancel === "function") {
					try { state.onCancel(); } catch {}
				}
				return state;
			}

			async sendPrompt(prompt, item, target, sessionId) {
				const meta = {
					kind: item.emoji ? "emote" : item.id,
					label: item.label,
					emoji: item.emoji || "",
					icon: item.icon || "",
					color: item.color || "#c8aa6e",
					prompt,
					target: target
						? { selector: target.selector, label: target.label, x: target.x, y: target.y }
						: null
				};
				let targetId = this.globalMode ? (sessionId || "") : (sessionId || this.sessionId);
				if (targetId === "global-session") targetId = "";
				if (this.globalMode) {
					const host = typeof window !== "undefined" ? window.agentPingHost : null;
					if (!host || typeof host.sendSignal !== "function") {
						this.addRecent({ ...meta, sent: false });
						this.toast("发送失败：全局宿主不可用", true);
						return;
					}
					try {
						const result = await host.sendSignal({
							id: uid(),
							label: item.label || "全局信号",
							emoji: item.emoji || "🖥️",
							icon: item.icon || "flag",
							color: item.color || "#62b6ff",
							prompt,
							target,
							source: "global",
							sessionId: targetId
						});
						if (result && result.ok) {
							this.addRecent({ ...meta, sent: true });
							this.toast(result.queued ? "信号已排队 · 等待 DSH" : "信号已发送 · " + item.label);
							this.playSound("sent");
							return result;
						}
						throw new Error((result && (result.error || result.message)) || "无法连接 DSH 桥接");
					} catch (error) {
						this.addRecent({ ...meta, sent: false });
						this.toast("发送失败：" + (error && error.message ? error.message : "未知错误"), true);
						this.playSound("error");
						return;
					}
				}
				if (!targetId) {
					this.addRecent({ ...meta, sent: false });
					this.toast("已标记位置 · 没有找到活动会话");
					return;
				}
				let binding = null;
				let release = null;
				if (targetId === this.sessionId) {
					try {
						binding = this.ctx.sessions && this.ctx.sessions.binding(this.sessionId);
					} catch {}
				} else {
					try {
						const sessions = this.ctx && this.ctx.sessions;
						if (!sessions || typeof sessions.retain !== "function") {
							throw new Error("当前 DSH 不支持指定会话");
						}
						const reference = sessions.retain(targetId, { source: "agent-ping" });
						release = () => {
							try { reference.release(); } catch {}
						};
						await reference.ready;
						binding = reference.binding;
					} catch (error) {
						release = null;
						this.addRecent({ ...meta, sent: false });
						this.toast("无法打开目标会话：" + (error && error.message ? error.message : "未知错误"), true);
						return;
					}
				}
				if (!binding || !binding.session) {
					if (release) release();
					this.addRecent({ ...meta, sent: false });
					this.toast("已标记位置 · 会话尚未就绪");
					return;
				}
				const session = binding.session;
				let running = false;
				try {
					running = Boolean(session.getSnapshot && session.getSnapshot().running);
				} catch {}
				const mode = running && this.settings.steerWhenRunning ? "steer" : "queue";
				let requestId = uid();
				let submission = null;
				try {
					if (typeof session.beginSubmission === "function") {
						submission = session.beginSubmission({ text: prompt, mode, attachments: [] });
						if (submission && typeof submission.requestId === "string") requestId = submission.requestId;
					}
				} catch {}
				try {
					if (typeof session.prompt !== "function") throw new Error("当前会话不支持发送");
					const result = await session.prompt([{ type: "text", text: prompt }], mode, undefined, requestId);
					if (result && result.ok === false) {
						const message = result.error && (result.error.message || result.error.code);
						throw new Error(message || "Agent 拒绝了这次请求");
					}
					this.addRecent({ ...meta, sent: true });
					this.toast(result && result.queued ? "信号已排队 · 等待 DSH" : "信号已发送 · " + item.label);
					this.playSound("sent");
					return result;
				} catch (error) {
					if (submission && typeof submission.abandon === "function") {
						try { submission.abandon(); } catch {}
					}
					this.addRecent({ ...meta, sent: false });
					this.toast("发送失败：" + (error && error.message ? error.message : "未知错误"), true);
					this.playSound("error");
				} finally {
					if (release) release();
				}
			}

			openAsk(target, item, sessionId) {
				this.hideToast();
				this.closeWheel(true);
				this.closeSettings();
				const askSessionId = this.globalMode ? "" : (sessionId || this.sessionId);
				const askSession = this.sessionOptions().find((row) => row.id === askSessionId);
				this.askState = { target, item: item || PINGS[0], sessionId: askSessionId };
				const quickSessions = this.sessionOptions();
				const sessionLine = this.globalMode
					? `<label class="ap-ask-session">发送到：<select class="ap-ask-session-select" data-ap-ask-session-select><option value="">当前会话</option>${quickSessions
						.filter((row) => !row.current)
						.map((row) => `<option value="${esc(row.id)}">${esc(row.title)}${row.running ? "（运行中）" : ""}</option>`)
						.join("")}</select></label>`
					: `<label class="ap-ask-session">发送到：<select class="ap-ask-session-select" data-ap-ask-session-select>${quickSessions
						.map((row) => `<option value="${esc(row.id)}"${row.current ? " selected" : ""}>${esc(row.title)}${row.current ? "（当前）" : ""}</option>`)
						.join("")}</select></label>`;
				const ctx = target || {};
				const contextLine = ctx.selector && ctx.selector !== "页面空白处"
					? ctx.selector
					: ctx.text
						? oneLine(ctx.text, 90)
						: "页面空白处";
				this.el.ask.innerHTML = `
<div class="ap-card ap-ask-card">
	<div class="ap-card-head">
		<div>
			<div class="ap-kicker">AGENT PING // QUESTION</div>
			<div class="ap-card-title">对标记位置提问</div>
		</div>
		<button class="ap-icon-btn" type="button" data-ap-ask-close aria-label="关闭">×</button>
	</div>
	<div class="ap-ask-target">
		<div class="ap-ask-target-icon">${iconHtml("question")}</div>
		<div class="ap-ask-target-main">
			<div class="ap-ask-target-label">${esc(ctx.label || "页面空白处")}</div>
			<div class="ap-ask-target-text">${esc(contextLine)}</div>
		</div>
	</div>
	${ctx.preview ? `<div class="ap-ask-preview"><img src="${esc(ctx.preview)}" alt="标记位置截图"></div>` : ""}
	<textarea data-ap-ask-input placeholder="对这里问点什么…例如：这段代码为什么报错？" spellcheck="false"></textarea>
	<div class="ap-chips">
		<button class="ap-chip" type="button" data-ap-chip="这里是什么？">这里是什么？</button>
		<button class="ap-chip" type="button" data-ap-chip="为什么会这样？">为什么会这样？</button>
		<button class="ap-chip" type="button" data-ap-chip="帮我改这里">帮我改这里</button>
		<button class="ap-chip" type="button" data-ap-chip="解释这一段">解释这一段</button>
		<button class="ap-chip" type="button" data-ap-chip="继续从这里工作">继续从这里工作</button>
	</div>
	${sessionLine}
	<div class="ap-ask-foot">
		<span class="ap-ask-hint">拖动紫框或四角可调整标记 · Ctrl + Enter 发送 · Esc 取消</span>
		<button class="ap-send" type="button" data-ap-ask-send>
			<span data-ap-ask-send-label>发送信号</span>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 12 15-7-4.6 15-3.5-6.1L4 12Z"/></svg>
		</button>
	</div>
</div>`;
				this.showTarget(target, this.askState.item && this.askState.item.color);
				this.setRootState("ask");
				this.positionAsk();
				const input = this.el.ask.querySelector("[data-ap-ask-input]");
				const send = this.el.ask.querySelector("[data-ap-ask-send]");
				const close = this.el.ask.querySelector("[data-ap-ask-close]");
				const card = this.el.ask.querySelector(".ap-ask-card");
				if (card) {
					card.addEventListener("pointerdown", (event) => event.stopPropagation());
				}
				if (card && typeof ResizeObserver === "function") {
					try { if (this.askObserver) this.askObserver.disconnect(); } catch {}
					// The screenshot preview and the session list arrive after the
					// first placement, growing the card past the bottom edge.
					this.askObserver = new ResizeObserver(() => {
						if (this.askState && this.el.ask && document.body.contains(card)) this.positionAsk();
					});
					this.askObserver.observe(card);
				}
				if (close) close.addEventListener("click", () => this.closeAsk());
				if (send) send.addEventListener("click", () => this.submitAsk());
				const sessionSelect = this.el.ask.querySelector("[data-ap-ask-session-select]");
				if (sessionSelect && !this.globalMode) {
					sessionSelect.addEventListener("change", () => {
						if (this.askState) this.askState.sessionId = sessionSelect.value || this.sessionId;
					});
				}
				if (input) {
					input.addEventListener("keydown", (event) => {
						if (event.key === "Escape") {
							event.preventDefault();
							this.closeAsk();
						}
						if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
							event.preventDefault();
							this.submitAsk();
						}
					});
					setTimeout(() => {
						try { input.focus({ preventScroll: true }); } catch {}
					}, 30);
				}
				this.el.ask.querySelectorAll("[data-ap-chip]").forEach((chip) => {
					chip.addEventListener("click", () => {
						if (!input) return;
						input.value = chip.getAttribute("data-ap-chip") || "";
						input.focus({ preventScroll: true });
						this.positionAsk();
					});
				});
				if (this.globalMode) this.loadGlobalSessions().then(() => this.positionAsk());
				const previewImage = this.el.ask.querySelector(".ap-ask-preview img");
				if (previewImage) {
					// The screenshot arrives after openAsk measured the card, so the
					// card can grow past the bottom edge; re-clamp once it is decoded.
					previewImage.addEventListener("load", () => this.positionAsk());
					if (previewImage.complete) this.positionAsk();
				}
			}

			/** Load session rows from the global host (bridge relay) with a short cache. */
			async fetchGlobalSessions(force = false) {
				const now = Date.now();
				// The main process seeds rows with every open-wheel payload, so a
				// non-empty list is already fresh; only the ask composer forces a
				// refresh (e.g. after renaming a conversation).
				if (!force && this.globalSessions.length > 0) return this.globalSessions;
				try {
					if (window.agentPingHost && typeof window.agentPingHost.listSessions === "function") {
						const result = await window.agentPingHost.listSessions();
						if (result && result.ok) {
							this.setGlobalSessions(result.sessions || []);
							this.globalSessionCacheAt = now;
						}
					}
				} catch {}
				return this.globalSessions;
			}

			/** Fill the global ask composer's session selector from the bridge list. */
			async loadGlobalSessions() {
				const select = this.el.ask && this.el.ask.querySelector("[data-ap-ask-session-select]");
				if (!select) return;
				const sessions = await this.fetchGlobalSessions(true);
				if (!this.askState || !document.body.contains(select)) return;
				if (sessions.length === 0) {
					select.disabled = true;
					select.title = "没有获取到 DSH 会话列表";
					return;
				}
				select.innerHTML = sessions
					.map((row) => `<option value="${esc(row.id)}">${esc(row.title || row.id)}${row.current ? "（当前）" : ""}</option>`)
					.join("");
				const current = sessions.find((row) => row.current);
				if (current) {
					select.value = current.id;
					if (this.askState) this.askState.sessionId = current.id;
				}
				select.addEventListener("change", () => {
					if (this.askState) this.askState.sessionId = select.value || "";
				});
			}

			positionAsk() {
				if (!this.askState || !this.el.ask) return;
				const card = this.el.ask.querySelector(".ap-ask-card");
				if (!card) return;
				const target = this.askState.target;
				const point = target && Number.isFinite(target.x) ? target : this.lastPointer;
				const rect = card.getBoundingClientRect();
				if (this.globalMode) {
					// Pin the desktop composer to the top-right corner: the screenshot
					// preview decodes after the first measure, and a mark near the
					// bottom edge used to push the session selector off-screen.
					this.el.ask.style.left = Math.max(12, innerWidth - rect.width - 16) + "px";
					this.el.ask.style.top = "16px";
					return;
				}
				const avoid = target && target.rect ? target.rect : null;
				const preferred = { x: point.x + 24, y: point.y - 42 };
				const spot = this.placeCard(rect.width, rect.height, avoid, preferred);
				this.el.ask.style.left = spot.left + "px";
				this.el.ask.style.top = spot.top + "px";
			}

			async submitAsk() {
				if (!this.askState) return;
				const input = this.el.ask.querySelector("[data-ap-ask-input]");
				const question = input ? input.value.trim() : "";
				if (!question) {
					if (input) {
						input.focus();
						input.style.borderColor = "rgba(255,91,91,.65)";
						setTimeout(() => { input.style.borderColor = ""; }, 700);
					}
					this.toast("先写下你的问题", true);
					return;
				}
				this.askState.question = question;
				const target = this.askState.target;
				const item = {
					id: "question",
					label: "提问",
					color: "#8b7bff",
					icon: "question",
					ask: true
				};
				if (this.globalMode) {
					if (this.globalSessions.length === 0) {
						await this.fetchGlobalSessions(true);
						if (!this.askState) return;
					}
					const options = this.sessionOptions().slice();
					const chosen = this.askState.sessionId;
					const index = chosen ? options.findIndex((row) => row.id === chosen) : -1;
					if (index > 0) options.unshift(options.splice(index, 1)[0]);
					if (options.length > 1) {
						this.openSessionPicker(options, (sessionId) => {
							this.dispatchAsk(question, item, target, sessionId);
						}, target, item.color, true, () => {
							const sessionId = this.askState && this.askState.sessionId;
							this.openAsk(target, item, sessionId);
							const textarea = this.el.ask.querySelector("[data-ap-ask-input]");
							if (textarea) {
								textarea.value = question;
								textarea.focus({ preventScroll: true });
							}
						});
						return;
					}
				}
				const targetSessionId = this.globalMode ? (this.askState.sessionId || "") : (this.askState.sessionId || this.sessionId);
				this.dispatchAsk(question, item, target, targetSessionId);
			}

			dispatchAsk(question, item, target, sessionId) {
				const send = this.el.ask.querySelector("[data-ap-ask-send]");
				const label = this.el.ask.querySelector("[data-ap-ask-send-label]");
				if (send) send.disabled = true;
				if (label) label.textContent = "发送中";
				const prompt = formatQuestionPrompt(question, target);
				this.playSound("send");
				this.ripple(target, item);
				this.sendPrompt(prompt, item, target, sessionId).then((ok) => {
					if (send) send.disabled = false;
					if (label) label.textContent = "发送信号";
					if (ok) this.closeAsk();
				}).catch(() => {
					if (send) send.disabled = false;
					if (label) label.textContent = "发送信号";
				});
			}

			closeAsk() {
				if (!this.askState) return;
				this.askState = null;
				try { if (this.askObserver) { this.askObserver.disconnect(); this.askObserver = null; } } catch {}
				if (this.el.ask) this.el.ask.innerHTML = "";
				if (!this.wheel && !this.settingsOpen) {
					this.hideTarget();
					this.setRootState(null);
				}
				this.updateSpotlight();
			}

			openSettings() {
				this.hideToast();
				this.stopKeyCapture();
				this.closeWheel(true);
				this.closeAsk();
				this.settingsOpen = true;
				this.renderSettings();
				this.setRootState("settings");
				this.playSound("open", "settings");
			}

			closeSettings() {
				if (!this.settingsOpen) return;
				this.stopKeyCapture();
				this.settingsOpen = false;
				if (this.el.settings) this.el.settings.innerHTML = "";
				if (!this.wheel && !this.askState) {
					this.hideTarget();
					this.setRootState(null);
				}
			}

			renderSettings() {
				const settings = this.settings;
				const keyButtons = [
					["pingKey", "信号轮盘", "默认 Shift+Alt+Q，打开后移动鼠标点击扇区"],
					["emoteKey", "表情轮盘", "默认 Shift+Alt+E，打开后移动鼠标点击扇区"],
					["settingsKey", "设置面板", "默认 Shift+Alt+P"]
				];
				const toggles = [
					["sound", "音效", "信号与轮盘的操作音"],
					["steerWhenRunning", "Agent 忙碌时插话", "开启后使用 steer，否则进入队列"],
					["includeContext", "附带标记上下文", "把元素、文本和坐标一并发送"],
					["showFeed", "显示信号记录", "左下角的最近信号入口"]
				];
				const emoteRows = settings.emotes.map((emote, index) => `
<div class="ap-emote-row" data-ap-emote-row="${index}">
	<input class="ap-emoji-input" data-ap-emote-field="emoji" data-ap-emote-index="${index}" maxlength="8" value="${esc(emote.emoji)}" aria-label="表情">
	<div class="ap-emote-main">
		<input class="ap-input" data-ap-emote-field="label" data-ap-emote-index="${index}" maxlength="24" value="${esc(emote.label)}" placeholder="名称" aria-label="名称">
		<input class="ap-input" data-ap-emote-field="command" data-ap-emote-index="${index}" maxlength="500" value="${esc(emote.command)}" placeholder="发送给 Agent 的快捷指令" aria-label="快捷指令">
	</div>
	<div class="ap-emote-actions">
		<button class="ap-mini-btn" type="button" data-ap-emote-action="up" data-ap-emote-index="${index}" ${index === 0 ? "disabled" : ""} title="上移">↑</button>
		<button class="ap-mini-btn" type="button" data-ap-emote-action="down" data-ap-emote-index="${index}" ${index === settings.emotes.length - 1 ? "disabled" : ""} title="下移">↓</button>
		<button class="ap-mini-btn danger" type="button" data-ap-emote-action="delete" data-ap-emote-index="${index}" title="删除">×</button>
	</div>
</div>`).join("");
				this.el.settings.innerHTML = `
<div class="ap-card">
	<div class="ap-card-head">
		<div>
			<div class="ap-kicker">AGENT PING // CONFIG</div>
			<div class="ap-card-title">信号轮盘设置</div>
		</div>
		<button class="ap-icon-btn" type="button" data-ap-settings-close aria-label="关闭">×</button>
	</div>
	<div class="ap-settings-body">
		<div class="ap-section">
			<div class="ap-section-title">快捷键</div>
			${keyButtons.map(([field, label, note]) => `
			<div class="ap-field-row">
				<div>
					<div class="ap-field-label">${label}</div>
					<div class="ap-field-note">${note}</div>
				</div>
				<button class="ap-key-btn" type="button" data-ap-capture="${field}">${esc(displayKey(settings[field]))}</button>
			</div>`).join("")}
		</div>
		<div class="ap-section">
			<div class="ap-section-title">行为</div>
			${toggles.map(([field, label, note]) => `
			<div class="ap-field-row">
				<div>
					<div class="ap-field-label">${label}</div>
					<div class="ap-field-note">${note}</div>
				</div>
				<label class="ap-switch"><input type="checkbox" data-ap-toggle="${field}" ${settings[field] ? "checked" : ""}><span></span></label>
			</div>`).join("")}
			<div class="ap-field-row">
				<div>
					<div class="ap-field-label">音量</div>
					<div class="ap-field-note">仅影响轮盘音效</div>
				</div>
				<input class="ap-range" type="range" min="0" max="1" step="0.05" value="${settings.volume}" data-ap-volume>
			</div>
		</div>
		<div class="ap-section">
			<div class="ap-section-title">表情快捷指令</div>
			<div class="ap-emote-list">${emoteRows}</div>
			<div class="ap-btn-row">
				<button class="ap-ghost-btn" type="button" data-ap-emote-add ${settings.emotes.length >= MAX_EMOTES ? "disabled" : ""}>＋ 添加表情</button>
				<button class="ap-ghost-btn" type="button" data-ap-reset-emotes>恢复默认表情</button>
			</div>
		</div>
		<div class="ap-section">
			<div class="ap-section-title">信号记录</div>
			<div class="ap-field-row">
				<div>
					<div class="ap-field-label">最近信号</div>
					<div class="ap-field-note">共 ${this.recent.length} 条，保留最近 20 条</div>
				</div>
				<button class="ap-ghost-btn danger" type="button" data-ap-clear-feed>清空记录</button>
			</div>
		</div>
	</div>
	<div class="ap-settings-foot">
		<span>DSH Agent Ping v${VERSION} · 设置自动保存到本浏览器</span>
		<button class="ap-done" type="button" data-ap-settings-done>完成</button>
	</div>
</div>`;
				this.el.settings.querySelector("[data-ap-settings-close]").addEventListener("click", () => this.closeSettings());
				this.el.settings.querySelector("[data-ap-settings-done]").addEventListener("click", () => this.closeSettings());
				this.el.settings.querySelectorAll("[data-ap-capture]").forEach((button) => {
					button.addEventListener("click", () => this.startKeyCapture(button.getAttribute("data-ap-capture")));
				});
				this.el.settings.querySelectorAll("[data-ap-toggle]").forEach((input) => {
					input.addEventListener("change", () => {
						const field = input.getAttribute("data-ap-toggle");
						this.settings[field] = input.checked;
						this.save();
						if (field === "showFeed") this.updateFeedVisibility();
					});
				});
				this.el.settings.querySelector("[data-ap-volume]").addEventListener("input", (event) => {
					this.settings.volume = clamp(Number(event.target.value) || 0, 0, 1);
					this.save();
				});
				this.el.settings.querySelectorAll("[data-ap-emote-field]").forEach((input) => {
					input.addEventListener("input", () => {
						const index = Number(input.getAttribute("data-ap-emote-index"));
						const field = input.getAttribute("data-ap-emote-field");
						if (!this.settings.emotes[index]) return;
						this.settings.emotes[index][field] = input.value;
						this.save();
					});
				});
				this.el.settings.querySelectorAll("[data-ap-emote-action]").forEach((button) => {
					button.addEventListener("click", () => {
						const index = Number(button.getAttribute("data-ap-emote-index"));
						const action = button.getAttribute("data-ap-emote-action");
						this.emoteAction(action, index);
					});
				});
				this.el.settings.querySelector("[data-ap-emote-add]").addEventListener("click", () => {
					if (this.settings.emotes.length >= MAX_EMOTES) return;
					const next = DEFAULT_EMOTES[this.settings.emotes.length % DEFAULT_EMOTES.length];
					this.settings.emotes.push({ emoji: next.emoji, label: next.label, command: next.command });
					this.save();
					this.renderSettings();
				});
				this.el.settings.querySelector("[data-ap-reset-emotes]").addEventListener("click", () => {
					if (!window.confirm("把表情快捷键恢复为默认的 8 个？")) return;
					this.settings.emotes = clone(DEFAULT_EMOTES);
					this.save();
					this.renderSettings();
				});
				this.el.settings.querySelector("[data-ap-clear-feed]").addEventListener("click", () => {
					this.recent = [];
					this.settings.feed = [];
					this.save();
					this.renderFeed();
					this.updateFeedVisibility();
					this.renderSettings();
					this.toast("信号记录已清空");
				});
			}

			startKeyCapture(field) {
				this.capturingKey = field;
				const button = this.el.settings.querySelector('[data-ap-capture="' + field + '"]');
				if (button) {
					button.classList.add("is-capturing");
					button.textContent = "按下按键…";
				}
				const capture = (event) => {
					event.preventDefault();
					event.stopPropagation();
					if (event.key === "Escape") {
						this.stopKeyCapture();
						return;
					}
					if (event.repeat) return;
					const combo = comboFromEvent(event);
					if (!combo) {
						this.toast("请使用 Shift+Alt+字母 这类组合键");
						return;
					}
					const others = ["pingKey", "emoteKey", "settingsKey"]
						.filter((name) => name !== field)
						.map((name) => this.settings[name]);
					if (others.includes(combo)) {
						this.toast("三个快捷键不能重复");
						return;
					}
					this.settings[field] = combo;
					this.save();
					this.stopKeyCapture();
					this.renderSettings();
					this.toast("快捷键已更新为 " + displayKey(combo));
				};
				this.captureListener = capture;
				window.addEventListener("keydown", capture, true);
			}

			stopKeyCapture() {
				if (this.captureListener) {
					window.removeEventListener("keydown", this.captureListener, true);
					this.captureListener = null;
				}
				const field = this.capturingKey;
				this.capturingKey = null;
				if (field && this.settingsOpen) {
					const button = this.el.settings.querySelector('[data-ap-capture="' + field + '"]');
					if (button) {
						button.classList.remove("is-capturing");
						button.textContent = displayKey(this.settings[field]);
					}
				}
			}

			emoteAction(action, index) {
				const emotes = this.settings.emotes;
				if (!emotes[index]) return;
				if (action === "delete") {
					if (emotes.length <= 1) {
						this.toast("至少保留一个表情快捷指令");
						return;
					}
					emotes.splice(index, 1);
				} else if (action === "up" && index > 0) {
					const [item] = emotes.splice(index, 1);
					emotes.splice(index - 1, 0, item);
				} else if (action === "down" && index < emotes.length - 1) {
					const [item] = emotes.splice(index, 1);
					emotes.splice(index + 1, 0, item);
				} else {
					return;
				}
				this.save();
				this.renderSettings();
			}

			save() {
				this.settings.feed = this.recent.slice(0, 20);
				saveSettings(this.settings);
			}

			clearFeed() {
				this.recent = [];
				this.settings.feed = [];
				this.save();
				this.renderFeed();
				this.updateFeedVisibility();
				this.toast("信号记录已清除");
			}

			addRecent(entry) {
				this.recent.unshift({
					id: uid(),
					time: Date.now(),
					...entry
				});
				this.recent = this.recent.slice(0, 20);
				this.save();
				this.renderFeed();
				this.updateFeedVisibility();
			}

			renderFeed() {
				if (!this.el || !this.el.feed) return;
				const items = this.recent.slice(0, 8);
				const rows = items.length
					? items.map((item) => {
						const icon = item.emoji
							? '<span class="ap-emoji">' + esc(item.emoji) + "</span>"
							: iconHtml(item.icon || "praise");
						const time = new Date(item.time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
						return (
							'<button class="ap-feed-row" type="button" data-ap-feed-id="' + esc(item.id) + '" style="--ap-color:' + esc(item.color || "#c8aa6e") + '">' +
							'<span class="ap-feed-icon">' + icon + "</span>" +
							'<span class="ap-feed-main"><span class="ap-feed-label">' + esc(item.label || "信号") + "</span>" +
							'<span class="ap-feed-time">' + time + (item.sent === false ? " · 未发送" : "") + "</span></span>" +
							"</button>"
						);
					}).join("")
					: '<div class="ap-feed-empty">还没有信号记录</div>';
				const head = items.length
					? '<div class="ap-feed-head"><span>最近信号</span><button class="ap-feed-clear" type="button" data-ap-feed-clear>清除</button></div>'
					: "";
				this.el.feed.innerHTML =
					'<button class="ap-feed-toggle" type="button" data-ap-feed-toggle>' +
					'<span class="ap-feed-dot"></span><span>信号</span><span class="ap-feed-count">' + this.recent.length + "</span>" +
					"</button>" +
					'<div class="ap-feed-list">' + head + rows + "</div>";
				const toggle = this.el.feed.querySelector("[data-ap-feed-toggle]");
				if (toggle) {
					toggle.addEventListener("click", (event) => {
						event.stopPropagation();
						this.el.feed.classList.toggle("is-open");
					});
				}
				const clear = this.el.feed.querySelector("[data-ap-feed-clear]");
				if (clear) {
					clear.addEventListener("click", (event) => {
						event.stopPropagation();
						this.clearFeed();
					});
				}
				this.el.feed.querySelectorAll("[data-ap-feed-id]").forEach((button) => {
					button.addEventListener("click", () => {
						const id = button.getAttribute("data-ap-feed-id");
						const item = this.recent.find((entry) => entry.id === id);
						if (!item) return;
						this.el.feed.classList.remove("is-open");
						this.resend(item);
					});
				});
			}

			resend(item) {
				if (!item || !item.prompt) return;
				const target = item.target || { x: innerWidth / 2, y: innerHeight / 2, selector: "历史信号", label: item.label };
				this.ripple(target, item);
				this.sendPrompt(item.prompt, {
					id: item.kind || "history",
					label: item.label || "信号",
					emoji: item.emoji || "",
					icon: item.icon || "praise",
					color: item.color || "#c8aa6e"
				}, target);
			}

			updateFeedVisibility() {
				if (!this.root) return;
				const visible = Boolean(this.settings.showFeed && this.recent.length > 0);
				this.root.classList.toggle("is-feed", visible);
			}

			ripple(target, item) {
				if (!this.el || !this.el.ripples) return;
				const point = target && Number.isFinite(target.x) ? target : this.lastPointer;
				const wrap = document.createElement("div");
				wrap.className = "ap-ripple";
				wrap.style.left = point.x + "px";
				wrap.style.top = point.y + "px";
				wrap.style.setProperty("--ap-color", item.color || "#c8aa6e");
				const icon = item.emoji
					? '<span class="ap-emoji">' + esc(item.emoji) + "</span>"
					: iconHtml(item.icon || "praise");
				wrap.innerHTML =
					'<span class="ap-ripple-ring"></span><span class="ap-ripple-ring"></span><span class="ap-ripple-ring"></span>' +
					'<span class="ap-ripple-icon">' + icon + "</span>" +
					'<span class="ap-ripple-label">' + esc(item.label || "信号") + "</span>";
				this.el.ripples.appendChild(wrap);
				setTimeout(() => wrap.remove(), 1900);
			}

			toast(message, isError) {
				if (!this.el || !this.el.toast) return;
				if (this.toastTimer) clearTimeout(this.toastTimer);
				this.el.toast.textContent = message;
				this.el.toast.classList.toggle("is-error", Boolean(isError));
				this.el.toast.classList.add("is-visible");
				this.toastTimer = setTimeout(() => {
					if (this.el && this.el.toast) this.el.toast.classList.remove("is-visible");
				}, 2600);
			}

			hideToast() {
				if (this.toastTimer) {
					clearTimeout(this.toastTimer);
					this.toastTimer = null;
				}
				if (this.el && this.el.toast) this.el.toast.classList.remove("is-visible");
			}

			playSound(kind, mode) {
				if (!this.settings.sound) return;
				try {
					const AudioCtor = window.AudioContext || window.webkitAudioContext;
					if (!AudioCtor) return;
					if (!this.audio) this.audio = new AudioCtor();
					if (this.audio.state === "suspended") this.audio.resume().catch(() => {});
					const now = this.audio.currentTime;
					const gain = this.audio.createGain();
					const volume = clamp(this.settings.volume, 0, 1);
					gain.gain.setValueAtTime(0.0001, now);
					gain.connect(this.audio.destination);
					const tone = (frequency, start, duration, type, level) => {
						const oscillator = this.audio.createOscillator();
						const envelope = this.audio.createGain();
						oscillator.type = type || "sine";
						oscillator.frequency.setValueAtTime(frequency, now + start);
						envelope.gain.setValueAtTime(0.0001, now + start);
						envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, (level || 0.12) * volume), now + start + 0.012);
						envelope.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
						oscillator.connect(envelope);
						envelope.connect(gain);
						oscillator.start(now + start);
						oscillator.stop(now + start + duration + 0.02);
					};
					if (kind === "open") {
						tone(mode === "emote" ? 420 : 360, 0, 0.1, "sine", 0.08);
						tone(mode === "emote" ? 680 : 560, 0.045, 0.16, "triangle", 0.06);
					} else if (kind === "close") {
						tone(420, 0, 0.1, "sine", 0.05);
					} else if (kind === "hover") {
						tone(880, 0, 0.035, "sine", 0.025);
					} else if (kind === "send") {
						tone(520, 0, 0.08, "triangle", 0.08);
						tone(780, 0.05, 0.13, "triangle", 0.07);
					} else if (kind === "sent") {
						tone(660, 0, 0.09, "sine", 0.06);
						tone(990, 0.06, 0.18, "sine", 0.05);
					} else if (kind === "question") {
						tone(392, 0, 0.16, "sine", 0.08);
						tone(587, 0.12, 0.25, "triangle", 0.07);
					} else if (kind === "error") {
						tone(180, 0, 0.14, "sawtooth", 0.06);
						tone(140, 0.1, 0.2, "sawtooth", 0.05);
					}
				} catch {}
			}
		}

		const inject = ["slots", "sessions"];

		function createAgentPing(ctx, options) {
			return new AgentPing(ctx, options);
		}

		function apply(ctx) {
			if (!ctx || !ctx.slots) return null;
			try {
			const controller = createAgentPing(ctx);
			ctx.effect(() => {
				controller.mount();
				controller.startBridge();
				return () => controller.dispose();
			}, "agent-ping: signal wheel");
			ctx.slots.inject("conversation.input.dock", () =>
				ctx.slots.register(
					{
						name: "conversation.input.dock",
						id: "agent-ping-session-bridge",
						order: 999,
						inject: (sessionId) => {
							queueMicrotask(() => controller.bindSession(sessionId));
							return { sessionId };
						}
					},
					(props) => {
						try {
							if (props && props.sessionId) controller.bindSession(props.sessionId);
						} catch (error) {
							console.error("[agent-ping] dock bridge failed", error);
							throw error;
						}
						return null;
					}
				)
			);
			return controller;
			} catch (error) {
				console.error("[agent-ping] apply failed", error);
				throw error;
			}
		}

		exports.apply = apply;
		exports.inject = inject;
		exports.createAgentPing = createAgentPing;
		exports.captureTarget = captureTarget;
		exports.PINGS = PINGS;
		exports.DEFAULT_EMOTES = DEFAULT_EMOTES;
		exports.VERSION = VERSION;
		return module.exports;
	}
});
