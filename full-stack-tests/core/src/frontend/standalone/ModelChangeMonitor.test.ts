/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as path from "path";
import { Guid, OpenMode, ProcessDetector } from "@itwin/core-bentley";
import { Transform } from "@itwin/core-geometry";
import { BriefcaseConnection, GeometricModelState } from "@itwin/core-frontend";
import { addAllowedChannel, coreFullStackTestIpc, initializeEditTools, insertLineElement, makeModelCode, transformElements } from "../Editing";
import { TestUtility } from "../TestUtility";

if (!ProcessDetector.isMobileAppFrontend) {
  describe("Model change monitoring", () => {
    let imodel: BriefcaseConnection;

    before(async () => {
      await TestUtility.startFrontend(undefined, undefined, true);
      await initializeEditTools();
    });

    after(async () => {
      await TestUtility.shutdownFrontend();
    });

    beforeEach(async () => {
      const filePath = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/cjs/test/assets/planprojection.bim");
      imodel = await BriefcaseConnection.openStandalone(filePath, OpenMode.ReadWrite);
      await addAllowedChannel(imodel, "shared");
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
        const modelId = await coreFullStackTestIpc.createAndInsertPhysicalModel(imodel.key, (await makeModelCode(imodel, imodel.models.repositoryModelId, Guid.createValue())));
        const dictId = await imodel.models.getDictionaryModel();
        const categoryId = await coreFullStackTestIpc.createAndInsertSpatialCategory(imodel.key, dictId, Guid.createValue(), { color: 0 });
        elemId = await insertLineElement(imodel, modelId, categoryId);

        // Make sure the event produced by saveChanges doesn't pollute our tests.
        await getBufferedChanges(async () => imodel.saveChanges());

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

        modelIds = await getBufferedChanges(async () => {
          await imodel.txns.reverseSingleTxn();
        });
        expect(modelIds.size).to.equal(1);
        expect(modelIds.has(model.id)).to.be.true;
        expect(model.geometryGuid).to.equal(prevGuid);

        modelIds = await getBufferedChanges(async () => {
          await imodel.txns.reinstateTxn();
        });
        expect(modelIds.size).to.equal(1);
        expect(modelIds.has(model.id)).to.be.true;
        expect(model.geometryGuid).to.equal(newGuid);
      });

      it("after exiting a graphical editing scope", async () => {
        let numBufferedChanges = 0;
        imodel.onBufferedModelChanges.addListener(() => ++numBufferedChanges);

        const prevGuid = model.geometryGuid;
        expect(prevGuid).not.to.be.undefined;

        const scope = await imodel.enterEditingScope();
        await moveElement();
        expect(model.geometryGuid).to.equal(prevGuid);

        await imodel.txns.reverseSingleTxn();
        expect(model.geometryGuid).to.equal(prevGuid);

        await imodel.txns.reinstateTxn();
        expect(model.geometryGuid).to.equal(prevGuid);

        expect(numBufferedChanges).to.equal(0);

        const modelIds = await getBufferedChanges(async () => scope.exit());
        expect(numBufferedChanges).to.equal(1);
        expect(modelIds.size).to.equal(1);
        expect(modelIds.has(model.id)).to.be.true;
        expect(model.geometryGuid).not.to.equal(prevGuid);
        expect(model.geometryGuid).not.to.be.undefined;
      });
    });
  });
}
