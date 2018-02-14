/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { CodeSpec, CodeSpecNames } from "../../common/Code";
import { ElementProps, ViewDefinitionProps } from "../../common/ElementProps";
import { Model2dState } from "../../common/EntityState";
import { ModelProps } from "../../common/ModelProps";
import { DrawingViewState, OrthographicViewState, ViewState } from "../../common/ViewState";
import { IModelConnection, IModelConnectionElements, IModelConnectionModels } from "../../frontend/IModelConnection";
import { Point3d } from "@bentley/geometry-core/lib/PointVector";
import { DateTime, Blob, NavigationValue } from "../../common/ECSqlTypes";
import { TestData } from "./TestData";
import { ModelSelectorState } from "../../common/ModelSelectorState";
import { DisplayStyle3dState, DisplayStyle2dState } from "../../common/DisplayStyleState";
import { CategorySelectorState } from "../../common/CategorySelectorState";

// spell-checker: disable

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
    let viewState: ViewState = await iModel.views.loadView(viewDefinitionProps[0].id!);
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
    viewState = await iModel.views.loadView(viewDefinitionProps[0].id!);
    assert.exists(viewState);
    assert.equal(viewState.classFullName, DrawingViewState.getClassFullName());
    assert.equal(viewState.categorySelector.classFullName, CategorySelectorState.getClassFullName());
    assert.equal(viewState.displayStyle.classFullName, DisplayStyle2dState.getClassFullName());
    assert.instanceOf(viewState, DrawingViewState);
    assert.instanceOf(viewState.categorySelector, CategorySelectorState);
    assert.instanceOf(viewState.displayStyle, DisplayStyle2dState);
    assert.instanceOf((viewState as DrawingViewState).baseModel, Model2dState);

    assert.exists(iModel.projectExtents);

    await iModel.close(TestData.accessToken);
  });

  it("Parameterized ECSQL", async () => {
    await TestData.load();
    const iModel: IModelConnection = await IModelConnection.open(TestData.accessToken, TestData.testProjectId, TestData.testIModelId);
    assert.exists(iModel);

    let rows = await iModel.executeQuery("SELECT ECInstanceId,Model,LastMod,CodeValue,FederationGuid,Origin FROM bis.GeometricElement3d LIMIT 1");
    assert.equal(rows.length, 1);
    let expectedRow = rows[0];
    const expectedId: Id64 = expectedRow.id;
    assert.isTrue(expectedId.isValid());
    const expectedModelId: NavigationValue = expectedRow.model;
    assert.isTrue(expectedModelId.isValid());
    const expectedLastMod: DateTime = expectedRow.lastMod;
    assert.isTrue(expectedLastMod.isValid());
    const expectedFedGuid: Blob | undefined = expectedRow.federationGuid !== undefined ? expectedRow.federationGuid : undefined;
    const expectedOrigin: Point3d = expectedRow.origin;

    let actualRows = await iModel.executeQuery("SELECT 1 FROM bis.GeometricElement3d WHERE ECInstanceId=? AND Model=? OR (LastMod=? AND CodeValue=? AND FederationGuid=? AND Origin=?)",
      [expectedId, expectedModelId, expectedLastMod, expectedRow.codeValue,
        expectedFedGuid, expectedOrigin]);
    assert.equal(actualRows.length, 1);

    actualRows = await iModel.executeQuery("SELECT 1 FROM bis.GeometricElement3d WHERE ECInstanceId=:id AND Model=:model OR (LastMod=:lastmod AND CodeValue=:codevalue AND FederationGuid=:fedguid AND Origin=:origin)",
      {
        id: expectedId, model: expectedModelId, lastmod: expectedLastMod,
        codevalue: expectedRow.codeValue, fedguid: expectedFedGuid, origin: expectedOrigin,
      });
    assert.equal(actualRows.length, 1);

    // single parameter query
    actualRows = await iModel.executeQuery("SELECT 1 FROM bis.Element WHERE LastMod=?", [expectedLastMod]);
    assert.isTrue(actualRows.length >= 1);

    actualRows = await iModel.executeQuery("SELECT 1 FROM bis.Element WHERE LastMod=:lastmod", { lastmod: expectedLastMod });
    assert.isTrue(actualRows.length >= 1);

    // New query with point2d parameter
    rows = await iModel.executeQuery("SELECT ECInstanceId,Origin FROM bis.GeometricElement2d LIMIT 1");
    assert.equal(rows.length, 1);

    expectedRow = rows[0];
    actualRows = await iModel.executeQuery("SELECT 1 FROM bis.GeometricElement2d WHERE ECInstanceId=? AND Origin=?",
      [expectedRow.id, expectedRow.origin]);
    assert.equal(actualRows.length, 1);

    actualRows = await iModel.executeQuery("SELECT 1 FROM bis.GeometricElement2d WHERE ECInstanceId=:id AND Origin=:origin",
      { id: expectedRow.id, origin: expectedRow.origin });
    assert.equal(actualRows.length, 1);

    await iModel.close(TestData.accessToken);
  }).timeout(99999);
});
