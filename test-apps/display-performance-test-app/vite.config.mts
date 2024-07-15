/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { defineConfig, loadEnv, searchForWorkspaceRoot } from "vite";
import envCompatible from "vite-plugin-env-compatible";
import browserslistToEsbuild from "browserslist-to-esbuild";
import viteInspect from "vite-plugin-inspect";
import copy from "rollup-plugin-copy";
import ignore from "rollup-plugin-ignore";
import rollupVisualizer from "rollup-plugin-visualizer";
import externalGlobals from "rollup-plugin-external-globals";
import { webpackStats } from "rollup-plugin-webpack-stats";
import * as packageJson from "./package.json";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const mode =
  process.env.NODE_ENV === "development" ? "development" : "production";

// array of public directories static assets from dependencies to copy
const assets = ["./public/*"]; // assets for test-app
// local path alias to the ts entry point of each package
const packageAliases = {};

Object.keys(packageJson.dependencies).forEach((pkgName) => {
  if (pkgName.startsWith("@itwin") || pkgName.startsWith("@bentley")) {
    try {
      // gets dependency path
      const pkgPath = require.resolve(pkgName);

      // replaces everything after /lib/ with /lib/public/* to get static assets
      let pkgPublicPath = pkgPath.replace(/([\/\\]lib[\/\\]).*/, "$1public/*");

      const assetsPath = path
        .relative(process.cwd(), pkgPublicPath)
        .replace(/\\/g, "/"); // use relative path with forward slashes
      if (assetsPath.endsWith("lib/public/*")) {
        // filter out pkgs that actually dont have assets
        assets.push(assetsPath);
      }

      // ignore pkgs outside the monorepo (will have temp in path) and pkgs that are for backend
      if (pkgPath.includes("temp") || pkgPath.includes("backend")) return;
      packageAliases[pkgName] = pkgPath
        .replace("\\lib\\cjs\\", "\\src\\")
        .replace("/lib/cjs/", "/src/")
        .replace(".js", ".ts");
    } catch {}
  }
});

// https://vitejs.dev/config/
export default defineConfig(() => {
  // This changes the output dir from dist to build
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };
  return {
    debug: mode === "development",
    server: {
      open: false, // don't open browser
      port: 3000,
      strictPort: true, // exit if port is already in use
      fs: {
        // give Vite access to files in itwinjs-core root directory
        allow: [searchForWorkspaceRoot(process.cwd())],
      },
    },
    envPrefix: "IMJS_",
    publicDir: ".static-assets",
    logLevel: process.env.VITE_CI ? "error" : "warn",
    build: {
      outDir: "./lib",
      sourcemap: !process.env.VITE_CI, // append to the resulting output file if not running in CI.
      minify: false, // disable compaction of source code
      target: browserslistToEsbuild(), // for browserslist in package.json
      commonjsOptions: {
        // plugin to convert CommonJS modules to ESM, so they can be included in bundle
        include: [
          /core\/electron/, // prevent error in ElectronApp
          /core\/mobile/, // prevent error in MobileApp
          /node_modules/, // prevent errors from dependencies
        ],
        transformMixedEsModules: true, // transforms require statements
      },
      rollupOptions: {
        input: path.resolve(__dirname, "index.html"),
        // run `rushx build --stats` to view stats
        plugins: [
          ...(process.env.OUTPUT_STATS !== undefined
            ? [
                rollupVisualizer({
                  open: true,
                  filename: "stats.html",
                  template: "treemap",
                  sourcemap: true,
                }),
                webpackStats(), // needs to be the last plugin
              ]
            : []),
          externalGlobals({
            // allow global `window` object to access electron as external global
            electron: "window['electron']",
          })
        ],
      },
    },
    plugins: [
      ignore(["electron"]), // equivalent to webpack externals
      // copy static assets to .static-assets folder
      copy({
        targets: [
          {
            src: assets,
            dest: ".static-assets",
            rename: (_name, _extension, fullPath) => {
              // rename files to name of file without directory path
              const regex = new RegExp("(public(?:\\\\|/))(.*)");
              return regex.exec(fullPath)![2];
            },
          },
        ],
        overwrite: true,
        copyOnce: true, // only during initial build or on change
        hook: "buildStart",
      }),
      // open http://localhost:3000/__inspect/ to debug vite plugins
      ...(mode === "development" ? [viteInspect({ build: true })] : []),
      envCompatible({
        prefix: "IMJS_",
      }),
    ],
    define: {
      "process.env": process.env, // injects process.env into the frontend
    },
    resolve: {
      alias: {
        ...packageAliases,
        "@itwin/core-electron/lib/cjs/ElectronFrontend":
          "@itwin/core-electron/src/ElectronFrontend.ts",
        "@itwin/core-mobile/lib/cjs/MobileFrontend":
          "@itwin/core-mobile/src/MobileFrontend.ts",
        "../../package.json": "../package.json", // in core-frontend
      },
    },
    optimizeDeps: {
      force: true, // forces cache dumps on each rebuild. should be turned off once the issue in vite with monorepos not being correctly optimized is fixed. Issue link: https://github.com/vitejs/vite/issues/14099
      // overoptimized dependencies in the same monorepo (vite converts all cjs to esm)
      include: [
        "@itwin/core-electron/lib/cjs/ElectronFrontend", // import from module error
        "@itwin/core-mobile/lib/cjs/MobileFrontend", // import from module error
      ],
      exclude: [
        "@itwin/core-frontend", //prevents import not resolved errors
        "@itwin/core-common", //prevents rpc errors
      ],
    },
  };
});
