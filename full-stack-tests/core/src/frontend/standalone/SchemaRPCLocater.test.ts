/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";

import { TestUtility } from "../TestUtility";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { SchemaContext, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { ECSchemaRpcLocater } from "@itwin/ecschema-rpcinterface-common";

describe("Schema RPC locater", () => {
  let imodel: IModelConnection;
  let context: SchemaContext;

  before(async () => {
    await TestUtility.startFrontend();
  });

  after(async () => {
    if (imodel !== undefined)
      await imodel.close();

    await TestUtility.shutdownFrontend();
  });

  it("getSchema shouldn't throw duplicate schema error when called by multiple calls", async () => {

    imodel = await SnapshotConnection.openFile("testImodel.bim");
    const schemaLocater = new ECSchemaRpcLocater(imodel);
    context = new SchemaContext();
    context.addLocater(schemaLocater);

    try {
      // Schema "ECDbSchemaPolicies" doesn't exist in the context, so it will be added as part of the first getSchema call
      const firstCallSchema = await schemaLocater.getSchema(new SchemaKey("ECDbSchemaPolicies", 1, 0, 0), SchemaMatchType.LatestReadCompatible, context);
      expect(firstCallSchema).to.be.not.undefined;

      const secondCallSchema = await schemaLocater.getSchema(new SchemaKey("ECDbSchemaPolicies", 1, 0, 0), SchemaMatchType.LatestReadCompatible, context);
      expect(secondCallSchema).to.be.not.undefined;
    } catch (error: any) {
      // getSchema shouldn't fail with duplicate schema error when called more than once
      assert(false, error.toDebugString());
    }
  });
});
