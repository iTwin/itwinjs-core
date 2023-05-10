/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import pkgJson from "../package.json" assert { type: "json" };

const declarationFilePath = "index.d.ts";
const declarationFilePathPreview = "preview.d.ts";
const jsFilePath = "index.js";
const jsFilePathPreview = "preview.js";
const runtimeFilePath = "../frontend/src/extension/ExtensionRuntime.ts";
const generatedCsvFileName = "GeneratedExtensionApi.csv";

const codeGenOpeningComment = "// BEGIN GENERATED CODE";
const codeGenClosingComment = "// END GENERATED CODE";
// select all of generated block, including comments
const codeGenBlock = RegExp(
  `${codeGenOpeningComment}(\\s|\\S)*${codeGenClosingComment}`
);

// Convert extension linter's output file to a set of lists separated by export type
function interpretCsv(csvString) {
  const apiByType = {
    publicApi: {
      // property names to match the type names from extension eslint rule output
      enum: new Set(),
      interface: new Set(),
      type: new Set(),
      real: new Set(),
    },
    previewApi: {
      enum: new Set(),
      interface: new Set(),
      type: new Set(),
      real: new Set(),
    },
  };

  // csv order must be exportName,exportType,releaseTag
  try {
    csvString.split("\n").forEach((line) => {
      if (line.length === 0) {
        return;
      }
      const [exportName, exportType, releaseTag] = line.split(",");
      apiByType[`${releaseTag}Api`][exportType].add(exportName);
    });
  } catch (error) {
    console.log("Provided csv with Extension API was malformed.", error);
  }

  return apiByType;
}

// Create the export code for the .d.ts file
function generateDeclarationCode(exportList) {
  let exportCode = "";

  // Make real and type exports for each package
  for (const packageName in exportList) {
    const realExports = "export {";
    const typeExports = "export type {";
    const exportTrailer = `\n} from "${packageName}";\n\n`;

    let reals = [
      ...exportList[packageName].enum,
      ...exportList[packageName].real,
    ]
      .sort()
      .join(",\n\t");

    let types = [
      ...exportList[packageName].interface,
      ...exportList[packageName].type,
    ]
      .sort()
      .join(",\n\t");

    reals = reals ? `\n\t${reals}` : "";
    types = types ? `\n\t${types}` : "";
    exportCode +=
      realExports + reals + exportTrailer + typeExports + types + exportTrailer;
  }

  return exportCode;
}

// Create the export code for the .js file
function generateJsCode(exportList) {
  let exportCode = "export const {";
  const exportTrailer = "\n} = ext.exports;\n";

  // Only make exports for reals in each package
  for (const packageName in exportList) {
    exportCode += `\n// ${packageName}:`;
    const _exports = [
      ...exportList[packageName].enum,
      ...exportList[packageName].real,
    ]
      .sort()
      .join(",\n\t");
    exportCode += _exports ? `\n\t${_exports},` : "";
  }

  return exportCode + exportTrailer;
}

// Create the export code for the .ts file
function generateRuntimeCode(exportListPreview, exportList) {
  const tab = "  "; // two space tab
  let importCode = "";
  let exportsApi = `const extensionExports = {\n${tab}`;
  const _exports = [];
  const exportTrailer = `\n};\n\n`;
  const addComment = (packageName, release, kind) =>
    `  // @${release} ${kind}(s) from ${packageName}\n`;

  for (const packageName in exportList) {
    let imports = "import {\n";
    let importTrailer = `} from "${packageName}";\n\n`;
    // since ExtensionRuntime.ts is also in core-frontend we have to add this exception
    if (packageName === "@itwin/core-frontend")
      importTrailer = `} from "../core-frontend";\n\n`;

    imports +=
      exportListPreview[packageName].enum.size > 0
        ? addComment(packageName, "preview", "enum")
        : "";
    [...exportListPreview[packageName].enum].sort().forEach((enumExport) => {
      imports += `${tab}${enumExport},\n`;
      _exports.push(enumExport);
    });

    imports +=
      exportListPreview[packageName].real.size > 0
        ? addComment(packageName, "preview", "real")
        : "";
    [...exportListPreview[packageName].real].sort().forEach((realExport) => {
      imports += `${tab}${realExport},\n`;
      _exports.push(realExport);
    });

    imports +=
      exportList[packageName].enum.size > 0
        ? addComment(packageName, "public", "enum")
        : "";
    [...exportList[packageName].enum].sort().forEach((enumExport) => {
      imports += `${tab}${enumExport},\n`;
      _exports.push(enumExport);
    });

    imports +=
      exportList[packageName].real.size > 0
        ? addComment(packageName, "public", "real")
        : "";
    [...exportList[packageName].real].sort().forEach((realExport) => {
      imports += `${tab}${realExport},\n`;
      _exports.push(realExport);
    });

    importCode += imports + importTrailer;
  }

  exportsApi += _exports.sort().join(`,\n${tab}`) + ",";

  return importCode + exportsApi + exportTrailer;
}

// Find the extension linter's output file and convert to a set of useful lists
function collectExports(packagePath) {
  // Adjust to relative path from monorepo root and add path to generated extension API
  packagePath = path.join(packagePath, "../..", generatedCsvFileName);
  let fileContents;

  try {
    fileContents = fs.readFileSync(packagePath, "utf8");
    if (fileContents.length === 0) {
      throw Error(`Extension api csv (${packagePath}) is empty.`);
    }
  } catch (error) {
    throw Error(
      "Failed to read extension api csv, it may not exist or has no content.\n" +
        error
    );
  }

  return interpretCsv(fileContents);
}

// Replace the target file's code gen block with the provided code
function addToFile(filePath, generatedCode) {
  if (!fs.existsSync(filePath))
    throw Error(`File: ${filePath} does not exist.`);

  let fileContents = fs.readFileSync(filePath, "utf8");

  if (!codeGenBlock.test(fileContents))
    throw Error(
      `No block for generated code found in '${filePath}. A block with the code gen opening and closing comments is required.`
    );

  // Embed generated code in codeGen block
  generatedCode = `${codeGenOpeningComment}\n${generatedCode}${codeGenClosingComment}`;

  fileContents = fileContents.replace(codeGenBlock, generatedCode);
  fs.writeFileSync(filePath, fileContents);
}

// Use the extension linter's output file to add export statements to .d.ts and .js files
function addGeneratedExports(packages) {
  let exportList = {};
  let exportListPreview = {};

  packages.forEach((pkg) => {
    const { publicApi, previewApi } = collectExports(pkg.path);
    exportList[pkg.name] = publicApi;
    exportListPreview[pkg.name] = previewApi;
  });

  // Generate declaration code
  const declarationCode = generateDeclarationCode(exportList);
  addToFile(declarationFilePath, declarationCode);

  // Generate js code
  const jsCode = generateJsCode(exportList);
  addToFile(jsFilePath, jsCode);

  // Generate declaration code for preview.d.ts
  const declarationCodePreview = generateDeclarationCode(exportListPreview);
  addToFile(declarationFilePathPreview, declarationCodePreview);

  // Generate js code for preview.js
  const jsCodePreview = generateJsCode(exportListPreview);
  addToFile(jsFilePathPreview, jsCodePreview);

  // Generate ts code for ExtensionRuntime.ts
  const runtimeCode = generateRuntimeCode(exportListPreview, exportList);
  addToFile(runtimeFilePath, runtimeCode);
}

const require = createRequire(import.meta.url);
const packages = Object.keys(pkgJson.dependencies).map((name) => {
  const path = require.resolve(name);
  return { name, path };
});

addGeneratedExports(packages);
