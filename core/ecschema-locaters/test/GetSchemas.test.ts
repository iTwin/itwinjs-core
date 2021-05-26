/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as fs from "fs";
import  * as path from "path";
import { ECVersion, ISchemaLocater, Schema, SchemaContext, SchemaKey, SchemaMatchType } from "@bentley/ecschema-metadata";
import { SchemaJsonFileLocater } from "../src/SchemaJsonFileLocater";


/* eslint-disable @typescript-eslint/naming-convention */

describe("Concurrent schema accesses", () => {
  const asyncContext = new SchemaContext();
  const syncContext = new SchemaContext();
  const schemaKeys: SchemaKey[] = [];

  before(() => {
    const schemaFolder = path.join(__dirname, "assets", "JSON");
    const locater = new SchemaJsonFileLocater();
    locater.addSchemaSearchPath(schemaFolder);
    asyncContext.addLocater(locater as unknown as ISchemaLocater);
    syncContext.addLocater(locater as unknown as ISchemaLocater);

    const schemaFiles = fs.readdirSync(schemaFolder);
    schemaFiles.forEach((fileName) => {
      const schemaFile = path.join(schemaFolder, fileName);
      const schemaJson = JSON.parse(fs.readFileSync(schemaFile, "utf-8"));
      const schemaName = schemaJson.name;
      const schemaVersion = schemaJson.version;

      const key = new SchemaKey(schemaName.toString(), ECVersion.fromString(schemaVersion.toString()));
      schemaKeys.push(key);
    });
  });

  it.only("should correctly deserialize schemas concurrently", async () => {
    // Asynchronous
    const asyncSchemas: Schema[] = [];
    await Promise.all(schemaKeys.map( async (key) => {
      if (!key)
        return;
      console.log(`Starting retrieval of ${key.name} asynchronously`);
      const schema = await asyncContext.getSchema(key, SchemaMatchType.Latest);
      if (!schema)
        return;
      console.log(`Retrieval of ${key.name} asynchronously completed`);
      asyncSchemas.push(schema);
      return;
    }));
    expect(asyncSchemas.length).to.equal(schemaKeys.length);

    // Synchronous
    const syncSchemas: Schema[] =  [];
    schemaKeys.forEach((key) => {
      if (!key)
        return;
      console.log(`Starting retrieval of ${key.name} synchronously`);
      const schema = syncContext.getSchemaSync(key, SchemaMatchType.Latest);
      if (!schema)
        return;
      console.log(`Retrieval of ${key.name} synchronously completed`);
      syncSchemas.push(schema);
      return;
    });
    expect(syncSchemas.length).to.equal(schemaKeys.length);

    // Serialized async
    // const asyncSchemas: Schema[] = [];
    // const getSchema = async (key: SchemaKey) => {
    //   if (!key)
    //     return;
    //   console.log(`Starting retrieval of ${key.name}`);
    //   const schema = await asyncContext.getSchema(key, SchemaMatchType.Latest);
    //   if (!schema)
    //     return;
    //   console.log(`Retrieval of ${key.name} complete`);
    //   asyncSchemas.push(schema);
    //   return;
    // }
    // for (let i = 0; i < schemaKeys.length; i++) {
    //   await getSchema(schemaKeys[i]);
    // }
    // expect(asyncSchemas.length).to.equal(schemaKeys.length);

    for (let i = 0; i < schemaKeys.length; i++) {
      const syncSchema = syncSchemas[i];
      const syncSerialized = syncSchema.toJSON();

      const asyncSchema = asyncSchemas.find(asyncSchema => asyncSchema.schemaKey.matches(syncSchema.schemaKey));
      expect(asyncSchema).not.to.be.undefined;
      const asyncSerialized = asyncSchema!.toJSON();
      expect(asyncSerialized).to.deep.equal(syncSerialized);
    }
  });
});
