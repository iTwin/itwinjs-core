/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { createBlankConnection } from "./createBlankConnection";
import {  Cartographic, EcefLocation } from "@itwin/core-common";
import { SpatialViewState } from "../SpatialViewState";
import { Point3d, Vector3d } from "@itwin/core-geometry";

describe("Look At", () => {
  let imodel: IModelConnection;

  before(async () => {
    await IModelApp.startup();
    imodel = createBlankConnection("look-at-test");
    imodel.ecefLocation = EcefLocation.createFromCartographicOrigin(Cartographic.fromDegrees({latitude: 39.144703, longitude: -75.703054}));
  });

  after(async () => {
    await imodel.close();
    await IModelApp.shutdown();
  });

  it("lookAtGlobalLocation should change camera", async () => {
    const view3d = SpatialViewState.createBlank(imodel, new Point3d(), new Point3d());

    view3d.lookAt({
      viewDirection: {x: 0.0, y: 0.0, z: 1.0},
      eyePoint: {x: 0.0, y: 0.0, z: 0.0},
      upVector: new Vector3d(0.0, 0.0, 1.0),
    });

    const oldCam = view3d.camera.clone();
    view3d.lookAtGlobalLocation(1000.0, Math.PI / 4.0, {center: Cartographic.fromDegrees({latitude: 39.144703, longitude: -75.703054})});
    const newCam = view3d.camera;

    expect(oldCam.equals(newCam)).to.be.false;
  });
});
