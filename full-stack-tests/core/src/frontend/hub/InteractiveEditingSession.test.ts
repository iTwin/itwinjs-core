/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { BeDuration, compareStrings, DbOpcode, Id64String, OpenMode, ProcessDetector } from "@bentley/bentleyjs-core";
import { IModelJson, LineSegment3d, Point3d, Range3d, Transform, YawPitchRollAngles } from "@bentley/geometry-core";
import { BatchType, Code, ElementGeometryChange, ElementsChanged } from "@bentley/imodeljs-common";
import {
  ElementEditor3d, GeometricModel3dState, IModelApp, IModelTileTree, IModelTileTreeParams, InteractiveEditingSession, RemoteBriefcaseConnection,
  TileLoadPriority,
} from "@bentley/imodeljs-frontend";
import { TestUsers } from "@bentley/oidc-signin-tool/lib/TestUsers";
import { TestUtility } from "./TestUtility";

const expect = chai.expect;
chai.use(chaiAsPromised);
let codeSuffix = 1;

/* eslint-disable deprecation/deprecation */

// The Web RPC protocol does not support Ipc required for interactive editing.
if (ProcessDetector.isElectronAppFrontend) {
  describe("InteractiveEditingSession (#integration)", () => {
    let briefcase: RemoteBriefcaseConnection | undefined;
    let imodelId: string;
    let projectId: string;

    async function closeIModel(): Promise<void> {
      if (briefcase) {
        await briefcase.close();
        briefcase = undefined;
      }
    }

    before(async () => {
      const projectName = "iModelJsIntegrationTest";
      await IModelApp.shutdown(); // we call ElectronApp.startup in _Setup.test.ts. Shutdown IModelApp so we can use new IModelAppOptions in call to startup below
      await IModelApp.startup({
        authorizationClient: await TestUtility.initializeTestProject(projectName, TestUsers.regular),
        imodelClient: TestUtility.imodelCloudEnv.imodelClient,
        applicationVersion: "1.2.1.1",
      });

      projectId = await TestUtility.getTestProjectId(projectName);
      imodelId = await TestUtility.createIModel(TestUtility.generateUniqueName("interactiveEditingSessionTest"), projectId, true);
    });

    beforeEach(async () => {
      briefcase = await RemoteBriefcaseConnection.open(projectId, imodelId, OpenMode.ReadWrite);
    });

    afterEach(async () => {
      await closeIModel();
    });

    after(async () => {
      await closeIModel();
      await TestUtility.deleteIModel(imodelId, projectId);
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
      code.value = (codeSuffix++).toString();

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
      expect(briefcase).not.to.be.undefined;
      const imodel = briefcase!;

      const editor = await ElementEditor3d.start(imodel);
      const modelId = await imodel.editing.models.createAndInsertPhysicalModel(await imodel.editing.codes.makeModelCode(imodel.models.repositoryModelId, "GeomChanges"));
      const dictModelId = await imodel.models.getDictionaryModel();
      const category = await imodel.editing.categories.createAndInsertSpatialCategory(dictModelId, "GeomChanges", { color: 0 });
      await imodel.saveChanges();
      await imodel.pushChanges("line 1"); // release locks

      // Begin an editing session.
      const session = await InteractiveEditingSession.begin(imodel);

      let changedElements: ElementsChanged;
      session.onElementChanges.addListener((ch) => changedElements = ch);

      async function expectChanges(expected: ElementGeometryChange[], compareRange = false): Promise<void> {

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
      await expectChanges([insertElem1]);
      expect(changedElements!.deleted).to.be.undefined;
      expect(changedElements!.updated).to.be.undefined;
      expect(changedElements!.inserted).to.not.be.undefined;

      // Modify the line element.
      await editor.startModifyingElements([elem1]);
      await editor.applyTransform(Transform.createTranslationXYZ(1, 0, 0).toJSON());
      await editor.write();
      const updateElem1 = makeUpdate(elem1);
      await expectChanges([insertElem1]);
      await imodel.saveChanges();
      await expectChanges([updateElem1]);

      // Modify the line element twice.
      await editor.startModifyingElements([elem1]);
      await editor.applyTransform(Transform.createTranslationXYZ(0, 1, 0).toJSON());
      await editor.write();
      await editor.startModifyingElements([elem1]);
      await editor.applyTransform(Transform.createTranslationXYZ(-1, 0, 0).toJSON());
      await editor.write();
      await expectChanges([updateElem1]);
      await imodel.saveChanges();
      await expectChanges([updateElem1]);

      // Insert a new line element, modify both elements, then delete the old line element.
      const elem2 = await createLineElement(editor, modelId, category, makeLine());
      await editor.startModifyingElements([elem1, elem2]);
      await editor.applyTransform(Transform.createTranslationXYZ(0, 0, 1).toJSON());
      await editor.write();
      await imodel.editing.deleteElements([elem1]);
      const deleteElem1 = makeDelete(elem1);
      const insertElem2 = makeInsert(elem2);
      await expectChanges([updateElem1]);
      await imodel.saveChanges();
      await expectChanges([deleteElem1, insertElem2]);

      // ###TODO: No frontend API for testing undo/redo...

      await imodel.pushChanges(""); // release locks
      await session.end();
      await editor.end();
    });

    it("updates state of tile trees", async () => {
      expect(briefcase).not.to.be.undefined;
      const imodel = briefcase!;

      // Initial geometric model contains one line element.
      const editor = await ElementEditor3d.start(imodel);
      const modelId = await imodel.editing.models.createAndInsertPhysicalModel(await imodel.editing.codes.makeModelCode(imodel.models.repositoryModelId, "TreeState"));
      const dictModelId = await imodel.models.getDictionaryModel();
      const category = await imodel.editing.categories.createAndInsertSpatialCategory(dictModelId, "TreeState", { color: 0 });
      const elem1 = await createLineElement(editor, modelId, category, makeLine(new Point3d(0, 0, 0), new Point3d(10, 0, 0)));
      await imodel.saveChanges();

      await imodel.models.load([modelId]);
      const model = imodel.models.getLoaded(modelId) as GeometricModel3dState;
      expect(model).not.to.be.undefined;
      const location = Transform.createTranslationXYZ(0, 0, 2);

      // NB: element ranges are minimum 1mm on each axis. Our line element is aligned to X axis.
      const modelRange = await model.queryModelRange();
      modelRange.low.y = modelRange.low.z = -0.0005;
      modelRange.high.y = modelRange.high.z = 0.0005;
      location.inverse()!.multiplyRange(modelRange, modelRange);

      function createTileTree(): IModelTileTree {
        const params: IModelTileTreeParams = {
          id: "",
          modelId,
          iModel: imodel,
          location,
          priority: TileLoadPriority.Primary,
          formatVersion: 14,
          contentRange: modelRange.clone(),
          options: {
            allowInstancing: true,
            edgesRequired: false,
            batchType: BatchType.Primary,
            is3d: true,
          },
          rootTile: {
            contentId: "",
            range: modelRange.toJSON(),
            contentRange: modelRange.toJSON(),
            maximumSize: 512,
            isLeaf: true,
          },
        };

        return new IModelTileTree(params);
      }

      const expectTreeState = async (tree: IModelTileTree | IModelTileTree[], expectedState: "static" | "interactive" | "dynamic" | "disposed", expectedHiddenElementCount: number, expectedRange: Range3d) => {
        // ###TODO: After we switch from polling for native events, we should not need to wait for changed events to be fetched here...
        const waitTime = 150;
        await BeDuration.wait(waitTime);

        const rangeTolerance = 0.0001;
        const treeList = tree instanceof IModelTileTree ? [tree] : tree;
        for (const t of treeList) {
          expect(t.tileState).to.equal(expectedState);
          expect(t.hiddenElements.length).to.equal(expectedHiddenElementCount);
          expect(t.rootTile.range.isAlmostEqual(expectedRange, rangeTolerance)).to.be.true;
          expect(t.rootTile.contentRange.isAlmostEqual(expectedRange, rangeTolerance)).to.be.true;
          expect(t.contentRange!.isAlmostEqual(expectedRange, rangeTolerance)).to.be.true;
        }
      };

      // No editing session currently active.
      const tree1 = createTileTree();
      expect(tree1.range.isAlmostEqual(modelRange)).to.be.true;
      await expectTreeState(tree1, "static", 0, modelRange);

      const tree0 = createTileTree();
      tree0.dispose();
      await expectTreeState(tree0, "disposed", 0, modelRange);

      // Begin an editing session.
      let session = await InteractiveEditingSession.begin(imodel);
      const trees = [tree1, createTileTree()];
      await expectTreeState(trees, "interactive", 0, modelRange);
      await expectTreeState(tree0, "disposed", 0, modelRange);

      // Insert a new element.
      const elem2 = await createLineElement(editor, modelId, category, makeLine(new Point3d(0, 0, 0), new Point3d(-10, 0, 0)));
      await imodel.saveChanges();

      // Newly-inserted elements don't exist in tiles, therefore don't need to be hidden.
      // ###TODO: Test changes to range and content range...
      trees.push(createTileTree());
      const range2 = modelRange.clone();
      range2.low.x = -10;
      await expectTreeState(tree0, "disposed", 0, modelRange);
      await expectTreeState(trees, "dynamic", 0, range2);

      // Modify an element.
      await editor.startModifyingElements([elem1]);
      await editor.applyTransform(Transform.createTranslationXYZ(0, 5, 0).toJSON());
      await editor.write();
      await imodel.saveChanges();

      const range3 = range2.clone();
      range3.high.y += 5;
      trees.push(createTileTree());
      await expectTreeState(tree0, "disposed", 0, modelRange);
      await expectTreeState(trees, "dynamic", 1, range3);

      // Delete the same element.
      await imodel.editing.deleteElements([elem1]);
      await imodel.saveChanges();
      trees.push(createTileTree());
      await expectTreeState(tree0, "disposed", 0, modelRange);
      await expectTreeState(trees, "dynamic", 1, range2);

      // Delete the other element.
      await imodel.editing.deleteElements([elem2]);
      await imodel.saveChanges();
      trees.push(createTileTree());
      await expectTreeState(tree0, "disposed", 0, modelRange);
      await expectTreeState(trees, "dynamic", 2, modelRange);

      // ###TODO: test undo/redo (no frontend API for that currently...)

      // Terminate the session.
      await session.end();
      trees.push(createTileTree());
      await expectTreeState(tree0, "disposed", 0, modelRange);
      await expectTreeState(trees, "static", 0, modelRange);

      // Restart session then terminate with no changes.
      session = await InteractiveEditingSession.begin(imodel);
      const tree2 = trees.pop()!;
      await expectTreeState(tree0, "disposed", 0, modelRange);
      await expectTreeState(trees, "interactive", 0, modelRange);
      tree2.dispose();
      await expectTreeState(tree2, "disposed", 0, modelRange);
      await session.end();
      await expectTreeState(trees, "static", 0, modelRange);

      for (const tree of trees) {
        tree.dispose();
        await expectTreeState(tree, "disposed", 0, modelRange);
      }

      await imodel.pushChanges(""); // release locks
      await editor.end();
    });
  });
}
