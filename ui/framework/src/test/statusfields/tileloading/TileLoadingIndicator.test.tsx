/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as enzyme from "enzyme";
import * as moq from "typemoq";

import { MockRender, IModelApp, ScreenViewport, Viewport } from "@bentley/imodeljs-frontend";

import TestUtils from "../../TestUtils";
import { TileLoadingIndicator } from "../../../ui-framework";
import { BeEvent } from "@bentley/bentleyjs-core";

describe("TileLoadingIndicator", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
    MockRender.App.startup();
  });

  after(() => {
    MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });

  it("should render correctly footer", () => {
    enzyme.shallow(
      <TileLoadingIndicator isInFooterMode={true} onOpenWidget={() => { }} openWidget={"TileLoadingIndicator"} />,
    ).should.matchSnapshot();
  });

  it("should render correctly not footer", () => {
    enzyme.shallow(
      <TileLoadingIndicator isInFooterMode={false} onOpenWidget={() => { }} openWidget={"TileLoadingIndicator"} />,
    ).should.matchSnapshot();
  });

  it("should unmount correctly", () => {
    const sut = enzyme.mount(<TileLoadingIndicator isInFooterMode={true} onOpenWidget={() => { }} openWidget={"TileLoadingIndicator"} />);
    sut.unmount();
  });

  it("should handle onrender messages", () => {
    const sut = enzyme.mount(<TileLoadingIndicator isInFooterMode={true} onOpenWidget={() => { }} openWidget={"TileLoadingIndicator"} />);
    sut.unmount();
  });

  it("50% then 100% complete", () => {
    // numReadyTiles / (numReadyTiles + numRequestedTiles)
    let numRequestedTiles = 500;
    const numTilesReady = 500;
    const onRenderEvent = new BeEvent<(vp: Viewport) => void>();
    const viewportMock = moq.Mock.ofType<ScreenViewport>();
    viewportMock.setup((viewport) => viewport.numRequestedTiles).returns(() => numRequestedTiles);
    viewportMock.setup((viewport) => viewport.numReadyTiles).returns(() => numTilesReady);
    // added because component registers interest in onRender events
    viewportMock.setup((x) => x.onRender).returns(() => onRenderEvent);

    IModelApp.viewManager.setSelectedView(viewportMock.object);
    const sut = enzyme.mount(<TileLoadingIndicator isInFooterMode={true} onOpenWidget={() => { }} openWidget={"TileLoadingIndicator"} />);
    // 50% complete
    onRenderEvent.raiseEvent(viewportMock.object);
    numRequestedTiles = 0;
    // 100% complete
    onRenderEvent.raiseEvent(viewportMock.object);
    sut.unmount();
  });
});
