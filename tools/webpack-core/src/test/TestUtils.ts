/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import * as fs from "fs-extra";
import * as webpack from "webpack";
const MODULE = require("module");
const { usedDeps } = require("../utils/resolve-recurse/resolve");

function createTestCompiler(web: any, config: any, vol?: any) {
  let compiler: any;
  try {
    compiler = web(config);
  } catch (err) {
    console.log(err);
  }
  if (vol)
    compiler.inputFileSystem = vol;
  return compiler;
}

export async function runWebpack(config: any, vol?: any) {
  const compiler = createTestCompiler(webpack, config, vol);
  return new Promise<any>((resolve, reject) => {
    compiler.run((err: any, stats: any) => (err) ? reject(err) : resolve(stats.toJson({ logging: true })));
  });
}

export function getTestConfig(srcFile: string, pluginsToTest: any[], externalsToTest?: any[], rules?: any[]) {
  return {
    mode: "production",
    entry: [
      path.join(__dirname, srcFile),
    ],
    output: {
      path: path.join(__dirname, "dist"),
      chunkFilename: path.basename(srcFile),
      filename: "runtime.js",
      pathinfo: false,
    },
    plugins: pluginsToTest,
    externals: externalsToTest,
    optimization: { minimize: false, runtimeChunk: true },
    module: {
      rules,
    },
  };
}

export function fsFromJson(json: any) {
  for (const filePath in json) {
    if (json.hasOwnProperty(filePath)) {
      const dirName = path.dirname(filePath);
      if (!fs.existsSync(dirName)) {
        fs.mkdirSync(dirName, { recursive: true });
      }
      fs.writeFileSync(filePath, json[filePath]);
    }
  }
}

function clearModuleCache(paths: string) {
  for (const [key, value] of Object.entries(MODULE._pathCache)) {
    if ((value as string).startsWith(paths) || key.startsWith(paths) || key.includes("resolve-recurse")) {
      delete MODULE._pathCache[key];
    }
  }
  for (const key in MODULE._cache) {
    if (key.startsWith(paths) || key.includes("resolve-recurse")) {
      delete MODULE._cache[key];
    }
  }
  usedDeps.clear();
}

function clearRequireCache(paths: string) {
  for (const key in require.cache) {
    if (key.startsWith(paths) || key.includes("resolve-recurse")) {
      delete require.cache[key];
    }
  }
}

export function clearCache(dir: string) {
  const paths: string = path.join(dir, "/assets/");
  clearModuleCache(paths);
  clearRequireCache(paths);
}

export function clearFileSystem(dir: string) {
  fs.removeSync(path.join(dir, "/assets/"));
  fs.removeSync(path.join(dir, "/dist/"));
}
