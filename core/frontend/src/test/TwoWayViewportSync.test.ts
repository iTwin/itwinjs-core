/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ViewFlags } from "@itwin/core-common";
import { IModelApp } from "../IModelApp";
import { StandardViewId } from "../StandardView";
import type { ScreenViewport } from "../Viewport";
import { TwoWayViewportFrustumSync, TwoWayViewportSync } from "../TwoWayViewportSync";
import { openBlankViewport } from "./openBlankViewport";

describe("TwoWayViewportSync", () => {
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
      rotate(vp1, StandardViewId.Top);
      rotate(vp2, StandardViewId.Bottom);

      expect(isSameFrustum()).to.be.false;
      rotate(vp1, StandardViewId.Left);

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
    for (const type of [TwoWayViewportSync, TwoWayViewportFrustumSync]) {
      expect(vp1.isCameraOn).to.be.false;
      expect(vp2.isCameraOn).to.be.false;

      vp2.turnCameraOn();
      expect(vp2.isCameraOn).to.be.true;

      const sync = new type();
      sync.connect(vp2, vp1);
      expect(vp1.isCameraOn).to.be.true;
      expect(vp2.isCameraOn).to.be.true;
      expect(isSameFrustum()).to.be.true;

      vp1.turnCameraOff();
      expect(vp1.isCameraOn).to.be.false;
      expect(vp2.isCameraOn).to.be.false;
      expect(isSameFrustum()).to.be.true;

      sync.disconnect();
    }
  });

  it("synchronizes display style", () => {
    function test(type: typeof TwoWayViewportSync, expectSync: boolean) {
      vp1.viewFlags = new ViewFlags();
      vp2.viewFlags = new ViewFlags();
      expect(vp1.viewFlags.grid).to.be.false;
      vp1.viewFlags = vp1.viewFlags.with("grid", true);
      expect(vp2.viewFlags.acsTriad).to.be.false;
      vp2.viewFlags = vp2.viewFlags.with("acsTriad", true);

      const sync = new type();
      sync.connect(vp1, vp2);
      expect(vp1.viewFlags.grid).to.be.true;
      expect(vp2.viewFlags.grid).to.equal(expectSync);
      expect(vp2.viewFlags.acsTriad).not.to.equal(expectSync);

      vp2.viewFlags = vp2.viewFlags.with("acsTriad", true);
      vp2.synchWithView();
      expect(vp1.viewFlags.acsTriad).to.equal(expectSync);

      sync.disconnect();
    }

    test(TwoWayViewportSync, true);
    test(TwoWayViewportFrustumSync, false);

  });

  it("synchronizes selectors", () => {
    function categories(vp: ScreenViewport): string[] {
      return Array.from(vp.view.categorySelector.categories).sort();
    }

    function test(type: typeof TwoWayViewportSync, expectSync: boolean) {
      vp1.view.categorySelector.categories.clear();
      vp2.view.categorySelector.categories.clear();

      vp1.view.categorySelector.categories.add("0x1");
      expect(categories(vp1)).not.to.deep.equal(categories(vp2));

      const sync = new type();
      sync.connect(vp1, vp2);
      if (expectSync)
        expect(categories(vp1)).to.deep.equal(categories(vp2));
      else
        expect(categories(vp1)).not.to.deep.equal(categories(vp2));

      vp2.view.categorySelector.categories.delete("0x1");
      vp2.view.categorySelector.categories.add("0x2");
      vp2.synchWithView();
      vp1.view.categorySelector.categories.add("0x3");
      vp1.synchWithView();

      if (expectSync) {
        expect(categories(vp1)).to.deep.equal(categories(vp2));
        expect(categories(vp1)).to.deep.equal(["0x2", "0x3"]);
      } else {
        expect(categories(vp1)).to.deep.equal(["0x1", "0x3"]);
        expect(categories(vp2)).to.deep.equal(["0x2"]);
      }

      sync.disconnect();
    }

    test(TwoWayViewportSync, true);
    test(TwoWayViewportFrustumSync, false);
  });

  it("disconnects", () => {
    for (const type of [TwoWayViewportSync, TwoWayViewportFrustumSync]) {
      rotate(vp1, StandardViewId.Left);
      rotate(vp2, StandardViewId.Top);
      expect(isSameFrustum()).to.be.false;

      const sync = new type();
      sync.connect(vp1, vp2);
      expect(isSameFrustum()).to.be.true;

      sync.disconnect();

      const prevFrust = vp1.getFrustum();
      rotate(vp1, StandardViewId.Right);
      expect(isSameFrustum()).to.be.false;
      expect(prevFrust.isSame(vp2.getFrustum())).to.be.true;
    }
  });
});
