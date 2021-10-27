/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cSpell:ignore typemoq
import { expect } from "chai";
import * as moq from "typemoq";
import { DrawingViewState, OrthographicViewState, ScreenViewport, SheetViewState, SpatialViewState } from "@itwin/core-frontend";
import { ViewUtilities } from "../../appui-react";
import TestUtils from "../TestUtils";

describe("ViewUtilities", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  it("should get bis base class name", () => {
    const bisBaseClass = ViewUtilities.getBisBaseClass("xyz:SheetViewDefinition");
    expect(bisBaseClass).to.eq("SheetViewDefinition");
  });

  it("should recognize spatial view", () => {
    expect(ViewUtilities.isSpatial("SpatialViewDefinition")).to.be.true;
    expect(ViewUtilities.isSpatial("OrthographicViewDefinition")).to.be.true;
    expect(ViewUtilities.isSpatial("")).to.be.false;
  });

  it("should recognize drawing view", () => {
    expect(ViewUtilities.isDrawing("DrawingViewDefinition")).to.be.true;
    expect(ViewUtilities.isDrawing("")).to.be.false;
  });

  it("should recognize sheet view", () => {
    expect(ViewUtilities.isSheet("SheetViewDefinition")).to.be.true;
    expect(ViewUtilities.isSheet("")).to.be.false;
  });

  const viewportMock = moq.Mock.ofType<ScreenViewport>();

  it("is2d Sheet View", () => {
    const sheetViewStateMock = moq.Mock.ofType<SheetViewState>();
    sheetViewStateMock.setup((view) => view.is3d()).returns(() => false);
    sheetViewStateMock.setup((view) => view.classFullName).returns(() => "BisCore:SheetViewDefinition");
    viewportMock.reset();
    viewportMock.setup((viewport) => viewport.view).returns(() => sheetViewStateMock.object);
    expect(ViewUtilities.is3dView(viewportMock.object)).to.be.false;
    expect(ViewUtilities.isSheetView(viewportMock.object)).to.be.true;
    expect(ViewUtilities.isDrawingView(viewportMock.object)).to.be.false;
    expect(ViewUtilities.isSpatialView(viewportMock.object)).to.be.false;
    expect(ViewUtilities.isOrthographicView(viewportMock.object)).to.be.false;
    expect(ViewUtilities.viewSupportsCamera(viewportMock.object)).to.be.false;
  });

  it("is2d Drawing View", () => {
    const drawingViewStateMock = moq.Mock.ofType<DrawingViewState>();
    drawingViewStateMock.setup((view) => view.is3d()).returns(() => false);
    drawingViewStateMock.setup((view) => view.classFullName).returns(() => "BisCore:DrawingViewDefinition");
    viewportMock.reset();
    viewportMock.setup((viewport) => viewport.view).returns(() => drawingViewStateMock.object);
    expect(ViewUtilities.is3dView(viewportMock.object)).to.be.false;
    expect(ViewUtilities.isSheetView(viewportMock.object)).to.be.false;
    expect(ViewUtilities.isDrawingView(viewportMock.object)).to.be.true;
    expect(ViewUtilities.isSpatialView(viewportMock.object)).to.be.false;
    expect(ViewUtilities.isOrthographicView(viewportMock.object)).to.be.false;
    expect(ViewUtilities.viewSupportsCamera(viewportMock.object)).to.be.false;
  });

  it("is3d Spatial View", () => {
    const spatialViewStateMock = moq.Mock.ofType<SpatialViewState>();
    spatialViewStateMock.setup((view) => view.is3d()).returns(() => true);
    spatialViewStateMock.setup((view) => view.classFullName).returns(() => "BisCore:SpatialViewDefinition");
    viewportMock.reset();
    viewportMock.setup((viewport) => viewport.view).returns(() => spatialViewStateMock.object);
    expect(ViewUtilities.is3dView(viewportMock.object)).to.be.true;
    expect(ViewUtilities.isSheetView(viewportMock.object)).to.be.false;
    expect(ViewUtilities.isDrawingView(viewportMock.object)).to.be.false;
    expect(ViewUtilities.isSpatialView(viewportMock.object)).to.be.true;
    expect(ViewUtilities.isOrthographicView(viewportMock.object)).to.be.false;
    expect(ViewUtilities.viewSupportsCamera(viewportMock.object)).to.be.true;
  });

  it("is3d Ortho View", () => {
    const orthographicViewStateMock = moq.Mock.ofType<OrthographicViewState>();
    orthographicViewStateMock.setup((view) => view.is3d()).returns(() => true);
    orthographicViewStateMock.setup((view) => view.classFullName).returns(() => "BisCore:OrthographicViewDefinition");
    viewportMock.reset();
    viewportMock.setup((viewport) => viewport.view).returns(() => orthographicViewStateMock.object);
    expect(ViewUtilities.is3dView(viewportMock.object)).to.be.true;
    expect(ViewUtilities.isSheetView(viewportMock.object)).to.be.false;
    expect(ViewUtilities.isDrawingView(viewportMock.object)).to.be.false;
    expect(ViewUtilities.isSpatialView(viewportMock.object)).to.be.true;  // ortho is derived from spatial
    expect(ViewUtilities.isOrthographicView(viewportMock.object)).to.be.true;
    expect(ViewUtilities.viewSupportsCamera(viewportMock.object)).to.be.false;
  });

});
