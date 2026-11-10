/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { EmptyLocalization, GeometryClass, SubCategoryAppearance } from "@itwin/core-common";
import { Point3d } from "@itwin/core-geometry";
import { ElementPicker, LocateOptions, LocateResponse } from "../ElementLocateManager";
import { IModelApp } from "../IModelApp";
import { IModelDisplayReference } from "../IModelDisplayReference";
import { Pixel } from "../render/Pixel";
import { InputSource } from "../tools/Tool";
import { ReadPixelsArgs, ScreenViewport } from "../Viewport";
import { ViewRect } from "../common/ViewRect";
import { createBlankConnection } from "./createBlankConnection";
import { openBlankViewport } from "./openBlankViewport";

describe("ElementPicker", () => {
  let vp: ScreenViewport;
  let originalAllowExternalIModels: boolean;

  beforeAll(async () => IModelApp.startup({ localization: new EmptyLocalization() }));
  afterAll(async () => IModelApp.shutdown());

  beforeEach(() => {
    originalAllowExternalIModels = IModelApp.locateManager.options.allowExternalIModels;
    vp = openBlankViewport();
    vi.spyOn(vp, "cssPixelsToDevicePixels").mockImplementation((value) => value);
    vi.spyOn(vp, "worldToView").mockImplementation(() => new Point3d(5, 5, 0));
    vi.spyOn(vp, "getPixelDataWorldPoint").mockImplementation((args) => new Point3d(args.x, args.y, 0));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vp[Symbol.dispose]();
    IModelApp.locateManager.options.allowExternalIModels = originalAllowExternalIModels;
    IModelApp.locateManager.picker.empty();
    IModelApp.locateManager.setHitList(undefined);
    IModelApp.locateManager.setCurrHit(undefined);
  });

  function makePixel(ref: IModelDisplayReference, id: string): Pixel.Data {
    return new Pixel.Data({
      feature: { iModelRef: ref, elementId: id, modelId: "0x2", subCategoryId: "0x3", geometryClass: GeometryClass.Primary },
      type: Pixel.GeometryType.Surface,
      planarity: Pixel.Planarity.Planar,
      distanceFraction: 0.5,
    });
  }

  function pixels(getPixel: (x: number, y: number) => Pixel.Data): void {
    vi.spyOn(vp, "readPixels").mockImplementation((args: ViewRect | ReadPixelsArgs, _selector?: Pixel.Selector, receiver?: Pixel.Receiver) => {
      const receive = args instanceof ViewRect ? receiver : args.receiver;
      receive?.({ getPixel });
    });
  }

  it("keeps aperture hits from different references with colliding element Ids", () => {
    const linkedIModel = createBlankConnection();
    try {
      const refs = vp.iModelRefs;
      expect(refs.isSpatial).toBe(true);
      if (!refs.isSpatial)
        return;

      const linked = refs.link({ iModel: linkedIModel });
      // A linked pixel at the pick point ranks better than the primary pixel two pixels away; both share an element Id.
      pixels((x, y) => x === 5 && y === 5 ? makePixel(linked, "0x1") : x === 7 && y === 5 ? makePixel(vp.primaryIModelRef, "0x1") : new Pixel.Data());

      const picker = new ElementPicker();
      expect(picker.doPick(vp, new Point3d(), 4, new LocateOptions())).toBe(2);

      const hits = picker.getHitList(false).hits;
      expect(hits.length).toBe(2);
      expect(hits[0].feature.iModelRef).toBe(linked);
      expect(hits[0].sourceId).toBe("0x1");
      expect(hits[1].feature.iModelRef).toBe(vp.primaryIModelRef);
      expect(hits[1].sourceId).toBe("0x1");

      refs.unlink(linked);
    } finally {
      linkedIModel.closeSync();
    }
  });

  it("locates the primary hit when a better-ranked linked pixel shares its element Id", async () => {
    const linkedIModel = createBlankConnection();
    try {
      const refs = vp.iModelRefs;
      expect(refs.isSpatial).toBe(true);
      if (!refs.isSpatial)
        return;

      const linked = refs.link({ iModel: linkedIModel });
      pixels((x, y) => x === 5 && y === 5 ? makePixel(linked, "0x1") : x === 7 && y === 5 ? makePixel(vp.primaryIModelRef, "0x1") : new Pixel.Data());
      vi.spyOn(vp, "pixelsFromInches").mockReturnValue(6);

      IModelApp.locateManager.options.init(); // primary-only locate: allowExternalIModels is false
      const hit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, new Point3d(), vp, InputSource.Mouse);
      expect(hit).toBeDefined();
      expect(hit?.feature.iModelRef).toBe(vp.primaryIModelRef);
      expect(hit?.sourceId).toBe("0x1");

      refs.unlink(linked);
    } finally {
      linkedIModel.closeSync();
    }
  });

  it("rejects linked hits on a subcategory marked do-not-locate", async () => {
    const linkedIModel = createBlankConnection();
    try {
      const refs = vp.iModelRefs;
      expect(refs.isSpatial).toBe(true);
      if (!refs.isSpatial)
        return;

      const linked = refs.link({ iModel: linkedIModel });

      // The linked iModel's subcategory is marked "don't locate" in its own subcategory cache.
      const subCategoryId = "0x21";
      linkedIModel.subcategories.add("0x20", subCategoryId, new SubCategoryAppearance({ dontLocate: true }), true);

      pixels((x, y) => x === 5 && y === 5 ? new Pixel.Data({
        feature: { iModelRef: linked, elementId: "0x1", modelId: "0x2", subCategoryId, geometryClass: GeometryClass.Primary },
        type: Pixel.GeometryType.Surface,
        planarity: Pixel.Planarity.Planar,
        distanceFraction: 0.5,
      }) : new Pixel.Data());
      vi.spyOn(vp, "pixelsFromInches").mockReturnValue(6);

      // Even for a tool that opts in to external iModels, the linked reference's subcategory data must be honored.
      IModelApp.locateManager.options.init();
      IModelApp.locateManager.options.allowExternalIModels = true;
      const response = new LocateResponse();
      const hit = await IModelApp.locateManager.doLocate(response, true, new Point3d(), vp, InputSource.Mouse);
      expect(hit).toBeUndefined();
      expect(response.reason).toBe("LocateFailure.NotLocatableSubCategory");

      refs.unlink(linked);
    } finally {
      linkedIModel.closeSync();
    }
  });
});
