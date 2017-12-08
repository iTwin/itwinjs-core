/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { Point3d, Vector3d, YawPitchRollAngles } from "@bentley/geometry-core/lib/PointVector";
import { DisplayStyle3dState, ModelSelectorState, SpatialViewState, CategorySelectorState, Camera, ViewState } from "../common/ViewState";
import { AccessToken } from "@bentley/imodeljs-clients";
import { IModel, IModelToken } from "../common/IModel";
import { AxisAlignedBox3d } from "../common/geometry/Primitives";
import { IModelConnection } from "../frontend/IModelConnection";
import { Viewport, CoordSystem, ViewRect } from "../frontend/Viewport";
import { IModelTestUtils } from "./IModelTestUtils";
import { Cartographic } from "../common/geometry/Cartographic";
import { Angle } from "@bentley/geometry-core/lib/Geometry";

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

/** An abstract class representing an instance of an iModel. */
export class TestIModel extends IModel {
  private extents: AxisAlignedBox3d;

  public constructor(iModelToken: IModelToken, name: string, description: string, extents: any) {
    super(iModelToken, name, description);
    this.extents = extents;
  }

  public getExtents(): AxisAlignedBox3d {
    return this.extents;
  }
}

describe("ViewPort", () => {
  let accessToken: AccessToken;
  let testProjectId: string;
  let testIModelId: string;
  let imodelConnection: IModelConnection;
  let imodel: TestIModel;
  let categorySelectorState: CategorySelectorState;
  let displayStyleState: DisplayStyle3dState;
  let modelSelectorState: ModelSelectorState;
  let viewState: SpatialViewState;

  before(async () => {   // Create a ViewState to load into a ViewPort
    accessToken = await IModelTestUtils.getTestUserAccessToken();
    testProjectId = await IModelTestUtils.getTestProjectId(accessToken, "NodeJsTestProject");
    testIModelId = await IModelTestUtils.getTestIModelId(accessToken, testProjectId, "MyTestModel");
    imodelConnection = await IModelConnection.open(accessToken, testProjectId, testIModelId);
    imodel = new TestIModel(imodelConnection.iModelToken, "TestIModel", "TestIModel", new AxisAlignedBox3d(Point3d.create(-100, -100, -100), Point3d.create(100, 100, 100)));
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
    viewState = new SpatialViewState({
      classFullName: "SpatialViewDefinition",
      id: new Id64("0x88"),
      modelSelectorId: new Id64("0x22"),
      categorySelectorId: new Id64("0x67"),
      model: new Id64("0x64"),
      code: {
        spec: new Id64("0x12"),
        scope: "Hello World",
      },
      cameraOn: false,
      origin: Point3d.create(0, 0, 0),
      extents: Vector3d.create(1, 1, 1),
      angles: YawPitchRollAngles.createDegrees(0, 0, 0),
      camera: new Camera(
        {
          lens: 16.260204696416,
          focusDistance: 3,
          eye: {
            x: 0,
            y: 0,
            z: 50,
          },
        },
      ),
      displayStyleId: new Id64("0x112"),
    }, imodel, categorySelectorState, displayStyleState, modelSelectorState);
  });

  it.skip("should obtain equal viewport from round-trip setup using frustum", () => {
    const viewPort = new TestViewport(viewState);
    assert.isDefined(viewPort, "Could create testing equivalent of a ViewPort");

    const frustum = viewPort.getFrustum(CoordSystem.View, false);
    const newViewState = viewState.clone<SpatialViewState>();

    newViewState.setupFromFrustum(frustum);

    assert.isTrue(newViewState.origin.isAlmostEqual(viewState.origin), "ViewState created from old ViewState's frustum has same origin");
    assert.isTrue(newViewState.extents.isAlmostEqual(viewState.extents), "ViewState created from old ViewState's frustum has same extents");
    assert.isTrue(newViewState.rotation.isAlmostEqual(viewState.rotation), "ViewState created from old ViewState's frustum has same rotation");
    assert.isTrue(newViewState.camera.lens.isAlmostEqualNoPeriodShift(viewState.camera.lens), "ViewState created from old ViewState's frustum has same lens");
    assert.isTrue(newViewState.camera.eye.isAlmostEqual(viewState.camera.eye), "ViewState created from old ViewState's frustum has same eye");
    assert.equal(newViewState.camera.focusDistance, viewState.camera.focusDistance, "ViewState created from old ViewState's frustum has same focus distance");
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
