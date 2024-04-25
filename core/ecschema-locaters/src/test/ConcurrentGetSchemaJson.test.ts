/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { ECVersion, Schema, SchemaContext, SchemaJsonLocater, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
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

  it("Concurrently get BisCore with SchemaJsonFileLocater", async () => {
    const schemaContext = new SchemaContext();
    const jsonFileLocater = new SchemaJsonFileLocater();
    jsonFileLocater.addSchemaSearchPath(schemaFolder);
    schemaContext.addLocater(jsonFileLocater);

    const schemas = await Promise.all(
      [...Array(100).keys()].map(async () => {
        return schemaContext.getSchema(new SchemaKey("BisCore"));
      }),
    );
    expect(schemas.length).to.equal(100);
    schemas.forEach((schema) => {
      assert(schema !== undefined);
      expect(schema.fullName).to.equal("BisCore");
    });
  });

  it("Concurrently get a schema and it's referenced schema with SchemaJsonFileLocater", async () => {
    const schemaContext = new SchemaContext();
    const jsonFileLocater = new SchemaJsonFileLocater();
    jsonFileLocater.addSchemaSearchPath(schemaFolder);
    schemaContext.addLocater(jsonFileLocater);

    let getBisCoreFirst = 0;
    const schemas = await Promise.all(
      [...Array(2).keys()].map(async () => {
        if (getBisCoreFirst === 0) {
          getBisCoreFirst = 1;
          return schemaContext.getSchema(new SchemaKey("BisCore"));
        }
        return schemaContext.getSchema(new SchemaKey("CoreCustomAttributes"));
      }),
    );
    expect(schemas.length).to.equal(2);
    schemas.forEach((schema) => {
      expect(schema).to.not.be.undefined;
    });
  });

  const getSchemaProps = (schemaName: string) => {
    if (schemaName === "BisCore") {
      return {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        alias: "bis",
        description: "The BIS core schema contains classes that all other domain schemas extend.",
        label: "BIS Core",
        name: "BisCore",
        version: "01.00.15",
        references:[{name:"CoreCustomAttributes", version:"01.00.04"}],
      };
    }
    if (schemaName === "CoreCustomAttributes") {
      return {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        alias: "CoreCA",
        description: "Custom attributes to indicate core EC concepts, may include struct classes intended for use in core custom attributes.",
        label: "Core Custom Attributes",
        name: "CoreCustomAttributes",
        version: "01.00.04",
      };
    }

    return undefined;
  };

  it("Concurrently get BisCore with SchemaJsonLocater", async () => {
    const schemaContext = new SchemaContext();
    const jsonLocater = new SchemaJsonLocater(getSchemaProps);
    schemaContext.addLocater(jsonLocater);

    const schemas = await Promise.all(
      [...Array(100).keys()].map(async () => {
        return schemaContext.getSchema(new SchemaKey("BisCore"));
      }),
    );
    expect(schemas.length).to.equal(100);
    schemas.forEach((schema) => {
      assert(schema !== undefined);
      expect(schema.fullName).to.equal("BisCore");
    });
  });

  it("Concurrently get a schema and it's referenced schema with SchemaJsonLocater", async () => {
    const schemaContext = new SchemaContext();
    const jsonLocater = new SchemaJsonLocater(getSchemaProps);
    schemaContext.addLocater(jsonLocater);

    let getBisCoreFirst = 0;
    const schemas = await Promise.all(
      [...Array(2).keys()].map(async () => {
        if (getBisCoreFirst === 0) {
          getBisCoreFirst = 1;
          return schemaContext.getSchema(new SchemaKey("BisCore"));
        }
        return schemaContext.getSchema(new SchemaKey("CoreCustomAttributes"));
      }),
    );
    expect(schemas.length).to.equal(2);
    schemas.forEach((schema) => {
      expect(schema).to.not.be.undefined;
    });
  });
});
