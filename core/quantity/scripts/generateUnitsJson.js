/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
"use strict";
const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

// Run automatically as part of `rushx build`. Regenerates src/assets/Units.json when
// @bentley/units-schema version changes. Commit the result.
const schemaPath = require.resolve("@bentley/units-schema/Units.ecschema.json");
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));

const outPath = join(__dirname, "../src/assets/Units.json");

let currentVersion;
try {
  currentVersion = JSON.parse(readFileSync(outPath, "utf8")).sourceEcSchemaVersion;
} catch {
  currentVersion = undefined;
}

if (currentVersion === schema.version) {
  console.log(`Units.json up to date (schema ${schema.version})`);
  process.exit(0);
}

// Read the serialization format version from source to stay in sync with SERIALIZED_UNIT_SCHEMA_VERSION.
// Cannot require() the compiled constant — this script runs before tsc.
const schemaTsSrc = readFileSync(join(__dirname, "../src/SerializedUnitSchema.ts"), "utf8");
const versionMatch = schemaTsSrc.match(/SERIALIZED_UNIT_SCHEMA_VERSION\s*=\s*"([^"]+)"/);
if (!versionMatch)
  throw new Error("Cannot find SERIALIZED_UNIT_SCHEMA_VERSION in SerializedUnitSchema.ts");

const output = {
  version: versionMatch[1],
  sourceEcSchemaVersion: schema.version,
  name: schema.name,
  alias: schema.alias,
  label: schema.label,
  description: schema.description,
  items: schema.items,
};

writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`Generated Units.json from @bentley/units-schema ${schema.version}`);
