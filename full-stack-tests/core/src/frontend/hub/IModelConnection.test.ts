/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "vitest";
import { Id64, Logger, LogLevel, ProcessDetector } from "@itwin/core-bentley";
import { BisCodeSpec, IModelVersion, QueryBinder, QueryRowFormat, RelatedElement } from "@itwin/core-common";
import {
  CategorySelectorState, CheckpointConnection, DisplayStyle2dState, DisplayStyle3dState, DrawingViewState, IModelApp, IModelConnection,
  ModelSelectorState, OrthographicViewState, ViewState,
} from "@itwin/core-frontend";
import { Range3d, Transform } from "@itwin/core-geometry";
import { TestUsers } from "@itwin/oidc-signin-tool/lib/cjs/TestUsers";
import { TestUtility } from "../TestUtility";
import { SchemaFormatsProvider, SchemaKey } from "@itwin/ecschema-metadata";
import { Format, FormatterSpec } from "@itwin/core-quantity";

async function executeQuery(iModel: IModelConnection, ecsql: string, bindings?: any[] | object): Promise<any[]> {
  const rows: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  for await (const row of iModel.createQueryReader(ecsql, QueryBinder.from(bindings), { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
    rows.push(row.toRow());
  }
  return rows;
}

describe("IModelConnection (#integration)", () => {
  let iModel: IModelConnection;

  beforeAll(async () => {
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

  afterAll(async () => {
    await TestUtility.purgeAcquiredBriefcases(iModel.iModelId!);
    if (iModel)
      await iModel.close();
    await TestUtility.shutdownFrontend();
  });

  it("should be able to get elements and models from an IModelConnection", async () => {
    expect(iModel).toEqual(expect.anything());
    expect(iModel instanceof IModelConnection).toBe(true);
    expect(iModel.models).toEqual(expect.anything());
    expect(iModel.models instanceof IModelConnection.Models).toBe(true);
    expect(iModel.elements).toEqual(expect.anything());
    expect(iModel.elements instanceof IModelConnection.Elements).toBe(true);

    const elementProps = await iModel.elements.getProps(iModel.elements.rootSubjectId);
    expect(elementProps.length).toBe(1);
    expect(iModel.elements.rootSubjectId).toBe(Id64.fromJSON(elementProps[0].id));
    expect(iModel.models.repositoryModelId).toBe(RelatedElement.idFromJson(elementProps[0].model).toString());

    const queryElementIds = await iModel.elements.queryIds({ from: "BisCore.Category", limit: 20, offset: 0 });
    expect(queryElementIds.size).toBeGreaterThanOrEqual(1);

    const modelProps = await iModel.models.getProps(iModel.models.repositoryModelId);
    expect(modelProps).toEqual(expect.anything());
    expect(modelProps.length).toBe(1);
    expect(modelProps[0].id).toBe(iModel.models.repositoryModelId);
    expect(iModel.models.repositoryModelId).toBe(modelProps[0].id);

    const rows = await executeQuery(iModel, "SELECT CodeValue AS code FROM BisCore.Category LIMIT 20");
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].code).toEqual(expect.anything());
    expect(rows.length).toBe(queryElementIds.size);

    const codeSpecByName = await iModel.codeSpecs.getByName(BisCodeSpec.spatialCategory);
    expect(codeSpecByName).toEqual(expect.anything());
    const codeSpecById = await iModel.codeSpecs.getById(codeSpecByName.id);
    expect(codeSpecById).toEqual(expect.anything());
    const codeSpecByNewId = await iModel.codeSpecs.getById(Id64.fromJSON(codeSpecByName.id));
    expect(codeSpecByNewId).toEqual(expect.anything());

    let viewDefinitions = await iModel.views.getViewList({ from: "BisCore.OrthographicViewDefinition" });
    expect(viewDefinitions.length).toBeGreaterThanOrEqual(1);
    let viewState: ViewState = await iModel.views.load(viewDefinitions[0].id);
    expect(viewState).toEqual(expect.anything());
    expect(viewState.classFullName).toBe(OrthographicViewState.classFullName);
    expect(viewState.categorySelector.classFullName).toBe(CategorySelectorState.classFullName);
    expect(viewState.displayStyle.classFullName).toBe(DisplayStyle3dState.classFullName);
    expect(viewState).toBeInstanceOf(OrthographicViewState);
    expect(viewState.categorySelector).toBeInstanceOf(CategorySelectorState);
    expect(viewState.displayStyle).toBeInstanceOf(DisplayStyle3dState);
    expect((viewState as OrthographicViewState).modelSelector).toBeInstanceOf(ModelSelectorState);

    viewDefinitions = await iModel.views.getViewList({ from: "BisCore.DrawingViewDefinition" });
    expect(viewDefinitions.length).toBeGreaterThanOrEqual(1);
    viewState = await iModel.views.load(viewDefinitions[0].id);
    expect(viewState).toEqual(expect.anything());
    expect(viewState.code.value).toBe(viewDefinitions[0].name);
    expect(viewState.classFullName).toBe(viewDefinitions[0].class);
    expect(viewState.categorySelector.classFullName).toBe(CategorySelectorState.classFullName);
    expect(viewState.displayStyle.classFullName).toBe(DisplayStyle2dState.classFullName);
    expect(viewState).toBeInstanceOf(DrawingViewState);
    expect(viewState.categorySelector).toBeInstanceOf(CategorySelectorState);
    expect(viewState.displayStyle).toBeInstanceOf(DisplayStyle2dState);
    expect(iModel.projectExtents).toEqual(expect.anything());
  });

  it("should be able to open an IModel with no versions", async () => {
    const iTwinId = await TestUtility.queryITwinIdByName(TestUtility.testITwinName);
    const iModelId = await TestUtility.queryIModelIdByName(iTwinId, TestUtility.testIModelNames.noVersions);
    const noVersionsIModel = await CheckpointConnection.openRemote(iTwinId, iModelId);
    expect(noVersionsIModel).not.toBeNull();
    await noVersionsIModel.close();

    const noVersionsIModel2 = await CheckpointConnection.openRemote(iTwinId, iModelId);
    expect(noVersionsIModel2).not.toBeNull();
    await noVersionsIModel2.close();

    const noVersionsIModel3 = await CheckpointConnection.openRemote(iTwinId, iModelId, IModelVersion.asOfChangeSet(""));
    expect(noVersionsIModel3).not.toBeNull();
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
      expect(readOnlyTest).not.toBeNull();
      try {
        const promises = new Array<Promise<void>>();
        let n = 0;
        while (++n < 25) {
          const promise = CheckpointConnection.openRemote(iTwinId, iModelId)
            .then(async (readOnlyTest2: IModelConnection) => {
              try {
                expect(readOnlyTest2).not.toBeNull();
                expect(readOnlyTest.key === readOnlyTest2.key).toBe(true);
              } finally {
                await readOnlyTest2.close();
              }
            });
          promises.push(promise);
        }

        await Promise.all(promises);
      } finally {
        await readOnlyTest.close();
      }
    });
  }

  it("should be able to request tiles from an IModelConnection", async () => {
    const modelProps = await iModel.models.queryProps({ from: "BisCore.PhysicalModel" });
    expect(modelProps.length).toBe(1);

    const treeId = modelProps[0].id!.toString();
    const tree = await IModelApp.tileAdmin.requestTileTreeProps(iModel, treeId);

    expect(tree.id).toBe(modelProps[0].id);
    expect(tree.maxTilesToSkip).toBe(1);
    expect(tree.rootTile).not.toBeUndefined();

    const tf = Transform.fromJSON(tree.location);
    expect(tf.matrix.isIdentity).toBe(true);
    expect(tf.origin.isAlmostEqualXYZ(5.138785, 4.7847327, 10.15635152, 0.001)).toBe(true);

    const rootTile = tree.rootTile;
    expect(rootTile.contentId).toBe("0/0/0/0/1");

    const range = Range3d.fromJSON(rootTile.range);
    const expectedRange = { x: 35.285026, y: 35.118263, z: 10.157 };
    expect(range.low.isAlmostEqualXYZ(-expectedRange.x, -expectedRange.y, -expectedRange.z, 0.001)).toBe(true);
    expect(range.high.isAlmostEqualXYZ(expectedRange.x, expectedRange.y, expectedRange.z, 0.001)).toBe(true);

    // The following are not known until we load the tile content.
    expect(rootTile.contentRange).toBeUndefined();
    expect(rootTile.isLeaf).toBe(false);
  });

  it("should generate unique transient IDs", () => {
    for (let i = 1; i < 40; i++) {
      const id = iModel.transientIds.getNext();
      expect(Id64.getLocalId(id)).toBe(i); // auto-incrementing local ID beginning at 1
      expect(Id64.getBriefcaseId(id)).toBe(0xffffff); // illegal briefcase ID
      expect(Id64.isTransient(id)).toBe(true);
      expect(Id64.isTransient(id.toString())).toBe(true);
    }

    expect(Id64.isTransient(Id64.invalid)).toBe(false);
    expect(Id64.isTransient("0xffffff6789abcdef")).toBe(true);
  });

  it("should be able to retrieve schema metadata", async () => {
    expect(iModel.schemaContext).toEqual(expect.anything());
    const testKey = new SchemaKey("BisCore");
    const elem = await iModel.schemaContext.getSchema(testKey);
    expect(elem).toBeDefined();
  });

  it("should be able to use IModelApp.formatsProvider and format a quantity", async () => {
    const formatECName = "Formats.DefaultRealU";
    expect(IModelApp.formatsProvider).toBeDefined();
    const formatProps = await IModelApp.formatsProvider.getFormat(formatECName);
    expect(formatProps).toBeDefined();
    const persistenceUnitProps = await IModelApp.quantityFormatter.unitsProvider.findUnitByName("Units.M");
    const format = await Format.createFromJSON(formatECName, IModelApp.quantityFormatter.unitsProvider, formatProps!)
    const spec = await FormatterSpec.create(`${formatECName}_format_spec`, format, IModelApp.quantityFormatter.unitsProvider, persistenceUnitProps);
    const formattedValue = spec.applyFormatting(5.0);
    expect(formattedValue).toBe("5.0 m");
  });

  it("properly deserializes gcs latitude", async () => {
    const iTwinId = await TestUtility.getTestITwinId();
    const iModelId = await TestUtility.queryIModelIdByName(iTwinId, TestUtility.testIModelNames.smallTex);
    const smallTex = await CheckpointConnection.openRemote(iTwinId, iModelId);
    try {
      expect(smallTex.geographicCoordinateSystem?.horizontalCRS?.extent?.northEast.latitude).not.toBe(0);
    } finally {
      await smallTex.close();
    }
  });
});
