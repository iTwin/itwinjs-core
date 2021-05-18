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

describe("Schema References", () => {
  const context = new SchemaContext();
  const schemaKeys: SchemaKey[] = [];

  before(() => {
    const schemaFolder = path.join(__dirname, "assets", "JSON");
    const locater = new SchemaJsonFileLocater();
    locater.addSchemaSearchPath(schemaFolder);
    context.addLocater(locater as unknown as ISchemaLocater);

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

  it.only("should load schema references correctly", async () => {
    let schemasList: Schema[] = [];

    // Asynchronous
    await Promise.all(schemaKeys.map( async (key) => {
      if (!key)
        return;
      console.log(`Starting retrieval of ${key.name}`);
      const schema = await context.getSchema(key, SchemaMatchType.Latest);
      if (!schema)
        return;
      console.log(`Retrieval of ${key.name} complete`);
      schemasList.push(schema);
      return;
    }));
    expect(schemasList.length).to.equal(schemaKeys.length);

    // Synchronous
    // schemaKeys.forEach((key) => {
    //   if (!key)
    //     return;
    //   console.log(`Starting retrieval of ${key.name}`);
    //   const schema = context.getSchemaSync(key, SchemaMatchType.Latest);
    //   if (!schema)
    //     return;
    //   console.log(`Retrieval of ${key.name} complete`);
    //   schemasList.push(schema);
    //   return;
    // });
    // expect(schemasList.length).to.equal(35);

    // Serialized async
    // schemasList = [];
    // const getSchema = async (key: SchemaKey) => {
    //   if (!key)
    //     return;
    //   console.log(`Starting retrieval of ${key.name}`);
    //   const schema = await context.getSchema(key, SchemaMatchType.Latest);
    //   if (!schema)
    //     return;
    //   console.log(`Retrieval of ${key.name} complete`);
    //   schemasList.push(schema);
    //   return;
    // }
    // for (let i = 0; i < schemaKeys.length; i++) {
    //   await getSchema(schemaKeys[i]);
    // }
    // expect(schemasList.length).to.equal(schemaKeys.length);

  });
});
