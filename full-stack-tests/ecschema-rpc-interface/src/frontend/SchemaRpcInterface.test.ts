/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
import { IModelConnection } from "@itwin/core-frontend";
import { SchemaKey, SchemaKeyProps, SchemaProps } from "@itwin/ecschema-metadata";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { TestContext } from "./setup/TestContext";

// eslint-disable-next-line @typescript-eslint/no-var-requires
chai.use(require("chai-as-promised"));
const { expect } = chai;

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

  it.only("should throw when requesting non-existing schema JSON", async () => {
    // this is setting an internal protocol flag to simulate CORS blocking the X-Protocol-Version response header:
    ECSchemaRpcInterface.getClient().configuration.protocol.supportsStatusCategory = false;
    await expect(ECSchemaRpcInterface.getClient().getSchemaJSON(iModel.getRpcProps(), "DoesNotExist")).to.eventually.be.rejected;
  });
});
