/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Point3d } from "@bentley/geometry-core/lib/PointVector";
import { SpatialViewState, ViewState, StandardViewId } from "../../common/ViewState";
import { IModelConnection } from "../../frontend/IModelConnection";
import { Viewport, ViewRect } from "../../frontend/Viewport";
import { IModelApp, iModelApp } from "../../frontend/IModelApp";
import { Cartographic } from "../../common/geometry/Cartographic";
import { Angle } from "@bentley/geometry-core/lib/Geometry";
import * as path from "path";
import { PanTool } from "../../frontend/tools/ViewTool";
import { CompassMode } from "../../frontend/AccuDraw";

const iModelLocation = path.join(__dirname, "../../../../backend/lib/backend/test/assets/test.bim");

/** Class with scope limited to this file, used for creating a Viewport without a canvas */
class TestViewport extends Viewport {
  public constructor(viewState: ViewState) { super(undefined, viewState); this.setupFromView(); }
  private clientRect = new ViewRect(0, 0, 1000, 1000);  // Needed since we don't have a canvas
  public getClientRect(): ClientRect { return this.clientRect; }
}

class TestIModelApp extends IModelApp {
  protected supplyI18NOptions() { return { urlTemplate: "http://localhost:3000/locales/{{lng}}/{{ns}}.json" }; }
}

// tslint:disable:only-arrow-functions
// tslint:disable-next-line:space-before-function-paren
describe("Viewport", function () {
  let imodel: IModelConnection;
  let spatialView: SpatialViewState;

  before(async () => {   // Create a ViewState to load into a Viewport
    TestIModelApp.startup();
    imodel = await IModelConnection.openStandalone(iModelLocation);
    spatialView = await imodel.views.loadView("0x34") as SpatialViewState;
    spatialView.setStandardRotation(StandardViewId.Top);
  });

  after(async () => {
    await imodel.closeStandalone();
    IModelApp.shutdown();
  });

  it.skip("Viewport", () => {
    const vp = new TestViewport(spatialView);
    assert.isFalse(vp.isRedoPossible, "no redo");
    assert.isFalse(vp.isUndoPossible, "no undo");
    assert.isFalse(vp.isCameraOn(), "camera is off");

    const saveView = spatialView.clone<SpatialViewState>();
    assert.notEqual(saveView.modelSelector, spatialView.modelSelector, "clone should copy modelSelector");
    assert.notEqual(saveView.categorySelector, spatialView.categorySelector, "clone should copy categorySelector");
    assert.notEqual(saveView.displayStyle, spatialView.displayStyle, "clone should copy displayStyle");
    const frustSave = vp.getFrustum();

    vp.turnCameraOn();
    vp.synchWithView(true);
    assert.isTrue(vp.isCameraOn(), "camera on");
    const frust2 = vp.getFrustum();
    assert.notDeepEqual(frust2, frustSave, "camera turned on");
    assert.isTrue(vp.isUndoPossible, "undo should now be possible");
    vp.doUndo();
    assert.deepEqual(vp.getFrustum(), frustSave, "undo should reinstate saved view");
    assert.isTrue(vp.isRedoPossible, "redo is possible");
    assert.isFalse(vp.isUndoPossible, "no undo");
    vp.doRedo();
    assert.deepEqual(vp.getFrustum(), frust2, "redo should reinstate saved view");

    const pan = iModelApp.tools.create("View.Pan", vp) as PanTool;
    assert.instanceOf(pan, PanTool);
    assert.equal(pan.viewport, vp);

  });

  it("AccuDraw should work properly", () => {
    const viewport = new TestViewport(spatialView);
    const accudraw = iModelApp.accuDraw;
    assert.isTrue(accudraw.isEnabled(), "Accudraw should be enabled");
    const pt = new Point3d(1, 1, 1);
    accudraw.adjustPoint(pt, viewport, false);

    accudraw.activate();
    assert.isTrue(accudraw.isActive(), "AccuDraw is active");
    accudraw.deactivate();
    assert.isFalse(accudraw.isActive(), "not active");
    accudraw.setCompassMode(CompassMode.Polar);
    assert.equal(accudraw.getCompassMode(), CompassMode.Polar, "polar mode");
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
