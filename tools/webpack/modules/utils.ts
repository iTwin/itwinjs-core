/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as path from "path";
import * as fs from "fs-extra";
import * as glob from "glob";

/** Class that holds the results of a build operation. */
export class Result {
  public constructor(public operation: string, public exitCode: number, public error?: any, public stdout?: string | undefined, public stderr?: string | undefined) {
  }
}

// find webpack executable.
export function findWebpack(): string | undefined {
  // first look in node_modules/webpack
  const webpackCommand: string = process.platform === "win32" ? "webpack.cmd" : "webpack";
  const inLocalNodeModules = path.resolve(process.cwd(), "node_modules/.bin", webpackCommand);
  if (fs.existsSync(inLocalNodeModules))
    return inLocalNodeModules;

  const inToolsWebpackNodeModules = path.resolve(process.cwd(), "node_modules/@bentley/webpack-tools/node_modules/.bin", webpackCommand);
  if (fs.existsSync(inToolsWebpackNodeModules))
    return inToolsWebpackNodeModules;

  return undefined;
}

// Utilities for file system operations

export function readPackageFileContents(packageRoot: string): any {
  const packageFileName = path.resolve(packageRoot, "./package.json");
  if (!fs.existsSync(packageFileName))
    return {};

  const packageFileContents = fs.readFileSync(packageFileName, "utf8");
  return JSON.parse(packageFileContents);
}

export function symlinkFiles(cwd: string, source: string, dest: string, alwaysCopy: boolean, detail: number): Result {
  // first we must create the destination directory, if it isn't already there.
  const sourceSpecification: string = path.resolve(cwd, source);
  let sourceDirectory: string = path.dirname(sourceSpecification);
  if (sourceDirectory.endsWith("**")) {
    sourceDirectory = sourceDirectory.slice(0, sourceDirectory.length - 3);
  }

  const destinationPath: string = path.resolve(cwd, dest);
  try {
    fs.mkdirSync(destinationPath, { recursive: true });

    const found: string[] = glob.sync(sourceSpecification, { nodir: true });

    for (const fileName of found) {
      // find it relative to source.
      const relativePath = path.relative(sourceDirectory, fileName);
      const outputPath = path.resolve(destinationPath, relativePath);
      if (fs.existsSync(outputPath)) {
        if (detail > 3)
          console.log("  File", outputPath, "already exists");
      } else {
        if (detail > 3)
          console.log(alwaysCopy ? "  Copying" : "  Symlinking", fileName, "to", outputPath);
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        if (alwaysCopy)
          fs.copyFileSync(fileName, outputPath);
        else
          fs.symlinkSync(fileName, outputPath);
      }
    }
  } catch (error) {
    return new Result("Symlink or Copy Source Resources", 1, error);
  }
  return new Result("Symlink or Copy Source Resources", 0);
}

function ensureSymlink(sourceFile: string, outFilePath: string, detail: number): number {
  try {
    if (fs.existsSync(outFilePath)) {
      try {
        const linkContents = fs.readlinkSync(outFilePath, { encoding: "utf8" });
        if (linkContents === sourceFile) {
          if (detail > 3)
            console.log("  File", outFilePath, "already exists");
          return 0;
        }
      } catch (_error) {
        // It's not a link, do nothing and let it get deleted.
      }
      if (detail > 3)
        console.log("  Removing existing symlink found in", outFilePath);
      fs.unlinkSync(outFilePath);
    }
    if (detail > 3)
      console.log("  Symlinking", sourceFile, "to", outFilePath);
    fs.symlinkSync(sourceFile, outFilePath);
  } catch (error) {
    console.log(error);
    return 1;
  }
  return 0; // success
}

