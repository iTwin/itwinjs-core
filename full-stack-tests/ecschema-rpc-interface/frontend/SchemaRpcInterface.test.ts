/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import chai = require("chai");
import { expect } from "chai";

import chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

import { IModelConnection } from "@bentley/imodeljs-frontend";
import { ECSchemaRpcInterface } from "@bentley/ecschema-rpcinterface-common/lib/ECSchemaRpcInterface";
import { TestContext } from "./setup/TestContext";
import { SchemaKey } from "../../../core/backend/node_modules/@bentley/ecschema-metadata/lib/ecschema-metadata";

describe("Schema RPC Interface", () => {

  let iModel: IModelConnection;
  let testContext: TestContext;

  before(async () => {
    testContext = await TestContext.instance();
    iModel = await testContext.iModelWithChangesets!.getConnection();
  });

  it("should get schema names", async () => {
    let schemaNames: SchemaKey[] = [];
    schemaNames = await ECSchemaRpcInterface.getClient().getSchemaNames(iModel.getRpcProps());

    expect(schemaNames).to.not.be.undefined;
  });

  it("should get schema JSON", async () => {
    let schemaNames: SchemaKey[] = [];
    schemaNames = await ECSchemaRpcInterface.getClient().getSchemaNames(iModel.getRpcProps());
    const schemaJSON = await ECSchemaRpcInterface.getClient().getSchemaJSON(iModel.getRpcProps(), schemaNames[0].name);

    expect(schemaJSON).to.not.be.undefined;
  });
});
