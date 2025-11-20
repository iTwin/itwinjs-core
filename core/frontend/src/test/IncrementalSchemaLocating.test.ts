/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterEach, describe, expect, it} from "vitest";
import { IModelApp } from "../IModelApp";
import { createBlankConnection } from "./createBlankConnection";
import { RpcIncrementalSchemaLocater } from "@itwin/ecschema-rpcinterface-common";

describe("Incremental Schema Locating tests", () => {
  afterEach(async () => {
    if (IModelApp.initialized)
      await IModelApp.shutdown();
  });

  it("should not have an incremental schema locater if loading is disabled", async () => {
    await IModelApp.startup({ incrementalSchemaLoading: "disabled" });
    const connection = createBlankConnection();
    const locaters = connection.schemaContext.locaters;
    const incrementalLocater = locaters.find((locater) => locater instanceof RpcIncrementalSchemaLocater);
    expect(incrementalLocater).to.be.undefined;
  });

  it("should have an incremental schema locater if loading is not explicitly disabled", async () => {
    await IModelApp.startup();
    const connection = createBlankConnection();
    const locaters = connection.schemaContext.locaters;
    const incrementalLocater = locaters.find((locater) => locater instanceof RpcIncrementalSchemaLocater);
    expect(incrementalLocater).to.not.be.undefined;
  });

  it("should have an incremental schema locater if loading is enabled", async () => {
    await IModelApp.startup({ incrementalSchemaLoading: "enabled" });
    const connection = createBlankConnection();
    const locaters = connection.schemaContext.locaters;
    const incrementalLocater = locaters.find((locater) => locater instanceof RpcIncrementalSchemaLocater);
    expect(incrementalLocater).to.not.be.undefined;
  });
});

