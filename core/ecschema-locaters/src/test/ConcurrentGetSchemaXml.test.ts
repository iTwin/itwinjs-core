/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { Schema, SchemaContext, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { SchemaXmlFileLocater } from "../SchemaXmlFileLocater";
import { StubSchemaXmlFileLocater } from "../StubSchemaXmlFileLocater";
import { SchemaXml } from "../SchemaXml";

describe("Concurrent XML schema deserialization", () => {
  const assetDir: string = path.join(__dirname, "assets");
  const schemaFolder = path.join(__dirname, "assets", "xml");

  const schemaKeys: SchemaKey[] = [];
  let context: SchemaContext;
  let contextSync: SchemaContext;
  let syncSchemas: Array<Schema | undefined> = [];

  const locater = new SchemaXmlFileLocater();
  const helperLocater = new StubSchemaXmlFileLocater();

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
      const key = helperLocater.getSchemaKey(fs.readFileSync(schemaFile, "utf-8"));

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
    fs.copyFileSync(getSchemaPathFromPackage("aec-units-schema", "AecUnits.ecschema.xml"), path.join(schemaFolder, "AecUnits.ecschema.xml"));
    fs.copyFileSync(getSchemaPathFromPackage("bis-custom-attributes-schema", "BisCustomAttributes.ecschema.xml"), path.join(schemaFolder, "BisCustomAttributes.ecschema.xml"));
    fs.copyFileSync(getSchemaPathFromPackage("ecdb-map-schema", "ECDbMap.ecschema.xml"), path.join(schemaFolder, "ECDbMap.ecschema.xml"));
    fs.copyFileSync(getSchemaPathFromPackage("ecdb-schema-policies-schema", "ECDbSchemaPolicies.ecschema.xml"), path.join(schemaFolder, "ECDbSchemaPolicies.ecschema.xml"));
    fs.copyFileSync(getSchemaPathFromPackage("formats-schema", "Formats.ecschema.xml"), path.join(schemaFolder, "Formats.ecschema.xml"));
    fs.copyFileSync(getSchemaPathFromPackage("units-schema", "Units.ecschema.xml"), path.join(schemaFolder, "Units.ecschema.xml"));
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
      const syncXML = await SchemaXml.writeString(syncSchema!);

      const asyncSchema = asyncSchemas[i];
      expect(asyncSchema).not.to.be.undefined;
      const asyncXML = await SchemaXml.writeString(asyncSchema!);
      expect(asyncXML).to.deep.equal(syncXML);
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
    const asyncSchemas = await Promise.all(schemaPromises);

    for (let i = 0; i < schemaKeys.length; i++) {
      const syncSchema = syncSchemas[i];
      expect(syncSchema).not.to.be.undefined;
      const syncXML = await SchemaXml.writeString(syncSchema!);

      const asyncSchema = asyncSchemas[i];
      expect(asyncSchema).not.to.be.undefined;
      const asyncXML = await SchemaXml.writeString(asyncSchema!);
      expect(asyncXML).to.deep.equal(syncXML);
    }
  });
});
