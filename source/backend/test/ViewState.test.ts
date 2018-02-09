/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Point3d, Vector3d, YawPitchRollAngles } from "@bentley/geometry-core/lib/PointVector";
import { Range3d } from "@bentley/geometry-core/lib/Range";
import { RotMatrix } from "@bentley/geometry-core/lib/Transform";
import { Angle } from "@bentley/geometry-core/lib/Geometry";
import { SpatialViewState, ViewStatus, StandardView, StandardViewId, MarginPercent } from "../common/ViewState";
import { IModelDb } from "../backend/IModelDb";
import { SpatialViewDefinition } from "../backend/ViewDefinition";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import * as path from "path";
import { AuxCoordSystemSpatialState } from "../common/AuxCoordSys";
import { KnownTestLocations } from "./KnownTestLocations";
import { ModelSelectorState } from "../common/ModelSelectorState";
import { CategorySelectorState } from "../common/CategorySelectorState";
import { DeepCompare } from "@bentley/geometry-core/lib/serialization/DeepCompare";

// spell-checker: disable

// Note: This will be relative to root imodeljs-core directory for VS Code debugging, but relative to the test directory for running in console
const iModelLocation = path.join(KnownTestLocations.assetsDir, "test.bim");

describe.only("ViewState", () => {
  // The imodel as well as some basic objects usable for testing purposes in which data contents does not matter
  let imodel: IModelDb;
  let viewState: SpatialViewState;

  // Includes some usable objects for basic testing purposes
  before(() => {
    // Pull down flat view known to exist from bim file
    imodel = IModelDb.openStandalone(iModelLocation, OpenMode.Readonly);
    const viewRows = imodel.views.queryViewDefinitionProps(SpatialViewDefinition.sqlName);
    assert.exists(viewRows, "Should find some views");
    const flatView = viewRows[0] as SpatialViewDefinition;
    viewState = imodel.views.loadView(flatView.id!) as SpatialViewState;
  });

  after(() => imodel.closeStandalone());

  it("should be able to create ViewState from SpatialViewDefinition", async () => {
    assert.equal(viewState.code.value, "A Views - View 1", "Code value is A Views - View 1");
    assert.equal(viewState.displayStyle.id.value, "0x36", "Display Style Id is 0x36");
    assert.equal(viewState.categorySelector.id.value, "0x37", "Category Id is 0x37");
    assert.isFalse(viewState.isCameraOn(), "The camera is not turned on");
    assert.isTrue(viewState.extents.isAlmostEqual(new Vector3d(429.6229727570776, 232.24786876266097, 0.1017680889917761)), "View extents as expected");
    assert.isTrue(viewState.origin.isAlmostEqual(new Point3d(-87.73958171815832, -108.96514044887601, -0.0853709702222105)), "View origin as expected");
    assert.isTrue(viewState.rotation.isIdentity(), "View rotation is identity");
    assert.equal(viewState.jsonProperties.viewDetails.gridOrient, 0, "Grid orientation as expected");
    assert.equal(viewState.jsonProperties.viewDetails.gridSpaceX, 0.001, "GridSpaceX as expected");

    assert.isDefined(viewState.displayStyle);
    assert.instanceOf(viewState.categorySelector, CategorySelectorState);
    assert.equal(viewState.categorySelector.categories.size, 4);
    assert.instanceOf(viewState.modelSelector, ModelSelectorState);
    assert.equal(viewState.modelSelector.models.size, 5);
    assert.isTrue(viewState.origin.isAlmostEqual(new Point3d(-87.73958171815832, -108.96514044887601, -0.0853709702222105)), "View origin as expected");

    const v2 = viewState.clone<SpatialViewState>();
    assert.deepEqual(viewState, v2);

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

  const cycleJson = (obj: any) => JSON.parse(JSON.stringify(obj));
  const compareJson = (obj1: any, obj2: any, str: string) => {
    const compare = new DeepCompare();
    const val = compare.compare(cycleJson(obj1), cycleJson(obj2));
    if (!val)
      assert.isUndefined(compare.errorTracker, str);
    assert.isTrue(val, str);

  };
  // const compareJson12 = (obj1: any, obj2: any, str: string) => { assert.deepEqual(cycleJson(obj1), cycleJson(obj2), str); };

  // C++ Tests:
  it("view volume adjustments", () => {
    // Flat view test #1
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

    testParams.volume = Range3d.createXYZXYZ(10, 20, 0.5, 35, 21, 2);
    testParams.view = viewState;

    let cppView = imodel.executeTest("lookAtVolume", testParams);
    viewState.lookAtVolume(testParams.volume, testParams.aspectRatio, testParams.margin);
    compareJson(viewState, cppView, "LookAtVolume 1");

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
    cppView = imodel.executeTest("lookAtVolume", testParams);
    viewState.lookAtVolume(testParams.volume, testParams.aspectRatio, testParams.margin);
    compareJson(viewState, cppView, "LookAtVolume 3");

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
    cppView = imodel.executeTest("lookAtVolume", testParams);
    viewState.lookAtVolume(testParams.volume, testParams.aspectRatio, testParams.margin);
    compareJson(viewState, cppView, "LookAtVolume 2");
  });

  it("rotateCamareaLocal should work", async () => {
    const testParams: any = {
      view: viewState,
      angle: 1.28,
      axis: Vector3d.create(2, 5, 7),
    };

    viewState.setOrigin(Point3d.create(-5, -5, 0));
    viewState.setExtents(Vector3d.create(10, 10, 1));
    viewState.setRotation(RotMatrix.createIdentity());
    viewState.setLensAngle(Angle.createDegrees(50));
    viewState.setFocusDistance(49);
    viewState.setEyePoint(Point3d.create(5, 5, 50));
    const cppView = imodel.executeTest("rotateCameraLocal", testParams);
    viewState.rotateCameraLocal(Angle.createRadians(testParams.angle), testParams.axis);
    compareJson(viewState, cppView, "RotateCameraLocal");
    // let cppFlatViewStateJSON = imodel.executeTestById(3,
    //   {
    //     testMode: 0,
    //     id: flatView.id.value,
    //     dsId: flatView.displayStyleId.value,
    //     csId: flatView.categorySelectorId.value,
    //     msId: flatView.modelSelectorId.value,
    //     path: iModelLocation,
    //   });

    // cppFlatViewStateJSON = imodel.constructEntity(cppFlatViewStateJSON).toJSON();
    // // in native C++, yawpitchroll will be defined, even though it is technically not valid (did not conform to certain bounds)
    // cppFlatViewStateJSON.angles = undefined;

    // assert.isTrue(jsonCompare.compare(tsFlatViewStateJSON, cppFlatViewStateJSON), "'rotate & lookat' test 1 matches");

    // // Camera view test
    // const tsCamViewState = cameraViewState.clone<SpatialViewState>();
    // tsCamViewState.setOrigin(Point3d.create(100, 23, -18));
    // tsCamViewState.setExtents(Vector3d.create(55, 0.01, 23));
    // tsCamViewState.setRotation(YawPitchRollAngles.createDegrees(23, 65, 2).toRotMatrix());
    // tsCamViewState.setLensAngle(Angle.createDegrees(11));
    // tsCamViewState.setFocusDistance(191);
    //   tsCamViewState.setEyePoint(Point3d.create(-64, 120, 500));

    //   tsCamViewState.rotateCameraLocal(Angle.createRadians(1.6788888), Vector3d.create(-1, 6, 3), Point3d.create(1, 2, 3));
    //   let tsCamViewStateJSON = tsCamViewState.toJSON();

    //   let cppCamViewStateJSON = imodel.executeTestById(3,
    //     {
    //       testMode: 1,
    //       id: flatView.id.value,
    //       dsId: flatView.displayStyleId.value,
    //       csId: flatView.categorySelectorId.value,
    //       msId: flatView.modelSelectorId.value,
    //       path: iModelLocation,
    //     });
    //   cppCamViewStateJSON = imodel.constructEntity(cppCamViewStateJSON).toJSON();
    //   assert.isTrue(jsonCompare.compare(tsCamViewStateJSON, cppCamViewStateJSON), "'rotate & lookat' test 2 matches");

    //   // Camera view test (using lookAtUsingLensAngle)
    //   tsCamViewState.setOrigin(Point3d.create(100, 23, -18));
    //   tsCamViewState.setExtents(Vector3d.create(55, 0.01, 23));
    //   tsCamViewState.setRotation(YawPitchRollAngles.createDegrees(23, 65, 2).toRotMatrix());
    //   tsCamViewState.setLensAngle(Angle.createDegrees(11));
    //   tsCamViewState.setFocusDistance(191);
    //   tsCamViewState.setEyePoint(Point3d.create(-64, 120, 500));

    //   tsCamViewState.lookAtUsingLensAngle(Point3d.create(8, 6, 7), Point3d.create(100, -67, 5), Vector3d.create(1.001, 2.200, -3.999), Angle.createDegrees(27.897), 100.89, 101.23);
    //   tsCamViewStateJSON = tsCamViewState.toJSON();

    //   cppCamViewStateJSON = imodel.executeTestById(3,
    //     {
    //       testMode: 2,
    //       id: flatView.id.value,
    //       dsId: flatView.displayStyleId.value,
    //       csId: flatView.categorySelectorId.value,
    //       msId: flatView.modelSelectorId.value,
    //       path: iModelLocation,
    //     });

    //   cppCamViewStateJSON = imodel.constructEntity(cppCamViewStateJSON).toJSON();

    //   // in native C++, yawpitchroll will be defined, even though it is technically not valid (did not conform to certain bounds)
    //   cppCamViewStateJSON.angles = undefined;
    //   assert.isTrue(jsonCompare.compare(tsCamViewStateJSON, cppCamViewStateJSON), "'rotate & lookat' test 3 matches");
  });
});
