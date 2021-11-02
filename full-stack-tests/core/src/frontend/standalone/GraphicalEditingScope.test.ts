/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as path from "path";
import { BeDuration, compareStrings, DbOpcode, Guid, Id64String, OpenMode, ProcessDetector } from "@itwin/core-bentley";
import { Point3d, Range3d, Transform } from "@itwin/core-geometry";
import { BatchType, ChangedEntities, ElementGeometryChange, IModelError } from "@itwin/core-common";
import {
  BriefcaseConnection, GeometricModel3dState, GraphicalEditingScope, IModelTileTree, IModelTileTreeParams, TileLoadPriority,
} from "@itwin/core-frontend";
import { callFullStackTestIpc, deleteElements, initializeEditTools, insertLineElement, makeLineSegment, makeModelCode, transformElements } from "../Editing";
import { TestUtility } from "../TestUtility";

const expect = chai.expect;
chai.use(chaiAsPromised);

const dummyRange = new Range3d();
function makeInsert(id: Id64String, range?: Range3d): ElementGeometryChange { return { id, type: DbOpcode.Insert, range: (range ?? dummyRange) }; }
function makeUpdate(id: Id64String, range?: Range3d): ElementGeometryChange { return { id, type: DbOpcode.Update, range: (range ?? dummyRange) }; }
function makeDelete(id: Id64String): ElementGeometryChange { return { id, type: DbOpcode.Delete }; }

