/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import chai = require("chai");
import { expect } from "chai";

import chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

import { IModelConnection } from "@itwin/core-frontend";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { TestContext } from "./setup/TestContext";
import { SchemaKey, SchemaKeyProps, SchemaProps } from "@itwin/ecschema-metadata";

describe("Schema RPC Interface", () => {

  let iModel: IModelConnection;
  let testContext: TestContext;

  before(async () => {
    testContext = await TestContext.instance();
    iModel = await testContext.iModelWithChangesets!.getConnection();
  });

  it("should get schema keys", async () => {
    const schemaKeys: SchemaKey[] = [];
    const props: SchemaKeyProps[] = await ECSchemaRpcInterface.getClient().getSchemaKeys(iModel.getRpcProps());
    props.forEach((prop: SchemaKeyProps) => schemaKeys.push(SchemaKey.fromJSON(prop)));
    expect(schemaKeys).to.not.be.undefined;
  });

  it("should get schema JSON", async () => {
    const schemaKeys: SchemaKey[] = [];
    const props: SchemaKeyProps[] = await ECSchemaRpcInterface.getClient().getSchemaKeys(iModel.getRpcProps());
    props.forEach((prop: SchemaKeyProps) => schemaKeys.push(SchemaKey.fromJSON(prop)));
    const schemaJSON: SchemaProps = await ECSchemaRpcInterface.getClient().getSchemaJSON(iModel.getRpcProps(), schemaKeys[0].name);
    expect(schemaJSON).to.not.be.undefined;
  });
});
