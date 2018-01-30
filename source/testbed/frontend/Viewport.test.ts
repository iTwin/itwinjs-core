/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Point3d, YawPitchRollAngles, RotMatrix } from "@bentley/geometry-core/lib/PointVector";
import { SpatialViewState, CategorySelectorState, ViewState, Camera } from "../../common/ViewState";
import { Frustum } from "../../common/Frustum";
import { IModelConnection } from "../../frontend/IModelConnection";
import { Viewport, ViewRect, CoordSystem } from "../../frontend/Viewport";
import { IModelApp, iModelApp } from "../../frontend/IModelApp";
import { Cartographic } from "../../common/geometry/Cartographic";
import { Angle } from "@bentley/geometry-core/lib/Geometry";
import * as path from "path";
import { SpatialViewDefinitionProps } from "../../common/ElementProps";
import { PanTool } from "../../frontend/tools/ViewTool";
import { CompassMode } from "../../frontend/AccuDraw";
import { DisplayStyle3dState } from "../../common/DisplayStyleState";
import { ModelSelectorState } from "../../common/ModelSelectorState";

const iModelLocation = path.join(__dirname, "../../../../test/lib/test/assets/test.bim");

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
  let categorySelectorState: CategorySelectorState;
  let displayStyleState: DisplayStyle3dState;
  let modelSelectorState: ModelSelectorState;
  let viewStateXYFlat: SpatialViewState;
  let viewStateXZFlat: SpatialViewState;
  let viewStateXYZ: SpatialViewState;
  const mocha = this;

  before(async () => {   // Create a ViewState to load into a Viewport
    mocha.timeout(99999);
    TestIModelApp.startup();

    imodel = await IModelConnection.openStandalone(iModelLocation);
    const spatialViewProps = (await imodel.elements.getElementProps("0x34"))[0] as SpatialViewDefinitionProps;

    // Set up supporting ViewState classes
    categorySelectorState = new CategorySelectorState(
      {
        categories: ["test0"],
        model: "0x64",
        code: { spec: "0x12", scope: "Hello World" },
        id: "0x67",
        classFullName: "CategorySelector",
      }, imodel);
    displayStyleState = new DisplayStyle3dState(
      {
        model: "0x64",
        code: { spec: "0x12", scope: "Hello World" },
        id: "0x112",
        classFullName: "DisplayStyle3d",
      }, imodel);
    modelSelectorState = new ModelSelectorState(
      {
        models: ["test0"],
        model: "0x64",
        code: { spec: "0x12", scope: "Hello World" },
        id: "0x22",
        classFullName: "ModelSelector",
      }, imodel);

    // Set up 3 separate ViewState classes
    spatialViewProps.origin = { x: -5, y: -5, z: 0 };
    spatialViewProps.extents = { x: 10, y: 10, z: 1 };
    spatialViewProps.angles = YawPitchRollAngles.createDegrees(0, 0, 0);
    const camera = new Camera({ lens: { degrees: 50 }, eye: { x: 5, y: 5, z: 50 }, focusDist: 49 });
    spatialViewProps.camera = camera;
    spatialViewProps.cameraOn = false;
    viewStateXYFlat = new SpatialViewState(spatialViewProps, imodel, categorySelectorState, displayStyleState, modelSelectorState);

    spatialViewProps.origin = { x: -5, y: 1, z: -5 };
    spatialViewProps.angles = YawPitchRollAngles.createDegrees(0, 0, -90);
    spatialViewProps.cameraOn = false;
    viewStateXZFlat = new SpatialViewState(spatialViewProps, imodel, categorySelectorState, displayStyleState, modelSelectorState);

    spatialViewProps.origin = { x: -5, y: -5, z: 0 };
    spatialViewProps.angles = YawPitchRollAngles.createDegrees(0, 0, 0);
    camera.setEyePoint({ x: 5, y: 5, z: 20 });
    spatialViewProps.cameraOn = true;
    viewStateXYZ = new SpatialViewState(spatialViewProps, imodel, categorySelectorState, displayStyleState, modelSelectorState);
  });

  after(async () => {
    await imodel.closeStandalone();
    IModelApp.shutdown();
  });

  it("Viewport", () => {
    for (const viewState of [viewStateXYFlat, viewStateXZFlat, viewStateXYZ]) {
      const viewport = new TestViewport(viewState);

      const newViewState = viewport.view.clone<SpatialViewState>();
      let frustumWorld: Frustum;

      if (viewState.isCameraOn()) {
        frustumWorld = viewport.getFrustum(CoordSystem.World, true);
      } else {
        frustumWorld = viewport.getFrustum(CoordSystem.World, false);
        // "Dirty up the data"
        newViewState.setRotation(RotMatrix.createRowValues(
          5, 342, 34,
          6, 324, 5,
          -54, 0, 0.99999999,
        ));
        newViewState.setOrigin({ x: 1, y: -1000, z: 1000 });
        newViewState.setExtents({ x: 5, y: -134, z: 413 });
      }

      newViewState.setupFromFrustum(frustumWorld);

      if (viewport.frustFraction === 1) {   // Dealing with flat box, data has been "dirtied," check it was replaced correctly
        assert.isTrue(newViewState.origin.isAlmostEqual(viewport.view.getOrigin()), "ViewState created from old ViewState's frustum has same origin");
        assert.isTrue(newViewState.extents.isAlmostEqual(viewport.view.getExtents()), "ViewState created from old ViewState's frustum has same extents");
        assert.isTrue(newViewState.rotation.isAlmostEqual(viewport.view.getRotation()), "ViewState created from old ViewState's frustum has same rotation");
      } else {  // Camera angle adjusted our view
        const backFrac = newViewState.getBackDistance();
        const frontFrac = newViewState.getFrontDistance();
        const frustFraction = frontFrac / backFrac;
        // !!! Note: Tolerance is extremely low currently...
        assert.isTrue(Math.abs(viewport.frustFraction - frustFraction) < 1.0e-2, "Planes correctly conform to the found frustFraction");
      }
    }

    const view1 = viewStateXYZ.clone<SpatialViewState>();
    const vp = new TestViewport(view1);

    assert.isFalse(vp.isRedoPossible, "no redo");
    assert.isFalse(vp.isUndoPossible, "no undo");
    assert.isTrue(vp.isCameraOn(), "camera is on");
    view1.turnCameraOff();
    vp.synchWithView(true);
    assert.isTrue(vp.isUndoPossible, "undo should now be possible");

    const pan = iModelApp.tools.create("View.Pan", vp) as PanTool;
    assert.instanceOf(pan, PanTool);
    assert.equal(pan.viewport, vp);

  });

  it("AccuDraw should work properly", () => {
    const viewport = new TestViewport(viewStateXYFlat);
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
