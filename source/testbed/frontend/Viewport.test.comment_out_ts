/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Id64 } from "@build/imodeljs-core/node_modules/@bentley/bentleyjs-core/lib/Id";
import { Point3d, Vector3d, YawPitchRollAngles, RotMatrix } from "@build/imodeljs-core/node_modules/@bentley/geometry-core/lib/PointVector";
import { DisplayStyle3dState, ModelSelectorState, SpatialViewState, CategorySelectorState, ViewState, Frustum, SpatialViewDefinitionProps } from "@build/imodeljs-core/lib/common/ViewState";
import { IModelConnection } from "@build/imodeljs-core/lib/frontend/IModelConnection";
import { Viewport, ViewRect, CoordSystem } from "@build/imodeljs-core/lib/frontend/Viewport";
import { Cartographic } from "@build/imodeljs-core/lib/common/geometry/Cartographic";
import { Angle } from "@build/imodeljs-core/node_modules/@bentley/geometry-core/lib/Geometry";
import * as path from "path";

/* tslint:disable: no-console */

// ==========================================================================================================================================
// Test-Specific Declarations and Data
// ==========================================================================================================================================

const bimFileLocation = path.join(__dirname, "../../../../test/lib/test/assets/test.bim");

/** Class with scope limited to this file, used for creating a Viewport without a canvas */
class TestViewport extends Viewport {
  public constructor(viewState: ViewState) {
    super(undefined, viewState);
    this.setupFromView();
  }

  /** Needed since we don't have a canvas */
  private clientRect = new ViewRect(0, 0, 10, 10);
  public getClientRect(): ClientRect { return this.clientRect; }
}

// ==========================================================================================================================================
// ==========================================================================================================================================

describe("Viewport", () => {
  let imodel: IModelConnection;
  let categorySelectorState: CategorySelectorState;
  let displayStyleState: DisplayStyle3dState;
  let modelSelectorState: ModelSelectorState;

  let viewStateXYFlat: SpatialViewState;
  let viewStateXZFlat: SpatialViewState;
  let viewStateXYZ: SpatialViewState;

  // tslint:disable-next-line:only-arrow-functions
  before(async function() {   // Create a ViewState to load into a ViewPort
    this.timeout(99999);
    imodel = await IModelConnection.openStandalone(bimFileLocation);
    const spatialViewProps = (await imodel.elements.getElementProps([new Id64("0x34")]))[0] as SpatialViewDefinitionProps;

    // Set up supporting ViewState classes =====================================================
    categorySelectorState = new CategorySelectorState(
      {
        categories: ["test0"],
        model: new Id64("0x64"),
        code: {
          spec: new Id64("0x12"),
          scope: "Hello World",
        },
        id: new Id64("0x67"),
        classFullName: "CategorySelector",
      }, imodel);
    displayStyleState = new DisplayStyle3dState(
      {
        model: new Id64("0x64"),
        code: {
          spec: new Id64("0x12"),
          scope: "Hello World",
        },
        id: new Id64("0x112"),
        classFullName: "DisplayStyle3d",
      }, imodel);
    modelSelectorState = new ModelSelectorState(
      {
        models: ["test0"],
        model: new Id64("0x64"),
        code: {
          spec: new Id64("0x12"),
          scope: "Hello World",
        },
        id: new Id64("0x22"),
        classFullName: "ModelSelector",
      }, imodel);
    // ============================================================================================
    // Set up 3 seperate ViewState classes ========================================================
    spatialViewProps.origin = Point3d.create(-5, -5, 0);
    spatialViewProps.extents = Vector3d.create(10, 10, 1);
    spatialViewProps.angles = YawPitchRollAngles.createDegrees(0, 0, 0);
    spatialViewProps.camera.setLensAngle(Angle.createDegrees(50));
    spatialViewProps.camera.setEyePoint(Point3d.create(5, 5, 50));
    spatialViewProps.camera.setFocusDistance(49);
    spatialViewProps.cameraOn = false;
    viewStateXYFlat = new SpatialViewState(spatialViewProps, imodel, categorySelectorState, displayStyleState, modelSelectorState);

    spatialViewProps.origin = Point3d.create(-5, 1, -5);
    spatialViewProps.angles = YawPitchRollAngles.createDegrees(0, 0, -90);
    viewStateXZFlat = new SpatialViewState(spatialViewProps, imodel, categorySelectorState, displayStyleState, modelSelectorState);

    spatialViewProps.origin = Point3d.create(-5, -5, 0);
    spatialViewProps.angles = YawPitchRollAngles.createDegrees(0, 0, 0);
    spatialViewProps.camera.setEyePoint(Point3d.create(5, 5, 20));
    viewStateXYZ = new SpatialViewState(spatialViewProps, imodel, categorySelectorState, displayStyleState, modelSelectorState);
  });

  after(async () => {
    await imodel.closeStandalone();
  });

  it("should obtain equal viewport from round-trip setup using frustum", () => {
    for (const viewState of [viewStateXYFlat, viewStateXZFlat, viewStateXYZ]) {
      const viewPort = new TestViewport(viewState);
      assert.isDefined(viewPort, "Could create testing equivalent of a ViewPort");

      const newViewState = viewPort.view.clone<SpatialViewState>();
      let frustumWorld: Frustum;

      if (viewState.isCameraOn()) {
        frustumWorld = viewPort.getFrustum(CoordSystem.World, true);
      } else {
        frustumWorld = viewPort.getFrustum(CoordSystem.World, false);
        // "Dirty up the data"
        newViewState.setRotation(RotMatrix.createRowValues(
          5, 342, 34,
          6, 324, 5,
          -54, 0, 0.99999999,
        ));
        newViewState.setOrigin(Point3d.create(1, -1000, 1000));
        newViewState.setExtents(Vector3d.create(5, -134, 413));
      }

      newViewState.setupFromFrustum(frustumWorld);

      if (viewPort.frustFraction === 1) {   // Dealing with flat box, data has been "dirtied," check it was replaced correctly
        assert.isTrue(newViewState.origin.isAlmostEqual(viewPort.view.getOrigin()), "ViewState created from old ViewState's frustum has same origin");
        assert.isTrue(newViewState.extents.isAlmostEqual(viewPort.view.getExtents()), "ViewState created from old ViewState's frustum has same extents");
        assert.isTrue(newViewState.rotation.isAlmostEqual(viewPort.view.getRotation()), "ViewState created from old ViewState's frustum has same rotation");
      } else {  // Camera angle adjusted our view
        const backFrac = newViewState.getBackDistance();
        const frontFrac = newViewState.getFrontDistance();
        const frustFraction = frontFrac / backFrac;
        // !!! Note: Tolerance is extremely low currently...
        assert.isTrue(Math.abs(viewPort.frustFraction - frustFraction) < 1.0e-2, "Planes correctly conform to the found frustfraction");
      }
    }

    // assert that a viewstate with eye backed up to infinity produces a "flat view"
    const flatViewWithCamera = viewStateXYZ.clone<SpatialViewState>();
    flatViewWithCamera.setEyePoint(Point3d.create(0, 0, Number.MAX_VALUE));
    flatViewWithCamera.setFocusDistance(10000);
    const port = new TestViewport(flatViewWithCamera);
    assert.isTrue(Math.abs(port.frustFraction - 1) < 1.0e-4);
  }).timeout(99999);
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

  }).timeout(99999);
});
