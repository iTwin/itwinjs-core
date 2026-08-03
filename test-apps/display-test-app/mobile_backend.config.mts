/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { isBuiltin } from "node:module";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

const emptyModuleId = "\0dta-mobile-empty-module";

function ignoreDesktopModules(): Plugin {
  return {
    name: "ignore-desktop-modules",
    enforce: "pre",
    resolveId(source) {
      if (source.includes("electron-authorization")
        || source.includes("ElectronBackend")
        || source.includes("AzCopyFileHandler"))
        return emptyModuleId;

      return undefined;
    },
    load(id) {
      if (id !== emptyModuleId)
        return undefined;

      return [
        "export const ElectronHost = undefined;",
        "export const ElectronMainAuthorization = undefined;",
        "export default {};",
      ].join("\n");
    },
  };
}

export default defineConfig({
  build: {
    commonjsOptions: {
      // NativeLibrary's fallback require must remain dynamic; mobile resolves the binding through process._linkedBinding.
      ignoreDynamicRequires: true,
      // The entry point and workspace dependencies are compiled CommonJS outside node_modules.
      include: [/./],
      transformMixedEsModules: true,
    },
    minify: false,
    outDir: path.resolve(__dirname, "lib/mobile"),
    reportCompressedSize: false,
    rollupOptions: {
      external: (id) => isBuiltin(id)
        || id === "electron"
        || id === "bufferutil"
        || id === "utf-8-validate",
      input: path.resolve(__dirname, "lib/backend/MobileMain.js"),
      output: {
        entryFileNames: "main.js",
        footer: "module.exports = { main: {} };",
        format: "cjs",
        inlineDynamicImports: true,
      },
    },
    sourcemap: "inline",
    target: "esnext",
  },
  define: {
    // The existing mobile command produces a development-mode Webpack bundle.
    "process.env.NODE_ENV": JSON.stringify("development"),
    "global.GENTLY": "false",
    "process.version": JSON.stringify("v10.9.0"),
  },
  plugins: [ignoreDesktopModules()],
  publicDir: false,
  resolve: {
    conditions: ["node", "development"],
    mainFields: ["main", "module"],
  },
});
