/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Guid, Id64, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { Range3d, Transform, XYAndZ } from "@bentley/geometry-core";
import { BisCodeSpec, CodeSpec, IModelVersion, NavigationValue, RelatedElement } from "@bentley/imodeljs-common";
import {
  CategorySelectorState, CheckpointConnection, DisplayStyle2dState, DisplayStyle3dState, DrawingViewState, IModelApp, IModelConnection, MockRender,
  ModelSelectorState, OrthographicViewState, ViewState,
} from "@bentley/imodeljs-frontend";
import { TestUsers } from "@bentley/oidc-signin-tool/lib/frontend";
import { TestRpcInterface } from "../../common/RpcInterfaces";
import { TestSeqClient } from "./TestSeqClient";
import { TestUtility } from "./TestUtility";

async function executeQuery(iModel: IModelConnection, ecsql: string, bindings?: any[] | object): Promise<any[]> {
  const rows: any[] = [];
  for await (const row of iModel.query(ecsql, bindings)) {
    rows.push(row);
  }
  return rows;
}

describe("IModelConnection (#integration)", () => {
  let iModel: IModelConnection;

  before(async () => {
    await IModelApp.shutdown();
    await MockRender.App.startup({
      applicationVersion: "1.2.1.1",
    });

    Logger.initializeToConsole();
    Logger.setLevel("imodeljs-frontend.IModelConnection", LogLevel.Error); // Change to trace to debug

    const testProjectName = "iModelJsIntegrationTest";
    const testIModelName = "ConnectionReadTest";

    const authorizationClient = await TestUtility.initializeTestProject(testProjectName, TestUsers.regular);
    IModelApp.authorizationClient = authorizationClient;

    // Setup a model with a large number of change sets
    const testProjectId = await TestUtility.getTestProjectId(testProjectName);
    const testIModelId = await TestUtility.getTestIModelId(testProjectId, testIModelName);

    iModel = await CheckpointConnection.openRemote(testProjectId, testIModelId);
  });

  after(async () => {
    await TestUtility.purgeAcquiredBriefcases(iModel.iModelId!);
    if (iModel)
      await iModel.close();
    await MockRender.App.shutdown();
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
    assert.equal(iModel.elements.rootSubjectId, Id64.fromJSON(elementProps[0].id));
    assert.equal(iModel.models.repositoryModelId, RelatedElement.idFromJson(elementProps[0].model).toString());

    const queryElementIds = await iModel.elements.queryIds({ from: "BisCore.Category", limit: 20, offset: 0 });
    assert.isAtLeast(queryElementIds.size, 1);

    const modelProps = await iModel.models.getProps(iModel.models.repositoryModelId);
    assert.exists(modelProps);
    assert.equal(modelProps.length, 1);
    assert.equal(modelProps[0].id, iModel.models.repositoryModelId);
    assert.equal(iModel.models.repositoryModelId, modelProps[0].id);

    const rows: any[] = await executeQuery(iModel, "SELECT CodeValue AS code FROM BisCore.Category LIMIT 20");
    assert.isAtLeast(rows.length, 1);
    assert.exists(rows[0].code);
    assert.equal(rows.length, queryElementIds.size);

    const codeSpecByName: CodeSpec = await iModel.codeSpecs.getByName(BisCodeSpec.spatialCategory);
    assert.exists(codeSpecByName);
    const codeSpecById: CodeSpec = await iModel.codeSpecs.getById(codeSpecByName.id);
    assert.exists(codeSpecById);
    const codeSpecByNewId: CodeSpec = await iModel.codeSpecs.getById(Id64.fromJSON(codeSpecByName.id));
    assert.exists(codeSpecByNewId);

    let viewDefinitions = await iModel.views.getViewList({ from: "BisCore.OrthographicViewDefinition" });
    assert.isAtLeast(viewDefinitions.length, 1);
    let viewState: ViewState = await iModel.views.load(viewDefinitions[0].id);
    assert.exists(viewState);
    assert.equal(viewState.classFullName, OrthographicViewState.classFullName);
    assert.equal(viewState.categorySelector.classFullName, CategorySelectorState.classFullName);
    assert.equal(viewState.displayStyle.classFullName, DisplayStyle3dState.classFullName);
    assert.instanceOf(viewState, OrthographicViewState);
    assert.instanceOf(viewState.categorySelector, CategorySelectorState);
    assert.instanceOf(viewState.displayStyle, DisplayStyle3dState);
    assert.instanceOf((viewState as OrthographicViewState).modelSelector, ModelSelectorState);

    viewDefinitions = await iModel.views.getViewList({ from: "BisCore.DrawingViewDefinition" });
    assert.isAtLeast(viewDefinitions.length, 1);
    viewState = await iModel.views.load(viewDefinitions[0].id);
    assert.exists(viewState);
    assert.equal(viewState.code.value, viewDefinitions[0].name);
    assert.equal(viewState.classFullName, viewDefinitions[0].class);
    assert.equal(viewState.categorySelector.classFullName, CategorySelectorState.classFullName);
    assert.equal(viewState.displayStyle.classFullName, DisplayStyle2dState.classFullName);
    assert.instanceOf(viewState, DrawingViewState);
    assert.instanceOf(viewState.categorySelector, CategorySelectorState);
    assert.instanceOf(viewState.displayStyle, DisplayStyle2dState);
    assert.exists(iModel.projectExtents);

  });

  it.skip("should be able to re-establish IModelConnection if the backend is shut down", async () => {
    let elementProps = await iModel.elements.getProps(iModel.elements.rootSubjectId);
    assert.equal(elementProps.length, 1);
    assert.equal(iModel.elements.rootSubjectId, Id64.fromJSON(elementProps[0].id));
    assert.equal(iModel.models.repositoryModelId, RelatedElement.idFromJson(elementProps[0].model).toString());

    let queryElementIds = await iModel.elements.queryIds({ from: "BisCore.Category", limit: 20, offset: 0 });
    assert.isAtLeast(queryElementIds.size, 1);

    // Restart Backend!!!
    await TestRpcInterface.getClient().restartIModelHost();

    elementProps = await iModel.elements.getProps(iModel.elements.rootSubjectId);
    assert.equal(elementProps.length, 1);
    assert.equal(iModel.elements.rootSubjectId, Id64.fromJSON(elementProps[0].id));
    assert.equal(iModel.models.repositoryModelId, RelatedElement.idFromJson(elementProps[0].model).toString());

    queryElementIds = await iModel.elements.queryIds({ from: "BisCore.Category", limit: 20, offset: 0 });
    assert.isAtLeast(queryElementIds.size, 1);
  });

  it("should be able to open an IModel with no versions", async () => {
    const projectId = await TestUtility.getTestProjectId("iModelJsIntegrationTest");
    const iModelId = await TestUtility.getTestIModelId(projectId, "NoVersionsTest");
    const noVersionsIModel = await CheckpointConnection.openRemote(projectId, iModelId);
    assert.isNotNull(noVersionsIModel);

    const noVersionsIModel2 = await CheckpointConnection.openRemote(projectId, iModelId);
    assert.isNotNull(noVersionsIModel2);

    const noVersionsIModel3 = await CheckpointConnection.openRemote(projectId, iModelId, IModelVersion.asOfChangeSet(""));
    assert.isNotNull(noVersionsIModel3);
  });

  it("should send a usage log everytime an iModel is opened", async () => {
    const projectId = await TestUtility.getTestProjectId("iModelJsIntegrationTest");
    const iModelId = await TestUtility.getTestIModelId(projectId, "ReadOnlyTest");

    // Set a new session id to isolate the usage logs
    IModelApp.sessionId = Guid.createValue();

    // Open multiple connections
    let n = 0;
    const MAX_CONNECTIONS = 12;
    while (n++ < MAX_CONNECTIONS) {
      const noVersionsIModel = await CheckpointConnection.openRemote(projectId, iModelId);
      assert.isNotNull(noVersionsIModel);
    }

    const pause = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    await pause(5000); // Give ULAS and SEQ about 5 seconds to catch up

    const filter = `And(And(Equal(ServiceRequest,"FePostClientLog"),has(UsageLogEntry)),Equal(UsageLogEntry.CorrelationId,"${IModelApp.sessionId}"))`;
    const seqClient = new TestSeqClient(true /* = forUsageLogging */);
    const results = await seqClient.query(filter, MAX_CONNECTIONS * 2);
    assert.equal(results.length, MAX_CONNECTIONS);
  });

  it("should be able to open the same IModel many times", async () => {
    const projectId = await TestUtility.getTestProjectId("iModelJsIntegrationTest");
    const iModelId = await TestUtility.getTestIModelId(projectId, "ReadOnlyTest");

    const readOnlyTest = await CheckpointConnection.openRemote(projectId, iModelId, IModelVersion.latest());
    assert.isNotNull(readOnlyTest);

    const promises = new Array<Promise<void>>();
    let n = 0;
    while (++n < 25) {
      const promise = CheckpointConnection.openRemote(projectId, iModelId)
        .then((readOnlyTest2: IModelConnection) => {
          assert.isNotNull(readOnlyTest2);
          assert.isTrue(readOnlyTest.key === readOnlyTest2.key);
        });
      promises.push(promise);
    }

    await Promise.all(promises);
  });

  it("should be able to request tiles from an IModelConnection", async () => {
    const testProjectId = await TestUtility.getTestProjectId("iModelJsIntegrationTest");
    const testIModelId = await TestUtility.getTestIModelId(testProjectId, "ConnectionReadTest");
    iModel = await CheckpointConnection.openRemote(testProjectId, testIModelId);

    const modelProps = await iModel.models.queryProps({ from: "BisCore.PhysicalModel" });
    expect(modelProps.length).to.equal(1);

    const treeId = modelProps[0].id!.toString();
    const tree = await IModelApp.tileAdmin.requestTileTreeProps(iModel, treeId);

    expect(tree.id).to.equal(modelProps[0].id);
    expect(tree.maxTilesToSkip).to.equal(1);
    expect(tree.rootTile).not.to.be.undefined;

    const tf = Transform.fromJSON(tree.location);
    expect(tf.matrix.isIdentity).to.be.true;
    expect(tf.origin.isAlmostEqualXYZ(5.138785, 4.7847327, 10.15635152, 0.001)).to.be.true;

    const rootTile = tree.rootTile;
    expect(rootTile.contentId).to.equal("0/0/0/0/1");

    const range = Range3d.fromJSON(rootTile.range);
    const expectedRange = { x: 35.285026, y: 35.118263, z: 10.157 };
    expect(range.low.isAlmostEqualXYZ(-expectedRange.x, -expectedRange.y, -expectedRange.z, 0.001)).to.be.true;
    expect(range.high.isAlmostEqualXYZ(expectedRange.x, expectedRange.y, expectedRange.z, 0.001)).to.be.true;

    // The following are not known until we load the tile content.
    expect(rootTile.contentRange).to.be.undefined;
    expect(rootTile.isLeaf).to.be.false;
  });

  // This require new build of Addon
  it.skip("ECSQL with BLOB", async () => {
    assert.exists(iModel);
    let rows = await executeQuery(iModel, "SELECT ECInstanceId,GeometryStream FROM bis.GeometricElement3d WHERE GeometryStream IS NOT NULL LIMIT 1");
    assert.equal(rows.length, 1);
    const row: any = rows[0];

    assert.isTrue(Id64.isValidId64(row.id));

    assert.isDefined(row.geometryStream);
    const geomStream: Uint8Array = row.geometryStream;
    assert.isAtLeast(geomStream.byteLength, 1);

    rows = await executeQuery(iModel, "SELECT 1 FROM bis.GeometricElement3d WHERE GeometryStream=?", [geomStream]);
    assert.equal(rows.length, 1);
  });
  // This require new build of Addon
  it.skip("Parameterized ECSQL", async () => {
    assert.exists(iModel);
    let rows = await executeQuery(iModel, "SELECT ECInstanceId,Model,LastMod,CodeValue,FederationGuid,Origin FROM bis.GeometricElement3d LIMIT 1");
    assert.equal(rows.length, 1);
    let expectedRow = rows[0];
    const expectedId = Id64.fromJSON(expectedRow.id);
    assert.isTrue(Id64.isValid(expectedId));
    const expectedModel: NavigationValue = expectedRow.model;
    assert.isTrue(Id64.isValidId64(expectedModel.id));
    const expectedLastMod: string = expectedRow.lastMod;
    const expectedFedGuid: string | undefined = !!expectedRow.federationGuid ? expectedRow.federationGuid : undefined;
    const expectedOrigin: XYAndZ = expectedRow.origin;

    let actualRows = await executeQuery(iModel, "SELECT 1 FROM bis.GeometricElement3d WHERE ECInstanceId=? AND Model=? OR (LastMod=? AND CodeValue=? AND FederationGuid=? AND Origin=?)",
      [expectedId, expectedModel, expectedLastMod, expectedRow.codeValue, expectedFedGuid, expectedOrigin]);
    assert.equal(actualRows.length, 1);

    actualRows = await executeQuery(iModel, "SELECT 1 FROM bis.GeometricElement3d WHERE ECInstanceId=:id AND Model=:model OR (LastMod=:lastmod AND CodeValue=:codevalue AND FederationGuid=:fedguid AND Origin=:origin)",
      {
        id: expectedId, model: expectedModel, lastmod: expectedLastMod,
        codevalue: expectedRow.codeValue, fedguid: expectedFedGuid, origin: expectedOrigin,
      });
    assert.equal(actualRows.length, 1);

    // single parameter query
    actualRows = await executeQuery(iModel, "SELECT 1 FROM bis.Element WHERE LastMod=?", [expectedLastMod]);
    assert.isTrue(actualRows.length >= 1);

    actualRows = await executeQuery(iModel, "SELECT 1 FROM bis.Element WHERE LastMod=:lastmod", { lastmod: expectedLastMod });
    assert.isTrue(actualRows.length >= 1);

    // New query with point2d parameter
    rows = await executeQuery(iModel, "SELECT ECInstanceId,Origin FROM bis.GeometricElement2d LIMIT 1");
    assert.equal(rows.length, 1);

    expectedRow = rows[0];
    actualRows = await executeQuery(iModel, "SELECT 1 FROM bis.GeometricElement2d WHERE ECInstanceId=? AND Origin=?",
      [Id64.fromJSON(expectedRow.id), expectedRow.origin]);
    assert.equal(actualRows.length, 1);

    actualRows = await executeQuery(iModel, "SELECT 1 FROM bis.GeometricElement2d WHERE ECInstanceId=:id AND Origin=:origin",
      { id: expectedRow.id, origin: expectedRow.origin });
    assert.equal(actualRows.length, 1);
  }).timeout(99999);

  it("should generate unique transient IDs", () => {
    for (let i = 1; i < 40; i++) {
      const id = iModel.transientIds.next;
      expect(Id64.getLocalId(id)).to.equal(i); // auto-incrementing local ID beginning at 1
      expect(Id64.getBriefcaseId(id)).to.equal(0xffffff); // illegal briefcase ID
      expect(Id64.isTransient(id)).to.be.true;
      expect(Id64.isTransient(id.toString())).to.be.true;
    }

    expect(Id64.isTransient(Id64.invalid)).to.be.false;
    expect(Id64.isTransient("0xffffff6789abcdef")).to.be.true;
  });
});
