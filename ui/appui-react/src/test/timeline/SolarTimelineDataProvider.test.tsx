/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import type { ViewFlags } from "@itwin/core-common";
import type { DisplayStyle3dState, IModelConnection, ScreenViewport, ViewState3d } from "@itwin/core-frontend";
import { SolarTimelineDataProvider } from "../../appui-react/timeline/SolarTimelineDataProvider";

describe("SolarTimelineDataProvider", () => {

  const viewportMock = moq.Mock.ofType<ScreenViewport>();
  const viewMock = moq.Mock.ofType<ViewState3d>();
  const displayStyleMock = moq.Mock.ofType<DisplayStyle3dState>();
  const vfMock = moq.Mock.ofType<ViewFlags>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();

  beforeEach(() => {
    vfMock.reset();
    vfMock.setup((vf) => vf.shadows).returns(() => true);
    displayStyleMock.reset();
    displayStyleMock.setup((ds) => ds.viewFlags).returns(() => vfMock.object);
    displayStyleMock.setup((ds) => ds.setSunTime(moq.It.isAnyNumber()));

    imodelMock.setup((x) => x.isGeoLocated).returns(() => false);
    viewMock.reset();
    viewMock.setup((view) => view.classFullName).returns(() => "SpatialViewDefinition");
    viewMock.setup((view) => view.is3d()).returns(() => true);
    viewMock.setup((view) => view.displayStyle).returns(() => displayStyleMock.object);
    viewMock.setup((view) => view.iModel).returns(() => imodelMock.object);
    viewportMock.reset();
    viewportMock.setup((viewport) => viewport.view).returns(() => viewMock.object);
  });

  it("SolarTimelineDataProvider can provide timeline data", async () => {
    const viewState = viewMock.object;
    const viewport = viewportMock.object;

    const provider = new SolarTimelineDataProvider(viewState, viewport);
    expect(provider).not.to.be.null;
    expect(provider.supportsTimelineAnimation).to.be.true;
  });

});
