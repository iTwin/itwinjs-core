/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { CodeSpec, CodeSpecNames } from "../../common/Code";
import { ElementProps, ViewDefinitionProps } from "../../common/ElementProps";
import { Model2dState } from "../../common/EntityState";
import { ModelProps } from "../../common/ModelProps";
import { CategorySelectorState, DisplayStyle2dState, DisplayStyle3dState, DrawingViewState, ModelSelectorState, OrthographicViewState, ViewState } from "../../common/ViewState";
import { IModelConnection, IModelConnectionElements, IModelConnectionModels } from "../../frontend/IModelConnection";
import { Point2d, Point3d } from "@bentley/geometry-core/lib/PointVector";
import { DateTime, Blob, NavigationValue } from "../../common/ECSqlBindingValues";
import { TestData } from "./TestData";

describe("IModelConnection", () => {
  it("should be able to get elements and models from an IModelConnection", async () => {
    const iModel: IModelConnection = await IModelConnection.open(TestData.accessToken, TestData.testProjectId, TestData.testIModelId);
    assert.exists(iModel);
    assert.isTrue(iModel instanceof IModelConnection);
    assert.exists(iModel.models);
    assert.isTrue(iModel.models instanceof IModelConnectionModels);
    assert.exists(iModel.elements);
    assert.isTrue(iModel.elements instanceof IModelConnectionElements);

    const elementIds: Id64[] = [iModel.elements.rootSubjectId];
    const elementProps: ElementProps[] = await iModel.elements.getElementProps(elementIds);
    assert.equal(elementProps.length, elementIds.length);
    assert.isTrue(iModel.elements.rootSubjectId.equals(new Id64(elementProps[0].id)));
    assert.isTrue(iModel.models.repositoryModelId.equals(new Id64(elementProps[0].model)));

    const queryElementIds: Id64[] = await iModel.elements.queryElementIds({ from: "BisCore.Category", limit: 20, offset: 0 });
    assert.isAtLeast(queryElementIds.length, 1);
    assert.isTrue(queryElementIds[0] instanceof Id64);

    const formatObjs: any[] = await iModel.elements.formatElements(queryElementIds);
    assert.isAtLeast(formatObjs.length, 1);

    const modelIds: Id64[] = [iModel.models.repositoryModelId];
    const modelProps: ModelProps[] = await iModel.models.getModelProps(modelIds);
    assert.exists(modelProps);
    assert.equal(modelProps.length, modelIds.length);
    assert.isTrue(iModel.models.repositoryModelId.equals(new Id64(modelProps[0].id)));

    const rows: any[] = await iModel.executeQuery("SELECT CodeValue AS code FROM BisCore.Category");
    assert.isAtLeast(rows.length, 1);
    assert.exists(rows[0].code);
    assert.equal(rows.length, queryElementIds.length);

    const codeSpecByName: CodeSpec = await iModel.codeSpecs.getCodeSpecByName(CodeSpecNames.SpatialCategory());
    assert.exists(codeSpecByName);
    const codeSpecById: CodeSpec = await iModel.codeSpecs.getCodeSpecById(codeSpecByName.id);
    assert.exists(codeSpecById);
    const codeSpecByNewId: CodeSpec = await iModel.codeSpecs.getCodeSpecById(new Id64(codeSpecByName.id));
    assert.exists(codeSpecByNewId);

    let viewDefinitionProps: ViewDefinitionProps[] = await iModel.views.queryViewDefinitionProps("BisCore.OrthographicViewDefinition");
    assert.isAtLeast(viewDefinitionProps.length, 1);
    let viewState: ViewState = await iModel.views.loadViewState(new Id64(viewDefinitionProps[0].id));
    assert.exists(viewState);
    assert.equal(viewState.classFullName, OrthographicViewState.getClassFullName());
    assert.equal(viewState.categorySelector.classFullName, CategorySelectorState.getClassFullName());
    assert.equal(viewState.displayStyle.classFullName, DisplayStyle3dState.getClassFullName());
    assert.instanceOf(viewState, OrthographicViewState);
    assert.instanceOf(viewState.categorySelector, CategorySelectorState);
    assert.instanceOf(viewState.displayStyle, DisplayStyle3dState);
    assert.instanceOf((viewState as OrthographicViewState).modelSelector, ModelSelectorState);

    viewDefinitionProps = await iModel.views.queryViewDefinitionProps("BisCore.DrawingViewDefinition");
    assert.isAtLeast(viewDefinitionProps.length, 1);
    viewState = await iModel.views.loadViewState(new Id64(viewDefinitionProps[0].id));
    assert.exists(viewState);
    assert.equal(viewState.classFullName, DrawingViewState.getClassFullName());
    assert.equal(viewState.categorySelector.classFullName, CategorySelectorState.getClassFullName());
    assert.equal(viewState.displayStyle.classFullName, DisplayStyle2dState.getClassFullName());
    assert.instanceOf(viewState, DrawingViewState);
    assert.instanceOf(viewState.categorySelector, CategorySelectorState);
    assert.instanceOf(viewState.displayStyle, DisplayStyle2dState);
    assert.instanceOf((viewState as DrawingViewState).baseModel, Model2dState);

    await iModel.close(TestData.accessToken);
  }).timeout(99999);

  it("Parametrized ECSQL", async () => {
    const iModel: IModelConnection = await IModelConnection.open(TestData.accessToken, TestData.testProjectId, TestData.testIModelId);
    assert.exists(iModel);

    let rows = await iModel.executeQuery("SELECT ECInstanceId,Model,LastMod,CodeValue,FederationGuid,Origin FROM bis.GeometricElement3d LIMIT 1");
    assert.equal(rows.length, 1);
    let expectedRow = rows[0];
    let actualRows = await iModel.executeQuery("SELECT 1 FROM bis.GeometricElement3d WHERE ECInstanceId=? AND Model=? AND LastMod=? AND CodeValue=? AND FederationGuid=? AND Origin=?",
        [new Id64(expectedRow.id), new NavigationValue(expectedRow.model.id), new DateTime(expectedRow.lastMod), expectedRow.codeValue,
        new Blob(expectedRow.federationGuid), new Point3d(expectedRow.origin.x, expectedRow.origin.y, expectedRow.origin.z)]);
    assert.equal(actualRows.length, 1);
    assert.equal(actualRows[0], 1);

    actualRows = await iModel.executeQuery("SELECT 1 FROM bis.Element WHERE ECInstanceId=:id AND Model=:model AND LastMod=:lastmode AND CodeValue=:codevalue AND FederationGuid=:fedguid AND Origin=:origin",
      {id: new Id64(expectedRow.id), model: new NavigationValue(expectedRow.model.id), lastmod: new DateTime(expectedRow.lastMod),
      codevalue: expectedRow.codeValue, fedguid: new Blob(expectedRow.federationGuid), origin: new Point3d(expectedRow.origin.x, expectedRow.origin.y, expectedRow.origin.z)});
    assert.equal(actualRows.length, 1);
    assert.equal(actualRows[0], 1);

    // single parameter query
    actualRows = await iModel.executeQuery("SELECT 1 FROM bis.Element WHERE LastMod=?", [new DateTime(expectedRow.lastMod)]);
    assert.isTrue(actualRows.length >= 1);

    actualRows = await iModel.executeQuery("SELECT 1 FROM bis.Element WHERE LastMod=:lastmod", {lastmod: new DateTime(expectedRow.lastMod)});
    assert.isTrue(actualRows.length >= 1);

    // New query with point2d parameter
    rows = await iModel.executeQuery("SELECT ECInstanceId,Origin FROM bis.GeometricElement2d LIMIT 1");
    assert.equal(rows.length, 1);

    expectedRow = rows[0];
    actualRows = await iModel.executeQuery("SELECT 1 FROM bis.GeometricElement2d WHERE ECInstanceId=? AND Origin=?",
              [new Id64(expectedRow.id), new Point2d(expectedRow.origin.x, expectedRow.origin.y)]);
    assert.equal(actualRows.length, 1);
    assert.equal(actualRows[0], 1);

    actualRows = await iModel.executeQuery("SELECT 1 FROM bis.GeometricElement2d WHERE ECInstanceId=:id AND Origin=:origin",
      {id: new Id64(expectedRow.id), origin: new Point2d(expectedRow.origin.x, expectedRow.origin.y)});
    assert.equal(actualRows.length, 1);
    assert.equal(actualRows[0], 1);
  });
});
