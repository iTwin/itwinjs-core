/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
"use strict";
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { dirname, join } = require("node:path");
const { buildBasicConversionEntries, buildGeneratedBasicConversionModule } = require("./buildBasicUnitConversions");

// Run automatically as part of `rushx build`. Regenerates src/assets/Units.json when
// @bentley/units-schema version changes and keeps generated TypeScript identifiers in sync.
const schemaPath = require.resolve("@bentley/units-schema/Units.ecschema.json");
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));

const unitsJsonPath = join(__dirname, "../src/assets/Units.json");
const generatedTsPath = join(__dirname, "../src/generated/Units.generated.ts");
const basicConversionTsPath = join(__dirname, "../src/internal/BasicUnitConversions.generated.ts");

function readSerializationVersion() {
  // Read the serialization format version from source to stay in sync with SERIALIZED_UNIT_SCHEMA_VERSION.
  // Cannot require() the compiled constant — this script runs before tsc.
  const schemaTsSrc = readFileSync(join(__dirname, "../src/SerializedUnitSchema.ts"), "utf8");
  const versionMatch = schemaTsSrc.match(/SERIALIZED_UNIT_SCHEMA_VERSION\s*=\s*"([^"]+)"/);
  if (!versionMatch)
    throw new Error("Cannot find SERIALIZED_UNIT_SCHEMA_VERSION in SerializedUnitSchema.ts");

  return versionMatch[1];
}

function buildSerializedUnitsJson(sourceSchema, serializationVersion) {
  return {
    version: serializationVersion,
    sourceEcSchemaVersion: sourceSchema.version,
    name: sourceSchema.name,
    alias: sourceSchema.alias,
    label: sourceSchema.label,
    description: sourceSchema.description,
    items: sourceSchema.items,
  };
}

function isValidIdentifierKey(name) {
  return /^[$A-Z_][0-9A-Z_$]*$/i.test(name);
}

function assertUniqueGeneratedKeys(entries, schemaItemType) {
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.key))
      throw new Error(`Duplicate generated key "${entry.key}" for ${schemaItemType}`);
    seen.add(entry.key);
  }
}

function collectGeneratedSection(sourceSchema, schemaItemTypes) {
  const itemTypes = Array.isArray(schemaItemTypes) ? schemaItemTypes : [schemaItemTypes];
  const entries = Object.entries(sourceSchema.items)
    .filter(([, item]) => itemTypes.includes(item.schemaItemType))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, item]) => {
      if (!isValidIdentifierKey(name))
        throw new Error(`Cannot emit invalid TypeScript identifier key "${name}" for ${item.schemaItemType}`);
      return { key: name, value: `${sourceSchema.name}.${name}` };
    });

  assertUniqueGeneratedKeys(entries, itemTypes.join("/"));
  return entries;
}

function renderSection(indent, entries) {
  if (entries.length === 0)
    return `${indent}{}`;

  const lines = [`${indent}{`];
  for (const entry of entries) {
    lines.push(`${indent}  ${entry.key}: "${entry.value}",`);
  }
  lines.push(`${indent}}`);
  return lines.join("\n");
}

function stripSchemaPrefix(fullName, sourceSchema) {
  return fullName.slice(`${sourceSchema.name}.`.length);
}

function collectGroupedUnitSections(sourceSchema) {
  const groupedUnits = new Map();
  const unitEntries = buildBasicConversionEntries(sourceSchema, assertUniqueGeneratedKeys)
    .map((entry) => ({
      key: stripSchemaPrefix(entry.key, sourceSchema),
      value: entry.key,
      phenomenon: stripSchemaPrefix(entry.value[0], sourceSchema),
    }));

  for (const entry of unitEntries) {
    if (!isValidIdentifierKey(entry.phenomenon))
      throw new Error(`Cannot emit invalid TypeScript identifier key "${entry.phenomenon}" for grouped Units section`);

    const entries = groupedUnits.get(entry.phenomenon) ?? [];
    entries.push({ key: entry.key, value: entry.value });
    groupedUnits.set(entry.phenomenon, entries);
  }

  const groupedSections = [...groupedUnits.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([phenomenon, entries]) => ({
      key: phenomenon,
      entries: entries.sort((a, b) => a.key.localeCompare(b.key)),
    }));

  assertUniqueGeneratedKeys(groupedSections, "grouped Units sections");
  for (const section of groupedSections)
    assertUniqueGeneratedKeys(section.entries, `Units.${section.key}`);

  return groupedSections;
}

