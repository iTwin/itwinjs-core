/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { DeepCompare } from "@bentley/geometry-core/lib/serialization/DeepCompare";
import { Point3d, Vector3d, YawPitchRollAngles, Range3d, RotMatrix } from "@bentley/geometry-core/lib/PointVector";
import { Angle } from "@bentley/geometry-core/lib/Geometry";
import { Element } from "../backend/Element";
import { DisplayStyle3dState, ModelSelectorState, SpatialViewState, CategorySelectorState, ViewStatus, Camera, MarginPercent } from "../common/ViewState";
import { IModelDb } from "../backend/IModelDb";
import { DisplayStyle3d, ModelSelector, CategorySelector, SpatialViewDefinition } from "../backend/ViewDefinition";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import * as path from "path";

/* tslint:disable: no-console */

// Note: This will be relative to root imodeljs-core directory for VS Code debugging, but relative to the test directory for running in console
const bimFileLocation = path.join(__dirname + "/assets/test.bim");

// Given a ViewDefinition, return a ViewState that defines the members of that ViewDefinition
async function convertViewDefToViewState(imodel: IModelDb, view: SpatialViewDefinition): Promise<SpatialViewState> {
  const displayStyle = await imodel.elements.getElement(view.displayStyleId);
  assert.isTrue(displayStyle instanceof DisplayStyle3d, "The Display Style should be a DisplayStyle3d");
  const dStyleState = new DisplayStyle3dState(displayStyle.toJSON(), imodel);
  const bgColorDef = dStyleState.backgroundColor;
  assert.isTrue(bgColorDef.tbgr === 0, "The background as expected");
  const sceneBrightness: number = dStyleState.getSceneBrightness();
  assert.equal(sceneBrightness, 0);
  const styleProps = await imodel.elements.getElementProps(view.displayStyleId);
  const dStyleState2 = new DisplayStyle3dState(styleProps, imodel);
  assert.deepEqual(dStyleState, dStyleState2);
  const d3 = dStyleState.clone();
  assert.deepEqual(dStyleState, d3);

  const catSel = await imodel.elements.getElement(view.categorySelectorId) as CategorySelector;
  assert.isDefined(catSel.categories);
  assert.lengthOf(catSel.categories, 4);
  const modelSel = await imodel.elements.getElement(view.modelSelectorId) as ModelSelector;
  assert.isDefined(modelSel.models);
  assert.lengthOf(modelSel.models, 5);

  const catSelState = new CategorySelectorState(catSel.toJSON(), imodel);
  const c2 = catSelState.clone<CategorySelectorState>();
  assert.deepEqual(catSelState, c2);

  const modSelState = new ModelSelectorState(modelSel.toJSON(), imodel);
  const m2 = modSelState.clone<ModelSelectorState>();
  assert.deepEqual(modSelState, m2);

  return new Promise<SpatialViewState>((resolve) => {
    resolve(new SpatialViewState(view.toJSON(), imodel, catSelState, dStyleState, modSelState));
  });
}

