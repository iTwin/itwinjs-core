/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const fs = require("fs");

const declarationFilePath = "index.d.ts";
const generatedCsvPath = "/lib/GeneratedExtensionApi.csv";

const codeGenOpeningComment = `// BEGIN GENERATED CODE`;
const codeGenClosingComment = `// END GENERATED CODE`;
// select all of generated block, including comments
const codeGenBlock = RegExp(`${codeGenOpeningComment}(\\s|\\S)*${codeGenClosingComment}`);

const args = process.argv.slice(2);


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

function generateExports(apiByType, packageName) {
  let realExports = "export {\n";
  let typeExports = "export type {\n";
  const exportTrailer = "} from \"" + packageName + "\";\n\n";

  apiByType.enum.forEach((enumExport) => {
    realExports += enumExport + ",\n";
  });
  apiByType.real.forEach((realExport) => {
    realExports += realExport + ",\n";
  });

  apiByType.interface.forEach((interfaceExport) => {
    typeExports += interfaceExport + ",\n";
  });
  apiByType.type.forEach((typeExport) => {
    typeExports += typeExport + ",\n";
  });

  return realExports + exportTrailer + typeExports + exportTrailer;
}

function collectExports(packageName, packagePath) {
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

  const apiByType = interpretCsv(fileContents);

  return generateExports(apiByType, packageName);
}

function generateDeclarationFile(packages) {
  let generatedExports = codeGenOpeningComment + "\n";

  packages.forEach((package) => {
    generatedExports += collectExports(package.name, package.path);
  });
  generatedExports += codeGenClosingComment;

  fileContents = fs.readFileSync(declarationFilePath, "utf8");

  if (!codeGenBlock.test(fileContents)) {
    throw Error("No block for generated code found. A block with the code gen opening and closing comments is required.")
  }

  fileContents = fileContents.replace(
    codeGenBlock,
    generatedExports
  );
  fs.writeFileSync(declarationFilePath, fileContents);
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
generateDeclarationFile(packages);