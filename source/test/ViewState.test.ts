/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { Point3d, Vector3d, YawPitchRollAngles } from "@bentley/geometry-core/lib/PointVector";
import { DisplayStyle3dState, ModelSelectorState, SpatialViewState, CategorySelectorState, ViewStatus } from "../common/ViewState";
import { IModelDb } from "../backend/IModelDb";
import { DisplayStyle3d, ModelSelector, CategorySelector, SpatialViewDefinition } from "../backend/ViewDefinition";
import { IModelTestUtils } from "./IModelTestUtils";

/* tslint:disable: no-console */
/*
function getRangeOfViewState3d(viewState: SpatialViewState) {
  // Near and far plane information
  const nearHeight = 2 * Math.tan(viewState.camera.getLensAngle().radians / 2) * viewState.getFrontDistance();
  const nearWidth = nearHeight * viewState.getAspectRatio();
  const farHeight = 2 * Math.tan(viewState.camera.getLensAngle().radians / 2) * viewState.getBackDistance();
  const farWidth = farHeight * viewState.getAspectRatio();
  const nearCenter = viewState.camera.eye.plusScaled(viewState.getZVector(), viewState.getFrontDistance());
  const farCenter = viewState.camera.eye.plusScaled(viewState.getZVector(), viewState.getBackDistance());

  // Frustum points
  const nearTopLeft = nearCenter.plusScaled(viewState.getYVector(), nearHeight / 2).minus(viewState.getXVector().scale(nearWidth / 2));
  const nearTopRight = nearCenter.plusScaled(viewState.getYVector(), nearHeight / 2).plus(viewState.getXVector().scale(nearWidth / 2));
  const nearBottomLeft = nearCenter.minus(viewState.getYVector().scale(nearHeight / 2)).minus(viewState.getXVector().scale(nearWidth / 2));
  const nearBottomRight = nearCenter.minus(viewState.getYVector().scale(nearHeight / 2)).minus(viewState.getXVector().scale(nearWidth / 2));
  const farTopLeft = farCenter.plusScaled(viewState.getYVector(), farHeight / 2).minus(viewState.getXVector().scale(farWidth / 2));
  const farTopRight = farCenter.plusScaled(viewState.getYVector(), farHeight / 2).plus(viewState.getXVector().scale(farWidth / 2));
  const farBottomLeft = farCenter.minus(viewState.getYVector().scale(farHeight / 2)).minus(viewState.getXVector().scale(farWidth / 2));
  const farBottomRight = farCenter.minus(viewState.getYVector().scale(farHeight / 2)).minus(viewState.getXVector().scale(farWidth / 2));

  return Range3d.createArray([nearTopLeft, nearTopRight, nearBottomLeft, nearBottomRight, farTopLeft, farTopRight, farBottomLeft, farBottomRight]);
}
*/

describe("ViewState3d", () => {
  // The imodel as well as some basic objects usable for testing purposes in which data contents does not matter
  let imodel: IModelDb;

  // Includes some usable objects for basic testing purposes
  before(async () => {
    imodel = await IModelTestUtils.openIModel("test.bim");
  });

  after(() => {
    IModelTestUtils.closeIModel(imodel);
  });

  it("should be able to create ViewState from SpatialViewDefinition extracted from bim file", async () => {
    const viewRows: any[] = await imodel.executeQuery("SELECT EcInstanceId as elementId FROM " + SpatialViewDefinition.sqlName);
    assert.exists(viewRows, "Should find some views");
    const viewId = new Id64(viewRows[0].elementId);
    const view = await imodel.elements.getElement(viewId) as SpatialViewDefinition;
    assert.isTrue(view instanceof SpatialViewDefinition, "Should be instance of SpatialViewDefinition");
    assert.isTrue(view.code.value === "A Views - View 1", "Code value is A Views - View 1");
    assert.isTrue(view.displayStyleId.value === "0x36", "Display Style Id is 0x36");
    assert.isTrue(view.categorySelectorId.getLow() === 0x37, "Category Id is 0x37");
    assert.isFalse(view.cameraOn, "The camera is not turned on");
    assert.isTrue(view.extents.isAlmostEqual(new Vector3d(429.6229727570776, 232.24786876266097, 0.1017680889917761)), "View extents as expected");
    assert.isTrue(view.origin.isAlmostEqual(new Point3d(-87.73958171815832, -108.96514044887601, -0.0853709702222105)), "View origin as expected");
    assert.isTrue(view.angles.isAlmostEqual(new YawPitchRollAngles()), "View rotation is identity");
    assert.isTrue(view.jsonProperties.viewDetails.gridOrient === 0, "Grid orientation as expected");
    assert.isTrue(view.jsonProperties.viewDetails.gridSpaceX === 0.001, "GridSpaceX as expected");

    // get the display style element
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

    const newViewState = new SpatialViewState(view.toJSON(), imodel, catSelState, dStyleState, modSelState);
    assert.isDefined(newViewState.displayStyle);
    assert.instanceOf(newViewState.categorySelector, CategorySelectorState);
    assert.equal(newViewState.categorySelector.categories.size, 4);
    assert.instanceOf(newViewState.modelSelector, ModelSelectorState);
    assert.equal(newViewState.modelSelector.models.size, 5);
    assert.isTrue(newViewState.origin.isAlmostEqual(new Point3d(-87.73958171815832, -108.96514044887601, -0.0853709702222105)), "View origin as expected");
    const v2 = newViewState.clone<SpatialViewState>();
    assert.deepEqual(newViewState, v2);

    assert.notEqual(v2.origin, newViewState.origin); // make sure we're really looking at a copy
    assert.notEqual(v2.extents, newViewState.extents);
    assert.notEqual(v2.camera, newViewState.camera);
    assert.notEqual(v2.jsonProperties, newViewState.jsonProperties);
    assert.notEqual(v2.rotation, newViewState.rotation);
    const stat = v2.lookAt(new Point3d(1, 2, 3), new Point3d(100, 100, 100), new Vector3d(0, 1, 0));
    assert.equal(stat, ViewStatus.Success);
    assert.notDeepEqual(v2, newViewState);
  });
});
