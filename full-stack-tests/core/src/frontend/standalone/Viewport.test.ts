/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Id64String } from "@itwin/core-bentley";
import { Point3d } from "@itwin/core-geometry";
import { BackgroundMapProps, BackgroundMapSettings, ColorDef, FontMap, FontType } from "@itwin/core-common";
import {
  CompassMode, IModelApp, IModelConnection, PanViewTool,
  ScreenViewport, SpatialViewState, StandardViewId, TwoWayViewportSync,
} from "@itwin/core-frontend";
import { expect } from "vitest";
import { TestUtility } from "../TestUtility";
import { TestSnapshotConnection } from "../TestSnapshotConnection";

// cSpell:ignore calibri subcats subcat pmcv ovrs

function createViewDiv() {
  const div = document.createElement("div");
  expect(null !== div).toBeTruthy();
  div.style.width = div.style.height = "1000px";
  document.body.appendChild(div);
  return div;
}

describe("Viewport", () => {
  let imodel: IModelConnection;
  let imodel2: IModelConnection;
  let spatialView: SpatialViewState;

  const viewDiv = createViewDiv();
  const viewDiv2 = createViewDiv();

  beforeAll(async () => {   // Create a ViewState to load into a Viewport
    await TestUtility.startFrontend(undefined, true);
    imodel = await TestSnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver
    imodel2 = await TestSnapshotConnection.openFile("test2.bim"); // relative path resolved by BackendTestAssetResolver
    spatialView = await imodel.views.load("0x34") as SpatialViewState;
    spatialView.setStandardRotation(StandardViewId.RightIso);
  });

  afterAll(async () => {
    await imodel?.close();
    await imodel2?.close();
    await TestUtility.shutdownFrontend();
  });

  it("Viewport", async () => {
    const vpView = spatialView.clone();
    const vp = ScreenViewport.create(viewDiv, vpView);
    expect(vp.isRedoPossible).toBe(false);
    expect(vp.isUndoPossible).toBe(false);
    expect(vp.isCameraOn).toBe(false);

    const saveView = vpView.clone();
    expect(saveView.modelSelector, "clone should copy modelSelector").not.toBe(vpView.modelSelector);
    expect(saveView.categorySelector, "clone should copy categorySelector").not.toBe(vpView.categorySelector);
    expect(saveView.displayStyle, "clone should copy displayStyle").not.toBe(vpView.displayStyle);

    const frustSave = vp.getFrustum();
    const vpView2 = spatialView.clone(imodel2);
    vpView2.setStandardRotation(StandardViewId.Top);
    const vp2 = ScreenViewport.create(viewDiv2, vpView2);
    expect(vp2.getFrustum().isSame(vp.getFrustum())).toBe(false);

    // test the two-way connection between 2 viewports
    const vpConnection = new TwoWayViewportSync();
    vpConnection.connect(vp, vp2); // wire them together
    expect(vp2.getFrustum().isSame(frustSave)).toBe(true);
    vp.turnCameraOn();

    vp.synchWithView();
    expect(vp.iModel).toBe(imodel);
    expect(vp2.iModel).toBe(imodel2);

    expect(vp.isCameraOn).toBe(true);
    expect(vp2.isCameraOn).toBe(true);
    expect(vp2.getFrustum().isSame(vp.getFrustum())).toBe(true);

    const frust2 = vp.getFrustum();
    expect(frust2.isSame(frustSave)).toBe(false);
    expect(vp.isUndoPossible).toBe(true);
    vp.doUndo();
    expect(vp.getFrustum().isSame(frustSave)).toBe(true);
    expect(vp.isRedoPossible).toBe(true);
    expect(vp.isUndoPossible).toBe(false);
    expect(vp2.getFrustum().isSame(vp.getFrustum())).toBe(true);
    vp.doRedo();
    expect(vp.getFrustum().isSame(frust2)).toBe(true);
    expect(vp.isRedoPossible).toBe(false);
    expect(vp.isUndoPossible).toBe(true);
    expect(vp2.getFrustum().isSame(frust2)).toBe(true);

    vp2.view.displayStyle.monochromeColor = ColorDef.blue;
    vp2.synchWithView();
    expect(vp.view.displayStyle.monochromeColor.getRgb(), "synch from 2->1 should work").toBe(ColorDef.blue.getRgb());

    const pan = IModelApp.tools.create("View.Pan", vp) as PanViewTool;
    expect(pan).toBeInstanceOf(PanViewTool);
    expect(pan.viewport).toBe(vp);
  });

  it("AccuDraw", () => {
    const vpView = spatialView.clone();
    const viewport = ScreenViewport.create(viewDiv, vpView);
    const accudraw = IModelApp.accuDraw;
    expect(accudraw.isEnabled).toBe(true);
    const pt = new Point3d(1, 1, 1);
    accudraw.adjustPoint(pt, viewport, false);

    accudraw.activate();
    expect(accudraw.isActive).toBe(true);
    accudraw.deactivate();
    expect(accudraw.isActive).toBe(false);
    accudraw.setCompassMode(CompassMode.Polar);
    expect(accudraw.compassMode, "polar mode").toBe(CompassMode.Polar);
  });

  it("loadFontMap", async () => {
    const fonts1 = await imodel.loadFontMap(); // eslint-disable-line @typescript-eslint/no-deprecated
    expect(fonts1.fonts.size, "font map size should be 4").toBe(4);
    expect(FontType.TrueType, "get font 1 type is TrueType").toBe(fonts1.getFont(1)!.type);
    expect("Arial", "get Font 1 name").toBe(fonts1.getFont(1)!.name);
    expect(1, "get Font 1, by name").toBe(fonts1.getFont("Arial")!.id);
    expect(1, "get Font 1, by name case insensitive").toBe(fonts1.getFont("arial")!.id);
    expect(FontType.Rsc, "get font 2 type is Rsc").toBe(fonts1.getFont(2)!.type);
    expect("Font0", "get Font 2 name").toBe(fonts1.getFont(2)!.name);
    expect(2, "get Font 2, by name").toBe(fonts1.getFont("Font0")!.id);
    expect(2, "get Font 2, by name case insensitive").toBe(fonts1.getFont("fOnt0")!.id);
    expect(FontType.Shx, "get font 1 type is Shx").toBe(fonts1.getFont(3)!.type);
    expect("ShxFont0", "get Font 3 name").toBe(fonts1.getFont(3)!.name);
    expect(3, "get Font 3, by name").toBe(fonts1.getFont("ShxFont0")!.id);
    expect(3, "get Font 3, by name case insensitive").toBe(fonts1.getFont("shxfont0")!.id);
    expect(FontType.TrueType, "get font 4 type is TrueType").toBe(fonts1.getFont(4)!.type);
    expect("Calibri", "get Font 4 name").toBe(fonts1.getFont(4)!.name);
    expect(4, "get Font 4, by name").toBe(fonts1.getFont("Calibri")!.id);
    expect(4, "get Font 4, by name case insensitive").toBe(fonts1.getFont("cAlIbRi")!.id);
    expect(fonts1.getFont("notfound")).toBeUndefined();
    expect(new FontMap(fonts1.toJSON()), "toJSON on FontMap").toEqual(fonts1); // eslint-disable-line @typescript-eslint/no-deprecated
  });

  it("supports changing a subset of background map settings", () => {
    const vp = ScreenViewport.create(viewDiv, spatialView.clone());
    const test = (changeProps: BackgroundMapProps, expectProps: BackgroundMapProps) => {
      const oldSettings = vp.backgroundMapSettings;
      const expectSettings = BackgroundMapSettings.fromJSON(expectProps);
      vp.changeBackgroundMapProps(changeProps);
      const newSettings = vp.backgroundMapSettings;

      expect(newSettings).toEqual(expectSettings);
      expect(newSettings.equals(expectSettings)).toBe(true);

      if (undefined === changeProps.groundBias)
        expect(newSettings.groundBias).toBe(oldSettings.groundBias);
    };

    // Set up baseline values for all properties
    test({ groundBias: 1234.5, transparency: 0.3, useDepthBuffer: true, applyTerrain: true },
      { groundBias: 1234.5, transparency: 0.3, useDepthBuffer: true, applyTerrain: true });
    // Set values to the current values
    test({ groundBias: 1234.5, transparency: 0.3, useDepthBuffer: true, applyTerrain: true },
      { groundBias: 1234.5, transparency: 0.3, useDepthBuffer: true, applyTerrain: true });
    // Undefined values => preserve current name, type, & bias
    test({ groundBias: undefined, transparency: undefined, useDepthBuffer: undefined, applyTerrain: undefined },
      { groundBias: 1234.5, transparency: 0.3, useDepthBuffer: true, applyTerrain: true });
    // Missing values => preserve current name, type, & bias
    test({},
      { groundBias: 1234.5, transparency: 0.3, useDepthBuffer: true, applyTerrain: true });
    // Change groundBias only to int
    test({ groundBias: 543 }, { groundBias: 543, transparency: 0.3, useDepthBuffer: true, applyTerrain: true });

    // Change groundBias to negative
    test({ groundBias: -50.3 }, { groundBias: -50.3, transparency: 0.3, useDepthBuffer: true, applyTerrain: true });

    // Change bias
    test({ groundBias: -10 },
      { groundBias: -10, transparency: 0.3, useDepthBuffer: true, applyTerrain: true });

    // Change transparency to a number
    test({ transparency: 0.0 }, { groundBias: -10, transparency: 0.0, useDepthBuffer: true, applyTerrain: true });
    test({ transparency: 1.0 }, { groundBias: -10, transparency: 1.0, useDepthBuffer: true, applyTerrain: true });
    test({ transparency: 0.7 }, { groundBias: -10, transparency: 0.7, useDepthBuffer: true, applyTerrain: true });
    test({ transparency: -2.0 }, { groundBias: -10, transparency: 0.0, useDepthBuffer: true, applyTerrain: true });
    test({ transparency: 2.0 }, { groundBias: -10, transparency: 1.0, useDepthBuffer: true, applyTerrain: true });

    // Change transparency to false
    test({ transparency: false }, { groundBias: -10, transparency: false, useDepthBuffer: true, applyTerrain: true });

    // Change applyTerrain to false
    test({ applyTerrain: false }, { groundBias: -10, transparency: false, useDepthBuffer: true, applyTerrain: false });

    // Change useDepthBuffer to false
    test({ useDepthBuffer: false }, { groundBias: -10, transparency: false, useDepthBuffer: false, applyTerrain: false });
  });
});

