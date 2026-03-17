/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Plugin } from "vite";
import { randomUUID } from "crypto";
import { pathToFileURL } from "url";
import { resolve } from "path";
import { executeRegisteredCallback } from "./callbackRegistry.js";
import type { BridgeRequest, BridgeResponse, CertaBridgeOptions } from "./types.js";

/** Creates a Vite plugin that bridges browser-side test code to Node.js backend callbacks. */
export function certaBridgePlugin(opts: CertaBridgeOptions = {}): Plugin {
  let cleanupFn: (() => Promise<void>) | undefined;
  let backendReady: Promise<void>;

  // Per-session token prevents unauthorized callers from invoking backend callbacks.
  const bridgeToken = randomUUID();

  return {
    name: "vitest-certa-bridge",

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
        backendReady = (async () => {
          const modulePath = resolve(process.cwd(), opts.backendInitModule!);
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
      } else {
        backendReady = Promise.resolve();
      }

      // Register teardown
      server.httpServer?.on("close", async () => {
        if (cleanupFn)
          await cleanupFn();
      });

      // Add bridge middleware
      server.middlewares.use("/__certa_bridge", async (req, res) => {
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

        // Execute callback
        const response: BridgeResponse = {};
        try {
          response.result = await executeRegisteredCallback(body.name, body.args);
        } catch (err: any) {
          response.error = { message: err.message, stack: err.stack };
        }

        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(response));
      });
    },
  };
}
