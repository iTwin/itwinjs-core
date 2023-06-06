/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { defineConfig, loadEnv, searchForWorkspaceRoot } from 'vite';
import react from '@vitejs/plugin-react';
import svgrPlugin from 'vite-plugin-svgr';
import envCompatible from 'vite-plugin-env-compatible';
import tsconfigPaths from 'vite-tsconfig-paths';
import { externalGlobalPlugin } from 'esbuild-plugin-external-global';
import { esbuildCommonjs, viteCommonjs } from '@kckst8/vite-plugin-commonjs';
// import { commonjs } from '@rollup/plugin-commonjs'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill';
import ignore from 'rollup-plugin-ignore';
import viteInspect from "vite-plugin-inspect";
import replace from '@rollup/plugin-replace';
import rollupNodeModulesPolyfillPlugin from "rollup-plugin-node-polyfills";

const mode = process.env.NODE_ENV === "development" ? "development" : "production";

// https://vitejs.dev/config/
export default defineConfig(() => {
  // This changes the output dir from dist to build
  process.env = {...process.env, ...loadEnv(mode, process.cwd())};
  return {
    server: {
        // open: false, // BROWSER = none
        open: true,
        port: 3000,
        strictPort: true,
        fs: {
          allow: [
            searchForWorkspaceRoot(process.cwd()),
          ],
        },
    },
    envPrefix: "REACT_APP_",
    build: {
      outDir: './lib',
      commonjsOptions: {
        include: [/core\/electron/, /node_modules/],
      },
      rollupOptions: {
        input: 'src/index.ts',
        // plugins: [commonjs()]
      }
    },
    plugins: [
      ignore(["electron"]),
      react(),
      replace({
        "process.env.NODE_ENV": JSON.stringify("development")
      }),
      viteInspect({ build: true }),
      svgrPlugin({
      svgrOptions: {
        icon: true,
      },
    }),
      envCompatible(),
      tsconfigPaths(),
    ],
    resolve: {
        alias: [
        ],
    },
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
          esbuildCommonjs([
            'react-s3'
          ]),
        ],
      },
      // overoptimized dependencies in the same monorepo
      include: [
        "@itwin/core-electron/lib/cjs/ElectronFrontend",
        "@itwin/core-mobile/lib/cjs/MobileFrontend",
        "@itwin/core-frontend"
      ]
    },
  }
})