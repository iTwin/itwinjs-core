/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { DeepCompare } from "@bentley/geometry-core/lib/serialization/DeepCompare";
import { Point3d, Vector3d, YawPitchRollAngles } from "@bentley/geometry-core/lib/PointVector";
import { Range3d } from "@bentley/geometry-core/lib/Range";
import { RotMatrix } from "@bentley/geometry-core/lib/Transform";
import { Angle } from "@bentley/geometry-core/lib/Geometry";
import { SpatialViewState, ViewStatus, Camera, MarginPercent, StandardView } from "../../common/ViewState";
import { IModelDb } from "../IModelDb";
import { DisplayStyle3d, SpatialViewDefinition } from "../ViewDefinition";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import * as path from "path";
import { AuxCoordSystemSpatialState } from "../../common/AuxCoordSys";
import { CategorySelectorProps, ModelSelectorProps } from "../../common/ElementProps";
import { KnownTestLocations } from "./KnownTestLocations";
import { DisplayStyle3dState } from "../../common/DisplayStyleState";
import { ModelSelectorState } from "../../common/ModelSelectorState";
import { CategorySelectorState } from "../../common/CategorySelectorState";

// spell-checker: disable

// Note: This will be relative to root imodeljs-core directory for VS Code debugging, but relative to the test directory for running in console
const iModelLocation = path.join(KnownTestLocations.assetsDir, "test.bim");

// Given a ViewDefinition, return a ViewState that defines the members of that ViewDefinition
function convertViewDefToViewState(imodel: IModelDb, view: SpatialViewDefinition): SpatialViewState {
  const displayStyle = imodel.elements.getElement(view.displayStyleId);
  assert.isTrue(displayStyle instanceof DisplayStyle3d, "The Display Style should be a DisplayStyle3d");
  const dStyleState = new DisplayStyle3dState(displayStyle.toJSON(), imodel);
  const bgColorDef = dStyleState.backgroundColor;
  assert.isTrue(bgColorDef.tbgr === 0, "The background as expected");
  const sceneBrightness: number = dStyleState.getSceneBrightness();
  assert.equal(sceneBrightness, 0);
  const styleProps = imodel.elements.getElementProps(view.displayStyleId);
  const dStyleState2 = new DisplayStyle3dState(styleProps, imodel);
  assert.deepEqual(dStyleState, dStyleState2);
  const d3 = dStyleState.clone();
  assert.deepEqual(dStyleState, d3);

  const catSel = imodel.elements.getElementProps(view.categorySelectorId) as CategorySelectorProps;
  assert.isDefined(catSel.categories);
  assert.lengthOf(catSel.categories, 4);
  const modelSel = imodel.elements.getElementProps(view.modelSelectorId) as ModelSelectorProps;
  assert.isDefined(modelSel.models);
  assert.lengthOf(modelSel.models, 5);

  const catSelState = new CategorySelectorState(catSel, imodel);
  const c2 = catSelState.clone<CategorySelectorState>();
  assert.deepEqual(catSelState, c2);

  const modSelState = new ModelSelectorState(modelSel, imodel);
  const m2 = modSelState.clone<ModelSelectorState>();
  assert.deepEqual(modSelState, m2);
  return new SpatialViewState(view.toJSON(), imodel, catSelState, dStyleState, modSelState);
}

