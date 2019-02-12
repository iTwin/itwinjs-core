/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

const fs = require("fs");
const path = require("path");
const root = process.cwd();
const ecDiagnosticsDir = path.resolve(root, "lib", "Validation", "ECRules");
const bisDiagnosticsDir = path.resolve(root, "lib", "Validation", "BisRules");
const ecDiagnostics = require(ecDiagnosticsDir);
const bisDiagnostics = require(bisDiagnosticsDir);

function printErrorAndFail(errorMessage) {
  console.log(`Build failed creating localization file ECSchemaMetadata.json: ${errorMessage}`);
  throw new Error();
}

function createLocalization() {
  const localesDir = path.resolve(root, "public", "locales", "en");
  const entries = {};

  for (const [, value] of Object.entries(ecDiagnostics.Diagnostics)) {
    entries[value.prototype.code] = value.prototype.messageText;
  }

  for (const [, value] of Object.entries(bisDiagnostics.Diagnostics)) {
    entries[value.prototype.code] = value.prototype.messageText;
  }

  var jsonString = JSON.stringify(entries);
  var jsonEntries = JSON.parse(jsonString);

  const json = {
    Diagnostics: {
      ...jsonEntries
    }
  }

  fs.writeFile(path.resolve(localesDir, "ECSchemaMetadata.json"), JSON.stringify(json, undefined, 2), "utf8", function (err) {
    if (err) {
      printErrorAndFail(err);
    }
  });

  console.log("ECSchemaMetadata localization successful.");
}

createLocalization();