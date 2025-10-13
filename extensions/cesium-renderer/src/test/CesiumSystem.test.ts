/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CesiumSystem } from "../System.js";
import { IModelApp, ViewRect } from "@itwin/core-frontend";
import { CesiumOffScreenTarget, CesiumOnScreenTarget } from "../Target.js";

describe("CesiumSystem", () => {
  let cesiumSystem: CesiumSystem | undefined;

  beforeAll(async () => {
    await IModelApp.startup();
    cesiumSystem = CesiumSystem.create();
  });

  afterAll(async () => {
    await IModelApp.shutdown();
  });

  it("should create a valid CesiumSystem object", () => {
    expect(cesiumSystem).not.to.be.undefined;
    expect(cesiumSystem).to.be.instanceof(CesiumSystem);
    expect(cesiumSystem?.isValid).to.be.true;
  });

  it("should use a CesiumSystem object to create valid targets", () => {
    const canvas = document.createElement("canvas")
    canvas.width = 64;
    canvas.height = 32;
    document.body.appendChild(canvas);
    const onScreenTarget = cesiumSystem?.createTarget(canvas);
    expect(onScreenTarget).not.to.be.undefined;
    expect(onScreenTarget).to.be.instanceOf(CesiumOnScreenTarget);
    expect(onScreenTarget?.viewRect?.left).to.equal(0);
    expect(onScreenTarget?.viewRect?.top).to.equal(0);
    expect(onScreenTarget?.viewRect?.right).to.equal(64);
    expect(onScreenTarget?.viewRect?.bottom).to.equal(32);
    document.body.removeChild(canvas);

    const offScreenTarget = cesiumSystem?.createOffscreenTarget(new ViewRect(0, 0, 64, 32));
    expect(offScreenTarget).not.to.be.undefined;
    expect(offScreenTarget).to.be.instanceOf(CesiumOffScreenTarget);
    expect(offScreenTarget?.viewRect?.left).to.equal(0);
    expect(offScreenTarget?.viewRect?.top).to.equal(0);
    expect(offScreenTarget?.viewRect?.right).to.equal(64);
    expect(offScreenTarget?.viewRect?.bottom).to.equal(32);
  });
});
