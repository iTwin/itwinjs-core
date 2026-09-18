/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ProcessDetector } from "@itwin/core-bentley";
import { IModelConnection } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";
import { EntityClass, Schema, SchemaContext, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { ECSchemaRpcLocater } from "@itwin/ecschema-rpcinterface-common";
import { expect } from "vitest";
import { TestSnapshotConnection } from "../TestSnapshotConnection";

const describeChrome = ProcessDetector.isElectronAppFrontend ? describe.skip : describe;
describeChrome("Schema Locater Tests", () => {
  let context = new SchemaContext();
  let imodel: IModelConnection;

  beforeEach(async () => {
    await TestUtility.startFrontend();
    imodel = await TestSnapshotConnection.openFile("testImodel.bim"); // relative path resolved by BackendTestAssetResolver
    const schemaLocater = new ECSchemaRpcLocater(imodel);
    context = new SchemaContext();
    context.addLocater(schemaLocater);
  });

  afterEach(async () => {
    if (undefined !== imodel)
      await imodel.close();

    await TestUtility.shutdownFrontend();
  });

  it("should locate a valid schema asynchronously", async () => {
    const schemaKey = new SchemaKey("Gist", 1, 0, 0);
    const schema = await context.getSchema(schemaKey, SchemaMatchType.Exact);

    expect(schema).toBeDefined();
    expect(schema!.schemaKey.name).toBe("Gist");
    expect(schema!.schemaKey.version.toString()).toBe("01.00.00");

    // Check that the schema is cached in the context
    // Even though getSchemaSync is not supported for locating schemas over RPC/HTTP,
    // it will return the schema if it has already been cached by a previous async getSchema call.
    const schemaSync = context.getSchemaSync(schemaKey, SchemaMatchType.Exact);
    expect(schemaSync).toBeDefined();
    expect(schemaSync!.schemaKey.name).toBe("Gist");
    expect(schemaSync!.schemaKey.version.toString()).toBe("01.00.00");
  });

  it("locating a non-existent schema asynchronously should return undefined", async () => {
    const schemaKey = new SchemaKey("SchemaDoesNotExist", 1, 0, 0);
    const schema = await context.getSchema(schemaKey, SchemaMatchType.Exact);
    expect(schema).toBeUndefined();
  });

  it("should throw an exception when locating a schema synchronously without caching", () => {
    const schemaKey = new SchemaKey("Gist", 1, 0, 0);
    let schema: Schema | undefined;
    expect(() => schema = context.getSchemaSync(schemaKey, SchemaMatchType.Exact)).to.throw("getSchemaSync is not supported. Use the asynchronous getSchema method instead.");
    expect(schema).toBeUndefined();
  });

  it("should retrieve schema items asynchronously", async () => {
    const toyPart = await context.getSchemaItem("Gist.ToyPart", EntityClass);
    expect(toyPart?.name).toEqual("ToyPart");
    const rod = await context.getSchemaItem("Gist.Rod", EntityClass);
    expect(rod?.name).toEqual("Rod");
    const hub = await context.getSchemaItem("Gist.Hub", EntityClass);
    expect(hub?.name).toEqual("Hub");
    const gistPhysicalElement = await context.getSchemaItem("Gist.GistPhysicalElement", EntityClass);
    expect(gistPhysicalElement?.name).toEqual("GistPhysicalElement");
  });

  it("should throw an exception when retrieving schema items synchronously over RPC/HTTP", () => {
    expect(() => context.getSchemaItemSync("Gist.ToyPart", EntityClass)).to.throw("getSchemaSync is not supported. Use the asynchronous getSchema method instead.");
    expect(() => context.getSchemaItemSync("Gist.Rod", EntityClass)).to.throw("getSchemaSync is not supported. Use the asynchronous getSchema method instead.");
    expect(() => context.getSchemaItemSync("Gist.Hub", EntityClass)).to.throw("getSchemaSync is not supported. Use the asynchronous getSchema method instead.");
    expect(() => context.getSchemaItemSync("Gist.GistPhysicalElement", EntityClass)).to.throw("getSchemaSync is not supported. Use the asynchronous getSchema method instead.");
  });

  it("should cache schema items in the context after asynchronous retrieval", async () => {
    // Retrieve a schema item asynchronously, which caches the schema in the context
    const toyPart = await context.getSchemaItem("Gist.ToyPart", EntityClass);
    expect(toyPart?.name).toEqual("ToyPart");

    // Retrieve other schema items synchronously, which works because the schema is now cached
    const rod = context.getSchemaItemSync("Gist.Rod", EntityClass);
    expect(rod?.name).toEqual("Rod");
    const hub = context.getSchemaItemSync("Gist.Hub", EntityClass);
    expect(hub?.name).toEqual("Hub");
    const gistPhysicalElement = context.getSchemaItemSync("Gist.GistPhysicalElement", EntityClass);
    expect(gistPhysicalElement?.name).toEqual("GistPhysicalElement");
  });
});
