/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as path from "path";
import { Guid, OpenMode, ProcessDetector } from "@itwin/core-bentley";
import { Transform } from "@itwin/core-geometry";
import { BriefcaseConnection } from "@itwin/core-frontend";
import { coreFullStackTestIpc, deleteElements, initializeEditTools, insertLineElement, makeModelCode, transformElements } from "../Editing";
import { TestUtility } from "../TestUtility";

describe("BriefcaseTxns", () => {
  if (!ProcessDetector.isMobileAppFrontend) {
    let rwConn: BriefcaseConnection;

    before(async () => {
      await TestUtility.startFrontend(undefined, undefined, true);
      await initializeEditTools();
    });

    after(async () => {
      await TestUtility.shutdownFrontend();
    });

    const filePath = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/cjs/test/assets/planprojection.bim");
    async function openRW(): Promise<void> {
      rwConn = await BriefcaseConnection.openStandalone(filePath, OpenMode.ReadWrite);
    }

    beforeEach(async () => openRW());

    afterEach(async () => rwConn.close());

    type TxnEventName = "onElementsChanged" | "onModelsChanged" | "onModelGeometryChanged" | "onCommit" | "onCommitted" | "onChangesApplied" | "onReplayExternalTxns" | "onReplayedExternalTxns";
    type TxnEvent = TxnEventName | "beforeUndo" | "beforeRedo" | "afterUndo" | "afterRedo";
    type ExpectEvents = (expected: TxnEvent[]) => Promise<void>;

    function installListeners(iModel: BriefcaseConnection): ExpectEvents {
      const received: TxnEvent[] = [];
      iModel.txns.onBeforeUndoRedo.addListener((isUndo) => received.push(isUndo ? "beforeUndo" : "beforeRedo"));
      iModel.txns.onAfterUndoRedo.addListener((isUndo) => received.push(isUndo ? "afterUndo" : "afterRedo"));

      const txnEventNames: TxnEventName[] = [
        "onElementsChanged", "onModelsChanged", "onModelGeometryChanged", "onCommit", "onCommitted", "onChangesApplied", "onReplayExternalTxns", "onReplayedExternalTxns",
      ];

      for (const event of txnEventNames)
        iModel.txns[event].addListener(() => received.push(event));

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

      return expectEvents;
    }

    describe("writable connection", () => {
      it("receives events from TxnManager", async () => {
        const expectEvents = installListeners(rwConn);

        const expectCommit = async (...evts: TxnEvent[]) => expectEvents(["onCommit", ...evts, "onCommitted"]);

        const dictModelId = await rwConn.models.getDictionaryModel();
        const category = await coreFullStackTestIpc.createAndInsertSpatialCategory(rwConn.key, dictModelId, Guid.createValue(), { color: 0 });
        await rwConn.saveChanges();
        await expectCommit("onElementsChanged");

        const code = await makeModelCode(rwConn, rwConn.models.repositoryModelId, Guid.createValue());
        const model = await coreFullStackTestIpc.createAndInsertPhysicalModel(rwConn.key, code);
        await rwConn.saveChanges();
        await expectCommit("onElementsChanged", "onModelsChanged");

        // NB: onCommit is produced *after* we process all changes. onModelGeometryChanged is produced *during* change processing.
        const elem1 = await insertLineElement(rwConn, model, category);
        await rwConn.saveChanges();

        await expectCommit("onModelGeometryChanged", "onElementsChanged");

        await transformElements(rwConn, [elem1], Transform.createTranslationXYZ(1, 0, 0));
        await rwConn.saveChanges();
        await expectCommit("onModelGeometryChanged", "onElementsChanged");

        await deleteElements(rwConn, [elem1]);
        await rwConn.saveChanges();
        await expectCommit("onModelGeometryChanged", "onElementsChanged");

        const undo = async () => rwConn.txns.reverseSingleTxn();
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

        const redo = async () => rwConn.txns.reinstateTxn();
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

        await rwConn.txns.reverseAll();
        await expectUndo([
          "onElementsChanged", "onChangesApplied", "onModelGeometryChanged",
          "onElementsChanged", "onChangesApplied", "onModelGeometryChanged",
          "onElementsChanged", "onChangesApplied", "onModelGeometryChanged",
          "onElementsChanged", "onModelsChanged", "onChangesApplied",
          "onElementsChanged", "onChangesApplied",
        ]);

        await rwConn.txns.reinstateTxn();
        await expectRedo([
          "onElementsChanged", "onChangesApplied",
          "onElementsChanged", "onModelsChanged", "onChangesApplied",
          "onElementsChanged", "onChangesApplied", "onModelGeometryChanged",
          "onElementsChanged", "onChangesApplied", "onModelGeometryChanged",
          "onElementsChanged", "onChangesApplied", "onModelGeometryChanged",
        ]);
      });
    });

    describe("read-only connection with watchForChanges enabled", () => {
      let roConn: BriefcaseConnection;

      beforeEach(async () => {
        roConn = await BriefcaseConnection.openFile({
          fileName: filePath,
          key: Guid.createValue(),
          readonly: true,
          watchForChanges: true,
        });
      });

      afterEach(async () => roConn.close());

      it("receives events from TxnManager", async () => {
        // This test is mostly a duplicate of the first portion of the "writable connection" test above.
        // The events are bookended by "onReplay(ed)ExternalTxns" events instead of "onCommit(ted)", the order
        // of the events is slightly different, "onChangesApplied" is included, and undo/redo is not supported.
        const expectEvents = installListeners(roConn);
        const expectCommit = async (...evts: TxnEvent[]) => expectEvents(["onReplayExternalTxns", ...evts, "onReplayedExternalTxns"]);

        const dictModelId = await rwConn.models.getDictionaryModel();
        const category = await coreFullStackTestIpc.createAndInsertSpatialCategory(rwConn.key, dictModelId, Guid.createValue(), { color: 0 });
        await rwConn.saveChanges();
        await expectCommit("onElementsChanged", "onChangesApplied");

        const code = await makeModelCode(rwConn, rwConn.models.repositoryModelId, Guid.createValue());
        const model = await coreFullStackTestIpc.createAndInsertPhysicalModel(rwConn.key, code);
        await rwConn.saveChanges();
        await expectCommit("onElementsChanged", "onModelsChanged", "onChangesApplied");

        // NB: onCommit is produced *after* we process all changes. onModelGeometryChanged is produced *during* change processing.
        const elem1 = await insertLineElement(rwConn, model, category);
        await rwConn.saveChanges();

        await expectCommit("onElementsChanged", "onChangesApplied", "onModelGeometryChanged");

        await transformElements(rwConn, [elem1], Transform.createTranslationXYZ(1, 0, 0));
        await rwConn.saveChanges();
        await expectCommit("onElementsChanged", "onChangesApplied", "onModelGeometryChanged");

        await deleteElements(rwConn, [elem1]);
        await rwConn.saveChanges();
        await expectCommit("onElementsChanged", "onChangesApplied", "onModelGeometryChanged");
      });

      it("continues to receive events after iModel is closed and reopened", async () => {
        const expectEvents = installListeners(roConn);
        const expectCommit = async (...evts: TxnEvent[]) => expectEvents(["onReplayExternalTxns", ...evts, "onReplayedExternalTxns"]);

        const dictModelId = await rwConn.models.getDictionaryModel();
        await coreFullStackTestIpc.createAndInsertSpatialCategory(rwConn.key, dictModelId, Guid.createValue(), { color: 0 });
        await rwConn.saveChanges();
        await expectCommit("onElementsChanged", "onChangesApplied");

        await coreFullStackTestIpc.createAndInsertSpatialCategory(rwConn.key, dictModelId, Guid.createValue(), { color: 0 });
        await rwConn.saveChanges();
        await expectCommit("onElementsChanged", "onChangesApplied");

        // Cannot reopen roConn as writable while rwConn is open for write.
        await rwConn.close();

        // Reopen roConn as temporarily writable, then reopen as read-only.
        await coreFullStackTestIpc.closeAndReopenDb(roConn.key);

        // Reopen rwConn
        await openRW();

        await coreFullStackTestIpc.createAndInsertSpatialCategory(rwConn.key, dictModelId, Guid.createValue(), { color: 0 });
        await rwConn.saveChanges();
        await expectCommit("onElementsChanged", "onChangesApplied");

        // Repeat.
        await rwConn.close();
        await coreFullStackTestIpc.closeAndReopenDb(roConn.key);
        await openRW();

        await coreFullStackTestIpc.createAndInsertSpatialCategory(rwConn.key, dictModelId, Guid.createValue(), { color: 0 });
        await rwConn.saveChanges();
        await expectCommit("onElementsChanged", "onChangesApplied");
      });
    });
  }
});
