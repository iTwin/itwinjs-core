/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { EmptyLocalization, ViewFlags } from "@itwin/core-common";
import { IModelApp } from "../IModelApp";
import { StandardViewId } from "../StandardView";
import { Viewport } from "../Viewport";
import {
  connectViewports, synchronizeViewportFrusta, synchronizeViewportViews, TwoWayViewportFrustumSync, TwoWayViewportSync,
} from "../ViewportSync";
import { openBlankViewport } from "./openBlankViewport";

function rotate(vp: Viewport, id: StandardViewId) {
  vp.view.setStandardRotation(id);
  vp.synchWithView();
}

describe("TwoWayViewportSync", () => {
  let vp1: Viewport;
  let vp2: Viewport;

  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterAll(async () => IModelApp.shutdown());

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

  it("synchronizes frusta", () => {
    for (const type of [TwoWayViewportSync, TwoWayViewportFrustumSync]) {
      rotate(vp1, StandardViewId.Top);
      rotate(vp2, StandardViewId.Bottom);

      expect(isSameFrustum()).toBe(false);
      rotate(vp1, StandardViewId.Left);

      const sync = new type();
      sync.connect(vp1, vp2);
      expect(isSameFrustum()).toBe(true);

      let prevFrust = vp1.getFrustum();
      rotate(vp1, StandardViewId.Right);
      expect(prevFrust.isSame(vp1.getFrustum())).toBe(false);
      expect(isSameFrustum()).toBe(true);

      prevFrust = vp2.getFrustum();
      rotate(vp2, StandardViewId.RightIso);
      expect(prevFrust.isSame(vp2.getFrustum())).toBe(false);
      expect(isSameFrustum()).toBe(true);

      sync.disconnect();
    }
  });

  it("synchronizes camera", () => {
    for (const type of [TwoWayViewportSync, TwoWayViewportFrustumSync]) {
      expect(vp1.isCameraOn).toBe(false);
      expect(vp2.isCameraOn).toBe(false);

      vp2.turnCameraOn();
      expect(vp2.isCameraOn).toBe(true);

      const sync = new type();
      sync.connect(vp2, vp1);
      expect(vp1.isCameraOn).toBe(true);
      expect(vp2.isCameraOn).toBe(true);
      expect(isSameFrustum()).toBe(true);

      vp1.turnCameraOff();
      expect(vp1.isCameraOn).toBe(false);
      expect(vp2.isCameraOn).toBe(false);
      expect(isSameFrustum()).toBe(true);

      sync.disconnect();
    }
  });

  it("synchronizes display style", () => {
    function test(type: typeof TwoWayViewportSync, expectSync: boolean) {
      vp1.viewFlags = new ViewFlags();
      vp2.viewFlags = new ViewFlags();
      expect(vp1.viewFlags.grid).toBe(false);
      vp1.viewFlags = vp1.viewFlags.with("grid", true);
      expect(vp2.viewFlags.acsTriad).toBe(false);
      vp2.viewFlags = vp2.viewFlags.with("acsTriad", true);

      const sync = new type();
      sync.connect(vp1, vp2);
      expect(vp1.viewFlags.grid).toBe(true);
      expect(vp2.viewFlags.grid).toEqual(expectSync);
      expect(vp2.viewFlags.acsTriad).not.toEqual(expectSync);

      vp2.viewFlags = vp2.viewFlags.with("acsTriad", true);
      vp2.synchWithView();
      expect(vp1.viewFlags.acsTriad).toEqual(expectSync);

      sync.disconnect();
    }

    test(TwoWayViewportSync, true);
    test(TwoWayViewportFrustumSync, false);

  });

  it("synchronizes selectors", () => {
    function categories(vp: Viewport): string[] {
      return Array.from(vp.view.categorySelector.categories).sort();
    }

    function test(type: typeof TwoWayViewportSync, expectSync: boolean) {
      vp1.view.categorySelector.categories.clear();
      vp2.view.categorySelector.categories.clear();

      vp1.view.categorySelector.categories.add("0x1");
      expect(categories(vp1)).not.toEqual(categories(vp2));

      const sync = new type();
      sync.connect(vp1, vp2);
      if (expectSync)
        expect(categories(vp1)).toEqual(categories(vp2));
      else
        expect(categories(vp1)).not.toEqual(categories(vp2));

      vp2.view.categorySelector.categories.delete("0x1");
      vp2.view.categorySelector.categories.add("0x2");
      vp2.synchWithView();
      vp1.view.categorySelector.categories.add("0x3");
      vp1.synchWithView();

      if (expectSync) {
        expect(categories(vp1)).toEqual(categories(vp2));
        expect(categories(vp1)).toEqual(["0x2", "0x3"]);
      } else {
        expect(categories(vp1)).toEqual(["0x1", "0x3"]);
        expect(categories(vp2)).toEqual(["0x2"]);
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
      expect(isSameFrustum()).toBe(false);

      const sync = new type();
      sync.connect(vp1, vp2);
      expect(isSameFrustum()).toBe(true);

      sync.disconnect();

      const prevFrust = vp1.getFrustum();
      rotate(vp1, StandardViewId.Right);
      expect(isSameFrustum()).toBe(false);
      expect(prevFrust.isSame(vp2.getFrustum())).toBe(true);
    }
  });
});

describe("connectViewports", () => {
  const nVps = 4;
  const vps: Viewport[] = [];

  before(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  after(async () => IModelApp.shutdown());

  beforeEach(() => {
    for (let i = 0; i < nVps; i++)
      vps.push(openBlankViewport());
  });

  afterEach(() => {
    for (const vp of vps)
      vp.dispose();

    vps.length = 0;
  });

  function getTargets(source: Viewport) {
    return vps.filter((x) => x !== source);
  }

  function sameFrusta(source: Viewport) {
    return getTargets(source).every((x) => x.getFrustum().isSame(source.getFrustum()));
  }

  function allSameFrustum() {
    const allSame = vps.every((x) => sameFrusta(x));
    const anySame = vps.some((x) => sameFrusta(x));
    expect(allSame).toEqual(anySame);
    return allSame;
  }

  function connectFrusta() {
    return connectViewports(vps, synchronizeViewportFrusta);
  }

  function connectViews() {
    return connectViewports(vps, synchronizeViewportViews);
  }

  function makeUniqueFrusta() {
    rotate(vps[0], StandardViewId.Top);
    rotate(vps[1], StandardViewId.Bottom);
    rotate(vps[2], StandardViewId.Left);
    rotate(vps[3], StandardViewId.Right);
  }

  it("synchronizes frusta", () => {
    for (const connect of [connectFrusta, connectViews]) {
      makeUniqueFrusta();
      expect(allSameFrustum()).toBe(false);

      const disconnect = connect();
      expect(allSameFrustum()).toBe(true);

      const prevFrust = vps[2].getFrustum();
      rotate(vps[2], StandardViewId.Iso);
      expect(prevFrust.isSame(vps[2].getFrustum())).toBe(false);
      expect(allSameFrustum()).toBe(true);

      disconnect();
    }
  });

  it("synchronizes initially to the first viewport", () => {
    for (const connect of [connectFrusta, connectViews]) {
      const test = (reorder: () => void) => {
        makeUniqueFrusta();
        reorder();

        const frust = vps[0].getFrustum();
        expect(vps.every((x) => x.getFrustum().isSame(frust) === (x === vps[0]))).toBe(true);

        const disconnect = connect();
        expect(vps.every((x) => x.getFrustum().isSame(frust))).toBe(true);
        disconnect();
      };

      test(() => undefined);
      test(() => vps.reverse());
    }
  });

  it("synchronizes camera", () => {
    for (const connect of [connectFrusta, connectViews]) {
      expect(vps.every((x) => x.isCameraOn)).toBe(false);

      vps[1].turnCameraOn();
      expect(vps.every((x) => x.isCameraOn === (x === vps[1]))).toBe(true);

      const disconnect = connect();
      expect(vps.every((x) => !x.isCameraOn)).toBe(true); // because the first viewport is the one we initially sync the others to.
      expect(allSameFrustum()).toBe(true);

      vps[2].turnCameraOn();
      expect(vps.every((x) => x.isCameraOn)).toBe(true);
      expect(allSameFrustum()).toBe(true);

      vps[3].turnCameraOff();
      expect(vps.every((x) => x.isCameraOn)).toBe(false);
      expect(allSameFrustum()).toBe(true);

      disconnect();
    }
  });

  it("synchronizes display style", () => {
    function test(connect: () => VoidFunction, expectSync: boolean) {
      vps[0].viewFlags = new ViewFlags();
      vps[3].viewFlags = new ViewFlags();
      expect(vps[0].viewFlags.grid).toBe(false);
      vps[0].viewFlags = vps[0].viewFlags.with("grid", true);
      expect(vps[3].viewFlags.acsTriad).toBe(false);
      vps[3].viewFlags = vps[3].viewFlags.with("acsTriad", true);

      const disconnect = connect();
      expect(vps.every((x) => x.viewFlags.grid)).toEqual(expectSync);
      expect(vps.some((x) => x.viewFlags.acsTriad)).not.toEqual(expectSync);

      vps[1].viewFlags = vps[1].viewFlags.with("acsTriad", true);
      vps[1].synchWithView();
      expect(vps.every((x) => x.viewFlags.acsTriad)).toEqual(expectSync);

      disconnect();
    }

    test(connectViews, true);
    test(connectFrusta, false);
  });

  it("disconnects", () => {
    for (const connect of [connectFrusta, connectViews]) {
      makeUniqueFrusta();
      const disconnect = connect();
      expect(allSameFrustum()).toBe(true);

      disconnect();
      makeUniqueFrusta();
      expect(allSameFrustum()).toBe(false);
    }
  });
});
