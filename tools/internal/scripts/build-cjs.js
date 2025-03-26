/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

exports.command = "build-cjs";
exports.builder = (yargs) =>
  yargs.strict(true).options({
    packageDir: {
      alias: "p",
      describe: "Path to the package root directory.",
      type: "string",
      default: process.cwd(),
    },
    tsconfig: {
      describe: "Path to the CommonJS `tsconfig.json`.",
      type: "string",
      default: path.join(process.cwd(), "tsconfig.cjs.json"),
    },
  });

exports.handler = async (argv) => {
  const packageJsonPath = path.join(argv.packageDir, "package.json");
  const tsconfigPath = argv.tsconfig;

  const packageJsonContent = fs.readFileSync(packageJsonPath, "utf8");
  const packageJson = JSON.parse(packageJsonContent);

  try {
    const outDir = getOutputDir(tsconfigPath);
    // overwrite package.json with the new type
    fs.writeFileSync(packageJsonPath, JSON.stringify({ ...packageJson, type: "commonjs" }));
    // transpile
    execSync(`tsc -p ${tsconfigPath}`, { stdio: "inherit", shell: true });
    // emit module type to out dir
    fs.writeFileSync(path.join(outDir, "package.json"), `{ "type": "commojs" }`);
  } catch (e) {
    console.error(e);
  } finally {
    // revert package.json content
    fs.writeFileSync(packageJsonPath, packageJsonContent);
  }
};

function getOutputDir(tsconfigPath) {
  const res = execSync(`tsc -p ${tsconfigPath} --showConfig`, { shell: true });
  const config = JSON.parse(res.toString());
  const outDir = config.compilerOptions.outDir;
  if (!outDir) {
    console.error(`No "outDir" found in "${tsconfigPath}`);
    throw new Error(`No "outDir" found in "${tsconfigPath}`);
  }
  return outDir;
}