// symlinks the module file and source map file if available.
export function symlinkOrCopyModuleFile(moduleSourceFile: string, outFilePath: string, alwaysCopy: boolean, detail: number) {
  const mapFile = moduleSourceFile + ".map";
  const outMapFile = outFilePath + ".map";
  const cssFile = moduleSourceFile.replace(".js", ".css");
  const outCssFile = outFilePath.replace(".js", ".css");

  if (alwaysCopy) {
    // copy  the module file.
    if (detail > 3)
      console.log("  Copying file", moduleSourceFile, "to", outFilePath);

    // if there is a symlink already there, copyFileSync fails, so check for that case.
    if (fs.existsSync(outFilePath))
      fs.unlinkSync(outFilePath);

    fs.copyFileSync(moduleSourceFile, outFilePath);

    if (fs.existsSync(mapFile)) {
      if (detail > 3)
        console.log("  Copying file", mapFile, "to", outMapFile);

      // if there is a symlink already there, copyFileSync fails, so check for that case.
      if (fs.existsSync(outMapFile))
        fs.unlinkSync(outMapFile);

      fs.copyFileSync(mapFile, outMapFile);
    }

    if (fs.existsSync(cssFile)) {
      if (detail > 3)
        console.log("  Copying file", cssFile, "to", outCssFile);

      if (fs.existsSync(outCssFile))
        fs.unlinkSync(outCssFile);

      fs.copyFileSync(cssFile, outCssFile);
    }
  } else {
    // symlink the module file.
    ensureSymlink(moduleSourceFile, outFilePath, detail);

    // if there's a source map file, link that, too.
    if (fs.existsSync(mapFile))
      ensureSymlink(mapFile, outMapFile, detail);

    if (fs.existsSync(cssFile))
      ensureSymlink(cssFile, outCssFile, detail);
  }
}

export function isDirectory(directoryName: string) {
  return (fs.statSync(directoryName)).isDirectory();
}

export function isSymLink(fileName: string): boolean {
  if (!fs.existsSync(fileName))
    return false;
  const stats = fs.statSync(fileName);
  return stats.isSymbolicLink();
}

export function moveFile(sourceDirectory: string, destDirectory: string, fileName: string, warn: boolean) {
  const sourceFile = path.join(sourceDirectory, fileName);
  if (!fs.existsSync(sourceFile)) {
    if (warn)
      console.log("Error: Trying to move file that does not exist", sourceFile);
    return;
  }
  const destFile = path.join(destDirectory, fileName);
  fs.renameSync(sourceFile, destFile);
}

// find the files that go into the plugin manifest (recurses through directories). The names should be relative to the buildDir.
export function findAllPluginFiles(fileList: string[], rootDir: string, thisDir: string, skipFile?: string) {
  const entryList: string[] = fs.readdirSync(thisDir);
  for (const thisEntry of entryList) {
    const thisPath: string = path.resolve(thisDir, thisEntry);
    if (isDirectory(thisPath)) {
      findAllPluginFiles(fileList, rootDir + thisEntry + "/", thisPath, skipFile);
    } else {
      // skip the runtime.js and the prod.js.map files.
      if (thisEntry.startsWith("runtime"))
        continue;
      if ((-1 !== thisEntry.indexOf("prod")) && thisEntry.endsWith(".js.map"))
        continue;
      if (skipFile && (thisEntry === skipFile))
        continue;
      fileList.push(rootDir + thisEntry);
    }
  }
}

export function removeAllFiles(thisDir: string) {
  // recurse to remove all files only.
  try {
    const entryList: string[] = fs.readdirSync(thisDir);
    for (const thisEntry of entryList) {
      const thisPath: string = path.resolve(thisDir, thisEntry);
      if (isDirectory(thisPath)) {
        removeAllFiles(thisPath);
      } else {
        fs.unlinkSync(thisPath);
      }
    }
  } catch (error) {
    // don't care.
  }
}

export function removeDirectory(thisDir: string, depth: number) {
  // recurse to remove all directories.
  try {
    const entryList: string[] = fs.readdirSync(thisDir);
    for (const thisEntry of entryList) {
      const thisPath: string = path.resolve(thisDir, thisEntry);
      if (isDirectory(thisPath)) {
        removeDirectory(thisPath, depth + 1);
        fs.rmdirSync(thisPath);
      }
    }
    if (depth === 0)
      fs.rmdirSync(thisDir);
  } catch (error) {
    // don't care.
  }
}
