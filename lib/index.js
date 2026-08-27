// Host half of the file-upload plugin.
//
// Registers a tiny HTTP endpoint (POST /file-upload) on the web server that the
// browser button calls. The uploaded bytes are streamed to a file under
// `<uploadRoot>/uploads`, where `uploadRoot` defaults to the current session's
// workspace (the agent's working directory). The response reports the absolute
// saved path so the client can surface it and the agent can `read` it.
import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const name = "file-upload";
const inject = ["webServer"];

/** Strip path separators and characters a filename cannot carry on Windows. */
function sanitizeName(raw) {
	const base = basename(String(raw ?? "").trim() || "file");
	const cleaned = base.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim();
	return cleaned === "" || cleaned === "." || cleaned === ".." ? "file" : cleaned;
}

/**
 * Resolve the upload root: an explicit `config.uploadRoot` always wins; otherwise
 * fall back to the current active session's cwd, then `process.cwd()`. The agent
 * tools resolve against the session cwd, so a session cwd keeps uploads where the
 * agent can read them.
 * @param ctx - host context (may expose the `sessions` service).
 * @returns an absolute directory path.
 */
function sessionCwd(ctx) {
	try {
		const sessions = ctx.get("sessions");
		const list = sessions?.list?.() ?? [];
		const hit = list.find((entry) => entry?.header?.cwd);
		if (hit?.header?.cwd) return hit.header.cwd;
	} catch {
		/* sessions service absent or not ready — fall through to process.cwd() */
	}
	return process.cwd();
}

function apply(ctx, config = {}) {
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: "/file-upload",
		handler: async (req, res) => {
			if (req.method !== "POST") {
				res.writeHead(405);
				res.end();
				return;
			}
			try {
				const root = resolve(config.uploadRoot ?? sessionCwd(ctx), "uploads");
				await mkdir(root, { recursive: true });
				const url = new URL(req.url ?? "/", "http://x");
				const header = Array.isArray(req.headers["x-filename"]) ? req.headers["x-filename"][0] : req.headers["x-filename"];
				const rawName = url.searchParams.get("filename") ?? header ?? "file";
				let name = sanitizeName(rawName);
				let target = join(root, name);
				const dot = name.lastIndexOf(".");
				const stem = dot > 0 ? name.slice(0, dot) : name;
				const ext = dot > 0 ? name.slice(dot) : "";
				let counter = 1;
				for (;;) {
					try {
						await stat(target);
					} catch {
						break;
					}
					target = join(root, `${stem}-${counter}${ext}`);
					counter += 1;
				}
				await new Promise((resolveWrite, reject) => {
					const ws = createWriteStream(target);
					req.on("error", reject);
					ws.on("error", reject);
					ws.on("finish", resolveWrite);
					req.pipe(ws);
				});
				const info = await stat(target);
				res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
				res.end(JSON.stringify({ ok: true, path: target, name: basename(target), size: info.size }));
			} catch (error) {
				res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
				res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
			}
		}
	}), "dsh-file-upload: /file-upload route");
}

export { apply, inject, name };
