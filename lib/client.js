// Browser half of the file-upload plugin.
//
// Registers a small control into the conversation input-dock slot: an "upload"
// button beside a hidden multi-file input. Selecting files POSTs each one to the
// host's /file-upload endpoint, then shows the saved path as a chip and, when the
// framework hands us a draft writer, appends a file reference so the agent reads
// the file on the next message.
window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-file-upload",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		var react = require("react");
		var createElement = react.createElement;
		var useState = react.useState;
		var useRef = react.useRef;

		var inject = ["slots"];

		// Labels: prefer the ambient locale; fall back to Chinese then English.
		function labels() {
			var zh = typeof navigator !== "undefined" && /^zh/i.test(navigator.language || "");
			return zh ? {
				upload: "上传文件",
				uploading: "上传中…",
				failed: "上传失败",
				loaded: "已上传"
			} : {
				upload: "Upload file",
				uploading: "Uploading…",
				failed: "Upload failed",
				loaded: "Uploaded"
			};
		}

		function FileUploadDock(props) {
			props = props || {};
			var inputActions = props.inputActions;
			var useInput = props.useInput;
			var strs = labels();
			var inputRef = useRef(null);
			var [items, setItems] = useState([]);
			var [busy, setBusy] = useState(false);
			var [error, setError] = useState(null);

			// Read the current draft once during render (rules-of-hooks: the
			// selector hook may only run here, never inside an event handler).
			var draft = "";
			if (typeof useInput === "function") {
				try {
					draft = useInput(function (s) { return (s && s.draft) || ""; }) || "";
				} catch (e) {
					draft = "";
				}
			}

			var appendReference = function (path, name) {
				if (!(inputActions && typeof inputActions.setDraft === "function")) return;
				var note = "@\""
					+ path.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")
					+ "\" 请读取这个文件";
				try {
					inputActions.setDraft(draft.replace(/\s+$/, "") + (draft.replace(/\s+$/, "") ? "\n" : "") + note);
				} catch (e) {
					/* writing the draft is best-effort */
				}
			};

			var doUpload = async function (file) {
				setBusy(true);
				setError(null);
				try {
					var url = new URL("/file-upload", window.location.origin);
					url.searchParams.set("filename", file.name || "file");
					var res = await fetch(url.toString(), {
						method: "POST",
						headers: { "content-type": "application/octet-stream" },
						body: file
					});
					var json = null;
					try { json = await res.json(); } catch (e) { /* non-JSON body */ }
					if (!res.ok || !json || json.ok !== true) {
						throw new Error((json && json.error) ? json.error : ("HTTP " + res.status));
					}
					setItems(function (prev) { return prev.concat(json); });
					appendReference(json.path, json.name);
					return json;
				} catch (e) {
					setError(String((e && e.message) || e));
					return null;
				} finally {
					setBusy(false);
				}
			};

			var onFiles = function (event) {
				var files = event.target.files;
				if (!files || files.length === 0) return;
				var arr = Array.prototype.slice.call(files);
				arr.forEach(function (f) { doUpload(f); });
				event.target.value = "";
			};

			var openPicker = function () { if (inputRef.current) inputRef.current.click(); };

			var rootStyle = {
				display: "flex",
				flexWrap: "wrap",
				alignItems: "center",
				gap: 8,
				padding: "4px 12px 0",
				fontSize: 13,
				minWidth: 0
			};
			var btnStyle = {
				display: "inline-flex",
				alignItems: "center",
				gap: 6,
				borderRadius: 8,
				border: "1px solid var(--dsw-alias-border-l2-darkmode-thin, #d9d9d9)",
				background: "var(--dsw-specific-input-major, #ffffff)",
				color: "var(--dsw-alias-label-primary, #1f2329)",
				cursor: "pointer",
				padding: "4px 10px",
				fontSize: 13,
				userSelect: "none"
			};
			var chipStyle = {
				display: "inline-flex",
				alignItems: "center",
				gap: 6,
				borderRadius: 6,
				background: "var(--dsw-alias-interactive-bg-hover, #ececec)",
				color: "var(--dsw-alias-label-secondary, #444)",
				padding: "2px 8px",
				fontSize: 12,
				maxWidth: 340,
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap"
			};

			var children = [
				createElement("input", {
					ref: inputRef,
					type: "file",
					multiple: true,
					style: { display: "none" },
					onChange: onFiles
				}),
				createElement("button", {
					type: "button",
					disabled: busy,
					style: btnStyle,
					onClick: openPicker
				}, createElement("span", { "aria-hidden": "true" }, "\u2B06"),
					createElement("span", null, busy ? strs.uploading : strs.upload)),
				error ? createElement("span", { style: { color: "var(--dsw-alias-label-tertiary, #888)", fontSize: 12 } }, strs.failed + ": " + error) : null
			];

			items.forEach(function (it, idx) {
				children.push(createElement("span", {
					key: idx,
					title: it.path,
					style: chipStyle
				}, it.name + " (" + ((it.size || 0) / 1024).toFixed(1) + " KB)"));
			});

			return createElement("div", { "data-file-upload": "", style: rootStyle }, children);
		}

		function apply(ctx) {
			ctx.slots.inject("conversation.input.dock", function () {
				return ctx.slots.register({
					name: "conversation.input.dock",
					id: "file-upload",
					order: 200,
					locale: "conversation"
				}, FileUploadDock);
			});
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
