/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const fs = require("fs");

const declarationFilePath = "index.d.ts";
const jsFilePath = "index.js";
const generatedCsvPath = "/lib/GeneratedExtensionApi.csv";

const codeGenOpeningComment = `// BEGIN GENERATED CODE`;
const codeGenClosingComment = `// END GENERATED CODE`;
// select all of generated block, including comments
const codeGenBlock = RegExp(`${codeGenOpeningComment}(\\s|\\S)*${codeGenClosingComment}`);

const args = process.argv.slice(2);


// Convert extension linter's output file to a set of lists separated by export type
function interpretCsv(csvString) {
  let apiByType = {
    // property names to match the type names from extension eslint rule output
    enum: [],
    interface: [],
    type: [],
    real: []
  };

  // Data in exportName,exportType order
  try {
    csvString.split("\n").forEach(line => {
      if (line.length === 0) {
        return;
      }
      line = line.split(",");
      apiByType[line[1]].push(line[0]);
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
    let realExports = "export {\n";
    let typeExports = "export type {\n";
    const exportTrailer = `} from "${packageName}";\n\n`;

    exportList[packageName].enum.forEach((enumExport) => {
      realExports += `\t${enumExport},\n`;
    });
    exportList[packageName].real.forEach((realExport) => {
      realExports += `\t${realExport}, // REAL \n`;
    });

    exportList[packageName].interface.forEach((interfaceExport) => {
      typeExports += `\t${interfaceExport},\n`;
    });
    exportList[packageName].type.forEach((typeExport) => {
      typeExports += `\t${typeExport},\n`;
    });

    exportCode += realExports + exportTrailer + typeExports + exportTrailer;
  };

  return exportCode;
}


// Create the export code for the .js file
function generateJsCode(exportList) {
  let exportCode = "export const {\n";
  const exportTrailer = "} = ext.exports;\n";

  // Only make exports for reals in each package
  for (const packageName in exportList) {
    exportCode += `// ${packageName}:\n`;
    exportList[packageName].enum.forEach((enumExport) => {
      exportCode += `\t${enumExport},\n`;
    });
    exportList[packageName].real.forEach((realExport) => {
      exportCode += `\t${realExport}, // REAL \n`;
    });
  };

  return exportCode + exportTrailer;
}


// Find the extension linter's output file and convert to a set of useful lists
function collectExports(packagePath) {
  // Adjust to relative path from monorepo root and add path to generated extension API
  packagePath = "../../" + packagePath + generatedCsvPath;

  try {
    var fileContents = fs.readFileSync(packagePath, "utf8");
    if (fileContents.length === 0) {
      throw Error(`Extension api csv (${packagePath + generatedCsvPath}) is empty.`);
    }
  } catch (error) {
    throw Error("Failed to read extension api csv, it may not exist or has no content.\n" + error);
  }

  return interpretCsv(fileContents);
}


// Replace the target file's code gen block with the provided code
function addToFile(filePath, generatedCode) {
  let fileContents = fs.readFileSync(filePath, "utf8");

  if (!codeGenBlock.test(fileContents)) {
    throw Error(`No block for generated code found in '${filePath}. A block with the code gen opening and closing comments is required.`);
  }

  // Embed generated code in codeGen block
  generatedCode = `${codeGenOpeningComment}\n${generatedCode}${codeGenClosingComment}`;

  fileContents = fileContents.replace(
    codeGenBlock,
    generatedCode
  );
  fs.writeFileSync(filePath, fileContents);
}


// Use the extension linter's output file to add export statements to .d.ts and .js files
function addGeneratedExports(packages) {
  let exportList = {};

  packages.forEach((package) => {
    exportList[package.name] = collectExports(package.path);
  });

  // Generate declaration code
  const declarationCode = generateDeclarationCode(exportList);
  addToFile(declarationFilePath, declarationCode);

  // Generate js code
  const jsCode = generateJsCode(exportList);
  addToFile(jsFilePath, jsCode);
}


const packages = [];
args.forEach((paramPair) => {
  // Replace all single quotes with double quotes, so JSON can parse
  paramPair = paramPair.replace(/'/g, "\"");
  paramPair = JSON.parse(paramPair);

  if (paramPair.length < 2) {
    throw Error("Provided argument does not contain package name followed by package path.", paramPair);
  }
  packages.push({
    name: paramPair[0],
    path: paramPair[1]
  });
});
addGeneratedExports(packages);