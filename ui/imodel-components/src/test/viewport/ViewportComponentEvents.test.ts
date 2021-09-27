/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { BeUiEvent } from "@itwin/core-bentley";
import { Matrix3d, Point3d } from "@itwin/core-geometry";
import { IModelApp, SelectedViewportChangedArgs, StandardViewId, ViewManager, Viewport } from "@itwin/core-frontend";
import { ViewportComponentEvents } from "../../imodel-components-react/viewport/ViewportComponentEvents";
import { TestUtils } from "../TestUtils";

describe("ViewportComponentEvents", () => {
  const onSelectedViewportChanged = new BeUiEvent();

  before(() => {
    ViewportComponentEvents.terminate();
  });

  it("should initialize when IModelApp.viewManager is defined", () => {
    (IModelApp as any)._viewManager = { onSelectedViewportChanged } as ViewManager;
    ViewportComponentEvents.initialize();
    expect(onSelectedViewportChanged.numberOfListeners).to.equal(1);
  });

  it("should return early in initialization when already initialized", () => {
    ViewportComponentEvents.initialize();
  });

  it("should setCubeMatrix", async () => {
    const cubeListener = sinon.spy();
    const remove = ViewportComponentEvents.onCubeRotationChangeEvent.addListener(cubeListener);
    const rotMatrix = Matrix3d.createIdentity();
    ViewportComponentEvents.setCubeMatrix(rotMatrix, undefined);
    await TestUtils.flushAsyncOperations();
    expect(cubeListener.calledOnce).to.be.true;
    remove();
  });

  it("should setStandardRotation", async () => {
    const standardRotationListener = sinon.spy();
    const remove = ViewportComponentEvents.onStandardRotationChangeEvent.addListener(standardRotationListener);
    const standardRotation = StandardViewId.Front;
    ViewportComponentEvents.setStandardRotation(standardRotation);
    await TestUtils.flushAsyncOperations();
    expect(standardRotationListener.calledOnce).to.be.true;
    remove();
  });

  it("should setViewMatrix", async () => {
    const viewRotationListener = sinon.spy();
    const remove = ViewportComponentEvents.onViewRotationChangeEvent.addListener(viewRotationListener);
    const viewport = { rotation: Matrix3d.createIdentity() } as Viewport;
    ViewportComponentEvents.setViewMatrix(viewport, undefined);
    await TestUtils.flushAsyncOperations();
    expect(viewRotationListener.calledOnce).to.be.true;
    remove();
  });

  it("should setViewMatrix when onSelectedViewportChanged event is emitted", async () => {
    const viewRotationListener = sinon.spy();
    const remove = ViewportComponentEvents.onViewRotationChangeEvent.addListener(viewRotationListener);
    const current = { rotation: Matrix3d.createIdentity() } as Viewport;
    onSelectedViewportChanged.emit({ current } as SelectedViewportChangedArgs);
    await TestUtils.flushAsyncOperations();
    expect(viewRotationListener.calledOnce).to.be.true;
    remove();
  });

  it("should not setViewMatrix when onSelectedViewportChanged event is emitted with unset current", async () => {
    const viewRotationListener = sinon.spy();
    const remove = ViewportComponentEvents.onViewRotationChangeEvent.addListener(viewRotationListener);
    onSelectedViewportChanged.emit({} as SelectedViewportChangedArgs);
    await TestUtils.flushAsyncOperations();
    expect(viewRotationListener.calledOnce).to.be.false;
    remove();
  });

  it("should setDrawingViewportState", async () => {
    const drawingViewportStateListener = sinon.spy();
    const remove = ViewportComponentEvents.onDrawingViewportChangeEvent.addListener(drawingViewportStateListener);
    const origin = Point3d.createZero();
    const rotation = Matrix3d.createIdentity();
    ViewportComponentEvents.setDrawingViewportState(origin, rotation);
    await TestUtils.flushAsyncOperations();
    expect(drawingViewportStateListener.calledOnce).to.be.true;
    remove();
  });
});
