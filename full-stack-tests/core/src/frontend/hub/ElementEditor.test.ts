/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Id64Array, Id64String, OpenMode } from "@bentley/bentleyjs-core";
import { IModelJson, LineSegment3d, Point3d, YawPitchRollAngles } from "@bentley/geometry-core";
import { LockLevel } from "@bentley/imodelhub-client";
import { BisCodeSpec, Code, CodeProps } from "@bentley/imodeljs-common";
import {
  BeButtonEvent, ElementEditor3d, IModelApp, IModelAppOptions, IModelConnection, RemoteBriefcaseConnection,
} from "@bentley/imodeljs-frontend";
import { TestUsers } from "@bentley/oidc-signin-tool/lib/TestUsers";
import { PlacementTestTool } from "./TestPrimitiveTools";
import { TestUtility } from "./TestUtility";

const testProjectName = "iModelJsIntegrationTest";
const testIModelName = "elementEditorTest";

function makeLine(p1?: Point3d, p2?: Point3d): LineSegment3d {
  return LineSegment3d.create(p1 || new Point3d(0, 0, 0), p2 || new Point3d(0, 0, 0));
}

async function createLine(editor: ElementEditor3d, model: Id64String, category: Id64String, line: LineSegment3d, parentId?: string, code?: CodeProps): Promise<void> {
  const geomprops = IModelJson.Writer.toIModelJson(line);
  const origin = line.point0Ref;
  const angles = new YawPitchRollAngles();
  if (code === undefined)
    code = Code.createEmpty();
  const props3d = { classFullName: "Generic:PhysicalObject", model, category, code };
  if (parentId !== undefined)
    (props3d as any).parent = { id: parentId, relClassName: "bis.ElementOwnsChildElements" };
  return editor.createElement(props3d, origin, angles, geomprops);
}

async function createAssembly(editor: ElementEditor3d, model: Id64String, category: Id64String, parentCode: CodeProps): Promise<Id64String> {
  await createLine(editor, model, category, makeLine(), undefined, parentCode);
  const parentProps = await editor.writeReturningProps();
  assert.isArray(parentProps);
  assert.equal(parentProps.length, 1);
  assert.isTrue(Code.equalCodes(parentProps[0].code, parentCode));
  assert.equal(parentProps[0].category, category);
  const parentId = parentProps[0].id;

  assert.isTrue(parentId !== undefined);

  await createLine(editor, model, category, makeLine(), parentId);  // add two children
  await createLine(editor, model, category, makeLine(), parentId);

  await editor.write();

  return parentId!;
}

/* eslint-disable deprecation/deprecation */
async function checkAssembly(iModel: RemoteBriefcaseConnection, parentId: Id64String, nExpected: number[]): Promise<Id64Array> {
  await iModel.saveChanges(""); // TODO: Move this after select statement when we fix the problem with querying uncommitted changes

  const nParentQres = await iModel.queryRows("select count(*) as n from bis.GeometricElement3d where ecinstanceid=?", [parentId]);
  assert.equal(nParentQres.rows[0].n, nExpected[0]);

  const childrenQres = await iModel.queryRows("select ecinstanceid as id from bis.GeometricElement3d where parent.id=?", [parentId]);
  assert.equal(childrenQres.rows.length, nExpected[1]);

  return childrenQres.rows.map((row) => row.id);
}

async function countElementsInModel(iModel: IModelConnection, modelId: Id64String): Promise<number> {
  for await (const res of iModel.query("select count(*) as elementCount from bis.element where model.id = ?", [modelId])) {
    return parseInt(res.elementCount, 10);
  }
  return 0;
}