describe("GraphicalEditingScope", () => {
  if (ProcessDetector.isElectronAppFrontend) {
    let imodel: BriefcaseConnection | undefined;
    // Editable; BisCore version < 1.0.11
    const oldFilePath = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/cjs/test/assets/test.bim");
    // Editable; BisCore version == 1.0.11
    const newFilePath = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/cjs/test/assets/planprojection.bim");

    async function closeIModel(): Promise<void> {
      if (imodel) {
        await imodel.close();
        imodel = undefined;
      }
    }

    before(async () => {
      await TestUtility.startFrontend();
      await initializeEditTools();
    });

    after(async () => {
      await closeIModel();
      await TestUtility.shutdownFrontend();
    });

    afterEach(async () => {
      await closeIModel();
    });

    it("should not be supported for read-only connections", async () => {
      imodel = await BriefcaseConnection.openStandalone(oldFilePath, OpenMode.Readonly);
      expect(imodel.openMode).to.equal(OpenMode.Readonly);
      expect(await imodel.supportsGraphicalEditing()).to.be.false;
      await expect(imodel.enterEditingScope()).to.be.rejectedWith(IModelError);
    });

    it("should not be supported for iModels with BisCore < 1.0.11", async () => {
      imodel = await BriefcaseConnection.openStandalone(oldFilePath);
      expect(imodel.openMode).to.equal(OpenMode.ReadWrite);
      expect(await imodel.supportsGraphicalEditing()).to.be.false;
      await expect(imodel.enterEditingScope()).to.be.rejectedWith(IModelError);
    });

    it("should not be supported for read-only iModels with BisCore >= 1.0.11", async () => {
      imodel = await BriefcaseConnection.openStandalone(newFilePath, OpenMode.Readonly);
      expect(imodel.openMode).to.equal(OpenMode.Readonly);
      expect(await imodel.supportsGraphicalEditing()).to.be.false;
      await expect(imodel.enterEditingScope()).to.be.rejectedWith(IModelError);
    });

    it("should be supported for writable iModels with BisCore >= 1.0.11", async () => {
      imodel = await BriefcaseConnection.openStandalone(newFilePath, OpenMode.ReadWrite);
      expect(imodel.openMode).to.equal(OpenMode.ReadWrite);
      expect(await imodel.supportsGraphicalEditing()).to.be.true;
      const scope = await imodel.enterEditingScope();
      expect(imodel.editingScope).to.equal(scope);
      await scope.exit();
      expect(imodel.editingScope).to.be.undefined;
    });

    async function openWritable(): Promise<BriefcaseConnection> {
      expect(imodel).to.be.undefined;
      return BriefcaseConnection.openStandalone(newFilePath, OpenMode.ReadWrite);
    }

    it("throws if enter is called repeatedly", async () => {
      imodel = await openWritable();
      const scope = await imodel.enterEditingScope();
      await expect(imodel.enterEditingScope()).to.be.rejectedWith("Cannot create an editing scope for an iModel that already has one");
      await scope.exit();
    });

    it("throws if exit is called repeatedly", async () => {
      imodel = await openWritable();
      const scope = await imodel.enterEditingScope();
      await scope.exit();
      await expect(scope.exit()).to.be.rejectedWith("Cannot exit editing scope after it is disconnected from the iModel");
    });

    it("exits the scope when closing the iModel", async () => {
      imodel = await openWritable();
      const scope = await imodel.enterEditingScope();
      expect(imodel.editingScope).to.equal(scope);
      expect(scope.isDisposed).to.be.false;
      await imodel.close();
      expect(scope.isDisposed).to.be.true;
      expect(imodel.editingScope).to.be.undefined;
    });

    it("dispatches events when scopes enter or exit", async () => {
      imodel = await openWritable();

      let beginCount = 0;
      const removeBeginListener = GraphicalEditingScope.onEnter.addListener(() => ++beginCount);

      const scope = await imodel.enterEditingScope();
      expect(beginCount).to.equal(1);

      let endingCount = 0;
      let endCount = 0;
      const removeEndingListener = scope.onExiting.addListener(() => ++endingCount);
      const removeEndListener = scope.onExited.addListener(() => ++endCount);

      const endPromise = scope.exit();
      expect(endingCount).to.equal(1);
      expect(endCount).to.equal(0);

      await endPromise;
      expect(endCount).to.equal(1);

      removeBeginListener();
      removeEndListener();
      removeEndingListener();
    });

    it("accumulates geometry changes", async () => {
      imodel = await openWritable();
      const modelId = await callFullStackTestIpc("createAndInsertPhysicalModel", imodel.key, (await makeModelCode(imodel, imodel.models.repositoryModelId, Guid.createValue())));
      const dictModelId = await imodel.models.getDictionaryModel();
      const category = await callFullStackTestIpc("createAndInsertSpatialCategory", imodel.key, dictModelId, Guid.createValue(), { color: 0 });
      await imodel.saveChanges();

      // Enter an editing scope.
      const scope = await imodel.enterEditingScope();

      let changedElements: ChangedEntities;
      imodel.txns.onElementsChanged.addListener((ch) => {
        changedElements = ch;
      });

      function expectChanges(expected: ElementGeometryChange[], compareRange = false): void {
        const changes = scope.getGeometryChangesForModel(modelId);
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
      expect(scope.getGeometryChangesForModel(modelId)).to.be.undefined;
      const elem1 = await insertLineElement(imodel, modelId, category);
      // Events not dispatched until changes saved.
      await imodel.saveChanges();
      const insertElem1 = makeInsert(elem1);
      expectChanges([insertElem1]);
      expect(changedElements!.deleted).to.be.undefined;
      expect(changedElements!.updated).to.be.undefined;
      expect(changedElements!.inserted).to.not.be.undefined;

      // Modify the line element.
      await transformElements(imodel, [elem1], Transform.createTranslationXYZ(1, 0, 0));
      const updateElem1 = makeUpdate(elem1);
      await imodel.saveChanges();
      expectChanges([updateElem1]);

      // Modify the line element twice.
      await transformElements(imodel, [elem1], Transform.createTranslationXYZ(0, 1, 0));
      await transformElements(imodel, [elem1], Transform.createTranslationXYZ(-1, 0, 0));
      await imodel.saveChanges();
      expectChanges([updateElem1]);

      // Insert a new line element, modify both elements, then delete the old line element.
      const elem2 = await insertLineElement(imodel, modelId, category);
      await transformElements(imodel, [elem1, elem2], Transform.createTranslationXYZ(0, 0, 1));
      await deleteElements(imodel, [elem1]);
      const deleteElem1 = makeDelete(elem1);
      const insertElem2 = makeInsert(elem2);
      await imodel.saveChanges();
      expectChanges([deleteElem1, insertElem2]);

      // Undo
      // NOTE: Elements do not get removed from the set returned by getGeometryChangedForModel -
      // but their state may change (e.g. from "insert" to "delete") as a result of undo/redo/
      const isUndoPossible = await imodel.txns.isUndoPossible();
      expect(isUndoPossible).to.be.true;

      const undo = async () => imodel!.txns.reverseSingleTxn();
      await imodel.txns.reverseSingleTxn();
      const deleteElem2 = makeDelete(elem2);
      expectChanges([insertElem1, deleteElem2]);

      await undo();
      expectChanges([updateElem1, deleteElem2]);

      await undo();
      expectChanges([updateElem1, deleteElem2]);

      await undo();
      expectChanges([deleteElem1, deleteElem2]);

      // Redo
      const redo = async () => imodel!.txns.reinstateTxn();
      await redo();
      expectChanges([insertElem1, deleteElem2]);

      await redo();
      expectChanges([updateElem1, deleteElem2]);

      await redo();
      expectChanges([updateElem1, deleteElem2]);

      await redo();
      expectChanges([deleteElem1, insertElem2]);
      await scope.exit();
    });

    it("updates state of tile trees", async () => {
      imodel = await openWritable();

      // Initial geometric model contains one line element.
      const modelId = await callFullStackTestIpc("createAndInsertPhysicalModel", imodel.key, (await makeModelCode(imodel, imodel.models.repositoryModelId, Guid.createValue())));
      const dictModelId = await imodel.models.getDictionaryModel();
      const category = await callFullStackTestIpc("createAndInsertSpatialCategory", imodel.key, dictModelId, Guid.createValue(), { color: 0 });
      const elem1 = await insertLineElement(imodel, modelId, category, makeLineSegment(new Point3d(0, 0, 0), new Point3d(10, 0, 0)));
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
          iModel: imodel!,
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

        return new IModelTileTree(params, { edgesRequired: false, type: BatchType.Primary });
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

      // No editing scope currently active.
      const tree1 = createTileTree();
      expect(tree1.range.isAlmostEqual(modelRange)).to.be.true;
      await expectTreeState(tree1, "static", 0, modelRange);

      const tree0 = createTileTree();
      tree0.dispose();
      await expectTreeState(tree0, "disposed", 0, modelRange);

      // Enter an editing scope.
      let scope = await imodel.enterEditingScope();
      const trees = [tree1, createTileTree()];
      await expectTreeState(trees, "interactive", 0, modelRange);
      await expectTreeState(tree0, "disposed", 0, modelRange);

      // Insert a new element.
      const elem2 = await insertLineElement(imodel, modelId, category, makeLineSegment(new Point3d(0, 0, 0), new Point3d(-10, 0, 0)));
      await imodel.saveChanges();

      // Newly-inserted elements don't exist in tiles, therefore don't need to be hidden.
      // ###TODO: Test changes to range and content range...
      trees.push(createTileTree());
      const range2 = modelRange.clone();
      range2.low.x = -10;
      await expectTreeState(tree0, "disposed", 0, modelRange);
      await expectTreeState(trees, "dynamic", 0, range2);

      // Modify an element.
      await transformElements(imodel, [elem1], Transform.createTranslationXYZ(0, 5, 0));
      await imodel.saveChanges();

      const range3 = range2.clone();
      range3.high.y += 5;
      trees.push(createTileTree());
      await expectTreeState(tree0, "disposed", 0, modelRange);
      await expectTreeState(trees, "dynamic", 1, range3);

      // Delete the same element.
      await deleteElements(imodel, [elem1]);
      await imodel.saveChanges();
      trees.push(createTileTree());
      await expectTreeState(tree0, "disposed", 0, modelRange);
      await expectTreeState(trees, "dynamic", 1, range2);

      // Delete the other element.
      await deleteElements(imodel, [elem2]);
      await imodel.saveChanges();
      trees.push(createTileTree());
      await expectTreeState(tree0, "disposed", 0, modelRange);
      await expectTreeState(trees, "dynamic", 2, modelRange);

      // ###TODO: test undo/redo (no frontend API for that currently...)

      // Terminate the scope.
      await scope.exit();
      trees.push(createTileTree());
      await expectTreeState(tree0, "disposed", 0, modelRange);
      await expectTreeState(trees, "static", 0, modelRange);

      // Restart scope then terminate with no changes.
      scope = await imodel.enterEditingScope();
      const tree2 = trees.pop()!;
      await expectTreeState(tree0, "disposed", 0, modelRange);
      await expectTreeState(trees, "interactive", 0, modelRange);
      tree2.dispose();
      await expectTreeState(tree2, "disposed", 0, modelRange);
      await scope.exit();
      await expectTreeState(trees, "static", 0, modelRange);

      for (const tree of trees) {
        tree.dispose();
        await expectTreeState(tree, "disposed", 0, modelRange);
      }
    });
  }
});
