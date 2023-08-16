/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as path from "path";
import { Guid, Id64, OpenMode, ProcessDetector } from "@itwin/core-bentley";
import { ColorDef } from "@itwin/core-common";
import { Point3d, Transform } from "@itwin/core-geometry";
import { BriefcaseConnection, GeometricModelState, ViewCreator3d } from "@itwin/core-frontend";
import { coreFullStackTestIpc, initializeEditTools, insertLineStringElement, makeModelCode, transformElements } from "../Editing";
import { TestUtility } from "../TestUtility";

for (const watchForChanges of [false, true]) {
  describe.only(`watchForChanges (${watchForChanges})`, () => {
    if (ProcessDetector.isMobileAppFrontend)
      return;

    let rwConn: BriefcaseConnection;
    let roConn: BriefcaseConnection;
    let modelId: string;
    let categoryId: string;
    let elemId: string;

    before(async () => {
      await TestUtility.startFrontend(undefined, undefined, true);
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

      const projCenter = rwConn.projectExtents.center;
      const point = new Point3d(Math.round(projCenter.x), Math.round(projCenter.y), Math.round(projCenter.z));
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

    it("updates ModelState.geometryGuid when model geometry changes", async () => {
      const model = await getModel(roConn);
      const prevGuid = model.geometryGuid;
      expect(prevGuid).not.to.be.undefined;

      await expectModelChanges(async () => moveElement());
      expect(roConn.models.getLoaded(model.id)).to.equal(model);
      expect(model.geometryGuid).not.to.be.undefined;
      expect(model.geometryGuid).not.to.equal(prevGuid);

      const rwModel = await getModel(rwConn);
      expect(rwModel.geometryGuid).to.equal(model.geometryGuid);
    });

    it("purges and recreates tile trees when model geometry changes", async () => {
      const viewCreator = new ViewCreator3d(roConn);
      const view = await viewCreator.createDefaultView(undefined, [modelId]);

      const model = await getModel(roConn);
      const ref = model.createTileTreeReference(view);
      const prevTree = (await ref.treeOwner.loadTree())!;
      expect(prevTree).not.to.be.undefined;

      await expectModelChanges(async () => moveElement());
      const newTree = (await ref.treeOwner.loadTree())!;
      expect(newTree).not.to.be.undefined;
      expect(newTree).not.to.equal(prevTree);
      expect(newTree.isDisposed).to.be.false;
      expect(prevTree.isDisposed).to.be.true;

      console.log(JSON.stringify(prevTree.iModelTransform.toJSON()));
      console.log(JSON.stringify(newTree.iModelTransform.toJSON()));
    });
  });
}
