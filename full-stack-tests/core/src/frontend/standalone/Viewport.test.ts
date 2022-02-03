/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Point3d } from "@itwin/core-geometry";
import type { BackgroundMapProps} from "@itwin/core-common";
import { BackgroundMapSettings, ColorDef, FontMap, FontType } from "@itwin/core-common";
import type { IModelConnection,
  RenderPlan, SpatialViewState} from "@itwin/core-frontend";
import {
  CompassMode, createRenderPlanFromViewport, IModelApp, PanViewTool, ScreenViewport, SnapshotConnection, StandardViewId, TwoWayViewportSync,
} from "@itwin/core-frontend";
import { assert, expect } from "chai";
import { TestUtility } from "../TestUtility";

// cSpell:ignore calibri subcats subcat pmcv ovrs

function createViewDiv() {
  const div = document.createElement("div");
  assert(null !== div);
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

  before(async () => {   // Create a ViewState to load into a Viewport
    await TestUtility.startFrontend(undefined, true);
    imodel = await SnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver
    imodel2 = await SnapshotConnection.openFile("test2.bim"); // relative path resolved by BackendTestAssetResolver
    spatialView = await imodel.views.load("0x34") as SpatialViewState;
    spatialView.setStandardRotation(StandardViewId.RightIso);
  });

  after(async () => {
    if (imodel) await imodel.close();
    if (imodel2) await imodel2.close();
    await TestUtility.shutdownFrontend();
  });

  it("Viewport", async () => {
    const vpView = spatialView.clone();
    const vp = ScreenViewport.create(viewDiv, vpView);
    assert.isFalse(vp.isRedoPossible, "no redo");
    assert.isFalse(vp.isUndoPossible, "no undo");
    assert.isFalse(vp.isCameraOn, "camera is off");

    const saveView = vpView.clone();
    assert.notEqual(saveView.modelSelector, vpView.modelSelector, "clone should copy modelSelector");
    assert.notEqual(saveView.categorySelector, vpView.categorySelector, "clone should copy categorySelector");
    assert.notEqual(saveView.displayStyle, vpView.displayStyle, "clone should copy displayStyle");

    const frustSave = vp.getFrustum();
    const vpView2 = spatialView.clone(imodel2);
    vpView2.setStandardRotation(StandardViewId.Top);
    const vp2 = ScreenViewport.create(viewDiv2, vpView2);
    assert.isFalse(vp2.getFrustum().isSame(vp.getFrustum()), "frustums should start out different");

    // test the two-way connection between 2 viewports
    const vpConnection = new TwoWayViewportSync();
    vpConnection.connect(vp, vp2); // wire them together
    assert.isTrue(vp2.getFrustum().isSame(frustSave), "vp2 frustum should be same as vp1 after connect");
    vp.turnCameraOn();

    vp.synchWithView();
    assert.equal(vp.iModel, imodel);
    assert.equal(vp2.iModel, imodel2);

    assert.isTrue(vp.isCameraOn, "camera should be on");
    assert.isTrue(vp2.isCameraOn, "camera should be synched");
    assert.isTrue(vp2.getFrustum().isSame(vp.getFrustum()), "frustum should be synched");

    const frust2 = vp.getFrustum();
    assert.isFalse(frust2.isSame(frustSave), "turning camera on changes frustum");
    assert.isTrue(vp.isUndoPossible, "undo should now be possible");
    vp.doUndo();
    assert.isTrue(vp.getFrustum().isSame(frustSave), "undo should reinstate saved view");
    assert.isTrue(vp.isRedoPossible, "redo is possible");
    assert.isFalse(vp.isUndoPossible, "no undo");
    assert.isTrue(vp2.getFrustum().isSame(vp.getFrustum()), "frustum should be synched");
    vp.doRedo();
    assert.isTrue(vp.getFrustum().isSame(frust2), "redo should reinstate saved view");
    assert.isFalse(vp.isRedoPossible, "after redo, redo is not possible");
    assert.isTrue(vp.isUndoPossible, "after redo, undo is possible");
    assert.isTrue(vp2.getFrustum().isSame(frust2), "frustum should be synched");

    vp2.view.displayStyle.monochromeColor = ColorDef.blue;
    vp2.synchWithView();
    assert.equal(vp.view.displayStyle.monochromeColor.getRgb(), ColorDef.blue.getRgb(), "synch from 2->1 should work");

    const pan = IModelApp.tools.create("View.Pan", vp) as PanViewTool;
    assert.instanceOf(pan, PanViewTool);
    assert.equal(pan.viewport, vp);
  });

  it("AccuDraw", () => {
    const vpView = spatialView.clone();
    const viewport = ScreenViewport.create(viewDiv, vpView);
    const accudraw = IModelApp.accuDraw;
    assert.isTrue(accudraw.isEnabled, "Accudraw should be enabled");
    const pt = new Point3d(1, 1, 1);
    accudraw.adjustPoint(pt, viewport, false);

    accudraw.activate();
    assert.isTrue(accudraw.isActive, "AccuDraw is active");
    accudraw.deactivate();
    assert.isFalse(accudraw.isActive, "not active");
    accudraw.setCompassMode(CompassMode.Polar);
    assert.equal(accudraw.compassMode, CompassMode.Polar, "polar mode");
  });

  it("loadFontMap", async () => {
    const fonts1 = await imodel.loadFontMap();
    assert.equal(fonts1.fonts.size, 4, "font map size should be 4");
    assert.equal(FontType.TrueType, fonts1.getFont(1)!.type, "get font 1 type is TrueType");
    assert.equal("Arial", fonts1.getFont(1)!.name, "get Font 1 name");
    assert.equal(1, fonts1.getFont("Arial")!.id, "get Font 1, by name");
    assert.equal(FontType.Rsc, fonts1.getFont(2)!.type, "get font 2 type is Rsc");
    assert.equal("Font0", fonts1.getFont(2)!.name, "get Font 2 name");
    assert.equal(2, fonts1.getFont("Font0")!.id, "get Font 2, by name");
    assert.equal(FontType.Shx, fonts1.getFont(3)!.type, "get font 1 type is Shx");
    assert.equal("ShxFont0", fonts1.getFont(3)!.name, "get Font 3 name");
    assert.equal(3, fonts1.getFont("ShxFont0")!.id, "get Font 3, by name");
    assert.equal(FontType.TrueType, fonts1.getFont(4)!.type, "get font 4 type is TrueType");
    assert.equal("Calibri", fonts1.getFont(4)!.name, "get Font 4 name");
    assert.equal(4, fonts1.getFont("Calibri")!.id, "get Font 3, by name");
    assert.isUndefined(fonts1.getFont("notfound"), "attempt lookup of a font that should not be found");
    assert.deepEqual(new FontMap(fonts1.toJSON()), fonts1, "toJSON on FontMap");
  });

  it("creates a RenderPlan from a viewport", () => {
    const vpView = spatialView.clone();
    const vp = ScreenViewport.create(viewDiv, vpView);
    let plan: RenderPlan | undefined;
    try {
      plan = createRenderPlanFromViewport(vp);
    } catch (e) {
      plan = undefined;
    }

    assert.isDefined(plan);
    if (plan) {
      assert.isTrue(plan.is3d);
      assert.isUndefined(plan.clip);
      assert.isDefined(plan.hline);
      assert.isFalse(plan.hline!.visible.ovrColor);
      assert.equal(plan.hline!.hidden.width, undefined);
    }
  });

  it("supports changing a subset of background map settings", () => {
    const vp = ScreenViewport.create(viewDiv, spatialView.clone());
    const test = (changeProps: BackgroundMapProps, expectProps: BackgroundMapProps) => {
      const oldSettings = vp.backgroundMapSettings;
      const expectSettings = BackgroundMapSettings.fromJSON(expectProps);
      vp.changeBackgroundMapProps(changeProps);
      const newSettings = vp.backgroundMapSettings;

      expect(newSettings).to.deep.equal(expectSettings);
      expect(newSettings.equals(expectSettings)).to.be.true;

      if (undefined === changeProps.groundBias)
        expect(newSettings.groundBias).to.equal(oldSettings.groundBias);
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
