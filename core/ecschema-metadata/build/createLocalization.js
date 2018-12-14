/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

const fs = require("fs");
const path = require("path");
const root = process.cwd();
const diagnosticsDir = path.resolve(root, "lib", "Validation", "Diagnostics");
const diagnostics = require(diagnosticsDir);

function printErrorAndFail(errorMessage) {
  console.log(`Build failed creating localization file ECSchemaMetadata.json: ${errorMessage}`);
  throw new Error();
}

function createLocalization() {
  const localesDir = path.resolve(root, "public", "locales", "en");
  const entries = {};

  for (const [key, value] of Object.entries(diagnostics.DIAGNOSTICS)) {
    entries[value.key] = value.message;
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