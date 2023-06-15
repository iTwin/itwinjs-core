/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { IModelConnection, SpatialViewState, ViewCreator3d } from "@itwin/core-frontend";
import { TestContext } from "./setup/TestContext";

const expect = chai.expect;

describe("IModel Views", () => {
  let iModel: IModelConnection;
  let views: IModelConnection.Views;

  before(async function () {
    // Ensure the singleton is setup
    const testContext = await TestContext.instance();

    if (!testContext.settings.runiModelReadRpcTests) {
      this.skip();
    }

    iModel = await testContext.iModelWithChangesets!.getConnection();
    views = iModel.views;
  });

  it("should query ids", async () => {
    const props = await views.queryProps({ from: SpatialViewState.classFullName });
    expect(props).to.exist.and.be.not.empty;
  });

  it("should load", async () => {
    const props = await views.queryProps({ from: SpatialViewState.classFullName });
    const viewState = await views.load(props[0].id!);

    expect(viewState).to.exist.and.be.not.empty;
  });

  it("should create viewstate3d using viewcreator3d", async () => {
    const viewcreator3d = new ViewCreator3d(iModel);
    const viewState = await viewcreator3d.createDefaultView();

    expect(viewState).to.exist.and.be.not.empty;
  });
});
