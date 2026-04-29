/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Plugin } from "vite";
import { randomUUID } from "crypto";
import { pathToFileURL } from "url";
import { resolve } from "path";
import { dispatchCallback } from "./callbackRegistry.js";
import type { BridgeRequest, BridgeResponse, CertaBridgeOptions } from "./types.js";

/**
 * Creates a Vite plugin that bridges browser-side test code to Node.js backend callbacks.
 * @beta
 */
export function certaBridgePlugin(opts: CertaBridgeOptions = {}): Plugin {
  let cleanupFn: (() => Promise<void>) | undefined;
  // Initialize to resolved promise so awaiting backendReady before backend init is safe.
  let backendReady: Promise<void> = Promise.resolve();

  // Per-session token prevents unauthorized callers from invoking backend callbacks.
  const bridgeToken = randomUUID();

  return {
    name: "vitest-certa-bridge",

    // Auto-configure resolve.dedupe, optimizeDeps.exclude, and /ipc proxy here
    // (in config()) so changes take effect before Vite resolves its config.
    // Mutations made in configureServer() are post-resolution and are silently ignored
    // by Vite 5 for server.proxy.
    config() {
      const patch: any = {};

      if (opts.workspacePackages?.length) {
        patch.resolve = { dedupe: opts.workspacePackages };
        patch.optimizeDeps = { exclude: opts.workspacePackages };
      }

      if (opts.backendPort) {
        const target = `ws://127.0.0.1:${opts.backendPort}`;
        patch.server = { proxy: { "/ipc": { target, ws: true } } };
      }

      return Object.keys(patch).length ? patch : undefined;
    },

    // Inject the bridge token and window._CertaSendToBackend so external packages that still
    // use Certa's browser global (e.g., @itwin/oidc-signin-tool) work without changes.
    transformIndexHtml() {
      return [{
        tag: "script",
        attrs: { type: "module" },
        children: `
window.__CERTA_BRIDGE_TOKEN__ = "${bridgeToken}";
window._CertaSendToBackend = async function(name, args) {
  const res = await fetch("/__certa_bridge", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-certa-bridge-token": "${bridgeToken}" },
    body: JSON.stringify({ name, args }),
  });
  if (!res.ok) throw new Error("Bridge request failed with status " + res.status);
  const data = await res.json();
  if (data.error) { const e = new Error(data.error.message); e.stack = data.error.stack; throw e; }
  return data.result;
};`,
        injectTo: "head-prepend",
      }];
    },

    configureServer(server) {
      // Load backendInitModule if specified
      if (opts.backendInitModule) {
        const initModule = opts.backendInitModule;
        backendReady = (async () => {
          const modulePath = resolve(process.cwd(), initModule);
          const moduleUrl = pathToFileURL(modulePath).href;
          const mod = await import(moduleUrl);
          const result = mod.default ?? mod;
          if (typeof result === "function") {
            cleanupFn = result;
          } else if (typeof result?.then === "function") {
            const resolved = await result;
            if (typeof resolved === "function") {
              cleanupFn = resolved;
            }
          }
        })();
        backendReady.catch((err) => { console.error("[vitest-certa-bridge] Backend init failed:", err); });
      }

      // Register teardown
      server.httpServer?.on("close", async () => {
        if (cleanupFn)
          await cleanupFn();
      });

      // Add bridge middleware
      server.middlewares.use("/__certa_bridge", async (req, res) => {
        try {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: { message: "Method not allowed" } }));
            return;
          }

          if (req.headers["x-certa-bridge-token"] !== bridgeToken) {
            res.statusCode = 403;
            res.end(JSON.stringify({ error: { message: "Invalid or missing bridge token" } }));
            return;
          }

          // Read body
          const chunks: Buffer[] = [];
          for await (const chunk of req)
            chunks.push(chunk as Buffer);
          const body: BridgeRequest = JSON.parse(Buffer.concat(chunks).toString());

          // Wait for backend to be ready
          await backendReady;

          // Execute callback (token already validated above)
          const response: BridgeResponse = {};
          try {
            response.result = await dispatchCallback(body.name, body.args, bridgeToken, bridgeToken);
          } catch (err: any) {
            response.error = { message: err.message, stack: err.stack };
          }

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(response));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: { message: err.message, stack: err.stack } }));
        }
      });
    },
  };
}
