/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import svgrPlugin from 'vite-plugin-svgr';
import envCompatible from 'vite-plugin-env-compatible';
import tsconfigPaths from 'vite-tsconfig-paths';
import { externalGlobalPlugin } from "esbuild-plugin-external-global";
import { esbuildCommonjs, viteCommonjs } from "@kckst8/vite-plugin-commonjs";
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import { NodeModulesPolyfillPlugin } from "@esbuild-plugins/node-modules-polyfill";

// https://vitejs.dev/config/
export default defineConfig({
  // This changes the output dir from dist to build
  server: {
    port: 3000,
    strictPort: true,
  },
  envPrefix: "REACT_APP_",
  build: {
    outDir: 'build',
  },
  plugins: [
    react(),
    svgrPlugin({
      svgrOptions: {
        icon: true,
      },
    }),
    envCompatible(),
    tsconfigPaths(),
  ],
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
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
          "@itwin/core-frontend",
          "@itwin/presentation-frontend",
          "@itwin/presentation-components",
          "@itwin/appui-react",
        ]),
      ],
    },
    include: ["@studio/promise-utils"], // see https://github.com/vitejs/vite/issues/5668
  },
})