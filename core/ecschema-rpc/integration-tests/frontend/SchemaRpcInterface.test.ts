/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import chai = require("chai");
import { expect } from "chai";

import chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

import { IModelConnection } from "@bentley/imodeljs-frontend";
import { SchemaRpcInterface } from "@bentley/schema-rpcinterface-common";
import { TestContext } from "./setup/TestContext";

describe("Schema RPC Interface", () => {

  let iModel: IModelConnection;
  let testContext: TestContext;

  before(async () => {
    testContext = await TestContext.instance();
    iModel = await testContext.iModelWithChangesets!.getConnection();
  });

  it("should retrieve column headers", async () => {
    // IModelReadRpcInterface is configured, expect success
    const rows: any[] = await SchemaRpcInterface.getClient().getQueryColumnHeaders(iModel.getRpcProps(), "Select * from biscore.element");

    expect(rows).to.not.be.undefined;
  });

  it("should get schema names", async () => {
    let schemaNames: string[] = [];
    schemaNames = await SchemaRpcInterface.getClient().getSchemaNames(iModel.getRpcProps());

    expect(schemaNames).to.not.be.undefined;
  });

  it("should get schema JSON", async () => {
    let schemaNames: string[] = [];
    schemaNames = await SchemaRpcInterface.getClient().getSchemaNames(iModel.getRpcProps());
    const schemaJSON = await SchemaRpcInterface.getClient().getSchemaJSON(iModel.getRpcProps(), schemaNames[0]);

    expect(schemaJSON).to.not.be.undefined;
  });
});
