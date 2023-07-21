/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { defineConfig, loadEnv, searchForWorkspaceRoot } from "vite";
import envCompatible from "vite-plugin-env-compatible";
import browserslistToEsbuild from "browserslist-to-esbuild";
import viteInspect from "vite-plugin-inspect";
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";
import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";
import { externalGlobalPlugin } from "esbuild-plugin-external-global";
import copy from "rollup-plugin-copy";
import ignore from "rollup-plugin-ignore";
import rollupVisualizer from "rollup-plugin-visualizer";
import { webpackStats } from "rollup-plugin-webpack-stats";
import * as packageJson from "./package.json";
import path from "path";

const mode = process.env.NODE_ENV === "development" ? "development" : "production";

// array of public directories static assets from dependencies to copy
const assets = Object.keys(packageJson.dependencies)
  .map((pkgName) => {
    try {
      // get path and replace last segment with specific file name to "public/*"
      let pkg = require.resolve(pkgName).replace(/[^\\/]+$/, "public/*");
      // remove "cjs/" or "cjs\" from path
      pkg = pkg.replace(/cjs[\/\\]/, "");
      // use relative path with forward slashes
      return path.relative(process.cwd(), pkg).replace(/\\/g, '/');
    } catch { return "undefined"; }
  })
  .filter((path) => path !== "undefined");
assets.push("./public/*");

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
    build: {
      outDir: "./lib",
      sourcemap: "inline", // append to the resulting output file
      minify: false, // disable compaction of source code
      target: browserslistToEsbuild(), // for browserslist in package.json
      commonjsOptions: {
        // plugin to convert CommonJS modules to ES6, so they can be included in bundle
        include: [
          /core\/electron/, // prevent error in ElectronApp
          /core\/mobile/, // prevent error in MobileApp
          /node_modules/, // prevent errors for modules
        ],
      },
      rollupOptions: {
        input: "src/index.ts",
        // run `rushx build --stats` to view stats
        plugins: [
          ...(process.env.npm_config_stats !== undefined ? [
            rollupVisualizer({
              open: true,
              filename: "stats.html",
              template: "treemap",
              sourcemap: true,
            }),
            webpackStats(), // needs to be the last plugin
          ] : []),
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
        verbose: true,
        overwrite: true,
        copyOnce: true, // only during initial build or on change
      }),
      // open http://localhost:3000/__inspect/ to debug vite plugins
      ...(mode === "development" ? [viteInspect({ build: true })] : []),
      envCompatible({
        prefix: "IMJS_",
      }),
    ],
    optimizeDeps: {
      esbuildOptions: {
        plugins: [
          NodeGlobalsPolyfillPlugin({
          // Node.js globals not available to bundler by default ('process', '__dirname', etc.)
            process: true,
            buffer: true,
          }),
          // Node.js modules not available to bundler by default
          NodeModulesPolyfillPlugin(),
          externalGlobalPlugin({
            // allow global `window` object to access electron as external global
            electron: "window['electron']",
          }),
        ],
      },
      // overoptimized dependencies in the same monorepo (vite converts all cjs to esm)
      include: [
        "@itwin/core-common", // for opening iModel error
        "@itwin/core-electron/lib/cjs/ElectronFrontend", // import from module error
        "@itwin/core-frontend", // file in repository uses require (cjs)
        "@itwin/core-mobile/lib/cjs/MobileFrontend", // import from module error
      ],
    },
  };
});
