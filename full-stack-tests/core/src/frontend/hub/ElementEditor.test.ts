/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { IModelConnection, ElementEditor3d, IModelApp, IModelAppOptions, BeButtonEvent, Viewport } from "@bentley/imodeljs-frontend";
import { Code } from "@bentley/imodeljs-common";
import { Point3d, LineSegment3d, IModelJson, YawPitchRollAngles } from "@bentley/geometry-core";
import { OpenMode, Id64String } from "@bentley/bentleyjs-core";
import { TestUtility } from "./TestUtility";
import { TestUsers } from "./TestUsers";
import { PlacementTestTool } from "./TestPrimitiveTools";
import { LockLevel } from "@bentley/imodeljs-clients";

const testProjectName = "iModelJsIntegrationTest";
const testIModelName = "elementEditorTest";

function makeLine(p1?: Point3d, p2?: Point3d): LineSegment3d {
  return LineSegment3d.create(p1 || new Point3d(0, 0, 0), p2 || new Point3d(0, 0, 0));
}

async function countElementsInModel(iModel: IModelConnection, modelId: Id64String): Promise<number> {
  for await (const res of iModel.query("select count(*) as elementCount from bis.element where model.id = ?", [modelId])) {
    return parseInt(res.elementCount, 10);
  }
  return 0;
}

describe("Element editor tests (#integration)", async () => {
  let iModel: IModelConnection;
  let contextId: string;

  before(async () => {

    await TestUtility.initializeTestProject(testProjectName, TestUsers.regular);

    const options: IModelAppOptions = {
      authorizationClient: TestUtility.imodelCloudEnv.authorization,
      imodelClient: TestUtility.imodelCloudEnv.imodelClient,
    };
    IModelApp.startup(options);

    // NB: Call IModelApp.startup and set the authorizationClient *before* calling any other functions that might query the server.

    contextId = await TestUtility.getTestProjectId(testProjectName);

    const imodelId = await TestUtility.createIModel(testIModelName, contextId, true);
    assert.isTrue(imodelId !== undefined);
    assert.isTrue(imodelId !== "");

    iModel = await IModelConnection.open(contextId, imodelId, OpenMode.ReadWrite);
  });

  after(async () => {
    if (iModel) {
      await iModel.close();
    }
    IModelApp.shutdown();
  });

  it("ElementEditor3d test", async () => {
    const editor = await ElementEditor3d.start(iModel);

    const modelCode = await iModel.editing.codes.makeModelCode(iModel.models.repositoryModelId, "TestModel1");
    const model = await iModel.editing.models.createAndInsertPhysicalModel(modelCode);

    const dictionaryModelId = await iModel.models.getDictionaryModel();
    const category = await iModel.editing.categories.createAndInsertSpatialCategory(dictionaryModelId, "TestCategory1", { color: 0 });

    const line = makeLine();
    const geomprops = IModelJson.Writer.toIModelJson(line);
    const origin = line.point0Ref;
    const angles = new YawPitchRollAngles();
    const props3d = { classFullName: "Generic:PhysicalObject", model, category, code: Code.createEmpty() };
    await editor.createElement(props3d, origin, angles, geomprops);

    await editor.write();

    await editor.end();

    assert(await iModel.editing.hasUnsavedChanges());

    await iModel.saveChanges("create element test");

    assert.isTrue(await iModel.editing.hasPendingTxns());
    assert.isFalse(await iModel.editing.hasUnsavedChanges());

  });

  it("should run TestPrimitiveTool", async () => {
    // ------------- Set up test environment, including iModel, a model, and a (fake) Viewport ------------------

    // Create a model to work with
    const modelCode = await iModel.editing.codes.makeModelCode(iModel.models.repositoryModelId, "TestModel");
    const newModelId = await iModel.editing.models.createAndInsertPhysicalModel(modelCode);
    assert.isTrue(newModelId !== undefined);

    // mock a viewport ... just enough to make the Tool function
    const vp: Viewport = { view: { iModel } } as Viewport;

    const dictionaryModelId = await iModel.models.getDictionaryModel();
    const category = await iModel.editing.categories.createAndInsertSpatialCategory(dictionaryModelId, "TestPrimitiveToolCategory", { color: 0 });

    await iModel.saveChanges("create element test - model and category");

    assert.isTrue(await iModel.editing.hasPendingTxns());

    await iModel.editing.concurrencyControl.pullMergePush("create element test - model and category");

    // ------------- Set up and run the tool, as if a user executed the tool from a tool palette  ------------------

    //  --- Register
    const testNamespace = IModelApp.i18n.registerNamespace("TestApp");
    PlacementTestTool.register(testNamespace);

    //  --- Run
    assert.isTrue(IModelApp.tools.run("PlacementTestTool.Points"));
    assert.isTrue(IModelApp.toolAdmin.currentTool instanceof PlacementTestTool);
    const tool = IModelApp.toolAdmin.currentTool as PlacementTestTool;

    //  --- Auto-lock onto view and model
    assert.isUndefined(tool.targetModelId);
    tool.targetModelId = newModelId;

    assert.isUndefined(tool.targetView);
    tool.targetView = vp;

    //  -- Pretend user has picked a Category in ToolSettings or somewhere like that.
    IModelApp.toolAdmin.activeSettings.category = category;

    //  --- Simulate datapoints, reset, etc.
    assert.equal(0, await countElementsInModel(iModel, newModelId));

    const points: Point3d[] = [new Point3d(0, 0, 0), new Point3d(1, 0, 0)];

    assert.equal(await TestUtility.getModelLockLevel(iModel, tool.targetModelId!), LockLevel.None);   // Ask the iModel SERVER about the lock.

    await tool.onDataButtonDown(new BeButtonEvent({ point: points[0] }));

    assert.equal(await TestUtility.getModelLockLevel(iModel, tool.targetModelId!), LockLevel.Shared);

    await tool.onDataButtonDown(new BeButtonEvent({ point: points[1] }));

    assert.equal(await TestUtility.getModelLockLevel(iModel, tool.targetModelId!), LockLevel.Shared);

    await tool.onResetButtonUp(new BeButtonEvent({ point: points[1] }));

    assert.equal(1, await countElementsInModel(iModel, newModelId), "Tool should have added an element to the model");

    await iModel.saveChanges("create element test");

    assert.isTrue(await iModel.editing.hasPendingTxns());

    await iModel.editing.concurrencyControl.pullMergePush(tool.toolId);

    assert.isFalse(await iModel.editing.hasPendingTxns());

    assert.equal(await TestUtility.getModelLockLevel(iModel, tool.targetModelId!), LockLevel.None);
  });
});
