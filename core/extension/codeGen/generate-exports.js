/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const fs = require("fs");

const declarationFilePath = "index.d.ts";
const declarationFilePathPreview = "preview.d.ts";
const jsFilePath = "index.js";
const jsFilePathPreview = "preview.js";
const runtimeFilePath = '../frontend/src/extension/ExtensionRuntime.ts';
const generatedCsvPath = "/lib/GeneratedExtensionApi.csv";

const codeGenOpeningComment = `// BEGIN GENERATED CODE`;
const codeGenClosingComment = `// END GENERATED CODE`;
// select all of generated block, including comments
const codeGenBlock = RegExp(`${codeGenOpeningComment}(\\s|\\S)*${codeGenClosingComment}`);

let args = process.argv.slice(2);
if (!args.length || !args[0]){
  throw new Error("Please provide an argument in the form of '[\"package name\",\"package path\"] [\"package2 name\",\"package2 path\"]'")
}
args = args[0].replace(/'/g, "");
args = args.split(" ");

// Convert extension linter's output file to a set of lists separated by export type
function interpretCsv(csvString) {
  const apiByType = {
    public: {
      // property names to match the type names from extension eslint rule output
      enum: [],
      interface: [],
      type: [],
      real: []
    },
    preview: {
      enum: [],
      interface: [],
      type: [],
      real: []
    }
  };

  // csv order must be exportName,exportType,releaseTag
  try {
    csvString.split("\n").forEach(line => {
      if (line.length === 0) {
        return;
      }
      line = line.split(",");
      apiByType[line[2]][line[1]].push(line[0]);
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
      realExports += `\t${realExport},\n`;
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
      exportCode += `\t${realExport},\n`;
    });
  };

  return exportCode + exportTrailer;
}

// Create the export code for the .ts file
function generateRuntimeCode(exportListPreview, exportList) {
  let exportCode = "";
  let exports = "const extensionExports = {\n";
  const exportTrailer = `};\n\n`;
  const addComment = (packageName, release, kind) => `  // @${release} ${kind}(s) from ${packageName}\n`;
  const tab = "  "; // two space tab

  for (const packageName in exportList) {
    let imports = "import {\n";
    let importTrailer = `} from "${packageName}";\n\n`;
    // since ExtensionRuntime.ts is also in core-frontend we have to add this exception
    if (packageName === '@itwin/core-frontend')
      importTrailer = `} from "../core-frontend";\n\n`;

    imports += exportListPreview[packageName].enum.length > 0 ? addComment(packageName, 'preview', 'enum') : "";
    exportListPreview[packageName].enum.forEach((enumExport) => {
      imports += `${tab}${enumExport},\n`;
      exports += `${tab}${enumExport},\n`;
    });

    imports += exportListPreview[packageName].real.length > 0 ? addComment(packageName, 'preview', 'real') : "";
    exportListPreview[packageName].real.forEach((realExport) => {
      imports += `${tab}${realExport},\n`;
      exports += `${tab}${realExport},\n`;
    });

    imports += exportList[packageName].enum.length > 0 ? addComment(packageName, 'public', 'enum') : "";
    exportList[packageName].enum.forEach((enumExport) => {
      imports += `${tab}${enumExport},\n`;
      exports += `${tab}${enumExport},\n`;
    });

    imports += exportList[packageName].real.length > 0 ? addComment(packageName, 'public', 'real') : "";
    exportList[packageName].real.forEach((realExport) => {
      imports += `${tab}${realExport},\n`;
      exports += `${tab}${realExport},\n`;
    });

    exportCode += imports + importTrailer;
  };

  return exportCode + exports + exportTrailer;
}

// Find the extension linter's output file and convert to a set of useful lists
function collectExports(packagePath) {
  // Adjust to relative path from monorepo root and add path to generated extension API
  packagePath = "../../" + packagePath + generatedCsvPath;
  let fileContents;

  try {
    fileContents = fs.readFileSync(packagePath, "utf8");
    if (fileContents.length === 0) {
      throw Error(`Extension api csv (${packagePath}) is empty.`);
    }
  } catch (error) {
    throw Error("Failed to read extension api csv, it may not exist or has no content.\n" + error);
  }

  return interpretCsv(fileContents);
}

// Replace the target file's code gen block with the provided code
function addToFile(filePath, generatedCode) {
  if (!fs.existsSync(filePath))
    throw Error(`File: ${filePath} does not exist.`);

  let fileContents = fs.readFileSync(filePath, "utf8");

  if (!codeGenBlock.test(fileContents))
    throw Error(`No block for generated code found in '${filePath}. A block with the code gen opening and closing comments is required.`);

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
  let exportListPreview = {};

  packages.forEach((package) => {
     const { public, preview } = collectExports(package.path);
     exportList[package.name] = public;
     exportListPreview[package.name] = preview;
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

const packages = [];
args.forEach((paramPair) => {
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
