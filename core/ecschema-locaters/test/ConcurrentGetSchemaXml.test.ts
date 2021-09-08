/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { Schema, SchemaContext, SchemaKey, SchemaMatchType } from "@bentley/ecschema-metadata";
import { SchemaXmlFileLocater } from "../src/SchemaXmlFileLocater";
import { StubSchemaXmlFileLocater } from "../src/StubSchemaXmlFileLocater";

describe("Concurrent XML schema deserialization", () => {
  let schemaKeys: SchemaKey[] = [];
  let context: SchemaContext;
  let contextSync: SchemaContext;
  let syncSchemas: Array<Schema | undefined> = [];

  const schemaFolder = path.join(__dirname, "assets", "XML");
  const locater = new SchemaXmlFileLocater();
  const helperLocater = new StubSchemaXmlFileLocater();

  before(() => {
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
  })

  beforeEach(() => {
    context = new SchemaContext();
    context.addLocater(locater);
  });

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
      const syncXML = await syncSchema!.toXmlString();

      const asyncSchema = asyncSchemas[i];
      expect(asyncSchema).not.to.be.undefined;
      const asyncXML = await asyncSchema!.toXmlString();
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
      const syncXML = await syncSchema!.toXmlString();

      const asyncSchema = asyncSchemas[i];
      expect(asyncSchema).not.to.be.undefined;
      const asyncXML = await asyncSchema!.toXmlString();
      expect(asyncXML).to.deep.equal(syncXML);
    }
  });
});
