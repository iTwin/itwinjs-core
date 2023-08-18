/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as path from "path";
import { Guid, Id64, OpenMode, ProcessDetector } from "@itwin/core-bentley";
import { ColorDef, ElementAlignedBox3d, PackedFeature, RenderFeatureTable } from "@itwin/core-common";
import { Point3d, Transform } from "@itwin/core-geometry";
import {
  BriefcaseConnection, GeometricModelState, IModelApp, MockRender, RenderGraphic, TileTree, ViewCreator3d,
} from "@itwin/core-frontend";
import { coreFullStackTestIpc, deleteElements, initializeEditTools, insertLineStringElement, makeModelCode, transformElements } from "../Editing";
import { TestUtility } from "../TestUtility";

class System extends MockRender.System {
  public readonly batchElementIds = new Set<string>();

  public static get() {
    expect(IModelApp.renderSystem).instanceof(System);
    return IModelApp.renderSystem as System;
  }

  public override createBatch(graphic: RenderGraphic, features: RenderFeatureTable, range: ElementAlignedBox3d) {
    this.batchElementIds.clear();

    const packedFeature = PackedFeature.createWithIndex();
    for (const feature of features.iterable(packedFeature))
      this.batchElementIds.add(Id64.fromUint32PairObject(feature.elementId));

    return super.createBatch(graphic, features, range);
  }
}

