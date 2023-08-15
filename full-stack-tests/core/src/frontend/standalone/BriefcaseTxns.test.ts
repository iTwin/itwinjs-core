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

  async function test(readableConn: BriefcaseConnection): Promise<void> {
    type TxnEventName = "onElementsChanged" | "onModelsChanged" | "onModelGeometryChanged" | "onCommit" | "onCommitted" | "onChangesApplied";
    type TxnEvent = TxnEventName | "beforeUndo" | "beforeRedo" | "afterUndo" | "afterRedo";

    const received: TxnEvent[] = [];
    readableConn.txns.onBeforeUndoRedo.addListener((isUndo) => received.push(isUndo ? "beforeUndo" : "beforeRedo"));
    readableConn.txns.onAfterUndoRedo.addListener((isUndo) => received.push(isUndo ? "afterUndo" : "afterRedo"));

    const txnEventNames: TxnEventName[] = ["onElementsChanged", "onModelsChanged", "onModelGeometryChanged", "onCommit", "onCommitted", "onChangesApplied"];
    for (const event of txnEventNames)
      readableConn.txns[event].addListener(() => received.push(event));

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

    const dictModelId = await readableConn.models.getDictionaryModel();
    const category = await coreFullStackTestIpc.createAndInsertSpatialCategory(writableConn.key, dictModelId, Guid.createValue(), { color: 0 });
    await writableConn.saveChanges();
    await expectCommit("onElementsChanged");

    const code = await makeModelCode(readableConn, readableConn.models.repositoryModelId, Guid.createValue());
    const model = await coreFullStackTestIpc.createAndInsertPhysicalModel(writableConn.key, code);
    await writableConn.saveChanges();
    await expectCommit("onElementsChanged", "onModelsChanged");

    // NB: onCommit is produced *after* we process all changes. onModelGeometryChanged is produced *during* change processing.
    const elem1 = await insertLineElement(writableConn, model, category);
    await writableConn.saveChanges();

    await expectCommit("onModelGeometryChanged", "onElementsChanged");

    await transformElements(writableConn, [elem1], Transform.createTranslationXYZ(1, 0, 0));
    await writableConn.saveChanges();
    await expectCommit("onModelGeometryChanged", "onElementsChanged");

    await deleteElements(writableConn, [elem1]);
    await writableConn.saveChanges();
    await expectCommit("onModelGeometryChanged", "onElementsChanged");

    const undo = async () => writableConn.txns.reverseSingleTxn();
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

    const redo = async () => writableConn.txns.reinstateTxn();
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

    await writableConn.txns.reverseAll();
    await expectUndo([
      "onElementsChanged", "onChangesApplied", "onModelGeometryChanged",
      "onElementsChanged", "onChangesApplied", "onModelGeometryChanged",
      "onElementsChanged", "onChangesApplied", "onModelGeometryChanged",
      "onElementsChanged", "onModelsChanged", "onChangesApplied",
      "onElementsChanged", "onChangesApplied",
    ]);

    await writableConn.txns.reinstateTxn();
    await expectRedo([
      "onElementsChanged", "onChangesApplied",
      "onElementsChanged", "onModelsChanged", "onChangesApplied",
      "onElementsChanged", "onChangesApplied", "onModelGeometryChanged",
      "onElementsChanged", "onChangesApplied", "onModelGeometryChanged",
      "onElementsChanged", "onChangesApplied", "onModelGeometryChanged",
    ]);
  }

  it("receives events for writable connection", async () => {
    await test(writableConn);
  });

  it.only("receives events for read-only connection when watchForChanges is enabled", async () => {
    const readableConn = await BriefcaseConnection.openFile({
      fileName: filePath,
      key: Guid.createValue(),
      readonly: true,
      watchForChanges: true,
    });

    await test(readableConn);
    await readableConn.close();
  });
});
