/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { beforeAll, beforeEach, describe, it } from "vitest";
import * as chai from "chai";
import { ModelProps } from "@itwin/core-common";
import { IModelConnection, SpatialModelState } from "@itwin/core-frontend";
import { TestContext } from "./setup/TestContext";

const expect = chai.expect;

describe("IModel Models", () => {
  let iModel: IModelConnection;
  let testContext: TestContext;

  let skipSuite = false;
  beforeEach((context) => context.skip(skipSuite));
  beforeAll(async () => {
    testContext = await TestContext.instance();

    if (!testContext.settings.runiModelReadRpcTests) {
      skipSuite = true;
      return;
    }

    iModel = await testContext.iModelWithChangesets!.getConnection();
  });

  it("should get props", async () => {
    const modelIds: string[] = [iModel.models.repositoryModelId];
    const modelProps: ModelProps[] = await iModel.models.getProps(modelIds);

    expect(modelProps).to.exist.and.be.not.empty;
  });

  it("should query props", async () => {
    const modelProps: ModelProps[] = await iModel.models.queryProps({ from: SpatialModelState.classFullName });

    expect(modelProps).to.exist.and.be.not.empty;
  });
});
