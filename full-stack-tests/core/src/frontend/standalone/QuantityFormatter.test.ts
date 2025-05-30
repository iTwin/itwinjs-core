/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelConnection, QuantityFormatter } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";
import { SchemaContext, SchemaUnitProvider } from "@itwin/ecschema-metadata";
import { ECSchemaRpcLocater } from "@itwin/ecschema-rpcinterface-common";
import { assert } from "chai";
import { TestSnapshotConnection } from "../TestSnapshotConnection";

describe("QuantityFormatter", () => {
  let context = new SchemaContext();
  let imodel: IModelConnection;

  before(async () => {
    await TestUtility.startFrontend();
    imodel = await TestSnapshotConnection.openFile("testImodel.bim"); // relative path resolved by BackendTestAssetResolver
    const schemaLocater = new ECSchemaRpcLocater(imodel);
    context = new SchemaContext();
    context.addLocater(schemaLocater);
  });

  after(async () => {
    if (undefined !== imodel)
      await imodel.close();

    await TestUtility.shutdownFrontend();
  });

  it("QuantityFormatter initialized properly using units schema from iModel", async () => {
    const quantityFormatter = new QuantityFormatter();
    quantityFormatter.unitsProvider = new SchemaUnitProvider(context);
    await quantityFormatter.onInitialized();
    const spec = quantityFormatter.findFormatterSpecByQuantityType("QuantityTypeEnumValue-1");
    assert(spec !== undefined);
  });
});