describe("ViewState", () => {
  // The imodel as well as some basic objects usable for testing purposes in which data contents does not matter
  let imodel: IModelDb;
  let flatView: SpatialViewDefinition;
  let cameraViewState: SpatialViewState;
  const jsonCompare = new DeepCompare();

  // Includes some usable objects for basic testing purposes
  before(async () => {
    // Pull down flat view known to exist from bim file
    imodel = await IModelDb.openStandalone(bimFileLocation, OpenMode.Readonly);
    const viewRows: any[] = await imodel.executeQuery("SELECT EcInstanceId as elementId FROM " + SpatialViewDefinition.sqlName);
    assert.exists(viewRows, "Should find some views");
    const viewId = new Id64(viewRows[0].elementId);
    flatView = await imodel.elements.getElement(viewId) as SpatialViewDefinition;

    // Set up ViewState with camera turned on
    const dStyleState = new DisplayStyle3dState((await imodel.elements.getElement(flatView.displayStyleId)).toJSON(), imodel);
    const catSelState = new CategorySelectorState((await imodel.elements.getElement(flatView.categorySelectorId) as CategorySelector).toJSON(), imodel);
    const modSelState = new ModelSelectorState((await imodel.elements.getElement(flatView.modelSelectorId) as ModelSelector).toJSON(), imodel);
    cameraViewState = new SpatialViewState({
      classFullName: "BisCore:SpatialViewDefinition",
      id: new Id64("0x34"),
      modelSelectorId: modSelState.id.value,
      categorySelectorId: catSelState.id.value,
      model: new Id64("0x10"),
      code: {
        spec: new Id64("0x1c"),
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
          focusDistance: 50,
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

  it("should be able to create ViewState from SpatialViewDefinition extracted from bim file", async () => {
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

    const viewState = await convertViewDefToViewState(imodel, flatView);

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

  });

  // ===================================================================================================================================
  // ===================================================================================================================================
  // C++ Tests:

  it.only("should see ViewState creation parallels that of ViewState created in C++", async () => {
    // compare the extracted view with that in native C++
    let nativeResultJSON = imodel.elements.executeTestById(1,
      {
        id: flatView.id.value,
        dsId: flatView.displayStyleId.value,
        csId: flatView.categorySelectorId.value,
        msId: flatView.modelSelectorId.value,
        path: bimFileLocation,
      });
    nativeResultJSON = (imodel.constructEntity(nativeResultJSON) as Element).toJSON();
    const viewStateJSON = (await convertViewDefToViewState(imodel, flatView)).toJSON() as any;
    viewStateJSON.description = undefined;    // Currently does not appear if not explitly specified in TS
    assert.isTrue(jsonCompare.compare(viewStateJSON, nativeResultJSON), "Native side ViewState creation matches TS");
  });

  it("view volume adjustments should match that of adjustments in C++", async () => {
    // Flat view test #1 ==========================================================================================
    const tsFlatViewState = await convertViewDefToViewState(imodel, flatView);
    tsFlatViewState.setOrigin(Point3d.create(-5, -5, 0));
    tsFlatViewState.setExtents(Vector3d.create(10, 10, 1));
    tsFlatViewState.setRotation(RotMatrix.createIdentity());
    tsFlatViewState.setLensAngle(Angle.createDegrees(50));
    tsFlatViewState.setFocusDistance(49);
    tsFlatViewState.setEyePoint(Point3d.create(5, 5, 50));

    tsFlatViewState.lookAtVolume(Range3d.createXYZXYZ(10, 20, 0.5, 35, 21, 2));
    let tsFlatViewStateJSON = tsFlatViewState.toJSON();
    (tsFlatViewStateJSON as any).description = undefined;  // Currently does not appear if not explicitly specified in TS

    let cppFlatViewStateJSON = imodel.elements.executeTestById(2,
      {
        testMode: 0,
        id: flatView.id.value,
        dsId: flatView.displayStyleId.value,
        csId: flatView.categorySelectorId.value,
        msId: flatView.modelSelectorId.value,
        path: bimFileLocation,
      });
    cppFlatViewStateJSON = (imodel.constructEntity(cppFlatViewStateJSON) as Element).toJSON();
    assert.isTrue(jsonCompare.compare(tsFlatViewStateJSON, cppFlatViewStateJSON), "Native side ViewState 'lookAtVolume' test 1 matches TS");
    // ============================================================================================================

    // Flat view test #2 ==========================================================================================
    tsFlatViewState.setOrigin(Point3d.create(100, 1000, -2));
    tsFlatViewState.setExtents(Vector3d.create(314, 1, -.00001));
    tsFlatViewState.setRotation(RotMatrix.createRowValues(1, 4, -1, 2, 3, 6, -9, 4, 3));
    tsFlatViewState.setLensAngle(Angle.createDegrees(12));
    tsFlatViewState.setFocusDistance(1000);
    tsFlatViewState.setEyePoint(Point3d.create(1, 1000, 2));

    tsFlatViewState.lookAtVolume(Range3d.createXYZXYZ(-1000, -10, 6, -5, 0, 0), 1.8, new MarginPercent(1, 1, 2, 2));
    tsFlatViewStateJSON = tsFlatViewState.toJSON();
    (tsFlatViewStateJSON as any).description = undefined;  // Currently does not appear if not explicitly specified in TS

    cppFlatViewStateJSON = await imodel.elements.executeTestById(2,
      {
        testMode: 1,
        id: flatView.id.value,
        dsId: flatView.displayStyleId.value,
        csId: flatView.categorySelectorId.value,
        msId: flatView.modelSelectorId.value,
        path: bimFileLocation,
      });
    cppFlatViewStateJSON = (imodel.constructEntity(cppFlatViewStateJSON) as Element).toJSON();
    // in native C++, yawpitchroll will be defined, even though it is technically not valid (did not conform to certain bounds)
    cppFlatViewStateJSON.angles = undefined;

    assert.isTrue(jsonCompare.compare(tsFlatViewStateJSON, cppFlatViewStateJSON), "Native side ViewState 'lookAtVolume' test 2 matches TS");
    // =============================================================================================================

    // Camera view test #1 =========================================================================================
    const tsCamViewState = cameraViewState.clone<SpatialViewState>();

    tsCamViewState.lookAtVolume(Range3d.createXYZXYZ(0.1, 0.1, 0.1, 10, 20, 30));
    let tsCamViewStateJSON = tsCamViewState.toJSON();
    (tsCamViewStateJSON as any).description = undefined;  // Currently does not appear if not explicitly specified in TS

    let cppCamViewStateJSON = imodel.elements.executeTestById(2,
      {
        testMode: 2,
        id: flatView.id.value,
        dsId: flatView.displayStyleId.value,
        csId: flatView.categorySelectorId.value,
        msId: flatView.modelSelectorId.value,
        path: bimFileLocation,
      });
    cppCamViewStateJSON = (imodel.constructEntity(cppCamViewStateJSON) as Element).toJSON();
    assert.isTrue(jsonCompare.compare(tsCamViewStateJSON, cppCamViewStateJSON), "Native side ViewState 'lookAtVolume' test 3 matches TS");
    // =============================================================================================================

    // Camera view test #2 =========================================================================================
    tsCamViewState.setOrigin(Point3d.create(100, 1000, -2));
    tsCamViewState.setExtents(Vector3d.create(314, 1, -.00001));
    tsCamViewState.setRotation(YawPitchRollAngles.createDegrees(25, 25, 0.1).toRotMatrix());
    tsCamViewState.setLensAngle(Angle.createDegrees(108));
    tsCamViewState.setFocusDistance(89);
    tsCamViewState.setEyePoint(Point3d.create(1, 1000, 2));

    tsCamViewState.lookAtVolume(Range3d.createXYZXYZ(-1000, -10, 6, -5, 0, 0), 1.2, new MarginPercent(1, 2, 3, 4));
    tsCamViewStateJSON = tsCamViewState.toJSON();
    (tsCamViewStateJSON as any).description = undefined;  // Currently does not appear if not explicitly specified in TS

    cppCamViewStateJSON = imodel.elements.executeTestById(2,
      {
        testMode: 3,
        id: flatView.id.value,
        dsId: flatView.displayStyleId.value,
        csId: flatView.categorySelectorId.value,
        msId: flatView.modelSelectorId.value,
        path: bimFileLocation,
      });
    cppCamViewStateJSON = (imodel.constructEntity(cppCamViewStateJSON) as Element).toJSON();
    assert.isTrue(jsonCompare.compare(tsCamViewStateJSON, cppCamViewStateJSON), "Native side ViewState 'lookAtVolume' test 4 matches TS");
    // =============================================================================================================
  });

  it("rotation and 'lookAt' results should match that of those in C++", async () => {
    // Flat view test ==============================================================================================
    const tsFlatViewState = await convertViewDefToViewState(imodel, flatView);
    tsFlatViewState.setOrigin(Point3d.create(-5, -5, 0));
    tsFlatViewState.setExtents(Vector3d.create(10, 10, 1));
    tsFlatViewState.setRotation(RotMatrix.createIdentity());
    tsFlatViewState.setLensAngle(Angle.createDegrees(50));
    tsFlatViewState.setFocusDistance(49);
    tsFlatViewState.setEyePoint(Point3d.create(5, 5, 50));

    tsFlatViewState.rotateCameraLocal(Angle.createRadians(1.28), Vector3d.create(2, 5, 7), undefined);
    const tsFlatViewStateJSON = tsFlatViewState.toJSON();
    (tsFlatViewStateJSON as any).description = undefined;  // Currently does not appear if not explicitly specified in TS

    let cppFlatViewStateJSON = imodel.elements.executeTestById(3,
      {
        testMode: 0,
        id: flatView.id.value,
        dsId: flatView.displayStyleId.value,
        csId: flatView.categorySelectorId.value,
        msId: flatView.modelSelectorId.value,
        path: bimFileLocation,
      });

    cppFlatViewStateJSON = (imodel.constructEntity(cppFlatViewStateJSON) as Element).toJSON();
    // in native C++, yawpitchroll will be defined, even though it is technically not valid (did not conform to certain bounds)
    cppFlatViewStateJSON.angles = undefined;

    assert.isTrue(jsonCompare.compare(tsFlatViewStateJSON, cppFlatViewStateJSON), "Native side ViewState 'rotate & lookat' test 1 matches TS");
    // =============================================================================================================

    // Camera view test ============================================================================================
    const tsCamViewState = cameraViewState.clone<SpatialViewState>();
    tsCamViewState.setOrigin(Point3d.create(100, 23, -18));
    tsCamViewState.setExtents(Vector3d.create(55, 0.01, 23));
    tsCamViewState.setRotation(YawPitchRollAngles.createDegrees(23, 65, 2).toRotMatrix());
    tsCamViewState.setLensAngle(Angle.createDegrees(11));
    tsCamViewState.setFocusDistance(191);
    tsCamViewState.setEyePoint(Point3d.create(-64, 120, 500));

    tsCamViewState.rotateCameraLocal(Angle.createRadians(1.6788888), Vector3d.create(-1, 6, 3), Point3d.create(1, 2, 3));
    let tsCamViewStateJSON = tsCamViewState.toJSON();
    (tsCamViewStateJSON as any).description = undefined;    // Currently does not appear if not explicitly specified in TS

    let cppCamViewStateJSON = imodel.elements.executeTestById(3,
      {
        testMode: 1,
        id: flatView.id.value,
        dsId: flatView.displayStyleId.value,
        csId: flatView.categorySelectorId.value,
        msId: flatView.modelSelectorId.value,
        path: bimFileLocation,
      });
    cppCamViewStateJSON = (imodel.constructEntity(cppCamViewStateJSON) as Element).toJSON();
    assert.isTrue(jsonCompare.compare(tsCamViewStateJSON, cppCamViewStateJSON), "Native side ViewState 'rotate & lookat' test 2 matches TS");
    // =============================================================================================================

    // Camera view test (using lookAtUsingLensAngle) ===============================================================
    tsCamViewState.setOrigin(Point3d.create(100, 23, -18));
    tsCamViewState.setExtents(Vector3d.create(55, 0.01, 23));
    tsCamViewState.setRotation(YawPitchRollAngles.createDegrees(23, 65, 2).toRotMatrix());
    tsCamViewState.setLensAngle(Angle.createDegrees(11));
    tsCamViewState.setFocusDistance(191);
    tsCamViewState.setEyePoint(Point3d.create(-64, 120, 500));

    tsCamViewState.lookAtUsingLensAngle(Point3d.create(8, 6, 7), Point3d.create(100, -67, 5), Vector3d.create(1.001, 2.200, -3.999), Angle.createDegrees(27.897), 100.89, 101.23);
    tsCamViewStateJSON = tsCamViewState.toJSON();
    (tsCamViewStateJSON as any).description = undefined;    // Currently does not appear if not explicitly specified in TS

    cppCamViewStateJSON = imodel.elements.executeTestById(3,
      {
        testMode: 2,
        id: flatView.id.value,
        dsId: flatView.displayStyleId.value,
        csId: flatView.categorySelectorId.value,
        msId: flatView.modelSelectorId.value,
        path: bimFileLocation,
      });

    cppCamViewStateJSON = (imodel.constructEntity(cppCamViewStateJSON) as Element).toJSON();

    // in native C++, yawpitchroll will be defined, even though it is technically not valid (did not conform to certain bounds)
    cppCamViewStateJSON.angles = undefined;
    assert.isTrue(jsonCompare.compare(tsCamViewStateJSON, cppCamViewStateJSON), "Native side ViewState 'rotate & lookat' test 2 matches TS");
    // =============================================================================================================
  });
});
