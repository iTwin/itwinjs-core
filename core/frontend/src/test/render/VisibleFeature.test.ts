/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Point3d, Vector3d } from "@itwin/core-geometry";
import { IModelApp } from "../../IModelApp";
import { IModelConnection } from "../../IModelConnection";
import { QueryVisibleFeaturesOptions } from "../../render/VisibleFeature";
import { SpatialViewState } from "../../SpatialViewState";
import { ScreenViewport } from "../../Viewport";
import { createBlankConnection } from "../createBlankConnection";

describe("Visible feature query", () => {
  let imodel: IModelConnection;
  let viewport: ScreenViewport | undefined;

  before(async () => {
    await IModelApp.startup();
    imodel = createBlankConnection("visible-features");
  });

  afterEach(() => {
    if (viewport) {
      viewport.dispose();
      viewport = undefined;
    }
  });

  after(async () => {
    await imodel.close();
    await IModelApp.shutdown();
  });

  function testViewport(width: number, height: number, devicePixelRatio: number | undefined, callback: (vp: ScreenViewport) => void): void {
    const div = document.createElement("div");
    div.style.width = `${width}px`;
    div.style.height = `${height}px`;
    div.style.position = "absolute";
    div.style.top = div.style.left = "0px";
    document.body.appendChild(div);

    const view = SpatialViewState.createBlank(imodel, new Point3d(), new Vector3d(1, 1, 1));
    if (view.viewFlags.acsTriad || view.viewFlags.grid)
      view.viewFlags = view.viewFlags.copy({ acsTriad: false, grid: false });

    const vp = ScreenViewport.create(div, view);
    IModelApp.viewManager.addViewport(vp);
    expect(vp.target.debugControl).not.to.be.undefined;
    vp.target.debugControl!.devicePixelRatioOverride = devicePixelRatio ?? 1;

    vp.renderFrame();

    try {
      callback(vp);
    } finally {
      vp.dispose();
      document.body.removeChild(div);
    }
  }

  it("is usable only within callback", () => {
    testViewport(20, 20, 1, (vp) => {
      const isDisposed = (features: any) => true === features._disposed;
      function test(options: QueryVisibleFeaturesOptions): void {
        let features;
        vp.queryVisibleFeatures(options, (f) => {
          features = f;
          expect(isDisposed(features)).to.be.false;
        });

        expect(isDisposed(features)).to.be.true;
      }

      test({ source: "tiles" });
      test({ source: "screen" });
    });
  });
});
