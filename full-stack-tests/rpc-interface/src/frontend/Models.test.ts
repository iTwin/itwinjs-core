/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import type { ModelProps } from "@itwin/core-common";
import type { IModelConnection} from "@itwin/core-frontend";
import { SpatialModelState } from "@itwin/core-frontend";
import { TestContext } from "./setup/TestContext";

const expect = chai.expect;

describe("IModel Models", () => {
  let iModel: IModelConnection;
  let testContext: TestContext;

  before(async function () {
    testContext = await TestContext.instance();

    if (!testContext.settings.runiModelReadRpcTests)
      this.skip();

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
