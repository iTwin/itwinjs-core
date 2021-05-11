/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as path from "path";
import { Guid, OpenMode, ProcessDetector } from "@bentley/bentleyjs-core";
import { Transform } from "@bentley/geometry-core";
import { BriefcaseConnection, EditingFunctions } from "@bentley/imodeljs-frontend";
import { ElectronApp } from "@bentley/electron-manager/lib/ElectronFrontend";
import { deleteElements, initializeEditTools, insertLineElement, transformElements } from "../Editing";

describe("BriefcaseTxns", () => {
  if (ProcessDetector.isElectronAppFrontend) {
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

    it("receives events from TxnManager", async () => {
      type TxnEventName = "onElementsChanged" | "onModelsChanged" | "onModelGeometryChanged" | "onCommit" | "onCommitted" | "onChangesApplied";
      type TxnEvent = TxnEventName | "beforeUndo" | "beforeRedo" | "afterUndo" | "afterRedo";

      const received: TxnEvent[] = [];
      imodel.txns.onBeforeUndoRedo.addListener((isUndo) => received.push(isUndo ? "beforeUndo" : "beforeRedo"));
      imodel.txns.onAfterUndoRedo.addListener((isUndo) => received.push(isUndo ? "afterUndo" : "afterRedo"));

      const txnEventNames: TxnEventName[] = ["onElementsChanged", "onModelsChanged", "onModelGeometryChanged", "onCommit", "onCommitted", "onChangesApplied"];
      for (const event of txnEventNames)
        imodel.txns[event].addListener(() => received.push(event));

      const expected: TxnEvent[] = [];
      const expectEvents = async (additionalEvents: TxnEvent[]): Promise<void> => {
        // The backend sends the events synchronously but the frontend receives them asynchronously relative to this test.
        // So we must wait until all expected events are received. If our expectations are wrong, we may end up waiting forever.
        for (const additionalEvent of additionalEvents)
          expected.push(additionalEvent);

        const wait = async (): Promise<void> => {
          if (received.length >= expected.length)
            return;

          await new Promise<void>((resolve: any) => setTimeout(resolve, 100));
          return wait();
        };

        await wait();
        expect(received).to.deep.equal(expected);
        received.length = expected.length = 0;
      };

      const expectCommit = async (...evts: TxnEvent[]) => expectEvents(["onCommit", ...evts, "onCommitted"]);

      // eslint-disable-next-line deprecation/deprecation
      const editing = new EditingFunctions(imodel);

      const dictModelId = await imodel.models.getDictionaryModel();
      const category = await editing.categories.createAndInsertSpatialCategory(dictModelId, Guid.createValue(), { color: 0 });
      await imodel.saveChanges();
      await expectCommit("onElementsChanged");

      const model = await editing.models.createAndInsertPhysicalModel(await editing.codes.makeModelCode(imodel.models.repositoryModelId, Guid.createValue()));
      await imodel.saveChanges();
      await expectCommit("onElementsChanged", "onModelsChanged");

      // NB: onCommit is produced *after* we process all changes. onModelGeometryChanged is produced *during* change processing.
      const elem1 = await insertLineElement(imodel, model, category);
      await imodel.saveChanges();

      await expectCommit("onModelGeometryChanged", "onElementsChanged");

      await transformElements(imodel, [elem1], Transform.createTranslationXYZ(1, 0, 0));
      await imodel.saveChanges();
      await expectCommit("onModelGeometryChanged", "onElementsChanged");

      // eslint-disable-next-line deprecation/deprecation
      await deleteElements(imodel, [elem1]);
      await imodel.saveChanges();
      await expectCommit("onModelGeometryChanged", "onElementsChanged");

      const undo = async () => imodel.txns.reverseSingleTxn();
      const expectUndo = async (evts: TxnEvent[]) => expectEvents(["beforeUndo", ...evts, "afterUndo"]);

      await undo();
      await expectUndo(["onElementsChanged", "onChangesApplied", "onModelGeometryChanged"]);
      await undo();
      await expectUndo(["onElementsChanged", "onChangesApplied", "onModelGeometryChanged"]);
      await undo();
      await expectUndo(["onElementsChanged", "onChangesApplied", "onModelGeometryChanged"]);
      await undo();
      await expectUndo(["onElementsChanged", "onModelsChanged", "onChangesApplied"]);
      await undo();
      await expectUndo(["onElementsChanged", "onChangesApplied"]);

      const redo = async () => imodel.txns.reinstateTxn();
      const expectRedo = async (evts: TxnEvent[]) => expectEvents(["beforeRedo", ...evts, "afterRedo"]);
      await redo();
      await expectRedo(["onElementsChanged", "onChangesApplied"]);
      await redo();
      await expectRedo(["onElementsChanged", "onModelsChanged", "onChangesApplied"]);
      await redo();
      await expectRedo(["onElementsChanged", "onChangesApplied", "onModelGeometryChanged"]);
      await redo();
      await expectRedo(["onElementsChanged", "onChangesApplied", "onModelGeometryChanged"]);
      await redo();
      await expectRedo(["onElementsChanged", "onChangesApplied", "onModelGeometryChanged"]);

      await imodel.txns.reverseAll();
      await expectUndo([
        "onElementsChanged", "onChangesApplied", "onModelGeometryChanged",
        "onElementsChanged", "onChangesApplied", "onModelGeometryChanged",
        "onElementsChanged", "onChangesApplied", "onModelGeometryChanged",
        "onElementsChanged", "onModelsChanged", "onChangesApplied",
        "onElementsChanged", "onChangesApplied",
      ]);

      await imodel.txns.reinstateTxn();
      await expectRedo([
        "onElementsChanged", "onChangesApplied",
        "onElementsChanged", "onModelsChanged", "onChangesApplied",
        "onElementsChanged", "onChangesApplied", "onModelGeometryChanged",
        "onElementsChanged", "onChangesApplied", "onModelGeometryChanged",
        "onElementsChanged", "onChangesApplied", "onModelGeometryChanged",
      ]);
    });
  }
});
