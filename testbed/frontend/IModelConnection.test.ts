/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Id64, OpenMode } from "@bentley/bentleyjs-core";
import { XYAndZ } from "@bentley/geometry-core";
import { BisCodeSpec, CodeSpec, ViewDefinitionProps, NavigationValue, ECSqlTypedString, ECSqlStringType, RelatedElement } from "@bentley/imodeljs-common";
import { TestData } from "./TestData";
import { TestRpcInterface } from "../common/TestRpcInterface";
import {
  DrawingViewState, OrthographicViewState, ViewState, IModelConnection, IModelConnectionElements, IModelConnectionModels,
  ModelSelectorState, DisplayStyle3dState, DisplayStyle2dState, CategorySelectorState, IModelApp,
} from "@bentley/imodeljs-frontend";

describe("IModelConnection", () => {
  let iModel: IModelConnection;

  before(async () => {
    IModelApp.startup();
    await TestData.load();
    iModel = await IModelConnection.open(TestData.accessToken, TestData.testProjectId, TestData.testIModelId);
  });

  after(async () => {
    await iModel.close(TestData.accessToken);
    IModelApp.shutdown();
  });

  it("should be able to get elements and models from an IModelConnection (#integration)", async () => {
    assert.exists(iModel);
    assert.isTrue(iModel instanceof IModelConnection);
    assert.exists(iModel.models);
    assert.isTrue(iModel.models instanceof IModelConnectionModels);
    assert.exists(iModel.elements);
    assert.isTrue(iModel.elements instanceof IModelConnectionElements);

    const elementProps = await iModel.elements.getProps(iModel.elements.rootSubjectId);
    assert.equal(elementProps.length, 1);
    assert.isTrue(iModel.elements.rootSubjectId.equals(new Id64(elementProps[0].id)));
    assert.isTrue(iModel.models.repositoryModelId.equals(RelatedElement.idFromJson(elementProps[0].model)));

    const queryElementIds = await iModel.elements.queryIds({ from: "BisCore.Category", limit: 20, offset: 0 });
    assert.isAtLeast(queryElementIds.size, 1);

    const formatObjs: any[] = await iModel.elements.formatElements(queryElementIds);
    assert.isAtLeast(formatObjs.length, 1);

    const modelProps = await iModel.models.getProps(iModel.models.repositoryModelId);
    assert.exists(modelProps);
    assert.equal(modelProps.length, 1);
    assert.equal(modelProps[0].id, iModel.models.repositoryModelId.value);
    assert.isTrue(iModel.models.repositoryModelId.equals(new Id64(modelProps[0].id)));

    const rows: any[] = await iModel.executeQuery("SELECT CodeValue AS code FROM BisCore.Category LIMIT 20");
    assert.isAtLeast(rows.length, 1);
    assert.exists(rows[0].code);
    assert.equal(rows.length, queryElementIds.size);

    const codeSpecByName: CodeSpec = await iModel.codeSpecs.getByName(BisCodeSpec.spatialCategory);
    assert.exists(codeSpecByName);
    const codeSpecById: CodeSpec = await iModel.codeSpecs.getById(codeSpecByName.id);
    assert.exists(codeSpecById);
    const codeSpecByNewId: CodeSpec = await iModel.codeSpecs.getById(new Id64(codeSpecByName.id));
    assert.exists(codeSpecByNewId);

    let viewDefinitionProps: ViewDefinitionProps[] = await iModel.views.queryProps({ from: "BisCore.OrthographicViewDefinition" });
    assert.isAtLeast(viewDefinitionProps.length, 1);
    let viewState: ViewState = await iModel.views.load(viewDefinitionProps[0].id!);
    assert.exists(viewState);
    assert.equal(viewState.classFullName, OrthographicViewState.getClassFullName());
    assert.equal(viewState.categorySelector.classFullName, CategorySelectorState.getClassFullName());
    assert.equal(viewState.displayStyle.classFullName, DisplayStyle3dState.getClassFullName());
    assert.instanceOf(viewState, OrthographicViewState);
    assert.instanceOf(viewState.categorySelector, CategorySelectorState);
    assert.instanceOf(viewState.displayStyle, DisplayStyle3dState);
    assert.instanceOf((viewState as OrthographicViewState).modelSelector, ModelSelectorState);

    viewDefinitionProps = await iModel.views.queryProps({ from: "BisCore.DrawingViewDefinition" });
    assert.isAtLeast(viewDefinitionProps.length, 1);
    viewState = await iModel.views.load(viewDefinitionProps[0].id!);
    assert.exists(viewState);
    assert.equal(viewState.classFullName, DrawingViewState.getClassFullName());
    assert.equal(viewState.categorySelector.classFullName, CategorySelectorState.getClassFullName());
    assert.equal(viewState.displayStyle.classFullName, DisplayStyle2dState.getClassFullName());
    assert.instanceOf(viewState, DrawingViewState);
    assert.instanceOf(viewState.categorySelector, CategorySelectorState);
    assert.instanceOf(viewState.displayStyle, DisplayStyle2dState);
    assert.exists(iModel.projectExtents);

  });

  it("Parameterized ECSQL (#integration)", async () => {
    assert.exists(iModel);
    let rows = await iModel.executeQuery("SELECT ECInstanceId,Model,LastMod,CodeValue,FederationGuid,Origin FROM bis.GeometricElement3d LIMIT 1");
    assert.equal(rows.length, 1);
    let expectedRow = rows[0];
    const expectedId = new Id64(expectedRow.id);
    assert.isTrue(expectedId.isValid());
    const expectedModel: NavigationValue = expectedRow.model;
    assert.isTrue(new Id64(expectedModel.id).isValid());
    const expectedLastMod: ECSqlTypedString = { type: ECSqlStringType.DateTime, value: expectedRow.lastMod };
    const expectedFedGuid: ECSqlTypedString | undefined = expectedRow.federationGuid !== undefined ? { type: ECSqlStringType.Guid, value: expectedRow.federationGuid } : undefined;
    const expectedOrigin: XYAndZ = expectedRow.origin;

    let actualRows = await iModel.executeQuery("SELECT 1 FROM bis.GeometricElement3d WHERE ECInstanceId=? AND Model=? OR (LastMod=? AND CodeValue=? AND FederationGuid=? AND Origin=?)",
      [expectedId, expectedModel, expectedLastMod, expectedRow.codeValue, expectedFedGuid, expectedOrigin]);
    assert.equal(actualRows.length, 1);

    actualRows = await iModel.executeQuery("SELECT 1 FROM bis.GeometricElement3d WHERE ECInstanceId=:id AND Model=:model OR (LastMod=:lastmod AND CodeValue=:codevalue AND FederationGuid=:fedguid AND Origin=:origin)",
      {
        id: expectedId, model: expectedModel, lastmod: expectedLastMod,
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
      [new Id64(expectedRow.id), expectedRow.origin]);
    assert.equal(actualRows.length, 1);

    actualRows = await iModel.executeQuery("SELECT 1 FROM bis.GeometricElement2d WHERE ECInstanceId=:id AND Origin=:origin",
      { id: { type: ECSqlStringType.Id, value: expectedRow.id }, origin: expectedRow.origin });
    assert.equal(actualRows.length, 1);
  }).timeout(99999);

  it("Change cache file generation when attaching change cache (#integration)", async () => {
    assert.exists(iModel);
    await TestRpcInterface.getClient().deleteChangeCache(iModel.iModelToken);
    await iModel.attachChangeCache();
    const changeSummaryRows: any[] = await iModel.executeQuery("SELECT count(*) cnt FROM change.ChangeSummary");
    assert.equal(changeSummaryRows.length, 1);
    assert.equal(changeSummaryRows[0].cnt, 0);
    const changeSetRows = await iModel.executeQuery("SELECT count(*) cnt FROM imodelchange.ChangeSet");
    assert.equal(changeSetRows.length, 1);
    assert.equal(changeSetRows[0].cnt, 0);
  }).timeout(99999);

  it("Change cache file generation during change summary extraction (#integration)", async () => {
    assert.exists(iModel);
    // for now, imodel must be open readwrite for changesummary extraction
    await iModel.close(TestData.accessToken);

    const testIModel: IModelConnection = await IModelConnection.open(TestData.accessToken, TestData.testProjectId, TestData.testIModelId, OpenMode.ReadWrite);
    try {
      await TestRpcInterface.getClient().deleteChangeCache(testIModel.iModelToken);
      await TestRpcInterface.getClient().extractChangeSummaries(testIModel.iModelToken, { currentChangeSetOnly: true });
      await testIModel.attachChangeCache();

      const changeSummaryRows: any[] = await testIModel.executeQuery("SELECT count(*) cnt FROM change.ChangeSummary");
      assert.equal(changeSummaryRows.length, 1);
      const changeSetRows = await testIModel.executeQuery("SELECT count(*) cnt FROM imodelchange.ChangeSet");
      assert.equal(changeSetRows.length, 1);
      assert.equal(changeSetRows[0].cnt, changeSummaryRows[0].cnt);
    } finally {
      await testIModel.close(TestData.accessToken);
    }
  }); // .timeout(99999);
});