describe("ViewState", () => {
  // The imodel as well as some basic objects usable for testing purposes in which data contents does not matter
  let imodel: IModelDb;
  let flatView: SpatialViewDefinition;
  let cameraViewState: SpatialViewState;
  const jsonCompare = new DeepCompare();

  // Includes some usable objects for basic testing purposes
  before(() => {
    // Pull down flat view known to exist from bim file
    imodel = IModelDb.openStandalone(iModelLocation, OpenMode.Readonly);
    const viewRows: any[] = imodel.executeQuery("SELECT ECInstanceId FROM " + SpatialViewDefinition.sqlName);
    assert.exists(viewRows, "Should find some views");
    const viewId: Id64 = new Id64(viewRows[0].id);
    flatView = imodel.elements.getElement(viewId) as SpatialViewDefinition;

    // Set up ViewState with camera turned on
    const dStyleState = new DisplayStyle3dState((imodel.elements.getElementProps(flatView.displayStyleId)), imodel);
    const catSelState = new CategorySelectorState((imodel.elements.getElementProps(flatView.categorySelectorId)) as CategorySelectorProps, imodel);
    const modSelState = new ModelSelectorState((imodel.elements.getElementProps(flatView.modelSelectorId)) as ModelSelectorProps, imodel);
    cameraViewState = new SpatialViewState({
      classFullName: "BisCore:SpatialViewDefinition",
      id: "0x34",
      modelSelectorId: modSelState.id.value,
      categorySelectorId: catSelState.id.value,
      model: "0x10",
      description: "",
      code: {
        spec: "0x1c",
        scope: "0x10",
        value: "A Views - View 1",
      },
      cameraOn: true,
      origin: Point3d.create(5, 5, 5),
      extents: Vector3d.create(2, 5, 2),
      angles: YawPitchRollAngles.createDegrees(0, 0, 0),
      camera: new Camera(
        {
          lens: 30,
          focusDist: 50,
          eye: {
            x: 5,
            y: 5,
            z: 75,
          },
        },
      ),
      displayStyleId: dStyleState.id.value,
      jsonProperties:
        {
          viewDetails:
            {
              gridOrient: 0,
              gridSpaceX: 0.001,
            },
        },
    }, imodel, catSelState, dStyleState, modSelState);
  });

  after(() => {
    imodel.closeStandalone();
  });

  it("should be able to create ViewState from SpatialViewDefinition", async () => {
    assert.isTrue(flatView instanceof SpatialViewDefinition, "Should be instance of SpatialViewDefinition");
    assert.isTrue(flatView.code.value === "A Views - View 1", "Code value is A Views - View 1");
    assert.isTrue(flatView.displayStyleId.value === "0x36", "Display Style Id is 0x36");
    assert.isTrue(flatView.categorySelectorId.getLow() === 0x37, "Category Id is 0x37");
    assert.isFalse(flatView.cameraOn, "The camera is not turned on");
    assert.isTrue(flatView.extents.isAlmostEqual(new Vector3d(429.6229727570776, 232.24786876266097, 0.1017680889917761)), "View extents as expected");
    assert.isTrue(flatView.origin.isAlmostEqual(new Point3d(-87.73958171815832, -108.96514044887601, -0.0853709702222105)), "View origin as expected");
    assert.isTrue(flatView.angles.isAlmostEqual(new YawPitchRollAngles()), "View rotation is identity");
    assert.isTrue(flatView.jsonProperties.viewDetails.gridOrient === 0, "Grid orientation as expected");
    assert.isTrue(flatView.jsonProperties.viewDetails.gridSpaceX === 0.001, "GridSpaceX as expected");

    const viewState = convertViewDefToViewState(imodel, flatView);

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

  // C++ Tests:
  it.skip("ViewState creation", () => {
    // compare the extracted view with that in native C++
    let nativeResultJSON = imodel.executeTestById(1,
      {
        id: flatView.id.value,
        dsId: flatView.displayStyleId.value,
        csId: flatView.categorySelectorId.value,
        msId: flatView.modelSelectorId.value,
        path: iModelLocation,
      });
    nativeResultJSON = imodel.constructEntity(nativeResultJSON).toJSON();
    const viewStateJSON = (convertViewDefToViewState(imodel, flatView)).toJSON();
    assert.deepEqual(viewStateJSON, nativeResultJSON, "ViewState creation matches");
  });

  it.skip("view volume adjustments", () => {
    // Flat view test #1
    const tsFlatViewState = convertViewDefToViewState(imodel, flatView);
    tsFlatViewState.setOrigin(Point3d.create(-5, -5, 0));
    tsFlatViewState.setExtents(Vector3d.create(10, 10, 1));
    tsFlatViewState.setRotation(RotMatrix.createIdentity());
    tsFlatViewState.setLensAngle(Angle.createDegrees(50));
    tsFlatViewState.setFocusDistance(49);
    tsFlatViewState.setEyePoint(Point3d.create(5, 5, 50));

    tsFlatViewState.lookAtVolume(Range3d.createXYZXYZ(10, 20, 0.5, 35, 21, 2));
    let tsFlatViewStateJSON = tsFlatViewState.toJSON();

    let cppFlatViewStateJSON = imodel.executeTestById(2,
      {
        testMode: 0,
        id: flatView.id.value,
        dsId: flatView.displayStyleId.value,
        csId: flatView.categorySelectorId.value,
        msId: flatView.modelSelectorId.value,
        path: iModelLocation,
      });
    cppFlatViewStateJSON = imodel.constructEntity(cppFlatViewStateJSON).toJSON();
    assert.deepEqual(tsFlatViewStateJSON, cppFlatViewStateJSON, "lookAtVolume matches");

    // Flat view test #2
    tsFlatViewState.setOrigin(Point3d.create(100, 1000, -2));
    tsFlatViewState.setExtents(Vector3d.create(314, 1, -.00001));
    tsFlatViewState.setRotation(RotMatrix.createRowValues(1, 4, -1, 2, 3, 6, -9, 4, 3));
    tsFlatViewState.setLensAngle(Angle.createDegrees(12));
    tsFlatViewState.setFocusDistance(1000);
    tsFlatViewState.setEyePoint(Point3d.create(1, 1000, 2));

    tsFlatViewState.lookAtVolume(Range3d.createXYZXYZ(-1000, -10, 6, -5, 0, 0), 1.8, new MarginPercent(1, 1, 2, 2));
    tsFlatViewStateJSON = tsFlatViewState.toJSON();

    cppFlatViewStateJSON = imodel.executeTestById(2,
      {
        testMode: 1,
        id: flatView.id.value,
        dsId: flatView.displayStyleId.value,
        csId: flatView.categorySelectorId.value,
        msId: flatView.modelSelectorId.value,
        path: iModelLocation,
      });
    cppFlatViewStateJSON = imodel.constructEntity(cppFlatViewStateJSON).toJSON();
    // in native C++, yawpitchroll will be defined, even though it is technically not valid (did not conform to certain bounds)
    cppFlatViewStateJSON.angles = undefined;

    assert.deepEqual(tsFlatViewStateJSON, cppFlatViewStateJSON, "lookAtVolume test 2 matches");

    // Camera view test #1
    const tsCamViewState = cameraViewState.clone<SpatialViewState>();

    tsCamViewState.lookAtVolume(Range3d.createXYZXYZ(0.1, 0.1, 0.1, 10, 20, 30));
    let tsCamViewStateJSON = tsCamViewState.toJSON();

    let cppCamViewStateJSON = imodel.executeTestById(2,
      {
        testMode: 2,
        id: flatView.id.value,
        dsId: flatView.displayStyleId.value,
        csId: flatView.categorySelectorId.value,
        msId: flatView.modelSelectorId.value,
        path: iModelLocation,
      });
    cppCamViewStateJSON = imodel.constructEntity(cppCamViewStateJSON).toJSON();
    assert.deepEqual(tsCamViewStateJSON, cppCamViewStateJSON, "lookAtVolume test 3 matches");

    // Camera view test #2
    tsCamViewState.setOrigin(Point3d.create(100, 1000, -2));
    tsCamViewState.setExtents(Vector3d.create(314, 1, -.00001));
    tsCamViewState.setRotation(YawPitchRollAngles.createDegrees(25, 25, 0.1).toRotMatrix());
    tsCamViewState.setLensAngle(Angle.createDegrees(108));
    tsCamViewState.setFocusDistance(89);
    tsCamViewState.setEyePoint(Point3d.create(1, 1000, 2));

    tsCamViewState.lookAtVolume(Range3d.createXYZXYZ(-1000, -10, 6, -5, 0, 0), 1.2, new MarginPercent(1, 2, 3, 4));
    tsCamViewStateJSON = tsCamViewState.toJSON();

    cppCamViewStateJSON = imodel.executeTestById(2,
      {
        testMode: 3,
        id: flatView.id.value,
        dsId: flatView.displayStyleId.value,
        csId: flatView.categorySelectorId.value,
        msId: flatView.modelSelectorId.value,
        path: iModelLocation,
      });
    cppCamViewStateJSON = imodel.constructEntity(cppCamViewStateJSON).toJSON();
    assert.isTrue(jsonCompare.compare(tsCamViewStateJSON, cppCamViewStateJSON), "lookAtVolume test 4 matches");
  });

  it.skip("rotation and 'lookAt' results should work", async () => {
    // Flat view test
    const tsFlatViewState = convertViewDefToViewState(imodel, flatView);
    tsFlatViewState.setOrigin(Point3d.create(-5, -5, 0));
    tsFlatViewState.setExtents(Vector3d.create(10, 10, 1));
    tsFlatViewState.setRotation(RotMatrix.createIdentity());
    tsFlatViewState.setLensAngle(Angle.createDegrees(50));
    tsFlatViewState.setFocusDistance(49);
    tsFlatViewState.setEyePoint(Point3d.create(5, 5, 50));

    tsFlatViewState.rotateCameraLocal(Angle.createRadians(1.28), Vector3d.create(2, 5, 7), undefined);
    const tsFlatViewStateJSON = tsFlatViewState.toJSON();

    let cppFlatViewStateJSON = imodel.executeTestById(3,
      {
        testMode: 0,
        id: flatView.id.value,
        dsId: flatView.displayStyleId.value,
        csId: flatView.categorySelectorId.value,
        msId: flatView.modelSelectorId.value,
        path: iModelLocation,
      });

    cppFlatViewStateJSON = imodel.constructEntity(cppFlatViewStateJSON).toJSON();
    // in native C++, yawpitchroll will be defined, even though it is technically not valid (did not conform to certain bounds)
    cppFlatViewStateJSON.angles = undefined;

    assert.isTrue(jsonCompare.compare(tsFlatViewStateJSON, cppFlatViewStateJSON), "'rotate & lookat' test 1 matches");

    // Camera view test
    const tsCamViewState = cameraViewState.clone<SpatialViewState>();
    tsCamViewState.setOrigin(Point3d.create(100, 23, -18));
    tsCamViewState.setExtents(Vector3d.create(55, 0.01, 23));
    tsCamViewState.setRotation(YawPitchRollAngles.createDegrees(23, 65, 2).toRotMatrix());
    tsCamViewState.setLensAngle(Angle.createDegrees(11));
    tsCamViewState.setFocusDistance(191);
    tsCamViewState.setEyePoint(Point3d.create(-64, 120, 500));

    tsCamViewState.rotateCameraLocal(Angle.createRadians(1.6788888), Vector3d.create(-1, 6, 3), Point3d.create(1, 2, 3));
    let tsCamViewStateJSON = tsCamViewState.toJSON();

    let cppCamViewStateJSON = imodel.executeTestById(3,
      {
        testMode: 1,
        id: flatView.id.value,
        dsId: flatView.displayStyleId.value,
        csId: flatView.categorySelectorId.value,
        msId: flatView.modelSelectorId.value,
        path: iModelLocation,
      });
    cppCamViewStateJSON = imodel.constructEntity(cppCamViewStateJSON).toJSON();
    assert.isTrue(jsonCompare.compare(tsCamViewStateJSON, cppCamViewStateJSON), "'rotate & lookat' test 2 matches");

    // Camera view test (using lookAtUsingLensAngle)
    tsCamViewState.setOrigin(Point3d.create(100, 23, -18));
    tsCamViewState.setExtents(Vector3d.create(55, 0.01, 23));
    tsCamViewState.setRotation(YawPitchRollAngles.createDegrees(23, 65, 2).toRotMatrix());
    tsCamViewState.setLensAngle(Angle.createDegrees(11));
    tsCamViewState.setFocusDistance(191);
    tsCamViewState.setEyePoint(Point3d.create(-64, 120, 500));

    tsCamViewState.lookAtUsingLensAngle(Point3d.create(8, 6, 7), Point3d.create(100, -67, 5), Vector3d.create(1.001, 2.200, -3.999), Angle.createDegrees(27.897), 100.89, 101.23);
    tsCamViewStateJSON = tsCamViewState.toJSON();

    cppCamViewStateJSON = imodel.executeTestById(3,
      {
        testMode: 2,
        id: flatView.id.value,
        dsId: flatView.displayStyleId.value,
        csId: flatView.categorySelectorId.value,
        msId: flatView.modelSelectorId.value,
        path: iModelLocation,
      });

    cppCamViewStateJSON = imodel.constructEntity(cppCamViewStateJSON).toJSON();

    // in native C++, yawpitchroll will be defined, even though it is technically not valid (did not conform to certain bounds)
    cppCamViewStateJSON.angles = undefined;
    assert.isTrue(jsonCompare.compare(tsCamViewStateJSON, cppCamViewStateJSON), "'rotate & lookat' test 3 matches");
  });
});
