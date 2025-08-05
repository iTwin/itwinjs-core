/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as path from "path";
import { Guid, Logger, LogLevel, OpenMode, ProcessDetector } from "@itwin/core-bentley";
import { Transform } from "@itwin/core-geometry";
import { BriefcaseConnection, TxnEntityChanges, TxnEntityChangeType } from "@itwin/core-frontend";
import { addAllowedChannel, coreFullStackTestIpc, deleteElements, initializeEditTools, insertLineElement, makeModelCode, transformElements } from "../Editing";
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
      await addAllowedChannel(rwConn, "shared");
    }

    beforeEach(async () => openRW());

    afterEach(async () => rwConn.close());

    type TxnEventName = "onElementsChanged" | "onModelsChanged" | "onModelGeometryChanged" | "onCommit" | "onCommitted" | "onChangesApplied" | "onReplayExternalTxns" | "onReplayedExternalTxns";
    type TxnEvent = TxnEventName | "beforeUndo" | "beforeRedo" | "afterUndo" | "afterRedo";
    type ExpectEvents = (label: string, expected: TxnEvent[]) => Promise<void>;

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
      const expectEvents = async (label: string, additionalEvents: TxnEvent[]): Promise<void> => {
        // The backend sends the events synchronously but the frontend receives them asynchronously relative to this test.
        // So we must wait until all expected events are received. If our expectations are wrong, we may end up waiting forever.
        for (const additionalEvent of additionalEvents)
          expected.push(additionalEvent);

        let timesWaited = 0;
        const wait = async (): Promise<boolean> => {
          if (received.length >= expected.length)
            return true;

          if (received.length > 0) {
            for (let i = 0; i < received.length; ++i) {
              if (received[i] !== expected[i]) {
                // We have received some events, but not all. Make sure they are the expected events.
                // If not, throw an error. If we don't do this, and an event is never received, we will
                // needlessly wait for 30 seconds.
                throw new Error(`Received unexpected event for <${label}>: ${received[i]} instead of ${expected[i]}`);
              }
            }
          }
          if (timesWaited > 300) { // 10 timesWaited is 1 second. 100 is 10 seconds. 300 is 30 seconds.
            // Typical run-time for these tests is < 1 second. 30 seconds is plenty.
            throw new Error(`Timed out waiting for events for <${label}>. Received: ${received.length}, Expected: ${expected.length}\n\tReceived: ${received.map((evt) => evt).join(", ")}\n\tExpected: ${expected.map((evt) => evt).join(", ")}`);
          }
          await new Promise<void>((resolve: any) => setTimeout(resolve, 100));
          timesWaited++;
          return false;
        };

        while (!await wait()) {
          // Wait for the expected events to be received.
        }
        try {
          expect(received).to.deep.equal(expected);
        } catch (e) {
          // expect doesn't give you any way to show the label.
          Logger.logError("TestCategory", `Error in test <${label}>.`);
          throw e;
        }
        received.length = expected.length = 0;
      };

      return expectEvents;
    }

    describe("writable connection", () => {
      it("receives events from TxnManager", async () => {
        const expectEvents = installListeners(rwConn);
        Logger.initializeToConsole();
        Logger.setLevel("TestCategory", LogLevel.Trace);
        const expectCommit = async (label: string, ...evts: TxnEvent[]) => expectEvents(label, ["onCommit", ...evts, "onCommitted"]);

        const dictModelId = await rwConn.models.getDictionaryModel();
        const category = await coreFullStackTestIpc.createAndInsertSpatialCategory(rwConn.key, dictModelId, Guid.createValue(), { color: 0 });
        await rwConn.saveChanges();
        await expectCommit("create and insert spatial category", "onElementsChanged");

        const code = await makeModelCode(rwConn, rwConn.models.repositoryModelId, Guid.createValue());
        const model = await coreFullStackTestIpc.createAndInsertPhysicalModel(rwConn.key, code);
        await rwConn.saveChanges();
        await expectCommit("create and insert physical model", "onElementsChanged", "onModelsChanged");

        // NB: onCommit is produced *after* we process all changes. onModelGeometryChanged is produced *during* change processing.
        const elem1 = await insertLineElement(rwConn, model, category);
        await rwConn.saveChanges();

        await expectCommit("insert line element", "onModelGeometryChanged", "onElementsChanged");

        await transformElements(rwConn, [elem1], Transform.createTranslationXYZ(1, 0, 0));
        await rwConn.saveChanges();
        await expectCommit("translate", "onModelGeometryChanged", "onElementsChanged");

        await deleteElements(rwConn, [elem1]);
        await rwConn.saveChanges();
        await expectCommit("delete element", "onModelGeometryChanged", "onElementsChanged");

        const undo = async () => rwConn.txns.reverseSingleTxn();
        const expectUndo = async (label: string, evts: TxnEvent[]) => expectEvents(label, ["beforeUndo", ...evts, "afterUndo"]);

        await undo();
        await expectUndo("undo 1", ["onElementsChanged", "onChangesApplied", "onModelGeometryChanged"]);
        await undo();
        await expectUndo("undo 2", ["onElementsChanged", "onChangesApplied", "onModelGeometryChanged"]);
        await undo();
        await expectUndo("undo 3", ["onElementsChanged", "onChangesApplied", "onModelGeometryChanged"]);
        await undo();
        await expectUndo("undo 4", ["onElementsChanged", "onModelsChanged", "onChangesApplied"]);
        await undo();
        await expectUndo("undo 5", ["onElementsChanged", "onChangesApplied"]);

        const redo = async () => rwConn.txns.reinstateTxn();
        const expectRedo = async (label: string, evts: TxnEvent[]) => expectEvents(label, ["beforeRedo", ...evts, "afterRedo"]);
        await redo();
        await expectRedo("redo 1", ["onElementsChanged", "onChangesApplied"]);
        await redo();
        await expectRedo("redo 2", ["onElementsChanged", "onModelsChanged", "onChangesApplied"]);
        await redo();
        await expectRedo("redo 3", ["onElementsChanged", "onChangesApplied", "onModelGeometryChanged"]);
        await redo();
        await expectRedo("redo 4", ["onElementsChanged", "onChangesApplied", "onModelGeometryChanged"]);
        await redo();
        await expectRedo("redo 5", ["onElementsChanged", "onChangesApplied", "onModelGeometryChanged"]);

        await rwConn.txns.reverseAll();
        await expectUndo("undo reverse all", [
          "onElementsChanged", "onChangesApplied", "onModelGeometryChanged",
          "onElementsChanged", "onChangesApplied", "onModelGeometryChanged",
          "onElementsChanged", "onChangesApplied", "onModelGeometryChanged",
          "onElementsChanged", "onModelsChanged", "onChangesApplied",
          "onElementsChanged", "onChangesApplied",
        ]);

        await rwConn.txns.reinstateTxn();
        await expectRedo("redo reinstate txn", [
          "onElementsChanged", "onChangesApplied",
          "onElementsChanged", "onModelsChanged", "onChangesApplied",
          "onElementsChanged", "onChangesApplied", "onModelGeometryChanged",
          "onElementsChanged", "onChangesApplied", "onModelGeometryChanged",
          "onElementsChanged", "onChangesApplied", "onModelGeometryChanged",
        ]);

        Logger.initialize(); // Reset the logger since we initialized it to console above.
      });

      it("receives events including entity Id and class name", async () => {
        type Change = [className: string, type: TxnEntityChangeType];

        async function expectChangedEntities(func: () => Promise<void>, terminalEvent: "onAfterUndoRedo" | "onCommitted", expectedChanges: Change[]): Promise<void> {
          const received: Change[] = [];
          function receive(changes: TxnEntityChanges): void {
            received.push(...Array.from(changes).map((change) => [change.metadata.classFullName, change.type] as Change));
          }

          const removeElementListener = rwConn.txns.onElementsChanged.addListener((changes) => receive(changes));
          const removeModelListener = rwConn.txns.onModelsChanged.addListener((changes) => receive(changes));

          let receivedTerminationEvent = false;
          rwConn.txns[terminalEvent].addOnce(() => receivedTerminationEvent = true);

          async function wait(): Promise<void> {
            if (receivedTerminationEvent) {
              removeElementListener();
              removeModelListener();
              return;
            }

            await new Promise<void>((resolve: any) => setTimeout(resolve, 100));
            return wait();
          }

          await func();
          await wait();

          expect(received).to.deep.equal(expectedChanges);
        }

        const dictModelId = await rwConn.models.getDictionaryModel();
        const cat1 = await coreFullStackTestIpc.createAndInsertSpatialCategory(rwConn.key, dictModelId, Guid.createValue(), { color: 0 });
        const cat2 = await coreFullStackTestIpc.createAndInsertSpatialCategory(rwConn.key, dictModelId, Guid.createValue(), { color: 0 });

        const code = await makeModelCode(rwConn, rwConn.models.repositoryModelId, Guid.createValue());
        const model = await coreFullStackTestIpc.createAndInsertPhysicalModel(rwConn.key, code);

        await insertLineElement(rwConn, model, cat1);
        await insertLineElement(rwConn, model, cat2);

        const expected: Change[] = [
          ["BisCore:SpatialCategory", "inserted"],
          ["BisCore:SubCategory", "inserted"],
          ["BisCore:SpatialCategory", "inserted"],
          ["BisCore:SubCategory", "inserted"],
          ["BisCore:PhysicalPartition", "inserted"],
          ["Generic:PhysicalObject", "inserted"],
          ["Generic:PhysicalObject", "inserted"],
          ["BisCore:PhysicalModel", "inserted"],
        ];

        await expectChangedEntities(async () => rwConn.saveChanges(), "onCommitted", expected);
        await expectChangedEntities(async () => {
          await rwConn.txns.reverseSingleTxn();
        }, "onAfterUndoRedo", expected.map((x) => [x[0], "deleted"]));
        await expectChangedEntities(async () => {
          await rwConn.txns.reinstateTxn();
        }, "onAfterUndoRedo", expected);
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
        const expectCommit = async (label: string, ...evts: TxnEvent[]) => expectEvents(label, ["onReplayExternalTxns", ...evts, "onReplayedExternalTxns"]);

        const dictModelId = await rwConn.models.getDictionaryModel();
        const category = await coreFullStackTestIpc.createAndInsertSpatialCategory(rwConn.key, dictModelId, Guid.createValue(), { color: 0 });
        await rwConn.saveChanges();
        await expectCommit("create and insert spatial category", "onElementsChanged", "onChangesApplied");

        const code = await makeModelCode(rwConn, rwConn.models.repositoryModelId, Guid.createValue());
        const model = await coreFullStackTestIpc.createAndInsertPhysicalModel(rwConn.key, code);
        await rwConn.saveChanges();
        await expectCommit("create and insert physical model", "onElementsChanged", "onModelsChanged", "onChangesApplied");

        // NB: onCommit is produced *after* we process all changes. onModelGeometryChanged is produced *during* change processing.
        const elem1 = await insertLineElement(rwConn, model, category);
        await rwConn.saveChanges();

        await expectCommit("insert line element", "onElementsChanged", "onChangesApplied", "onModelGeometryChanged");

        await transformElements(rwConn, [elem1], Transform.createTranslationXYZ(1, 0, 0));
        await rwConn.saveChanges();
        await expectCommit("translate", "onElementsChanged", "onChangesApplied", "onModelGeometryChanged");

        await deleteElements(rwConn, [elem1]);
        await rwConn.saveChanges();
        await expectCommit("delete element", "onElementsChanged", "onChangesApplied", "onModelGeometryChanged");
      });

      it("continues to receive events after iModel is closed and reopened", async () => {
        const expectEvents = installListeners(roConn);
        const expectCommit = async (label: string, ...evts: TxnEvent[]) => expectEvents(label, ["onReplayExternalTxns", ...evts, "onReplayedExternalTxns"]);

        const dictModelId = await rwConn.models.getDictionaryModel();
        await coreFullStackTestIpc.createAndInsertSpatialCategory(rwConn.key, dictModelId, Guid.createValue(), { color: 0 });
        await rwConn.saveChanges();
        await expectCommit("create and insert spatial category 1", "onElementsChanged", "onChangesApplied");

        await coreFullStackTestIpc.createAndInsertSpatialCategory(rwConn.key, dictModelId, Guid.createValue(), { color: 0 });
        await rwConn.saveChanges();
        await expectCommit("create and insert spatial category 2", "onElementsChanged", "onChangesApplied");

        // Cannot reopen roConn as writable while rwConn is open for write.
        await rwConn.close();

        // Reopen roConn as temporarily writable, then reopen as read-only.
        await coreFullStackTestIpc.closeAndReopenDb(roConn.key);

        // Reopen rwConn
        await openRW();

        await coreFullStackTestIpc.createAndInsertSpatialCategory(rwConn.key, dictModelId, Guid.createValue(), { color: 0 });
        await rwConn.saveChanges();
        await expectCommit("create and insert spatial category 3", "onElementsChanged", "onChangesApplied");

        // Repeat.
        await rwConn.close();
        await coreFullStackTestIpc.closeAndReopenDb(roConn.key);
        await openRW();

        await coreFullStackTestIpc.createAndInsertSpatialCategory(rwConn.key, dictModelId, Guid.createValue(), { color: 0 });
        await rwConn.saveChanges();
        await expectCommit("create and insert spatial category 4", "onElementsChanged", "onChangesApplied");
      });
    });
  }
});