describe("Viewport performance", () => {
  let imodel: IModelConnection;
  let spatialView: SpatialViewState;

  const viewDiv = createViewDiv();

  beforeAll(async () => {
    await TestUtility.startFrontend(undefined, true);
    imodel = await TestSnapshotConnection.openFile("test.bim");
    spatialView = SpatialViewState.createBlank(
      imodel,
      new Point3d(),
      new Point3d(),
    );
    spatialView.setStandardRotation(StandardViewId.RightIso);
  });

  afterAll(async () => {
    await imodel?.close();
    await TestUtility.shutdownFrontend();
  });

  it("changeCategoryDisplay", async () => {
    const vpView = spatialView.clone();
    const vp = ScreenViewport.create(viewDiv, vpView);
    const categories = generateCategoryIds(50_000);
    const start = Date.now();
    vp.changeCategoryDisplay(categories, true, undefined, true);
    const elapsed = Date.now() - start;
    expect(elapsed, `changeCategoryDisplay for ${categories.length} categories took ${elapsed} ms`).toBeLessThan(15_000);
  });

  function generateCategoryIds(count: number): Id64String[] {
    const ids: Id64String[] = [];
    for (let i = 1; i <= count; i++)
      ids.push(`0x${i.toString(16)}`);

    return ids;
  }
});
