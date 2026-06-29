/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
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
const generatedArtifactRelativePaths = {
  unitsJson: "src/assets/Units.json",
  generatedTs: "src/generated/Units.generated.ts",
  basicConversionTs: "src/internal/BasicUnitConversions.generated.ts",
  defaultPersistenceTs: "src/internal/DefaultPersistenceUnits.generated.ts",
} as const;

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

function loadSourceSchema(): SourceSchemaLike & { version: string } {
  return JSON.parse(readFileSync(schemaPath, "utf8")) as SourceSchemaLike & { version: string };
}

function buildGeneratedArtifactContents(schema: SourceSchemaLike & { version: string }) {
  const unitsJson = buildSerializedUnitsJson(schema, SERIALIZED_UNIT_SCHEMA_VERSION);
  return {
    unitsJson: `${JSON.stringify(unitsJson, null, 2)}\n`,
    generatedTs: buildGeneratedUnitsModule(schema),
    basicConversionTs: buildGeneratedBasicConversionModule(schema, assertUniqueGeneratedKeys),
    defaultPersistenceTs: buildGeneratedDefaultPersistenceModule(schema, assertUniqueGeneratedKeys),
  };
}

function generateUnitsArtifacts(destinationRoot = join(__dirname, "..")): {
  readonly anyChanged: boolean;
  readonly destinationRoot: string;
  readonly schemaVersion: string;
} {
  const schema = loadSourceSchema();
  const resolvedDestinationRoot = resolve(destinationRoot);
  const contents = buildGeneratedArtifactContents(schema);
  let anyChanged = false;
  for (const [artifactName, relativePath] of Object.entries(generatedArtifactRelativePaths)) {
    if (writeIfChanged(join(resolvedDestinationRoot, relativePath), contents[artifactName as keyof typeof contents]))
      anyChanged = true;
  }

  return {
    anyChanged,
    destinationRoot: resolvedDestinationRoot,
    schemaVersion: schema.version,
  };
}

function main(args: string[]): void {
  // Build every artifact in memory before writing any file so generator bugs fail before we
  // mutate the checked-in outputs. Each file is then updated independently only when its
  // content actually changed, which avoids churn while still letting partial artifact updates
  // land when a change is scoped to one generated output.
  const requestedDestinationRoot = args[0];
  const destinationRoot = requestedDestinationRoot ? resolve(requestedDestinationRoot) : join(__dirname, "..");
  const { anyChanged, destinationRoot: resolvedDestinationRoot, schemaVersion } = generateUnitsArtifacts(destinationRoot);

  if (!anyChanged) {
    console.log(`Units artifacts up to date (schema ${schemaVersion})`);
    return;
  }

  if (!requestedDestinationRoot) {
    console.log(`Generated Units artifacts from @bentley/units-schema ${schemaVersion}`);
    return;
  }

  console.log(`Generated Units artifacts from @bentley/units-schema ${schemaVersion} into ${resolvedDestinationRoot}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  main(process.argv.slice(2));
