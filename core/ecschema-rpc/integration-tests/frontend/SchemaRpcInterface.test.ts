/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import chai = require("chai");
import { expect } from "chai";

import chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

import { IModelConnection } from "@bentley/imodeljs-frontend";
import { MetadataRpcInterface } from "@bentley/schema-rpcinterface-common/lib/MetadataRpcInterface";
import { TestContext } from "./setup/TestContext";

describe("Schema RPC Interface", () => {

  let iModel: IModelConnection;
  let testContext: TestContext;

  before(async () => {
    testContext = await TestContext.instance();
    iModel = await testContext.iModelWithChangesets!.getConnection();
  });

  it("should get schema names", async () => {
    let schemaNames: string[] = [];
    schemaNames = await MetadataRpcInterface.getClient().getSchemaNames(iModel.getRpcProps());

    expect(schemaNames).to.not.be.undefined;
  });

  it("should get schema JSON", async () => {
    let schemaNames: string[] = [];
    schemaNames = await MetadataRpcInterface.getClient().getSchemaNames(iModel.getRpcProps());
    const schemaJSON = await MetadataRpcInterface.getClient().getSchemaJSON(iModel.getRpcProps(), schemaNames[0]);

    expect(schemaJSON).to.not.be.undefined;
  });
});
