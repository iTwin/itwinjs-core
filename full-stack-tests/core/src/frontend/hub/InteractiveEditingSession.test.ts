/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
const expect = chai.expect;
import * as path from "path";
import * as chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
import { BeDuration, compareStrings, DbOpcode, Id64String, OpenMode } from "@bentley/bentleyjs-core";
import { IModelJson, LineSegment3d, Point3d, Range3d, Transform, YawPitchRollAngles } from "@bentley/geometry-core";
import { Code, ElementGeometryChange, IModelError } from "@bentley/imodeljs-common";
import { ElementEditor3d, IModelApp, IModelConnection, InteractiveEditingSession, RemoteBriefcaseConnection } from "@bentley/imodeljs-frontend";
import { TestUsers } from "@bentley/oidc-signin-tool/lib/TestUsers";
import { TestUtility } from "./TestUtility";

describe("InteractiveEditingSession (#integration)", () => {
  let imodel: RemoteBriefcaseConnection;
  let projectId: string;

  before(async () => {
    const projectName = "iModelJsIntegrationTest";
    await IModelApp.startup({
      authorizationClient: await TestUtility.initializeTestProject(projectName, TestUsers.regular),
      imodelClient: TestUtility.imodelCloudEnv.imodelClient,
      applicationVersion: "1.2.1.1",
    });

    IModelApp.eventSourceOptions.pollInterval = 10;

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

  const dummyRange = new Range3d();
  function makeInsert(id: Id64String, range?: Range3d): ElementGeometryChange { return { id, type: DbOpcode.Insert, range: (range ?? dummyRange) }; }
  function makeUpdate(id: Id64String, range?: Range3d): ElementGeometryChange { return { id, type: DbOpcode.Update, range: (range ?? dummyRange) }; }
  function makeDelete(id: Id64String): ElementGeometryChange { return { id, type: DbOpcode.Delete }; }

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

    async function expectChanges(expected: ElementGeometryChange[], compareRange = false): Promise<void> {
      // ###TODO: After we switch from polling for native events, we should not need to wait for changed events to be fetched here...
      const waitTime = 150;
      await BeDuration.wait(waitTime);

      const changes = session.getGeometryChangesForModel(modelId);
      expect(undefined === changes).to.equal(expected.length === 0);
      if (changes) {
        const actual = Array.from(changes).sort((x, y) => compareStrings(x.id, y.id));
        if (compareRange) {
          expect(actual).to.deep.equal(expected);
        } else {
          expect(actual.length).to.equal(expected.length);
          for (let i = 0; i < actual.length; i++) {
            expect(actual[i].id).to.equal(expected[i].id);
            expect(actual[i].type).to.equal(expected[i].type);
          }
        }
      }
    }

    // Insert a line element.
    expect(session.getGeometryChangesForModel(modelId)).to.be.undefined;
    const elem1 = await createLineElement(editor, modelId, category, makeLine());
    // Events not dispatched until changes saved.
    await expectChanges([]);
    await imodel.saveChanges();
    const insertElem1 = makeInsert(elem1);
    await expectChanges([ insertElem1 ]);

    // Modify the line element.
    await editor.startModifyingElements([ elem1 ]);
    await editor.applyTransform(Transform.createTranslationXYZ(1, 0, 0));
    await editor.write();
    const updateElem1 = makeUpdate(elem1);
    await expectChanges([ insertElem1 ]);
    await imodel.saveChanges();
    await expectChanges([ updateElem1 ]);

    // Modify the line element twice.
    await editor.startModifyingElements([ elem1 ]);
    await editor.applyTransform(Transform.createTranslationXYZ(0, 1, 0));
    await editor.write();
    await editor.startModifyingElements([ elem1 ]);
    await editor.applyTransform(Transform.createTranslationXYZ(-1, 0, 0));
    await editor.write();
    await expectChanges([ updateElem1 ]);
    await imodel.saveChanges();
    await expectChanges([ updateElem1 ]);

    // Insert a new line element, modify both elements, then delete the old line element.
    const elem2 = await createLineElement(editor, modelId, category, makeLine());
    await editor.startModifyingElements([ elem1, elem2 ]);
    await editor.applyTransform(Transform.createTranslationXYZ(0, 0, 1));
    await editor.write();
    await imodel.editing.deleteElements([ elem1 ]);
    const deleteElem1 = makeDelete(elem1);
    const insertElem2 = makeInsert(elem2);
    await expectChanges([ updateElem1 ]);
    await imodel.saveChanges();
    await expectChanges([ deleteElem1, insertElem2 ]);

    // ###TODO: No frontend API for testing undo/redo...

    await imodel.pushChanges(""); // release locks
    await session.end();
    await editor.end();
  });
});
