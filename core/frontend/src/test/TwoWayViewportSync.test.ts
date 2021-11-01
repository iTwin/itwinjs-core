/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { IModelApp } from "../IModelApp";
import { StandardViewId } from "../StandardView";
import { ScreenViewport } from "../Viewport";
import { TwoWayViewportFrustumSync, TwoWayViewportSync } from "../TwoWayViewportSync";
import { openBlankViewport } from "./openBlankViewport";

describe.only("TwoWayViewportSync", () => {
  let vp1: ScreenViewport;
  let vp2: ScreenViewport;

  before(async () => IModelApp.startup());
  after(async () => IModelApp.shutdown());

  beforeEach(() => {
    vp1 = openBlankViewport();
    vp2 = openBlankViewport();
  });

  afterEach(() => {
    vp1.dispose();
    vp2.dispose();
  });

  function isSameFrustum() {
    return vp1.getFrustum().isSame(vp2.getFrustum());
  }

  function rotate(vp: ScreenViewport, id: StandardViewId) {
    vp.view.setStandardRotation(id);
    vp.synchWithView();
  }

  it("synchronizes frusta", () => {
    for (const type of [TwoWayViewportSync, TwoWayViewportFrustumSync]) {
      expect(isSameFrustum()).to.be.true;
      rotate(vp1, StandardViewId.Left);
      expect(isSameFrustum()).to.be.false;

      const sync = new type();
      sync.connect(vp1, vp2);
      expect(isSameFrustum()).to.be.true;

      let prevFrust = vp1.getFrustum();
      rotate(vp1, StandardViewId.Right);
      expect(prevFrust.isSame(vp1.getFrustum())).to.be.false;
      expect(isSameFrustum()).to.be.true;

      prevFrust = vp2.getFrustum();
      rotate(vp2, StandardViewId.RightIso);
      expect(prevFrust.isSame(vp2.getFrustum())).to.be.false;
      expect(isSameFrustum()).to.be.true;

      sync.disconnect();
    }
  });

  it("synchronizes camera", () => {
  });

  it("synchronizes display style", () => {
  });

  it("disconnects", () => {
  });
});
