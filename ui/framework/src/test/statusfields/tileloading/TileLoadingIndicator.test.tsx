/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import * as moq from "typemoq";
import { BeEvent } from "@bentley/bentleyjs-core";
import { IModelApp, MockRender, ScreenViewport, Viewport } from "@bentley/imodeljs-frontend";
import { TileLoadingIndicator } from "../../../ui-framework";
import TestUtils, { mount } from "../../TestUtils";

describe("TileLoadingIndicator", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
    await MockRender.App.startup();
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiFramework();
  });

  it("should render correctly footer", () => {
    shallow(
      <TileLoadingIndicator isInFooterMode={true} onOpenWidget={() => { }} openWidget={"TileLoadingIndicator"} />,
    ).should.matchSnapshot();
  });

  it("should render correctly not footer", () => {
    shallow(
      <TileLoadingIndicator isInFooterMode={false} onOpenWidget={() => { }} openWidget={"TileLoadingIndicator"} />,
    ).should.matchSnapshot();
  });

  it("should unmount correctly", () => {
    const sut = mount(<TileLoadingIndicator isInFooterMode={true} onOpenWidget={() => { }} openWidget={"TileLoadingIndicator"} />);
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
    mount(<TileLoadingIndicator isInFooterMode={true} onOpenWidget={() => { }} openWidget={"TileLoadingIndicator"} />);
    // 50% complete
    onRenderEvent.raiseEvent(viewportMock.object);
    numRequestedTiles = 0;
    // 100% complete
    onRenderEvent.raiseEvent(viewportMock.object);
  });
});
