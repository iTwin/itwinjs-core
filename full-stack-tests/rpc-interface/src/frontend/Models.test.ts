/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
const expect = chai.expect;

import { ModelProps } from "@bentley/imodeljs-common";
import { IModelConnection, SpatialModelState } from "@bentley/imodeljs-frontend";

import { TestContext } from "./setup/TestContext";

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
