/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Point3d, Angle } from "@bentley/geometry-core";
import { Cartographic, FontType, FontMap, ColorDef } from "@bentley/imodeljs-common";
import * as path from "path";
import { SpatialViewState, StandardViewId, IModelConnection, ScreenViewport, IModelApp, PanViewTool, CompassMode, TwoWayViewportSync } from "@bentley/imodeljs-frontend";
import { CONSTANTS } from "../common/Testbed";
import { RenderPlan } from "@bentley/imodeljs-frontend/lib/rendering";
import { MockRender } from "./MockRender";

const iModelLocation = path.join(CONSTANTS.IMODELJS_CORE_DIRNAME, "core/backend/lib/test/assets/test.bim");

describe("Viewport", () => {
  let imodel: IModelConnection;
  let spatialView: SpatialViewState;

  const createViewDiv = () => {
    const div = document.createElement("div") as HTMLDivElement;
    assert(null !== div);
    div!.style.width = div!.style.height = "1000px";
    document.body.appendChild(div!);
    return div;
  };

  const viewDiv = createViewDiv();
  const viewDiv2 = createViewDiv();

  before(async () => {   // Create a ViewState to load into a Viewport
    MockRender.App.startup();
    imodel = await IModelConnection.openStandalone(iModelLocation);
    spatialView = await imodel.views.load("0x34") as SpatialViewState;
    spatialView.setStandardRotation(StandardViewId.RightIso);
  });

  after(async () => {
    if (imodel) await imodel.closeStandalone();
    MockRender.App.shutdown();
  });

  it("Viewport", async () => {
    const vpView = spatialView.clone<SpatialViewState>();
    const vp = ScreenViewport.create(viewDiv!, vpView);
    assert.isFalse(vp.isRedoPossible, "no redo");
    assert.isFalse(vp.isUndoPossible, "no undo");
    assert.isFalse(vp.isCameraOn, "camera is off");

    const saveView = vpView.clone<SpatialViewState>();
    assert.notEqual(saveView.modelSelector, vpView.modelSelector, "clone should copy modelSelector");
    assert.notEqual(saveView.categorySelector, vpView.categorySelector, "clone should copy categorySelector");
    assert.notEqual(saveView.displayStyle, vpView.displayStyle, "clone should copy displayStyle");
    const frustSave = vp.getFrustum();

    const vpView2 = spatialView.clone<SpatialViewState>();
    vpView2.setStandardRotation(StandardViewId.Top);
    const vp2 = ScreenViewport.create(viewDiv2!, vpView2);
    assert.isFalse(vp2.getFrustum().isSame(vp.getFrustum()), "frustums should start out different");

    // test the two-way connection between 2 viewports
    const vpConnection = new TwoWayViewportSync();
    vpConnection.connect(vp, vp2); // wire them together
    assert.isTrue(vp2.getFrustum().isSame(frustSave), "vp2 frustum should be same as vp1 after connect");

    // const clientRect = vp.getClientRect();
    vpView.camera.validateLens();

    // currently the range test for visible elements doesn't match native code, so we get a different result.
    // re-enable this test when models hold their ranges.
    // const testParams: any = { view: vpView, rect: { left: clientRect.left, bottom: clientRect.bottom, right: clientRect.right, top: clientRect.top } };
    // const cppView = await imodel.executeTest("turnCameraOn", testParams);
    vp.turnCameraOn();
    // compareView(vpView, cppView, "turnCameraOn 3");

    vp.synchWithView(true);
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
    vp2.synchWithView(true);
    assert.equal(vp.view.displayStyle.monochromeColor.getRgb(), ColorDef.blue.getRgb(), "synch from 2->1 should work");

    const pan = IModelApp.tools.create("View.Pan", vp) as PanViewTool;
    assert.instanceOf(pan, PanViewTool);
    assert.equal(pan.viewport, vp);
  });

  it("AccuDraw", () => {
    const vpView = spatialView.clone<SpatialViewState>();
    const viewport = ScreenViewport.create(viewDiv!, vpView);
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
    const vpView = spatialView.clone<SpatialViewState>();
    const vp = ScreenViewport.create(viewDiv!, vpView);
    let plan: RenderPlan | undefined;
    try {
      plan = RenderPlan.createFromViewport(vp);
    } catch (e) {
      plan = undefined;
    }

    assert.isDefined(plan);
    if (plan) {
      assert.isTrue(plan.is3d);
      assert.isUndefined(plan.activeVolume);
      assert.isDefined(plan.hline);
      assert.isFalse(plan.hline!.visible.ovrColor);
      assert.equal(plan.hline!.hidden.width, undefined);
      assert.isUndefined(plan.lights);
    }
  });
});

describe("Cartographic tests", () => {
  it("Cartographic should convert properly", () => {
    const exton = Cartographic.fromDegrees(75, 40, 0);
    assert.equal(exton.toString(), "(1.3089969389957472, 0.6981317007977318, 0)", "exton toString");
    assert.isTrue(exton.equals(exton.clone()));

    const ecef1 = exton.toEcef();
    assert.isTrue(ecef1.isAlmostEqual({ x: 1266325.9090166602, y: 4725992.6313910205, z: 4077985.5722003765 }), "toEcef should work");
    const exton2 = Cartographic.fromEcef(ecef1);
    assert.isTrue(exton.equalsEpsilon(exton2!, 0.01));

    const paris = Cartographic.fromAngles(Angle.createDegrees(2.3522), Angle.createDegrees(48.8566), 67);
    const ecefParis = paris.toEcef();
    assert.isTrue(ecefParis.isAlmostEqual({ x: 4200958.840878805, y: 172561.58554401112, z: 4780131.797337915 }), "paris");
    const paris2 = Cartographic.fromEcef(ecefParis);
    assert.isTrue(paris.equalsEpsilon(paris2!, 0.01));

    const newYork = new Cartographic(Angle.degreesToRadians(74.006), Angle.degreesToRadians(49.7128), -100);
    const ecefNY = newYork.toEcef();
    assert.isTrue(ecefNY.isAlmostEqual({ x: 1138577.8226437706, y: 3972262.6507547107, z: 4842118.181650281 }), "new york");
    const ny2 = Cartographic.fromEcef(ecefNY);
    assert.isTrue(newYork.equalsEpsilon(ny2!, 0.01));
  });
});
