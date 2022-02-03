/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import * as moq from "typemoq";
import { BeEvent } from "@itwin/core-bentley";
import type { ScreenViewport, Viewport } from "@itwin/core-frontend";
import { IModelApp, MockRender } from "@itwin/core-frontend";
import { TileLoadingIndicator } from "../../../appui-react";
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

  it("50% then 100% complete", async () => {
    // numReadyTiles / (numReadyTiles + numRequestedTiles)
    const onRenderEvent = new BeEvent<(vp: Viewport) => void>();
    const viewportMock = moq.Mock.ofType<ScreenViewport>();

    // added because component registers interest in onRender events
    viewportMock.setup((x) => x.onRender).returns(() => onRenderEvent);

    await IModelApp.viewManager.setSelectedView(viewportMock.object);
    const wrapper = mount(<TileLoadingIndicator isInFooterMode={true} onOpenWidget={() => { }} openWidget={"TileLoadingIndicator"} />);
    IModelApp.viewManager.onViewOpen.emit(viewportMock.object);
    // 10% complete
    viewportMock.setup((viewport) => viewport.numRequestedTiles).returns(() => 90);
    viewportMock.setup((viewport) => viewport.numReadyTiles).returns(() => 10);
    onRenderEvent.raiseEvent(viewportMock.object);
    await TestUtils.flushAsyncOperations();

    // 50% complete
    viewportMock.setup((viewport) => viewport.numRequestedTiles).returns(() => 250);
    viewportMock.setup((viewport) => viewport.numReadyTiles).returns(() => 250);
    onRenderEvent.raiseEvent(viewportMock.object);
    await TestUtils.flushAsyncOperations();

    // 100% complete
    viewportMock.setup((viewport) => viewport.numRequestedTiles).returns(() => 0);
    viewportMock.setup((viewport) => viewport.numReadyTiles).returns(() => 0);
    onRenderEvent.raiseEvent(viewportMock.object);
    await TestUtils.flushAsyncOperations();

    wrapper.update();
    wrapper.unmount();
  });
});
