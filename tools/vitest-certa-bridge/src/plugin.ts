/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Plugin } from "vite";
import { pathToFileURL } from "url";
import { resolve } from "path";
import { executeRegisteredCallback } from "./callbackRegistry";
import type { BridgeRequest, BridgeResponse, CertaBridgeOptions } from "./types";

/** Creates a Vite plugin that bridges browser-side test code to Node.js backend callbacks. */
export function certaBridgePlugin(opts: CertaBridgeOptions = {}): Plugin {
  let cleanupFn: (() => Promise<void>) | undefined;
  let backendReady: Promise<void>;

  return {
    name: "vitest-certa-bridge",
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
