/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { ECVersion, Schema, SchemaContext, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { SchemaJsonFileLocater } from "../SchemaJsonFileLocater";

describe("Concurrent schema JSON deserialization", () => {
  const assetDir: string = path.join(__dirname, "assets");
  const schemaFolder = path.join(__dirname, "assets", "json");

  const schemaKeys: SchemaKey[] = [];
  let context: SchemaContext;
  let contextSync: SchemaContext;
  let syncSchemas: Array<Schema | undefined> = [];

  const locater = new SchemaJsonFileLocater();

  before(() => {
    if (!fs.existsSync(assetDir))
      fs.mkdirSync(assetDir);
    if (!fs.existsSync(schemaFolder))
      fs.mkdirSync(schemaFolder);

    copySchemasToAssetsDir();

    // Deserialize schemas synchronously/serially as standard to compare to
    contextSync = new SchemaContext();
    locater.addSchemaSearchPath(schemaFolder);
    contextSync.addLocater(locater);

    const schemaFiles = fs.readdirSync(schemaFolder);
    schemaFiles.forEach((fileName) => {
      const schemaFile = path.join(schemaFolder, fileName);
      const schemaJson = JSON.parse(fs.readFileSync(schemaFile, "utf-8"));
      const schemaName = schemaJson.name;
      const schemaVersion = schemaJson.version;

      const key = new SchemaKey(schemaName.toString(), ECVersion.fromString(schemaVersion.toString()));
      schemaKeys.push(key);
    });

    syncSchemas = schemaKeys.map((key): Schema | undefined => {
      if (!key)
        return undefined;

      const schema = contextSync.getSchemaSync(key, SchemaMatchType.Latest);
      return schema;
    });
  });

  beforeEach(() => {
    context = new SchemaContext();
    context.addLocater(locater);
  });

  function getSchemaPathFromPackage(packageName: string, schemaFileName: string): string {
    const schemaFile = path.join(__dirname, "..", "..", "..", "node_modules", "@bentley", packageName, schemaFileName);
    return schemaFile;
  }

  function copySchemasToAssetsDir() {
    // Copy Schemas that we need for testing
    fs.copyFileSync(getSchemaPathFromPackage("aec-units-schema", "AecUnits.ecschema.json"), path.join(schemaFolder, "AecUnits.ecschema.json"));
    fs.copyFileSync(getSchemaPathFromPackage("architectural-physical-schema", "ArchitecturalPhysical.ecschema.json"), path.join(schemaFolder, "ArchitecturalPhysical.ecschema.json"));
    fs.copyFileSync(getSchemaPathFromPackage("bis-core-schema", "BisCore.ecschema.json"), path.join(schemaFolder, "BisCore.ecschema.json"));
    fs.copyFileSync(getSchemaPathFromPackage("bis-custom-attributes-schema", "BisCustomAttributes.ecschema.json"), path.join(schemaFolder, "BisCustomAttributes.ecschema.json"));
    fs.copyFileSync(getSchemaPathFromPackage("construction-schema", "Construction.ecschema.json"), path.join(schemaFolder, "Construction.ecschema.json"));
    fs.copyFileSync(getSchemaPathFromPackage("core-custom-attributes-schema", "CoreCustomAttributes.ecschema.json"), path.join(schemaFolder, "CoreCustomAttributes.ecschema.json"));
    fs.copyFileSync(getSchemaPathFromPackage("ecdb-map-schema", "ECDbMap.ecschema.json"), path.join(schemaFolder, "ECDbMap.ecschema.json"));
    fs.copyFileSync(getSchemaPathFromPackage("ecdb-schema-policies-schema", "ECDbSchemaPolicies.ecschema.json"), path.join(schemaFolder, "ECDbSchemaPolicies.ecschema.json"));
    fs.copyFileSync(getSchemaPathFromPackage("formats-schema", "Formats.ecschema.json"), path.join(schemaFolder, "Formats.ecschema.json"));
    fs.copyFileSync(getSchemaPathFromPackage("linear-referencing-schema", "LinearReferencing.ecschema.json"), path.join(schemaFolder, "LinearReferencing.ecschema.json"));
    fs.copyFileSync(getSchemaPathFromPackage("physical-material-schema", "PhysicalMaterial.ecschema.json"), path.join(schemaFolder, "PhysicalMaterial.ecschema.json"));
    fs.copyFileSync(getSchemaPathFromPackage("plant-custom-attributes-schema", "PlantCustomAttributes.ecschema.json"), path.join(schemaFolder, "PlantCustomAttributes.ecschema.json"));
    fs.copyFileSync(getSchemaPathFromPackage("quantity-takeoffs-aspects-schema", "QuantityTakeoffsAspects.ecschema.json"), path.join(schemaFolder, "QuantityTakeoffsAspects.ecschema.json"));
    fs.copyFileSync(getSchemaPathFromPackage("spatial-composition-schema", "SpatialComposition.ecschema.json"), path.join(schemaFolder, "SpatialComposition.ecschema.json"));
    fs.copyFileSync(getSchemaPathFromPackage("structural-physical-schema", "StructuralPhysical.ecschema.json"), path.join(schemaFolder, "StructuralPhysical.ecschema.json"));
    fs.copyFileSync(getSchemaPathFromPackage("units-schema", "Units.ecschema.json"), path.join(schemaFolder, "Units.ecschema.json"));
  }

  it("should match schemas deserialized concurrently with schemas deserialized serially", async () => {
    const schemaPromises = schemaKeys.map(async (key): Promise<Schema | undefined> => {
      if (!key)
        return undefined;

      const schema = await context.getSchema(key, SchemaMatchType.Latest);
      return schema;
    });
    const asyncSchemas = await Promise.all(schemaPromises);

    for (let i = 0; i < schemaKeys.length; i++) {
      const syncSchema = syncSchemas[i];
      expect(syncSchema).not.to.be.undefined;
      const syncJSON = syncSchema!.toJSON();

      const asyncSchema = asyncSchemas[i];
      expect(asyncSchema).not.to.be.undefined;
      const asyncJSON = asyncSchema!.toJSON();
      expect(asyncJSON).to.deep.equal(syncJSON);
    }
  });

  it("should be able to mix getSchema and getSchemaSync", async () => {
    const schemaPromises = schemaKeys.map(async (key, index): Promise<Schema | undefined> => {
      if (index % 2 === 0) {
        // Use getSchema() for even indices
        if (!key)
          return undefined;

        const schema = await context.getSchema(key, SchemaMatchType.Latest);
        return schema;
      } else {
        // Use getSchemaSync() for odd indices
        if (!key)
          return undefined;

        const schema = context.getSchemaSync(key, SchemaMatchType.Latest);
        return schema;
      }
    });
    const schemas = await Promise.all(schemaPromises);

    for (let i = 0; i < schemaKeys.length; i++) {
      const syncSchema = syncSchemas[i];
      expect(syncSchema).not.to.be.undefined;
      const syncJSON = syncSchema!.toJSON();

      const schema = schemas[i];
      expect(schema).not.to.be.undefined;
      const schemaJSON = schema!.toJSON();
      expect(schemaJSON).to.deep.equal(syncJSON);
    }
  });

  /* Run these tests below one at a time. Running them together doesn't get accurate performance likely bc of disk access caching */
  it.skip("should measure regular deserialization performance", async () => {
    const schemaPromises = schemaKeys.map(async (key): Promise<Schema | undefined> => {
      if (!key)
        return undefined;

      const schema = await context.getSchema(key, SchemaMatchType.Latest);
      return schema;
    });

    for (const promise of schemaPromises) {
      await promise;
    }

    expect(schemaPromises.length).to.equal(schemaKeys.length);
  });

  it.skip("should measure concurrent deserialization performance", async () => {
    const schemaPromises = schemaKeys.map(async (key): Promise<Schema | undefined> => {
      if (!key)
        return undefined;

      const schema = await context.getSchema(key, SchemaMatchType.Latest);
      return schema;
    });
    const asyncSchemas = await Promise.all(schemaPromises);

    expect(asyncSchemas.length).to.equal(schemaKeys.length);
  });
});
