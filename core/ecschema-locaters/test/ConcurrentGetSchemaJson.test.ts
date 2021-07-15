/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { ECVersion, Schema, SchemaContext, SchemaKey, SchemaMatchType } from "@bentley/ecschema-metadata";
import { SchemaJsonFileLocater } from "../src/SchemaJsonFileLocater";

describe("Concurrent schema JSON deserialization", () => {
  let schemaKeys: SchemaKey[] = [];
  let context: SchemaContext;
  let contextSync: SchemaContext;
  let syncSchemas: Array<Schema | undefined> = [];

  const schemaFolder = path.join(__dirname, "assets", "JSON");
  const locater = new SchemaJsonFileLocater();

  before(() => {
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
      const syncJSON = syncSchema!.toJSON();

      const asyncSchema = asyncSchemas.find(asyncSchema => asyncSchema!.schemaKey.matches(syncSchema!.schemaKey));
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
    const asyncSchemas = await Promise.all(schemaPromises);

    for (let i = 0; i < schemaKeys.length; i++) {
      const syncSchema = syncSchemas[i];
      expect(syncSchema).not.to.be.undefined;
      const syncJSON = syncSchema!.toJSON();

      const asyncSchema = asyncSchemas.find(asyncSchema => asyncSchema!.schemaKey.matches(syncSchema!.schemaKey));
      expect(asyncSchema).not.to.be.undefined;
      const asyncJSON = asyncSchema!.toJSON();
      expect(asyncJSON).to.deep.equal(syncJSON);
    }
  });

  /* Run these tests below one at a time. Running them together doesn't get accurate performance likely bc of disk access caching */
  it.skip("should measure regular deserialization performance", async () => {
    const startTime = new Date().getTime();
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
    const endTime = new Date().getTime();
    console.log(`Async deserialization took ~${endTime - startTime}ms`);
  });

  it.skip("should measure concurrent deserialization performance", async () => {
    const startTime = new Date().getTime();
    const schemaPromises = schemaKeys.map(async (key): Promise<Schema | undefined> => {
      if (!key)
        return undefined;

      const schema = await context.getSchema(key, SchemaMatchType.Latest);
      return schema;
    });
    const asyncSchemas = await Promise.all(schemaPromises);

    expect(asyncSchemas.length).to.equal(schemaKeys.length);
    const endTime = new Date().getTime();
    console.log(`Concurrent async deserialization took ~${endTime - startTime}ms`);
  });
});
