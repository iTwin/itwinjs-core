/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
const expect = chai.expect;

import { Id64String, Id64Set } from "@bentley/bentleyjs-core";
import { ElementProps } from "@bentley/imodeljs-common";

import { TestContext } from "./setup/TestContext";
import { IModelConnection, SpatialModelState } from "@bentley/imodeljs-frontend";

describe("IModel Elements", () => {
  let iModel: IModelConnection;
  let elements: IModelConnection.Elements;

  before(async function () {
    const testContext = await TestContext.instance();

    if (!testContext.settings.runiModelReadRpcTests)
      this.skip();

    iModel = await testContext.iModelWithChangesets!.getConnection();
    elements = iModel.elements;
  });

  it("should get props", async () => {
    const elementIds: Id64String[] = [elements.rootSubjectId];
    const elementProps: ElementProps[] = await elements.getProps(elementIds);

    expect(elementProps).to.exist.and.be.not.empty;
  });

  it("should query props", async () => {
    const elementProps: ElementProps[] = await elements.queryProps({ from: SpatialModelState.classFullName });

    expect(elementProps).to.exist.and.be.not.empty;
  });

  it("should query ids", async () => {
    const ids: Id64Set = await elements.queryIds({ limit: 10, from: "BisCore:Subject" });

    expect(ids).to.exist;
  });
});
