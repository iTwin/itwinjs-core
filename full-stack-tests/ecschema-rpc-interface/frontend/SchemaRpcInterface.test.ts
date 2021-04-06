/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import chai = require("chai");
import { expect } from "chai";

import chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

import { IModelConnection } from "@bentley/imodeljs-frontend";
import { ECSchemaRpcInterface } from "@bentley/ecschema-rpcinterface-common";
import { TestContext } from "./setup/TestContext";
import { SchemaKey, SchemaProps } from "@bentley/ecschema-metadata";

describe("Schema RPC Interface", () => {

  let iModel: IModelConnection;
  let testContext: TestContext;

  before(async () => {
    testContext = await TestContext.instance();
    iModel = await testContext.iModelWithChangesets!.getConnection();
  });

  it("should get schema keys", async () => {
    let schemaKeys: SchemaKey[] = [];
    schemaKeys = await ECSchemaRpcInterface.getClient().getSchemaKeys(iModel.getRpcProps());

    expect(schemaKeys).to.not.be.undefined;
  });

  it("should get schema JSON", async () => {
    let schemaKeys: SchemaKey[] = [];
    schemaKeys = await ECSchemaRpcInterface.getClient().getSchemaKeys(iModel.getRpcProps());
    const result = await ECSchemaRpcInterface.getClient().getSchemaJSON(iModel.getRpcProps(), schemaKeys[0].name);
    const schemaJSON: SchemaProps = JSON.parse(result);
    expect(schemaJSON).to.not.be.undefined;
  });
});
