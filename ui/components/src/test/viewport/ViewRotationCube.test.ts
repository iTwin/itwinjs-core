/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { ViewRotationCube } from "../../ui-components";
import { Matrix3d } from "@bentley/geometry-core";
import { IModelApp, Viewport, StandardViewId, ViewManager, SelectedViewportChangedArgs } from "@bentley/imodeljs-frontend";
import { BeUiEvent } from "@bentley/bentleyjs-core";

describe("ViewRotationCube", () => {
  const onSelectedViewportChanged = new BeUiEvent();
  it("should quietly fail initialization when IModelApp.viewManager is not defined", () => {
    ViewRotationCube.initialize();
  });
  it("should initialize when IModelApp.viewManager is defined", () => {
    IModelApp.viewManager = { onSelectedViewportChanged } as ViewManager;
    ViewRotationCube.initialize();
    expect(onSelectedViewportChanged.numberOfListeners).to.equal(1);
  });
  it("should return early in initialization when already initialized", () => {
    ViewRotationCube.initialize();
  });
  it("should setCubeMatrix", () => {
    const cubeListener = sinon.spy();
    ViewRotationCube.onCubeRotationChangeEvent.addListener(cubeListener);
    const rotMatrix = Matrix3d.createIdentity();
    ViewRotationCube.setCubeMatrix(rotMatrix, undefined);
  });
  it("should setStandardRotation", () => {
    const standardRotationListener = sinon.spy();
    ViewRotationCube.onStandardRotationChangeEvent.addListener(standardRotationListener);
    const standardRotation = StandardViewId.Front;
    ViewRotationCube.setStandardRotation(standardRotation);
  });
  it("should setViewMatrix", () => {
    const viewRotationListener = sinon.spy();
    ViewRotationCube.onViewRotationChangeEvent.addListener(viewRotationListener);
    const viewport = { rotation: Matrix3d.createIdentity() } as Viewport;
    ViewRotationCube.setViewMatrix(viewport, undefined);
  });
  it("should setViewMatrix when onSelectedViewportChanged event is emitted", () => {
    const current = { rotation: Matrix3d.createIdentity() } as Viewport;
    onSelectedViewportChanged.emit({ current } as SelectedViewportChangedArgs);
  });
  it("should setViewMatrix when onSelectedViewportChanged event is emitted with unset current", () => {
    onSelectedViewportChanged.emit({} as SelectedViewportChangedArgs);
  });
});