describe("Element editor tests (#integration)", async () => {
  let iModel: RemoteBriefcaseConnection;
  let contextId: string;

  before(async () => {

    const authorizationClient = await TestUtility.initializeTestProject(testProjectName, TestUsers.regular);

    const options: IModelAppOptions = {
      authorizationClient,
      imodelClient: TestUtility.imodelCloudEnv.imodelClient,
      applicationVersion: "1.2.1.1",
    };
    await IModelApp.shutdown();
    await IModelApp.startup(options);

    // NB: Call IModelApp.startup and set the authorizationClient *before* calling any other functions that might query the server.

    contextId = await TestUtility.getTestProjectId(testProjectName);

    const imodelId = await TestUtility.createIModel(TestUtility.generateUniqueName(testIModelName), contextId, true);
    assert.isTrue(imodelId !== undefined);
    assert.isTrue(imodelId !== "");

    iModel = await RemoteBriefcaseConnection.open(contextId, imodelId, OpenMode.ReadWrite);
  });

  after(async () => {
    if (iModel) {
      await iModel.close();
      await TestUtility.deleteIModel(iModel.iModelId, iModel.contextId);
    }
    await IModelApp.shutdown();
  });

  it("ElementEditor3d test", async () => {
    const editor = await ElementEditor3d.start(iModel);

    const modelCode = await iModel.editing.codes.makeModelCode(iModel.models.repositoryModelId, "TestModel1");
    const model = await iModel.editing.models.createAndInsertPhysicalModel(modelCode);

    const dictionaryModelId = await iModel.models.getDictionaryModel();
    const category = await iModel.editing.categories.createAndInsertSpatialCategory(dictionaryModelId, "TestCategory1", { color: 0 });

    await createLine(editor, model, category, makeLine());

    await editor.write();

    await editor.end();

    assert(await iModel.editing.hasUnsavedChanges());

    await iModel.saveChanges("create element test"); // TODO: Move this after select statement when we fix the problem with querying uncommitted changes

    const qres = await iModel.queryRows("select count(*) as n from bis.GeometricElement3d");
    assert.equal(qres.rows[0].n, 1);

    assert.isTrue(await iModel.editing.hasPendingTxns());
    assert.isFalse(await iModel.editing.hasUnsavedChanges());

  });

  it("ElementEditor3d test create and delete assembly", async () => {
    const editor = await ElementEditor3d.start(iModel);

    const modelCode = await iModel.editing.codes.makeModelCode(iModel.models.repositoryModelId, "TestAssembly");
    const model = await iModel.editing.models.createAndInsertPhysicalModel(modelCode);

    const dictionaryModelId = await iModel.models.getDictionaryModel();
    const category = await iModel.editing.categories.createAndInsertSpatialCategory(dictionaryModelId, "TestAssembly", { color: 0 });

    const parentCode = await iModel.editing.codes.makeCode(BisCodeSpec.nullCodeSpec, iModel.elements.rootSubjectId, "assembly-parent");
    let parentId = await createAssembly(editor, model, category, parentCode);
    await checkAssembly(iModel, parentId, [1, 2]);
    await iModel.pushChanges(""); // (release locks)

    // Now delete the assembly. Specify only the parent. The children should be deleted as a side-effect of that.
    // The editing API should take care of obtaining all needed locks.
    await iModel.editing.deleteElements([parentId]);
    await iModel.saveChanges(); // TODO: remove this when we fix the problem with querying uncommitted changes
    await checkAssembly(iModel, parentId, [0, 0]);
    await iModel.pushChanges(""); // (release locks)

    // Create another assembly.
    // This time, delete the parent and both children explicitly. That should be tolerated and not throw an error, even
    // though deleting the parent automatically deletes the children.
    const parentCode2 = await iModel.editing.codes.makeCode(BisCodeSpec.nullCodeSpec, iModel.elements.rootSubjectId, "assembly-parent2");
    parentId = await createAssembly(editor, model, category, parentCode2);
    let childIds = await checkAssembly(iModel, parentId, [1, 2]);
    await iModel.editing.deleteElements([parentId, ...childIds]);
    await iModel.saveChanges(); // TODO: remove this when we fix the problem with querying uncommitted changes
    await checkAssembly(iModel, parentId, [0, 0]);
    await iModel.pushChanges(""); // (release locks)

    // Create another assembly.
    // This time, delete the one of the children explicitly and not the parent. That should
    // leave the rest of the assy intact.
    const parentCode3 = await iModel.editing.codes.makeCode(BisCodeSpec.nullCodeSpec, iModel.elements.rootSubjectId, "assembly-parent3");
    parentId = await createAssembly(editor, model, category, parentCode3);
    childIds = await checkAssembly(iModel, parentId, [1, 2]);
    await iModel.editing.deleteElements([childIds[0]]);
    await iModel.saveChanges(); // TODO: remove this when we fix the problem with querying uncommitted changes
    await checkAssembly(iModel, parentId, [1, 1]);
    await iModel.pushChanges(""); // (release locks)
  });

  it("should run TestPrimitiveTool", async () => {
    const modelCode = await iModel.editing.codes.makeModelCode(iModel.models.repositoryModelId, "TestModel");
    const newModelId = await iModel.editing.models.createAndInsertPhysicalModel(modelCode);
    assert.isTrue(newModelId !== undefined);

    const dictionaryModelId = await iModel.models.getDictionaryModel();
    const category = await iModel.editing.categories.createAndInsertSpatialCategory(dictionaryModelId, "TestPrimitiveToolCategory", { color: 0 });

    await iModel.saveChanges("create element test - model and category");

    assert.isTrue(await iModel.editing.hasPendingTxns());
    await iModel.pushChanges("create element test - model and category"); // (release locks)

    // ------------- Set up and run the tool, as if a user executed it from a tool palette  ------------------

    //  --- Register
    const testNamespace = IModelApp.i18n.registerNamespace("TestApp");
    PlacementTestTool.register(testNamespace);

    //  --- Run
    assert.isTrue(IModelApp.tools.run("PlacementTestTool.Points"));
    assert.isTrue(IModelApp.toolAdmin.currentTool instanceof PlacementTestTool);
    const tool = IModelApp.toolAdmin.currentTool as PlacementTestTool;

    // Pretend user has picked a target view, model, and Category
    assert.isUndefined(tool.targetModelId);
    tool.targetModelId = newModelId;

    assert.isUndefined(tool.targetView);
    tool.targetView = { view: { iModel } } as any; // mock a viewport, just enough to make the Tool function
    IModelApp.toolAdmin.activeSettings.category = category;

    //  --- Simulate datapoints, reset, etc.
    assert.equal(0, await countElementsInModel(iModel, newModelId));

    const points: Point3d[] = [new Point3d(0, 0, 0), new Point3d(1, 0, 0)];

    assert.equal(await TestUtility.getModelLockLevel(iModel, tool.targetModelId), LockLevel.None);   // Ask the iModel SERVER about the lock.

    await tool.onDataButtonDown(new BeButtonEvent({ point: points[0] }));

    assert.equal(await TestUtility.getModelLockLevel(iModel, tool.targetModelId), LockLevel.Shared);

    await tool.onDataButtonDown(new BeButtonEvent({ point: points[1] }));

    assert.equal(await TestUtility.getModelLockLevel(iModel, tool.targetModelId), LockLevel.Shared);

    await tool.onResetButtonUp(new BeButtonEvent({ point: points[1] }));

    assert.equal(1, await countElementsInModel(iModel, newModelId), "Tool should have added an element to the model");

    await iModel.saveChanges("create element test");

    assert.isTrue(await iModel.editing.hasPendingTxns());

    await iModel.pushChanges(tool.toolId); // (release locks)

    assert.isFalse(await iModel.editing.hasPendingTxns());

    assert.equal(await TestUtility.getModelLockLevel(iModel, tool.targetModelId), LockLevel.None);
  });
});
