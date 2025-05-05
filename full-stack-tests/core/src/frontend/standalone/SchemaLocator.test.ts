/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelConnection } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";
import { SchemaContext } from "@itwin/ecschema-metadata";
import { ECSchemaRpcLocater } from "@itwin/ecschema-rpcinterface-common";
import * as EC from "@itwin/ecschema-metadata";
import { assert, expect } from "chai";
import { TestSnapshotConnection } from "../TestSnapshotConnection";

describe("Schema Locater tests: ", () => {
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

  it("locate valid schema Async", async () => {
    const schemaKey = new EC.SchemaKey("Gist", 1, 0, 0);
    const schema = await context.getSchema(schemaKey, EC.SchemaMatchType.Exact);

    assert.isDefined(schema);
    assert.strictEqual(schema!.schemaKey.name, "Gist");
    assert.strictEqual(schema!.schemaKey.version.toString(), "01.00.00");
  });

  it("locate valid schema Sync", () => {
    const schemaKey = new EC.SchemaKey("Gist", 1, 0, 0);
    let schema: EC.Schema | undefined;
    expect(() => schema = context.getSchemaSync(schemaKey, EC.SchemaMatchType.Exact)).to.throw("getSchemaSync is not supported. Use the asynchronous getSchema method instead.");
    assert.isUndefined(schema);
  });
});
