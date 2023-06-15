/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { defineConfig, loadEnv, searchForWorkspaceRoot } from "vite";
import envCompatible from "vite-plugin-env-compatible";
import tsconfigPaths from "vite-tsconfig-paths";
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
import path from 'path';

const mode = process.env.NODE_ENV === "development" ?? "production";

const iTwinDeps = Object.keys(packageJson.dependencies)
  .filter((pkgName) => pkgName.startsWith("@itwin"))
  .flatMap((pkgName) => {
    return [
      `./node_modules/${pkgName}/lib/public/*`,
      `${pkgName.replace("@itwin/core-", "../../core/")}/src/public/*`,
    ];
  });
console.log(iTwinDeps);

// use require.resolve for paths
const resolves = Object.keys(packageJson.dependencies)
  .map((pkgName) => {
    try {
      const pkg = require.resolve(pkgName);
      const delimiter = pkg.includes("\\") ? "\\" : "/";
      return path.relative(process.cwd(), pkg.replace(/[^\\/]+$/, `public${delimiter}*`)).replace(/\\/g, '/').toString();
    } catch {return "undefined";}
  })
  .filter((pkg) => pkg !== 'undefined');
// use require.resolve for paths
console.log(resolves);

// https://vitejs.dev/config/
export default defineConfig(() => {
  // This changes the output dir from dist to build
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };
  return {
    debug: true,
    server: {
      open: false,
      port: 3000,
      strictPort: true,
      fs: {
        allow: [searchForWorkspaceRoot(process.cwd())],
      },
    },
    envPrefix: "IMJS_",
    build: {
      outDir: "./lib",
      sourcemap: "inline",
      minify: false,
      target: browserslistToEsbuild(),
      commonjsOptions: {
        include: [
          /core\/common/,
          /core\/electron/,
          /core\/frontend/,
          /core\/mobile/,
          /node_modules/,
        ],
      },
      rollupOptions: {
        input: "src/index.ts",
        plugins: [
          // run build with --stats flag to use plugins
          ...(process.env.npm_config_stats !== undefined ? [
            rollupVisualizer({
              open: true,
              filename: "stats.html",
              template: "network",
              sourcemap: true,
            }),
            webpackStats(), // needs to be the last plugin
          ] : []),
        ],
      },
    },
    plugins: [
      ignore(["electron"]), // equivalent to webpack externals
      // copy static assets to public folder
      copy({
        targets: [
          {
            src: resolves,
            dest: "public",
            rename: (_name, _extension, fullPath) => {
              const regex = new RegExp("(public(?:\\\\|/))(.*)");
              return regex.exec(fullPath)![2];
            },
          },
        ],
        verbose: true,
        overwrite: true,
        copyOnce: true,
      }),
      ...(process.env.NODE_ENV === "development" ? [viteInspect({ build: true })] : []),
      envCompatible({
        prefix: "IMJS_",
      }),
      tsconfigPaths(),
    ],
    optimizeDeps: {
      esbuildOptions: {
        plugins: [
          NodeGlobalsPolyfillPlugin({
            process: true,
            buffer: true,
          }),
          NodeModulesPolyfillPlugin(),
          externalGlobalPlugin({
            electron: "window['electron']",
          }),
        ],
      },
      // overoptimized dependencies in the same monorepo
      include: [
        "@itwin/core-common",
        "@itwin/core-electron/lib/cjs/ElectronFrontend",
        "@itwin/core-frontend",
        "@itwin/core-mobile/lib/cjs/MobileFrontend",
      ],
    },
  };
});
