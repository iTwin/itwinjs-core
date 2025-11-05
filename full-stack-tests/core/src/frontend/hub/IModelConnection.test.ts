/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Id64, Logger, LogLevel, ProcessDetector } from "@itwin/core-bentley";
import { BisCodeSpec, IModelVersion, QueryBinder, QueryRowFormat, RelatedElement } from "@itwin/core-common";
import {
  CategorySelectorState, CheckpointConnection, DisplayStyle2dState, DisplayStyle3dState, DrawingViewState, IModelApp, IModelConnection,
  ModelSelectorState, OrthographicViewState, ViewState,
} from "@itwin/core-frontend";
import { Range3d, Transform } from "@itwin/core-geometry";
import { TestUsers } from "@itwin/oidc-signin-tool/lib/cjs/frontend";
import { TestUtility } from "../TestUtility";
import { SchemaFormatsProvider, SchemaKey } from "@itwin/ecschema-metadata";
import { Format, FormatterSpec } from "@itwin/core-quantity";

async function executeQuery(iModel: IModelConnection, ecsql: string, bindings?: any[] | object): Promise<any[]> {
  const rows: any[] = [];
  for await (const row of iModel.createQueryReader(ecsql, QueryBinder.from(bindings), { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
    rows.push(row.toRow());
  }
  return rows;
}

describe("IModelConnection (#integration)", () => {
  let iModel: IModelConnection;

  before(async () => {
    await TestUtility.shutdownFrontend();
    await TestUtility.startFrontend({
      applicationVersion: "1.2.1.1",
    }, true);

    Logger.initializeToConsole();
    Logger.setLevel("core-frontend.IModelConnection", LogLevel.Error); // Change to trace to debug

    await TestUtility.initialize(TestUsers.regular);
    IModelApp.authorizationClient = TestUtility.iTwinPlatformEnv.authClient;

    // Setup a model with a large number of change sets
    const testITwinId = await TestUtility.queryITwinIdByName(TestUtility.testITwinName);
    const testIModelId = await TestUtility.queryIModelIdByName(testITwinId, TestUtility.testIModelNames.connectionRead);

    iModel = await CheckpointConnection.openRemote(testITwinId, testIModelId);
    IModelApp.formatsProvider = new SchemaFormatsProvider(iModel.schemaContext, "imperial");
  });

  after(async () => {
    await TestUtility.purgeAcquiredBriefcases(iModel.iModelId!);
    if (iModel)
      await iModel.close();
    await TestUtility.shutdownFrontend();
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

    const rows = await executeQuery(iModel, "SELECT CodeValue AS code FROM BisCore.Category LIMIT 20");
    assert.isAtLeast(rows.length, 1);
    assert.exists(rows[0].code);
    assert.equal(rows.length, queryElementIds.size);

    const codeSpecByName = await iModel.codeSpecs.getByName(BisCodeSpec.spatialCategory);
    assert.exists(codeSpecByName);
    const codeSpecById = await iModel.codeSpecs.getById(codeSpecByName.id);
    assert.exists(codeSpecById);
    const codeSpecByNewId = await iModel.codeSpecs.getById(Id64.fromJSON(codeSpecByName.id));
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

  it("should be able to open an IModel with no versions", async () => {
    const iTwinId = await TestUtility.queryITwinIdByName(TestUtility.testITwinName);
    const iModelId = await TestUtility.queryIModelIdByName(iTwinId, TestUtility.testIModelNames.noVersions);
    const noVersionsIModel = await CheckpointConnection.openRemote(iTwinId, iModelId);
    assert.isNotNull(noVersionsIModel);
    await noVersionsIModel.close();

    const noVersionsIModel2 = await CheckpointConnection.openRemote(iTwinId, iModelId);
    assert.isNotNull(noVersionsIModel2);
    await noVersionsIModel2.close();

    const noVersionsIModel3 = await CheckpointConnection.openRemote(iTwinId, iModelId, IModelVersion.asOfChangeSet(""));
    assert.isNotNull(noVersionsIModel3);
    await noVersionsIModel3.close();
  });

  // this test isn't correct under IPC. It shouldn't really be true for RPC, but i guess this attempts to simulate
  // multiple frontend processes by using a single process. I guess it works because "close" doesn't really close the file for web backends.
  // I think it should be eliminated.
  if (!ProcessDetector.isElectronAppFrontend) {
    it("should be able to open the same IModel many times", async () => {
      const iTwinId = await TestUtility.queryITwinIdByName(TestUtility.testITwinName);
      const iModelId = await TestUtility.queryIModelIdByName(iTwinId, "ReadOnlyTest");

      const readOnlyTest = await CheckpointConnection.openRemote(iTwinId, iModelId, IModelVersion.latest());
      assert.isNotNull(readOnlyTest);

      const promises = new Array<Promise<void>>();
      let n = 0;
      while (++n < 25) {
        const promise = CheckpointConnection.openRemote(iTwinId, iModelId)
          .then((readOnlyTest2: IModelConnection) => {
            assert.isNotNull(readOnlyTest2);
            assert.isTrue(readOnlyTest.key === readOnlyTest2.key);
          });
        promises.push(promise);
      }

      await Promise.all(promises);
    });
  }

  it("should be able to request tiles from an IModelConnection", async () => {
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

  it("should generate unique transient IDs", () => {
    for (let i = 1; i < 40; i++) {
      const id = iModel.transientIds.getNext();
      expect(Id64.getLocalId(id)).to.equal(i); // auto-incrementing local ID beginning at 1
      expect(Id64.getBriefcaseId(id)).to.equal(0xffffff); // illegal briefcase ID
      expect(Id64.isTransient(id)).to.be.true;
      expect(Id64.isTransient(id.toString())).to.be.true;
    }

    expect(Id64.isTransient(Id64.invalid)).to.be.false;
    expect(Id64.isTransient("0xffffff6789abcdef")).to.be.true;
  });

  it("should be able to retrieve schema metadata", async () => {
    assert.exists(iModel.schemaContext);
    const testKey = new SchemaKey("BisCore");
    const elem = await iModel.schemaContext.getSchema(testKey);
    assert.isDefined(elem, "BisCore schema should be defined in snapshot iModel");
  });

  it("should be able to use IModelApp.formatsProvider and format a quantity", async () => {
    const formatECName = "Formats.DefaultRealU";
    assert.isDefined(IModelApp.formatsProvider, "a SchemaFormatsProvider should be defined in test setup");
    const formatProps = await IModelApp.formatsProvider.getFormat(formatECName);
    assert.isDefined(formatProps, "Formats.AmerFI format should be defined in snapshot iModel");
    const persistenceUnitProps = await IModelApp.quantityFormatter.unitsProvider.findUnitByName("Units.M");
    const format = await Format.createFromJSON(formatECName, IModelApp.quantityFormatter.unitsProvider, formatProps!)
    const spec = await FormatterSpec.create(`${formatECName}_format_spec`, format, IModelApp.quantityFormatter.unitsProvider, persistenceUnitProps);
    const formattedValue = spec.applyFormatting(5.0);
    assert.equal(formattedValue, "5.0 m");
  });

  it("properly deserializes gcs latitude", async () => {
      const iTwinId = await TestUtility.getTestITwinId();
      const iModelId = await TestUtility.queryIModelIdByName(iTwinId, TestUtility.testIModelNames.smallTex);
      iModel = await CheckpointConnection.openRemote(iTwinId, iModelId);
      assert.notEqual(iModel.geographicCoordinateSystem?.horizontalCRS?.extent?.northEast.latitude, 0);
    })
});
