/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { SERIALIZED_UNIT_SCHEMA_VERSION } from "../src/SerializedUnitSchema";
import {
  buildGeneratedBasicConversionModule,
  buildGeneratedDefaultPersistenceModule,
  buildGeneratedUnitsModule,
  buildSerializedUnitsJson,
  type AssertUniqueGeneratedKeys,
  type SourceSchemaLike,
} from "./generatedModuleBuilders";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const schemaPath = require.resolve("@bentley/units-schema/Units.ecschema.json");
const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as SourceSchemaLike & { version: string };

const unitsJsonPath = join(__dirname, "../src/assets/Units.json");
const generatedTsPath = join(__dirname, "../src/generated/Units.generated.ts");
const basicConversionTsPath = join(__dirname, "../src/internal/BasicUnitConversions.generated.ts");
const defaultPersistenceTsPath = join(__dirname, "../src/internal/DefaultPersistenceUnits.generated.ts");

const assertUniqueGeneratedKeys: AssertUniqueGeneratedKeys = (entries, schemaItemType) => {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.key))
      throw new Error(`Duplicate generated key "${entry.key}" for ${schemaItemType}`);
    seen.add(entry.key);
  }
};

function readFileIfExists(filePath: string): string | undefined {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : undefined;
}

function writeIfChanged(filePath: string, content: string): boolean {
  const current = readFileIfExists(filePath);
  if (current === content)
    return false;

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
  return true;
}

function main(): void {
  // Build every artifact in memory before writing any file so generator bugs fail before we
  // mutate the checked-in outputs. Each file is then updated independently only when its
  // content actually changed, which avoids churn while still letting partial artifact updates
  // land when a change is scoped to one generated output.
  const unitsJson = buildSerializedUnitsJson(schema, SERIALIZED_UNIT_SCHEMA_VERSION);
  const unitsJsonContent = `${JSON.stringify(unitsJson, null, 2)}\n`;
  const generatedTsContent = buildGeneratedUnitsModule(schema);
  const basicConversionTsContent = buildGeneratedBasicConversionModule(schema, assertUniqueGeneratedKeys);
  const defaultPersistenceTsContent = buildGeneratedDefaultPersistenceModule(schema, assertUniqueGeneratedKeys);

  const jsonChanged = writeIfChanged(unitsJsonPath, unitsJsonContent);
  const tsChanged = writeIfChanged(generatedTsPath, generatedTsContent);
  const basicTsChanged = writeIfChanged(basicConversionTsPath, basicConversionTsContent);
  const defaultPersistenceTsChanged = writeIfChanged(defaultPersistenceTsPath, defaultPersistenceTsContent);

  if (!jsonChanged && !tsChanged && !basicTsChanged && !defaultPersistenceTsChanged) {
    console.log(`Units artifacts up to date (schema ${schema.version})`);
    return;
  }

  console.log(`Generated Units artifacts from @bentley/units-schema ${schema.version}`);
}

main();
