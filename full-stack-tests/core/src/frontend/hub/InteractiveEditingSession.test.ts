/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
const expect = chai.expect;
import * as path from "path";
import * as chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
import { BeDuration, DbOpcode, Id64String, OpenMode } from "@bentley/bentleyjs-core";
import { IModelJson, LineSegment3d, Point3d, YawPitchRollAngles } from "@bentley/geometry-core";
import { Code, ElementGeometryChange, IModelError } from "@bentley/imodeljs-common";
import { ElementEditor3d, IModelApp, IModelConnection, InteractiveEditingSession, RemoteBriefcaseConnection } from "@bentley/imodeljs-frontend";
import { TestUsers } from "@bentley/oidc-signin-tool/lib/TestUsers";
import { TestUtility } from "./TestUtility";

describe.only("InteractiveEditingSession (#integration)", () => {
  let imodel: RemoteBriefcaseConnection;
  let projectId: string;

  before(async () => {
    const projectName = "iModelJsIntegrationTest";
    await IModelApp.startup({
      authorizationClient: await TestUtility.initializeTestProject(projectName, TestUsers.regular),
      imodelClient: TestUtility.imodelCloudEnv.imodelClient,
      applicationVersion: "1.2.1.1",
    });

    projectId = await TestUtility.getTestProjectId(projectName);
    const imodelId = await TestUtility.createIModel("interactiveEditingSessionTest", projectId, true);
    imodel = await RemoteBriefcaseConnection.open(projectId, imodelId, OpenMode.ReadWrite);
  });

  after(async () => {
    if (imodel)
      await imodel.close();

    await IModelApp.shutdown();
  });

  function makeLine(p1?: Point3d, p2?: Point3d): LineSegment3d {
    return LineSegment3d.create(p1 || new Point3d(0, 0, 0), p2 || new Point3d(0, 0, 0));
  }

  async function createLineElement(editor: ElementEditor3d, model: Id64String, category: Id64String, line: LineSegment3d): Promise<Id64String> {
    const geomprops = IModelJson.Writer.toIModelJson(line);
    const origin = line.point0Ref;
    const angles = new YawPitchRollAngles();
    const code = Code.createEmpty();

    const props3d = { classFullName: "Generic:PhysicalObject", model, category, code };
    await editor.createElement(props3d, origin, angles, geomprops);

    const props = await editor.writeReturningProps();
    expect(Array.isArray(props)).to.be.true;
    expect(props.length).to.equal(1);
    expect(props[0].id).not.to.be.undefined;

    return props[0].id!;
  }

  it("accumulates geometry changes", async () => {
    // Create an empty physical model.
    const editor = await ElementEditor3d.start(imodel);
    const modelId = await imodel.editing.models.createAndInsertPhysicalModel(await imodel.editing.codes.makeModelCode(imodel.models.repositoryModelId, "Geom"));
    const dictModelId = await imodel.models.getDictionaryModel();
    const category = await imodel.editing.categories.createAndInsertSpatialCategory(dictModelId, "Geom",  { color: 0 });
    await imodel.saveChanges();
    await imodel.pushChanges("line 1"); // release locks

    // Begin an editing session.
    const session = await InteractiveEditingSession.begin(imodel);

    // Insert a line element.
    expect(session.getGeometryChangesForModel(modelId)).to.be.undefined;
    const elem1 = await createLineElement(editor, modelId, category, makeLine());
    await imodel.saveChanges();

    // ###TODO: After we switch from polling for native events, we should not need to wait for changed event here...
    await BeDuration.wait(IModelApp.eventSourceOptions.pollInterval * 2);
    const changes = session.getGeometryChangesForModel(modelId)!;
    expect(changes).not.to.be.undefined;

    let change: ElementGeometryChange | undefined;
    for (const entry of changes) {
      expect(change).to.be.undefined;
      change = entry;
    }

    expect(change).not.to.be.undefined;
    expect(change!.id).to.equal(elem1);
    expect(change!.type).to.equal(DbOpcode.Insert);

    await session.end();
    await editor.end();
  });
});
