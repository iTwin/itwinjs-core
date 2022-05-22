/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const fs = require("fs");
const path = require("path");
const root = process.cwd();
const ecDiagnosticsDir = path.resolve(root, "lib", "cjs", "Validation", "ECRules");
const ecDiagnostics = require(ecDiagnosticsDir);

function printErrorAndFail(errorMessage) {
  console.log(`Build failed creating localization file ECSchemaEditing.json: ${errorMessage}`);
  throw new Error();
}

function createLocalization() {
  const localesDir = path.resolve(root, "public", "locales", "en");
  const entries = {};

  for (const [, value] of Object.entries(ecDiagnostics.Diagnostics)) {
    entries[value.prototype.code] = value.prototype.messageText;
  }

  var jsonString = JSON.stringify(entries);
  var jsonEntries = JSON.parse(jsonString);

  const json = {
    Diagnostics: {
      ...jsonEntries
    }
  }

  fs.writeFile(path.resolve(localesDir, "ECSchemaEditing.json"), JSON.stringify(json, undefined, 2), "utf8", function (err) {
    if (err) {
      printErrorAndFail(err);
    }
  });

  console.log("ECSchemaEditing localization successful.");
}

createLocalization();