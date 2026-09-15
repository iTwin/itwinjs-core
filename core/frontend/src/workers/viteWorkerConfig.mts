/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Script } from "node:vm";
import { defineConfig, type Plugin } from "vite";

export interface WorkerConfigOptions {
  emptyOutDir?: boolean;
  entry: string;
  moduleSideEffects?: false | ((id: string) => boolean);
  outDir: string;
  outputFileName: string;
}

// Rollup reserves \0-prefixed IDs for virtual modules, preventing this stub from being resolved as a file or package.
const emptyNodeModuleId = "\0empty-node-module";
// draco3d exposes Node-only branches that the browser workers never execute.
const nodeModulesToStub = new Set(["fs", "path", "node:fs", "node:path"]);

function stubNodeModules(): Plugin {
  return {
    name: "stub-node-modules",
    enforce: "pre",
    resolveId(source) {
      return nodeModulesToStub.has(source) ? emptyNodeModuleId : undefined;
    },
    load(id) {
      return id === emptyNodeModuleId ? "export default {};" : undefined;
    },
  };
}

function verifyWorkerBundle(outputFileName: string): Plugin {
  return {
    name: "verify-worker-bundle",
    generateBundle(_options, bundle) {
      const outputs = Object.values(bundle);
      if (outputs.length !== 1)
        this.error(`Expected one worker output, but Vite produced ${outputs.length}.`);

      const [output] = outputs;
      if (output.type !== "chunk" || output.fileName !== outputFileName)
        this.error(`Expected a single ${outputFileName} chunk.`);

      if (output.imports.length > 0 || output.dynamicImports.length > 0 || output.referencedFiles.length > 0)
        this.error("The worker must be self-contained.");

      if (/\bprocess\.env\b|\brequire\s*\(/.test(output.code))
        this.error("The worker contains an unresolved Node.js runtime reference.");

      try {
        new Script(output.code);
      } catch (error) {
        this.error(`The worker is not a classic script: ${error}`);
      }
    },
  };
}

export function createWorkerConfig(options: WorkerConfigOptions) {
  return defineConfig({
    publicDir: false,
    logLevel: "error",
    define: {
      // Vite treats string values as replacement expressions, so include quotes to produce a string literal.
      "process.env.NODE_ENV": '"production"',
    },
    plugins: [stubNodeModules(), verifyWorkerBundle(options.outputFileName)],
    build: {
      outDir: options.outDir,
      emptyOutDir: options.emptyOutDir ?? true,
      copyPublicDir: false,
      sourcemap: false,
      minify: "esbuild",
      target: "es2022",
      lib: {
        entry: options.entry,
        formats: ["iife"],
        name: "WorkerBundle",
        fileName: () => options.outputFileName,
      },
      rollupOptions: {
        treeshake: {
          moduleSideEffects: options.moduleSideEffects ?? false,
        },
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  });
}