function buildGeneratedUnitsModule(sourceSchema) {
  const groupedUnitSections = collectGroupedUnitSections(sourceSchema);
  const phenomenonEntries = collectGeneratedSection(sourceSchema, "Phenomenon");
  const unitSystemEntries = collectGeneratedSection(sourceSchema, "UnitSystem");
  const renderedGroupedSections = groupedUnitSections.map((section) => `  ${section.key}: ${renderSection("  ", section.entries).slice(2)},`);

  return `${[
    "/*---------------------------------------------------------------------------------------------",
    "* Copyright (c) Bentley Systems, Incorporated. All rights reserved.",
    "* See LICENSE.md in the project root for license terms and full copyright notice.",
    "*--------------------------------------------------------------------------------------------*/",
    "/* eslint-disable @typescript-eslint/naming-convention */",
    "// AUTO-GENERATED by scripts/generateUnitsJson.js. Do not edit by hand.",
    'import type { NestedValueOf, ValueOf } from "@itwin/core-bentley";',
    "",
    "/** Canonical bundled unit identifiers grouped by phenomenon from the bundled Units.json asset.",
    " * @beta",
    " */",
    "export const Units = {",
    ...renderedGroupedSections,
    "} as const;",
    "",
    "/** Canonical bundled phenomenon identifiers from the bundled Units.json asset.",
    " * @beta",
    " */",
    `export const Phenomena = ${renderSection("", phenomenonEntries)} as const;`,
    "",
    "/** Canonical bundled unit system identifiers from the bundled Units.json asset.",
    " * @beta",
    " */",
    `export const UnitSystems = ${renderSection("", unitSystemEntries)} as const;`,
    "",
    "/** Bundled canonical unit-name identifiers generated from Units.",
    " * @beta",
    " */",
    "export type UnitName = NestedValueOf<typeof Units>;",
    "",
    "/** Bundled canonical phenomenon-name identifiers generated from Phenomena.",
    " * @beta",
    " */",
    "export type PhenomenonName = ValueOf<typeof Phenomena>;",
    "",
    "/** Bundled canonical unit-system identifiers generated from UnitSystems.",
    " * @beta",
    " */",
    "export type UnitSystemName = ValueOf<typeof UnitSystems>;",
    "",
  ].join("\n")}`;
}

function readFileIfExists(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : undefined;
}

function writeIfChanged(filePath, content) {
  const current = readFileIfExists(filePath);
  if (current === content)
    return false;

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
  return true;
}

function main() {
  const serializationVersion = readSerializationVersion();
  const unitsJson = buildSerializedUnitsJson(schema, serializationVersion);
  const unitsJsonContent = `${JSON.stringify(unitsJson, null, 2)}\n`;
  const generatedTsContent = buildGeneratedUnitsModule(schema);
  const basicConversionTsContent = buildGeneratedBasicConversionModule(schema, assertUniqueGeneratedKeys);

  const jsonChanged = writeIfChanged(unitsJsonPath, unitsJsonContent);
  const tsChanged = writeIfChanged(generatedTsPath, generatedTsContent);
  const basicTsChanged = writeIfChanged(basicConversionTsPath, basicConversionTsContent);

  if (!jsonChanged && !tsChanged && !basicTsChanged) {
    console.log(`Units artifacts up to date (schema ${schema.version})`);
    return;
  }

  console.log(`Generated Units artifacts from @bentley/units-schema ${schema.version}`);
}

if (require.main === module) {
  main();
}
