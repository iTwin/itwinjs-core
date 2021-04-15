/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as path from "path";
import { Guid, IModelStatus, OpenMode, ProcessDetector } from "@bentley/bentleyjs-core";
import { Transform } from "@bentley/geometry-core";
import { BriefcaseConnection, EditingFunctions, GeometricModelState } from "@bentley/imodeljs-frontend";
import { ElectronApp } from "@bentley/electron-manager/lib/ElectronFrontend";
import { deleteElements, initializeEditTools, insertLineElement, transformElements } from "../Editing";

if (ProcessDetector.isElectronAppFrontend) {
  describe.only("Model change monitoring", () => {
    let imodel: BriefcaseConnection;

    before(async () => {
      await ElectronApp.startup();
      await initializeEditTools();
    });

    after(async () => {
      await ElectronApp.shutdown();
    });

    beforeEach(async () => {
      const filePath = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/test/assets/planprojection.bim");
      imodel = await BriefcaseConnection.openStandalone(filePath, OpenMode.ReadWrite);
    });

    afterEach(async () => {
      await imodel.close();
    });

    async function getBufferedChanges(func: () => Promise<void>): Promise<Set<string>> {
      const promise = new Promise<Set<string>>((resolve) => {
        imodel.onBufferedModelChanges.addOnce((modelIds) => {
          resolve(modelIds);
        });
      });

      await func();
      return promise;
    }

    describe("updates state", () => {
      let model: GeometricModelState;
      let elemId: string;

      beforeEach(async () => {
        const editing = new EditingFunctions(imodel);
        const modelId = await editing.models.createAndInsertPhysicalModel(await editing.codes.makeModelCode(imodel.models.repositoryModelId, Guid.createValue()));
        const dictId = await imodel.models.getDictionaryModel();
        const categoryId = await editing.categories.createAndInsertSpatialCategory(dictId, Guid.createValue(), { color: 0 });
        elemId = await insertLineElement(imodel, modelId, categoryId);
        await imodel.saveChanges();

        await imodel.models.load(modelId);
        model = imodel.models.getLoaded(modelId) as GeometricModelState;
        expect(model).instanceof(GeometricModelState);
      });

      let zTranslation = 0;
      async function moveElement(): Promise<void> {
        const transform = Transform.createTranslationXYZ(0, 0, ++zTranslation);
        await transformElements(imodel, [elemId], transform);
        await imodel.saveChanges();
      }

      it("at transaction boundaries outside of a graphical editing scope", async () => {
        const prevGuid = model.geometryGuid;
        expect(prevGuid).not.to.be.undefined;

        let modelIds = await getBufferedChanges(async () => moveElement());
        expect(modelIds.size).to.equal(1);
        expect(modelIds.has(model.id)).to.be.true;

        expect(imodel.models.getLoaded(model.id)).to.equal(model);
        expect(model.geometryGuid).not.to.be.undefined;
        const newGuid = model.geometryGuid!;
        expect(newGuid).not.to.equal(prevGuid);

        modelIds = await getBufferedChanges(async () =>  { imodel.txns.reverseSingleTxn(); });
        expect(modelIds.size).to.equal(1);
        expect(modelIds.has(model.id)).to.be.true;
        expect(model.geometryGuid).to.equal(prevGuid);

        modelIds = await getBufferedChanges(async () => { imodel.txns.reinstateTxn(); });
        expect(modelIds.size).to.equal(1);
        expect(modelIds.has(model.id)).to.be.true;
        expect(model.geometryGuid).to.equal(newGuid);
      });

      it("after exiting a graphical editing scope", async () => {
      });
    });

    // deleteModel() is not exposed to frontend. Trying to delete via deleteElements() will produce foreign key constraint violation.
    it.skip("removes models from the loaded map after deletion", async () => {
      const editing = new EditingFunctions(imodel);
      const modelId = await editing.models.createAndInsertPhysicalModel(await editing.codes.makeModelCode(imodel.models.repositoryModelId, Guid.createValue()));
      await imodel.saveChanges();

      expect(imodel.models.getLoaded(modelId)).to.be.undefined;

      await imodel.models.load(modelId);
      expect(imodel.models.getLoaded(modelId)).not.to.be.undefined;

      let modelIds = await getBufferedChanges(async () => {
        const status = await deleteElements(imodel, [modelId]);
        await imodel.saveChanges();
        expect(status).to.equal(IModelStatus.Success);
      });

      expect(modelIds.size).to.equal(1);
      expect(modelIds.has(modelId)).to.be.true;
      expect(imodel.models.getLoaded(modelId)).to.be.undefined;

      modelIds = await getBufferedChanges(async () => {
        const status = await imodel.txns.reverseSingleTxn();
        expect(status).to.equal(IModelStatus.Success);
      });

      await imodel.models.load(modelId);
      expect(imodel.models.getLoaded(modelId)).not.to.be.undefined;

      modelIds = await getBufferedChanges(async () => {
        const status = await imodel.txns.reinstateTxn();
        expect(status).to.equal(IModelStatus.Success);
      });

      expect(modelIds.size).to.equal(1);
      expect(modelIds.has(modelId)).to.be.true;
      expect(imodel.models.getLoaded(modelId)).to.be.undefined;
    });
  });
}
