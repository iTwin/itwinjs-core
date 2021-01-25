/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ScreenViewport } from "../Viewport";
import { Marker } from "../Marker";
import { Decorator } from "../ViewManager";
import { Point3d } from "@bentley/geometry-core";
import { DecorateContext } from "../ViewContext";
import { IModelApp } from "../IModelApp";
import { SpatialViewState } from "../SpatialViewState";
// import { NoRenderApp } from "../NoRenderApp";
import { IModelConnection } from "../IModelConnection";

describe("ScreenViewport", () => {
  beforeEach(async () => {
    await IModelApp.startup();
  });
  afterEach(async () => {
    if (IModelApp.initialized) await IModelApp.shutdown();
  });

  function makeMarker(vp: ScreenViewport) {
    const marker = new Marker(vp.viewToWorld({x: 0, y: 0, z: 0}), { x: 10, y: 10 });
    marker.htmlElement = document.createElement("div");
    return marker;
  }

  class AddMarkersAlwaysDecorator implements Decorator {
    public markers: Marker[];
    public constructor(vp: ScreenViewport) {
      this.markers = new Array(3).fill(undefined).map(() => makeMarker(vp));
    }
    public decorate(ctx: DecorateContext) {
      this.markers.forEach((m) => {
        m.addDecoration(ctx);
      });
    }
  }

  class AddMarkersOnceDecorator implements Decorator {
    public markers: Marker[];
    private _didOnce = false;
    public constructor(vp: ScreenViewport) {
      this.markers = new Array(3).fill(undefined).map(() => makeMarker(vp));
    }
    public decorate(ctx: DecorateContext) {
      if (!this._didOnce) {
        this.markers.forEach((m) => {
          m.addDecoration(ctx);
        });
        this._didOnce = true;
      }
    }
  }

  function createMockViewport() {
    const parentDiv = document.createElement("div");
    parentDiv.setAttribute("height", "100px");
    parentDiv.setAttribute("width", "100px");
    parentDiv.style.height = parentDiv.style.width = "100px";
    document.body.appendChild(parentDiv);
    const vp = ScreenViewport.create(
      parentDiv,
      SpatialViewState.createBlank(
        {} as IModelConnection,
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 1, z: 1 }
      )
    );
    vp.setAllValid();
    (vp as any)._decorationsValid = false;
    return vp;
  }

  it("should not delete markers that are readded by registered decorators", () => {
    const vp = createMockViewport();
    const decorator = new AddMarkersAlwaysDecorator(vp);
    IModelApp.viewManager.addDecorator(decorator);
    IModelApp.viewManager.addViewport(vp);
    (IModelApp as any)._wantEventLoop = false;

    vp.renderFrame();
    for (const marker of decorator.markers) {
      expect(vp.decorationDiv.contains(marker.htmlElement || null)).to.be.true;
    }

    vp.invalidateDecorations();

    vp.renderFrame();
    for (const marker of decorator.markers) {
      expect(vp.decorationDiv.contains(marker.htmlElement || null)).to.be.true;
    }
  });

  it("should delete markers that aren't readded by registered decorators", () => {
    const vp = createMockViewport();
    const decorator = new AddMarkersOnceDecorator(vp);
    IModelApp.viewManager.addDecorator(decorator);
    IModelApp.viewManager.addViewport(vp);
    (IModelApp as any)._wantEventLoop = false;

    vp.renderFrame();
    for (const marker of decorator.markers) {
      expect(vp.decorationDiv.contains(marker.htmlElement || null)).to.be.true;
    }

    vp.invalidateDecorations();

    vp.renderFrame();
    for (const marker of decorator.markers) {
      expect(vp.decorationDiv.contains(marker.htmlElement || null)).to.be.false;
    }
  });
});
