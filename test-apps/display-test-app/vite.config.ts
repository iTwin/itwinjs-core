/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { defineConfig, loadEnv, searchForWorkspaceRoot } from 'vite';
import react from '@vitejs/plugin-react';
import svgrPlugin from 'vite-plugin-svgr';
import envCompatible from 'vite-plugin-env-compatible';
import tsconfigPaths from 'vite-tsconfig-paths';
import browserslistToEsbuild from 'browserslist-to-esbuild';
import { externalGlobalPlugin } from 'esbuild-plugin-external-global';
import { esbuildCommonjs, viteCommonjs } from '@kckst8/vite-plugin-commonjs';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill';
import ignore from 'rollup-plugin-ignore';
import viteInspect from "vite-plugin-inspect";
import replace from '@rollup/plugin-replace';
import copy from "rollup-plugin-copy";
import * as packageJson from "./package.json";
import fs from 'fs';

const mode = process.env.NODE_ENV === "development" ? "development" : "production";
const iTwinDeps = Object.keys(packageJson.dependencies)
  .filter((pkgName) => pkgName.startsWith("@itwin"))
  .flatMap((pkgName) => {
    return [`./node_modules/${pkgName}/lib/public/**`, `${pkgName.replace("@itwin/core-", "../../core/")}/src/public/**`]
  })
  // use require.resolve for paths
  console.log(iTwinDeps);

// https://vitejs.dev/config/
export default defineConfig(() => {
  // This changes the output dir from dist to build
  process.env = {...process.env, ...loadEnv(mode, process.cwd())};
  return {
    debug: mode === "development",
    server: {
        open: false,
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
      sourcemap: mode === "development",
      minify: mode !== "development",
      target: browserslistToEsbuild(),
      commonjsOptions: {
        include: [/core\/electron/, /core\/mobile/, /node_modules/],
      },
      rollupOptions: {
        input: 'src/index.ts',
      }
    },
    plugins: [
      ignore(["electron"]),
      react(),
      copy({
        targets: [
          {
            src: iTwinDeps,
            dest: "public",
            rename: (_name, _extension, fullPath) => {
              const regex = new RegExp("(public(?:\\\\|/))(.*)");
              return regex.exec(fullPath)[2];
            },
          },
        ],
        verbose: true,
        overwrite: true,
      }),
      replace({
        "process.env.NODE_ENV": JSON.stringify("development"),
        preventAssignment: true
      }),
      ...(mode === "development" ? [viteInspect({ build: true })] : []),
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
      // force: true, // TODO: remove line
      // overoptimized dependencies in the same monorepo
      include: [
        "@itwin/core-electron/lib/cjs/ElectronFrontend",
        "@itwin/core-mobile/lib/cjs/MobileFrontend",
        "@itwin/core-frontend"
      ]
    },
  }
})