for (const watchForChanges of [false, true]) {
  describe(`watchForChanges (${watchForChanges})`, () => {
    if (ProcessDetector.isMobileAppFrontend)
      return;

    let rwConn: BriefcaseConnection;
    let roConn: BriefcaseConnection;
    let modelId: string;
    let categoryId: string;
    let elemId: string;
    let projCenter: Point3d;

    before(async () => {
      const mockRender = true;
      const enableWebEdit = true;
      TestUtility.systemFactory = () => new System();
      await TestUtility.startFrontend(undefined, mockRender, enableWebEdit);
      await initializeEditTools();
    });

    after(async () => TestUtility.shutdownFrontend());

    beforeEach(async () => {
      const filePath = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/cjs/test/assets/planprojection.bim");

      // Populate the iModel with some initial geometry.
      rwConn = await BriefcaseConnection.openStandalone(filePath, OpenMode.ReadWrite);
      modelId = await coreFullStackTestIpc.createAndInsertPhysicalModel(rwConn.key, (await makeModelCode(rwConn, rwConn.models.repositoryModelId, Guid.createValue())));
      const dictId = await rwConn.models.getDictionaryModel();
      categoryId = await coreFullStackTestIpc.createAndInsertSpatialCategory(rwConn.key, dictId, Guid.createValue(), { color: 0 });

      projCenter = rwConn.projectExtents.center;
      projCenter.x = Math.round(projCenter.x);
      projCenter.y = Math.round(projCenter.y);
      projCenter.z = Math.round(projCenter.z);

      const point = projCenter.clone();
      elemId = await insertLineStringElement(rwConn, { model: modelId, category: categoryId, color: ColorDef.green, points: [point, new Point3d(point.x, point.y + 2, point.z)] });
      expect(Id64.isValid(elemId)).to.be.true;
      await rwConn.saveChanges();

      // Open a second, read-only connection that will monitor for changes made via the read-write connection.
      roConn = watchForChanges ? (await BriefcaseConnection.openFile({
        fileName: filePath,
        key: Guid.createValue(),
        readonly: true,
        watchForChanges: true,
      })) : rwConn;
    });

    afterEach(async () => {
      await roConn.close();
      await rwConn.close();
    });

    async function expectModelChanges(func: () => Promise<void>): Promise<void> {
      const promise = new Promise<void>((resolve) => {
        roConn.onBufferedModelChanges.addOnce((modelIds) => {
          expect(modelIds.size).to.equal(1);
          expect(modelIds.has(modelId)).to.be.true;
          resolve();
        });
      });

      await func();
      return promise;
    }

    let xTranslation = 0;
    async function moveElement(): Promise<void> {
      const transform = Transform.createTranslationXYZ(++xTranslation, 0, 0);
      await transformElements(rwConn, [elemId], transform);
      await rwConn.saveChanges();
    }

    async function getModel(iModel: BriefcaseConnection): Promise<GeometricModelState> {
      await iModel.models.load(modelId);
      const model = iModel.models.getLoaded(modelId) as GeometricModelState;
      expect(model).instanceof(GeometricModelState);
      return model;
    }

    async function expectElementsInTile(tree: TileTree, expectedElementIds: string[]): Promise<void> {
      // IModelTileTree.rootTile is-a RootTile that has no content of its own.
      expect(tree.rootTile.children!.length).to.equal(1);
      const tile = (tree.rootTile.children!)[0];

      const data = await tile.requestContent(() => false) as Uint8Array;
      expect(data).instanceof(Uint8Array);
      const content = await tile.readContent(data, IModelApp.renderSystem, () => false);
      expect(content.graphic).not.to.be.undefined;

      expect(Array.from(System.get().batchElementIds).sort()).to.deep.equal(expectedElementIds.sort());
    }

    it("purges and recreates tile trees when model geometry changes", async () => {
      const viewCreator = new ViewCreator3d(roConn);
      const view = await viewCreator.createDefaultView(undefined, [modelId]);

      const model = await getModel(roConn);
      let prevGuid = model.geometryGuid;
      const ref = model.createTileTreeReference(view);
      let prevTree = (await ref.treeOwner.loadTree())!;
      expect(prevTree).not.to.be.undefined;

      await expectModelChanges(async () => moveElement());
      expect(model.geometryGuid).not.to.equal(prevGuid);

      let newTree = (await ref.treeOwner.loadTree())!;
      expect(newTree).not.to.be.undefined;
      expect(newTree).not.to.equal(prevTree);
      expect(newTree.isDisposed).to.be.false;
      expect(prevTree.isDisposed).to.be.true;

      expect(newTree.range.isAlmostEqual(prevTree.range)).to.be.true;
      expect(newTree.iModelTransform.isAlmostEqual(prevTree.iModelTransform)).to.be.false;
      expect(newTree.iModelTransform.origin.x).to.equal(prevTree.iModelTransform.origin.x + 1);
      expect(newTree.iModelTransform.origin.x).to.equal(prevTree.iModelTransform.origin.x + 1);
      expect(newTree.iModelTransform.origin.y).to.equal(prevTree.iModelTransform.origin.y);
      expect(newTree.iModelTransform.origin.z).to.equal(prevTree.iModelTransform.origin.z);

      await expectElementsInTile(newTree, [elemId]);

      prevGuid = model.geometryGuid;
      prevTree = newTree;
      const elemId2 = await insertLineStringElement(rwConn, { model: modelId, category: categoryId, color: ColorDef.red, points: [projCenter.clone(), projCenter.plus({x:2, y:0, z:0})] });
      await expectModelChanges(async () => rwConn.saveChanges());

      expect(model.geometryGuid).not.to.equal(prevGuid);
      newTree = (await ref.treeOwner.loadTree())!;
      expect(newTree).not.to.equal(prevTree);
      expect(newTree.range.isAlmostEqual(prevTree.range)).to.be.false;

      await expectElementsInTile(newTree, [elemId, elemId2]);

      prevGuid = model.geometryGuid;
      prevTree = newTree;
      await expectModelChanges(async () => {
        await deleteElements(rwConn, [elemId]);
        await rwConn.saveChanges();
      });

      expect(model.geometryGuid).not.to.equal(prevGuid);
      newTree = (await ref.treeOwner.loadTree())!;
      expect(newTree).not.to.equal(prevTree);
      expect(newTree.range.isAlmostEqual(prevTree.range)).to.be.false;

      await expectElementsInTile(newTree, [elemId2]);
    });
  });
}
