/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cSpell:ignore typemoq

import { expect } from "chai";
import * as moq from "typemoq";
import { DrawingViewState, OrthographicViewState, ScreenViewport, SheetViewState, SpatialViewState } from "@itwin/core-frontend";
import { ContentViewManager, ViewportContentControl } from "../../appui-react";
import TestUtils from "../TestUtils";

describe("ContentViewManager", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  const viewportMock = moq.Mock.ofType<ScreenViewport>();
  const contentControlMock = moq.Mock.ofType<ViewportContentControl>();
  contentControlMock.setup((control) => control.viewport).returns(() => viewportMock.object);

  it("Content is 2d Sheet View", () => {
    const sheetViewStateMock = moq.Mock.ofType<SheetViewState>();
    sheetViewStateMock.setup((view) => view.is3d()).returns(() => false);
    sheetViewStateMock.setup((view) => view.classFullName).returns(() => "BisCore:SheetViewDefinition");
    viewportMock.reset();
    viewportMock.setup((viewport) => viewport.view).returns(() => sheetViewStateMock.object);

    expect(ContentViewManager.isContentSheetView(contentControlMock.object)).to.be.true;
    expect(ContentViewManager.isContentDrawingView(contentControlMock.object)).to.be.false;
    expect(ContentViewManager.isContentSpatialView(contentControlMock.object)).to.be.false;
    expect(ContentViewManager.isContentOrthographicView(contentControlMock.object)).to.be.false;
    expect(ContentViewManager.isContent3dView(contentControlMock.object)).to.be.false;
    expect(ContentViewManager.contentSupportsCamera(contentControlMock.object)).to.be.false;
  });

  it("Content is 2d Drawing View", () => {
    const drawingViewStateMock = moq.Mock.ofType<DrawingViewState>();
    drawingViewStateMock.setup((view) => view.is3d()).returns(() => false);
    drawingViewStateMock.setup((view) => view.classFullName).returns(() => "BisCore:DrawingViewDefinition");
    viewportMock.reset();
    viewportMock.setup((viewport) => viewport.view).returns(() => drawingViewStateMock.object);

    expect(ContentViewManager.isContentSheetView(contentControlMock.object)).to.be.false;
    expect(ContentViewManager.isContentDrawingView(contentControlMock.object)).to.be.true;
    expect(ContentViewManager.isContentSpatialView(contentControlMock.object)).to.be.false;
    expect(ContentViewManager.isContentOrthographicView(contentControlMock.object)).to.be.false;
    expect(ContentViewManager.isContent3dView(contentControlMock.object)).to.be.false;
    expect(ContentViewManager.contentSupportsCamera(contentControlMock.object)).to.be.false;
  });

  it("Content is 3d Spatial View", () => {
    const spatialViewStateMock = moq.Mock.ofType<SpatialViewState>();
    spatialViewStateMock.setup((view) => view.is3d()).returns(() => true);
    spatialViewStateMock.setup((view) => view.classFullName).returns(() => "BisCore:SpatialViewDefinition");
    viewportMock.reset();
    viewportMock.setup((viewport) => viewport.view).returns(() => spatialViewStateMock.object);

    expect(ContentViewManager.isContentSheetView(contentControlMock.object)).to.be.false;
    expect(ContentViewManager.isContentDrawingView(contentControlMock.object)).to.be.false;
    expect(ContentViewManager.isContentSpatialView(contentControlMock.object)).to.be.true;
    expect(ContentViewManager.isContentOrthographicView(contentControlMock.object)).to.be.false;
    expect(ContentViewManager.isContent3dView(contentControlMock.object)).to.be.true;
    expect(ContentViewManager.contentSupportsCamera(contentControlMock.object)).to.be.true;
  });

  it("Content is 3d Ortho View View", () => {
    const orthographicViewStateMock = moq.Mock.ofType<OrthographicViewState>();
    orthographicViewStateMock.setup((view) => view.is3d()).returns(() => true);
    orthographicViewStateMock.setup((view) => view.classFullName).returns(() => "BisCore:OrthographicViewDefinition");
    viewportMock.reset();
    viewportMock.setup((viewport) => viewport.view).returns(() => orthographicViewStateMock.object);

    expect(ContentViewManager.isContentSheetView(contentControlMock.object)).to.be.false;
    expect(ContentViewManager.isContentDrawingView(contentControlMock.object)).to.be.false;
    expect(ContentViewManager.isContentSpatialView(contentControlMock.object)).to.be.true;
    expect(ContentViewManager.isContentOrthographicView(contentControlMock.object)).to.be.true;
    expect(ContentViewManager.isContent3dView(contentControlMock.object)).to.be.true;
    expect(ContentViewManager.contentSupportsCamera(contentControlMock.object)).to.be.false;
  });

  it("Viewport is not set in Content", () => {
    const localContentMock = moq.Mock.ofType<ViewportContentControl>();
    localContentMock.setup((control) => control.viewport).returns(() => undefined);

    expect(ContentViewManager.isContentSheetView(localContentMock.object)).to.be.false;
    expect(ContentViewManager.isContentDrawingView(localContentMock.object)).to.be.false;
    expect(ContentViewManager.isContentSpatialView(localContentMock.object)).to.be.false;
    expect(ContentViewManager.isContentOrthographicView(localContentMock.object)).to.be.false;
    expect(ContentViewManager.isContent3dView(localContentMock.object)).to.be.false;
    expect(ContentViewManager.contentSupportsCamera(localContentMock.object)).to.be.false;
  });

});
