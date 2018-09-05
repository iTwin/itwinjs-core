/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Id64, OpenMode, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { XYAndZ, Range3d, Transform } from "@bentley/geometry-core";
import { BisCodeSpec, CodeSpec, NavigationValue, ECSqlTypedString, ECSqlStringType, RelatedElement, IModelVersion } from "@bentley/imodeljs-common";
import { TestData } from "./TestData";
import { TestRpcInterface } from "../common/TestRpcInterface";
import {
  DrawingViewState, OrthographicViewState, ViewState, IModelConnection,
  ModelSelectorState, DisplayStyle3dState, DisplayStyle2dState, CategorySelectorState, IModelApp,
} from "@bentley/imodeljs-frontend";
import { TestbedConfig } from "../common/TestbedConfig";
import { CONSTANTS } from "../common/Testbed";

describe("IModelConnection (#integration)", () => {
  let iModel: IModelConnection;

  before(async () => {
    IModelApp.startup();

    Logger.initializeToConsole();
    Logger.setLevel("imodeljs-frontend.IModelConnection", LogLevel.Error); // Change to trace to debug

    await TestData.load();
    iModel = await IModelConnection.open(TestData.accessToken, TestData.testProjectId, TestData.testIModelId);
  });

  after(async () => {
    if (iModel)
      await iModel.close(TestData.accessToken);
    IModelApp.shutdown();
  });

  it("should be able to get elements and models from an IModelConnection", async () => {
    assert.exists(iModel);
    assert.isTrue(iModel instanceof IModelConnection);
    assert.exists(iModel.models);
    assert.isTrue(iModel.models instanceof IModelConnection.Models);
    assert.exists(iModel.elements);
    assert.isTrue(iModel.elements instanceof IModelConnection.Elements);

    const elementProps = await iModel.elements.getProps(iModel.elements.rootSubjectId);
    assert.equal(elementProps.length, 1);
    assert.isTrue(iModel.elements.rootSubjectId.equals(new Id64(elementProps[0].id)));
    assert.equal(iModel.models.repositoryModelId, RelatedElement.idFromJson(elementProps[0].model).toString());

    const queryElementIds = await iModel.elements.queryIds({ from: "BisCore.Category", limit: 20, offset: 0 });
    assert.isAtLeast(queryElementIds.size, 1);

    const formatObjs: any[] = await iModel.elements.formatElements(queryElementIds);
    assert.isAtLeast(formatObjs.length, 1);

    const modelProps = await iModel.models.getProps(iModel.models.repositoryModelId);
    assert.exists(modelProps);
    assert.equal(modelProps.length, 1);
    assert.equal(modelProps[0].id, iModel.models.repositoryModelId);
    assert.equal(iModel.models.repositoryModelId, modelProps[0].id);

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

    let viewDefinitions = await iModel.views.getViewList({ from: "BisCore.OrthographicViewDefinition" });
    assert.isAtLeast(viewDefinitions.length, 1);
    let viewState: ViewState = await iModel.views.load(viewDefinitions[0].id);
    assert.exists(viewState);
    assert.equal(viewState.classFullName, OrthographicViewState.getClassFullName());
    assert.equal(viewState.categorySelector.classFullName, CategorySelectorState.getClassFullName());
    assert.equal(viewState.displayStyle.classFullName, DisplayStyle3dState.getClassFullName());
    assert.instanceOf(viewState, OrthographicViewState);
    assert.instanceOf(viewState.categorySelector, CategorySelectorState);
    assert.instanceOf(viewState.displayStyle, DisplayStyle3dState);
    assert.instanceOf((viewState as OrthographicViewState).modelSelector, ModelSelectorState);

    viewDefinitions = await iModel.views.getViewList({ from: "BisCore.DrawingViewDefinition" });
    assert.isAtLeast(viewDefinitions.length, 1);
    viewState = await iModel.views.load(viewDefinitions[0].id);
    assert.exists(viewState);
    assert.equal(viewState.code.getValue(), viewDefinitions[0].name);
    assert.equal(viewState.classFullName, viewDefinitions[0].class);
    assert.equal(viewState.categorySelector.classFullName, CategorySelectorState.getClassFullName());
    assert.equal(viewState.displayStyle.classFullName, DisplayStyle2dState.getClassFullName());
    assert.instanceOf(viewState, DrawingViewState);
    assert.instanceOf(viewState.categorySelector, CategorySelectorState);
    assert.instanceOf(viewState.displayStyle, DisplayStyle2dState);
    assert.exists(iModel.projectExtents);

  });

  it("should be able to re-establish IModelConnection if the backend is shut down", async () => {
    let elementProps = await iModel.elements.getProps(iModel.elements.rootSubjectId);
    assert.equal(elementProps.length, 1);
    assert.isTrue(iModel.elements.rootSubjectId.equals(new Id64(elementProps[0].id)));
    assert.equal(iModel.models.repositoryModelId, RelatedElement.idFromJson(elementProps[0].model).toString());

    let queryElementIds = await iModel.elements.queryIds({ from: "BisCore.Category", limit: 20, offset: 0 });
    assert.isAtLeast(queryElementIds.size, 1);

    // Restart Backend!!!
    assert(TestbedConfig.sendToMainSync({ name: CONSTANTS.RESTART_BACKEND, value: undefined }));

    elementProps = await iModel.elements.getProps(iModel.elements.rootSubjectId);
    assert.equal(elementProps.length, 1);
    assert.isTrue(iModel.elements.rootSubjectId.equals(new Id64(elementProps[0].id)));
    assert.equal(iModel.models.repositoryModelId, RelatedElement.idFromJson(elementProps[0].model).toString());

    queryElementIds = await iModel.elements.queryIds({ from: "BisCore.Category", limit: 20, offset: 0 });
    assert.isAtLeast(queryElementIds.size, 1);
  });

  it("should reuse open briefcases for exclusive access", async () => {
    // Repeatedly opening a Readonly or ReadWrite connection should result in the same briefcase
    // Note that the IModelDb is opened with OpenParams.FixedVersion(AccessMode.Shared) in the case of ReadOnly connections, and
    // OpenParams.PullAndPush(AccessMode.Exclusive) in the case of ReadWrite connections.
    const openModes: OpenMode[] = [OpenMode.Readonly, OpenMode.ReadWrite];
    for (const openMode of openModes) {
      const iModel1 = await IModelConnection.open(TestData.accessToken, TestData.testProjectId, TestData.testIModelId, openMode, IModelVersion.latest());
      assert.isNotNull(iModel1);
      let n = 0;
      while (++n < 5) {
        const iModel2 = await IModelConnection.open(TestData.accessToken, TestData.testProjectId, TestData.testIModelId, openMode, IModelVersion.latest());
        assert.isNotNull(iModel2);
        assert.equal(iModel2.iModelToken.key, iModel1.iModelToken.key);
      }
      await iModel1.close(TestData.accessToken);
    }
  });

  it("should be able to request tiles from an IModelConnection", async () => {
    const modelProps = await iModel.models.queryProps({ from: "BisCore.PhysicalModel" });
    expect(modelProps.length).to.equal(1);

    const treeIds = Id64.toIdSet(modelProps[0].id!);
    const tileTreeProps = await iModel.tiles.getTileTreeProps(treeIds);
    expect(tileTreeProps.length).to.equal(1);

    const tree = tileTreeProps[0];
    expect(tree.id).to.equal(modelProps[0].id);
    expect(tree.maxTilesToSkip).to.equal(1);
    expect(tree.rootTile).not.to.be.undefined;

    const tf = Transform.fromJSON(tree.location);
    expect(tf.matrix.isIdentity).to.be.true;
    expect(tf.origin.isAlmostEqualXYZ(0.0025, 0.0025, 10.001)).to.be.true;

    const rootTile = tree.rootTile;
    expect(rootTile.id.treeId).to.equal(tree.id);
    expect(rootTile.id.tileId).to.equal("0/0/0/0:1.000000");

    const range = Range3d.fromJSON(rootTile.range);
    expect(range.low.isAlmostEqualXYZ(-50.0075, -50.0075, -20.003)).to.be.true;
    expect(range.high.isAlmostEqualXYZ(50.0075, 50.0075, 20.003)).to.be.true;

    expect(rootTile.contentRange).not.to.be.undefined;

    const contentRange = Range3d.fromJSON(rootTile.contentRange);
    expect(contentRange.low.isAlmostEqualXYZ(-30.14521, -30.332516, -10.001)).to.be.true;
    expect(contentRange.high.isAlmostEqualXYZ(40.414249, 39.89347, 10.310687)).to.be.true;

    expect(rootTile.isLeaf).to.be.true;
  });

  it("Load native assets", async () => {
    const sprite = await iModel.loadNativeAsset("decorators/dgncore/SnapNone.png");
    assert.isDefined(sprite);
  });

  it("Parameterized ECSQL", async () => {
    assert.exists(iModel);
    let rows = await iModel.executeQuery("SELECT ECInstanceId,Model,LastMod,CodeValue,FederationGuid,Origin FROM bis.GeometricElement3d LIMIT 1");
    assert.equal(rows.length, 1);
    let expectedRow = rows[0];
    const expectedId = new Id64(expectedRow.id);
    assert.isTrue(expectedId.isValid);
    const expectedModel: NavigationValue = expectedRow.model;
    assert.isTrue(new Id64(expectedModel.id).isValid);
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

  it("Change cache file generation when attaching change cache", async () => {
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

  it("Change cache file generation during change summary extraction", async () => {
    assert.exists(iModel);
    // for now, imodel must be open readwrite for changesummary extraction
    await iModel.close(TestData.accessToken);

    const testIModel: IModelConnection = await IModelConnection.open(TestData.accessToken, TestData.testProjectId, TestData.testIModelId, OpenMode.ReadWrite);
    try {
      await TestRpcInterface.getClient().deleteChangeCache(testIModel.iModelToken);
      await TestRpcInterface.getClient().extractChangeSummaries(TestData.accessToken, testIModel.iModelToken, { currentChangeSetOnly: true });
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

  it("should generate unique transient IDs", () => {
    for (let i = 1; i < 40; i++) {
      const id = iModel.transientIds.next;
      expect(id.getLow()).to.equal(i); // auto-incrementing local ID beginning at 1
      expect(id.getHigh()).to.equal(0xffffffff); // illegal briefcase ID
      expect(Id64.isTransientId(id)).to.be.true;
      expect(Id64.isTransientId(id.toString())).to.be.true;
    }

    expect(Id64.isTransientId(Id64.invalidId)).to.be.false;
    expect(Id64.isTransientId("0xffffff6789abcdef")).to.be.false;
  });
});
