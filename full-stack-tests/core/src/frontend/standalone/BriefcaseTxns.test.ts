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
  if (ProcessDetector.isMobileAppFrontend)
    return;

  let writableConn: BriefcaseConnection;

  before(async () => {
    await TestUtility.startFrontend(undefined, undefined, true);
    await initializeEditTools();
  });

  after(async () => {
    await TestUtility.shutdownFrontend();
  });

  const filePath = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/cjs/test/assets/planprojection.bim");
  beforeEach(async () => {
    writableConn = await BriefcaseConnection.openStandalone(filePath, OpenMode.ReadWrite);
  });

  afterEach(async () => {
    await writableConn.close();
  });

  // NB: We don't listen for onChangesApplied. Lots of them are produced, mixed in with other more interesting events.
  type TxnEventName = "onElementsChanged" | "onModelsChanged" | "onModelGeometryChanged" | "onCommit" | "onCommitted" | "onReplayExternalTxns" | "onReplayedExternalTxns";
  type TxnEvent = TxnEventName | "beforeUndo" | "beforeRedo" | "afterUndo" | "afterRedo";
  type TxnType = "commit" | "undo" | "redo";

  interface ExpectedTxns {
    forElement(type: TxnType, geomChanged?: boolean, modelChanged?: boolean): TxnEvent[];
    forUndoRedoAll(type: "undo" | "redo"): TxnEvent[];
  }

  async function test(readableConn: BriefcaseConnection, expectedTxns: ExpectedTxns): Promise<void> {
    const received: TxnEvent[] = [];
    readableConn.txns.onBeforeUndoRedo.addListener((isUndo) => received.push(isUndo ? "beforeUndo" : "beforeRedo"));
    readableConn.txns.onAfterUndoRedo.addListener((isUndo) => received.push(isUndo ? "afterUndo" : "afterRedo"));

    const txnEventNames: TxnEventName[] = ["onElementsChanged", "onModelsChanged", "onModelGeometryChanged", "onCommit", "onCommitted", "onReplayExternalTxns", "onReplayedExternalTxns"];
    for (const event of txnEventNames)
      readableConn.txns[event].addListener(() => received.push(event));

    const expected: TxnEvent[] = [];
    const expectEvents = async (additionalEvents: TxnEvent[]): Promise<void> => {
      // The backend sends the events synchronously but the frontend receives them asynchronously relative to this test.
      // So we must wait until all expected events are received. If our expectations are wrong, we may end up waiting forever.
      for (const additionalEvent of additionalEvents)
        expected.push(additionalEvent);

      let numWaits = 0;
      const wait = async (): Promise<void> => {
        if (numWaits++ > 10 || received.length >= expected.length)
          return;

        await new Promise<void>((resolve: any) => setTimeout(resolve, 100));
        return wait();
      };

      await wait();
      console.log(JSON.stringify(received));
      expect(received).to.deep.equal(expected);

      numWaits = received.length = expected.length = 0;
    };

    const expectCommit = async(geomChanged?: boolean, modelChanged?: boolean) => expectEvents(expectedTxns.forElement("commit", geomChanged, modelChanged));

    const dictModelId = await readableConn.models.getDictionaryModel();
    const category = await coreFullStackTestIpc.createAndInsertSpatialCategory(writableConn.key, dictModelId, Guid.createValue(), { color: 0 });
    await writableConn.saveChanges();
    await expectCommit();

    const code = await makeModelCode(readableConn, readableConn.models.repositoryModelId, Guid.createValue());
    const model = await coreFullStackTestIpc.createAndInsertPhysicalModel(writableConn.key, code);
    await writableConn.saveChanges();
    await expectCommit(false, true);

    // NB: onCommit is produced *after* we process all changes. onModelGeometryChanged is produced *during* change processing.
    const elem1 = await insertLineElement(writableConn, model, category);
    await writableConn.saveChanges();

    await expectCommit(true);

    await transformElements(writableConn, [elem1], Transform.createTranslationXYZ(1, 0, 0));
    await writableConn.saveChanges();
    await expectCommit(true);

    await deleteElements(writableConn, [elem1]);
    await writableConn.saveChanges();
    await expectCommit(true);

    const undo = async () => writableConn.txns.reverseSingleTxn();
    const expectUndo = async (geomChanged?: boolean, modelChanged?: boolean) => expectEvents(expectedTxns.forElement("undo", geomChanged, modelChanged));

    await undo();
    await expectUndo(true);
    await undo();
    await expectUndo(true);
    await undo();
    await expectUndo(true);
    await undo();
    await expectUndo(false, true);
    await undo();
    await expectUndo();

    const redo = async () => writableConn.txns.reinstateTxn();
    const expectRedo = async (geomChanged?: boolean, modelChanged?: boolean) => expectEvents(expectedTxns.forElement("redo", geomChanged, modelChanged));
    await redo();
    await expectRedo();
    await redo();
    await expectRedo(false, true);
    await redo();
    await expectRedo(true);
    await redo();
    await expectRedo(true);
    await redo();
    await expectRedo(true);

    await writableConn.txns.reverseAll();
    await expectEvents(expectedTxns.forUndoRedoAll("undo"));

    await writableConn.txns.reinstateTxn();
    await expectEvents(expectedTxns.forUndoRedoAll("redo"));
  }

  it.only("receives events for writable connection", async () => {
    await test(writableConn, {
      forElement(type: TxnType, geomChanged?: boolean, modelChanged?: boolean): TxnEvent[] {
        const bookends = {
          "commit": ["onCommit", "onCommitted"] as const,
          "undo": ["beforeUndo", "afterUndo"] as const,
          "redo": ["beforeRedo", "afterRedo"] as const,
        } as const;

        const txns: TxnEvent[] = [bookends[type][0]];

        if (geomChanged && type === "commit")
          txns.push("onModelGeometryChanged");

        txns.push("onElementsChanged");
        if (modelChanged)
          txns.push("onModelsChanged");

        if (geomChanged && type !== "commit")
          txns.push("onModelGeometryChanged");

        txns.push(bookends[type][1]);
        return txns;
      },
      forUndoRedoAll(type: "undo" | "redo"): TxnEvent[] {
        return type === "undo" ? [
          "beforeUndo",
          "onElementsChanged", "onModelGeometryChanged",
          "onElementsChanged", "onModelGeometryChanged",
          "onElementsChanged", "onModelGeometryChanged",
          "onElementsChanged", "onModelsChanged",
          "onElementsChanged",
          "afterUndo",
        ] : [
          "beforeRedo",
          "onElementsChanged",
          "onElementsChanged", "onModelsChanged",
          "onElementsChanged", "onModelGeometryChanged",
          "onElementsChanged", "onModelGeometryChanged",
          "onElementsChanged", "onModelGeometryChanged",
          "afterRedo",
        ];
      },
    });
  });

  it.only("receives events for read-only connection when watchForChanges is enabled", async () => {
    const readableConn = await BriefcaseConnection.openFile({
      fileName: filePath,
      key: Guid.createValue(),
      readonly: true,
      watchForChanges: true,
    });

    await test(readableConn, {
      forElement(_type: TxnType, geomChanged?: boolean, modelChanged?: boolean): TxnEvent[] {
        const txns: TxnEvent[] = ["onReplayExternalTxns", "onElementsChanged"];
        if (geomChanged)
          txns.push("onModelGeometryChanged");

        if (modelChanged)
          txns.push("onModelsChanged");

        txns.push("onReplayedExternalTxns");
        return txns;
      },
      forUndoRedoAll(_type: "undo" | "redo"): TxnEvent[] {
        return [];
      },
    });

    await readableConn.close();
  });
});
