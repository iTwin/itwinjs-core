/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Point3d, Vector3d, YawPitchRollAngles, Range3d, Angle, RotMatrix } from "@bentley/geometry-core";
import { SpatialViewDefinitionProps, ViewDefinitionProps } from "@bentley/imodeljs-common";
import * as path from "path";
import { DeepCompare } from "@bentley/geometry-core/lib/serialization/DeepCompare";
import {
  SpatialViewState, ViewStatus, StandardView, StandardViewId, MarginPercent, AuxCoordSystemSpatialState, CategorySelectorState,
  ModelSelectorState, IModelConnection, DisplayStyle3dState,
} from "@bentley/imodeljs-frontend";
import { CONSTANTS } from "../common/Testbed";
import { MaybeRenderApp } from "./WebGLTestContext";

const iModelLocation = path.join(CONSTANTS.IMODELJS_CORE_DIRNAME, "core/backend/lib/test/assets/test.bim");

describe("ViewState", () => {
  let imodel: IModelConnection;
  let viewState: SpatialViewState;

  before(async () => {
    MaybeRenderApp.startup();
    imodel = await IModelConnection.openStandalone(iModelLocation);
    const viewRows: ViewDefinitionProps[] = await imodel.views.queryProps({ from: SpatialViewState.sqlName });
    assert.exists(viewRows, "Should find some views");
    viewState = await imodel.views.load(viewRows[0].id!) as SpatialViewState;
  });

  after(async () => { if (imodel) imodel.closeStandalone(); });

  const compareView = (v1: SpatialViewState, v2: SpatialViewDefinitionProps, str: string) => {
    const compare = new DeepCompare();
    const v2State = new SpatialViewState(v2, v1.iModel, v1.categorySelector, v1.displayStyle as DisplayStyle3dState, v1.modelSelector);

    const val = compare.compare(JSON.parse(JSON.stringify(v1)), JSON.parse(JSON.stringify(v2State)));
    if (!val)
      assert.isUndefined(compare.errorTracker, str);
    assert.isTrue(val, str);
  };

  it("should be able to create ViewState from SpatialViewDefinition", async () => {
    assert.equal(viewState.code.value, "A Views - View 1", "Code value is A Views - View 1");
    assert.equal(viewState.displayStyle.id.value, "0x36", "Display Style Id is 0x36");
    assert.equal(viewState.categorySelector.id.value, "0x37", "Category Id is 0x37");
    assert.isFalse(viewState.isCameraOn, "The camera is not turned on");
    assert.isTrue(viewState.extents.isAlmostEqual(new Vector3d(429.6229727570776, 232.24786876266097, 0.1017680889917761)), "View extents as expected");
    assert.isTrue(viewState.origin.isAlmostEqual(new Point3d(-87.73958171815832, -108.96514044887601, -0.0853709702222105)), "View origin as expected");
    assert.isTrue(viewState.rotation.isIdentity, "View rotation is identity");
    assert.equal(viewState.jsonProperties.viewDetails.gridOrient, 0, "Grid orientation as expected");
    assert.equal(viewState.jsonProperties.viewDetails.gridSpaceX, 0.001, "GridSpaceX as expected");

    assert.isDefined(viewState.displayStyle);
    assert.instanceOf(viewState.categorySelector, CategorySelectorState);
    assert.equal(viewState.categorySelector.categories.size, 4);
    assert.instanceOf(viewState.modelSelector, ModelSelectorState);
    assert.equal(viewState.modelSelector.models.size, 5);
    assert.isTrue(viewState.origin.isAlmostEqual(new Point3d(-87.73958171815832, -108.96514044887601, -0.0853709702222105)), "View origin as expected");

    const v2 = viewState.clone<SpatialViewState>();
    compareView(viewState, v2.toJSON(), "v2 clone");

    assert.notEqual(v2.origin, viewState.origin); // make sure we're really looking at a copy
    assert.notEqual(v2.extents, viewState.extents);
    assert.notEqual(v2.camera, viewState.camera);
    assert.notEqual(v2.jsonProperties, viewState.jsonProperties);
    assert.notEqual(v2.rotation, viewState.rotation);
    const stat = v2.lookAt(new Point3d(1, 2, 3), new Point3d(100, 100, 100), new Vector3d(0, 1, 0));
    assert.equal(stat, ViewStatus.Success);
    assert.notDeepEqual(v2, viewState);

    const acs = v2.createAuxCoordSystem("test");
    assert.equal(acs.code.value, "test");
    assert.instanceOf(acs, AuxCoordSystemSpatialState);
    acs.setOrigin({ x: 1, y: 1 });
    assert.isTrue(acs.getOrigin().isExactEqual({ x: 1, y: 1, z: 0 }));
    acs.setRotation(StandardView.Iso);
    assert.isTrue(acs.getRotation().isExactEqual(StandardView.Iso));
  });

  it("view volume adjustments", async () => {
    const testParams: any = {
      margin: new MarginPercent(0, 0, 0, 0),
      aspectRatio: 1,
      view: viewState,
      volume: Range3d.createXYZXYZ(10, 20, 0.5, 35, 21, 2),
    };

    viewState.setOrigin(Point3d.create(-5, -5, 0));
    viewState.setExtents(Vector3d.create(10, 10, 1));
    viewState.setRotation(RotMatrix.createIdentity());
    viewState.setLensAngle(Angle.createDegrees(50));
    viewState.setFocusDistance(49);
    viewState.setEyePoint(Point3d.create(5, 5, 50));

    let cppView: SpatialViewDefinitionProps = await imodel.executeTest("lookAtVolume", testParams);
    viewState.lookAtVolume(testParams.volume, testParams.aspectRatio, testParams.margin);
    compareView(viewState, cppView, "LookAtVolume 1");

    // LookAtVolume test #3
    viewState.setOrigin(Point3d.create(100, 1000, -2));
    viewState.setExtents(Vector3d.create(314, 1, -.00001));
    viewState.setRotation(YawPitchRollAngles.createDegrees(25, 25, 0.1).toRotMatrix());
    viewState.setLensAngle(Angle.createDegrees(108));
    viewState.setFocusDistance(89);
    viewState.setEyePoint(Point3d.create(1, 1000, 2));
    testParams.volume = Range3d.createXYZXYZ(1000, -10, 6, -5, 0, 0);
    testParams.margin = new MarginPercent(.01, .02, .03, .04);
    testParams.aspectRatio = 1.2;
    cppView = await imodel.executeTest("lookAtVolume", testParams);
    viewState.lookAtVolume(testParams.volume, testParams.aspectRatio, testParams.margin);
    compareView(viewState, cppView, "LookAtVolume 3");

    // LookAtVolume test #2
    viewState.setOrigin(Point3d.create(100, 1000, -2));
    viewState.setExtents(Vector3d.create(314, 1, -.00001));
    viewState.setStandardRotation(StandardViewId.RightIso);
    viewState.setLensAngle(Angle.createDegrees(72));
    viewState.setFocusDistance(100);
    viewState.setEyePoint(Point3d.create(1, 100, 2));
    testParams.volume = Range3d.createXYZXYZ(10, 20, 0.5, 35, 21, 2);
    testParams.aspectRatio = 1.0;
    testParams.margin = new MarginPercent(0, 0, 0, 0);
    cppView = await imodel.executeTest("lookAtVolume", testParams);
    viewState.lookAtVolume(testParams.volume, testParams.aspectRatio, testParams.margin);
    compareView(viewState, cppView, "LookAtVolume 2");
  });

  it("rotateCameraLocal should work", async () => {
    const testParams: any = {
      view: viewState,
      angle: 1.28,
      axis: Vector3d.create(2, 5, 7),
      about: undefined,
    };

    viewState.setOrigin(Point3d.create(-5, -5, 0));
    viewState.setExtents(Vector3d.create(10, 10, 1));
    viewState.setRotation(RotMatrix.createIdentity());
    viewState.setLensAngle(Angle.createDegrees(50));
    viewState.setFocusDistance(49);
    viewState.setEyePoint(Point3d.create(5, 5, 50));
    let cppView: SpatialViewDefinitionProps = await imodel.executeTest("rotateCameraLocal", testParams);
    viewState.rotateCameraLocal(Angle.createRadians(testParams.angle), testParams.axis, testParams.about);
    compareView(viewState, cppView, "RotateCameraLocal 1");

    viewState.setOrigin(Point3d.create(100, 23, -18));
    viewState.setExtents(Vector3d.create(55, 0.01, 23));
    viewState.setRotation(YawPitchRollAngles.createDegrees(23, 65, 2).toRotMatrix());
    viewState.setLensAngle(Angle.createDegrees(11));
    viewState.setFocusDistance(191);
    viewState.setEyePoint(Point3d.create(-64, 120, 500));
    testParams.angle = 1.6788888;
    testParams.axis = Vector3d.create(-1, 6, 3);
    testParams.about = Point3d.create(1, 2, 3);
    cppView = await imodel.executeTest("rotateCameraLocal", testParams);
    viewState.rotateCameraLocal(Angle.createRadians(testParams.angle), testParams.axis, testParams.about);
    compareView(viewState, cppView, "RotateCameraLocal 2");
  });

  it("lookAtUsingLensAngle should work", async () => {
    const testParams: any = {
      view: viewState,
      eye: Point3d.create(8, 6, 7),
      target: Point3d.create(100, -67, 5),
      up: Vector3d.create(1.001, 2.200, -3.999),
      lens: Angle.createDegrees(27.897),
      front: 100.89,
      back: 101.23,
    };

    viewState.setOrigin(Point3d.create(100, 23, -18));
    viewState.setExtents(Vector3d.create(55, 0.01, 23));
    viewState.setRotation(YawPitchRollAngles.createDegrees(23, 65, 2).toRotMatrix());
    viewState.setLensAngle(Angle.createDegrees(11));
    viewState.setFocusDistance(191);
    viewState.setEyePoint(Point3d.create(-64, 120, 500));
    const cppView: SpatialViewDefinitionProps = await imodel.executeTest("lookAtUsingLensAngle", testParams);
    viewState.lookAtUsingLensAngle(testParams.eye, testParams.target, testParams.up, testParams.lens, testParams.front, testParams.back);
    compareView(viewState, cppView, "lookAtUsingLensAngle");
  });
});
