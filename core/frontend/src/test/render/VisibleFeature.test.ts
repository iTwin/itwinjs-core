/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Point3d, Vector3d } from "@itwin/core-geometry";
import { EmptyLocalization, GeometryClass } from "@itwin/core-common";
import { IModelApp } from "../../IModelApp";
import { IModelConnection } from "../../IModelConnection";
import { QueryVisibleFeaturesOptions } from "../../render/VisibleFeature";
import { SpatialViewState } from "../../SpatialViewState";
import { ScreenViewport } from "../../Viewport";
import { Pixel } from "../../render/Pixel";
import { IModelDisplayFeature } from "../../IModelDisplayReference";
import { createBlankConnection } from "../createBlankConnection";

describe("Visible feature query", () => {
  let imodel: IModelConnection;
  let viewport: ScreenViewport | undefined;

  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    imodel = createBlankConnection("visible-features");
  });

  afterEach(() => {
    if (viewport) {
      viewport[Symbol.dispose]();
      viewport = undefined;
    }
  });

  afterAll(async () => {
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

    using vp = ScreenViewport.create(div, view);
    IModelApp.viewManager.addViewport(vp);
    expect(vp.target.debugControl).toBeDefined();
    vp.target.debugControl!.devicePixelRatioOverride = devicePixelRatio ?? 1;

    vp.renderFrame();

    try {
      callback(vp);
    } finally {
      IModelApp.viewManager.dropViewport(vp);
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
          expect(isDisposed(features)).toBe(false);
        });

        expect(isDisposed(features)).toBe(true);
      }

      test({ source: "tiles" });
      test({ source: "screen" });
    });
  });

  it("returns features from each displayed iModel", () => {
    const linkedIModel = createBlankConnection("visible-features-linked");
    try {
      testViewport(20, 20, 1, (vp) => {
        const refs = vp.iModelRefs;
        if (!refs.isSpatial)
          throw new Error("Expected a spatial viewport");

        const linkedRef = refs.link({ iModel: linkedIModel });
        const primaryFeature: IModelDisplayFeature = {
          elementId: "0x1",
          modelId: "0x3",
          subCategoryId: "0x2",
          geometryClass: GeometryClass.Primary,
          iModelRef: refs.primary,
        };
        const linkedFeature: IModelDisplayFeature = {
          ...primaryFeature,
          elementId: "0x4",
          iModelRef: linkedRef,
        };
        const pixels = {
          getPixel: (x: number) => new Pixel.Data({ feature: x < 10 ? primaryFeature : linkedFeature }),
        } as Pixel.Buffer;

        const readPixels = vi.spyOn(vp.target, "readPixels").mockImplementation((_rect, _selector, receiver) => receiver(pixels));
        const tileQuery = vi.spyOn(vp.target, "queryVisibleTileFeatures").mockImplementation((_options, _iModel, callback) => callback([
          { ...primaryFeature, iModel: imodel },
          { ...linkedFeature, iModel: linkedIModel },
        ]));

        const queryIModels = (options: QueryVisibleFeaturesOptions) => {
          const found = new Set<IModelConnection>();
          vp.queryVisibleFeatures(options, (features) => {
            for (const feature of features)
              found.add(feature.iModel);
          });
          return found;
        };

        expect(queryIModels({ source: "screen" })).toEqual(new Set([imodel, linkedIModel]));
        expect(queryIModels({ source: "tiles" })).toEqual(new Set([imodel, linkedIModel]));

        readPixels.mockRestore();
        tileQuery.mockRestore();
        refs.unlink(linkedRef);
      });
    } finally {
      linkedIModel.closeSync();
    }
  });
});
