/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as path from "path";
import { Guid, OpenMode, ProcessDetector } from "@bentley/bentleyjs-core";
import { IModelJson, LineSegment3d, Point3d, Transform, YawPitchRollAngles } from "@bentley/geometry-core";
import { Code, IModelWriteRpcInterface } from "@bentley/imodeljs-common";
import {
  BriefcaseConnection, EditingFunctions, ElementEditor3d, IpcApp,
} from "@bentley/imodeljs-frontend";
import { ElectronApp } from "@bentley/electron-manager/lib/ElectronFrontend";

describe("BriefcaseTxns", () => {
  if (ProcessDetector.isElectronAppFrontend) {
    let imodel: BriefcaseConnection;

    before(async () => {
      await ElectronApp.startup();
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
      type TxnEvent = "onElementsChanged" | "onModelsChanged" | "onModelGeometryChanged" | "onCommit" | "onCommitted" | "onChangesApplied" | "onBeforeUndoRedo" | "onAfterUndoRedo";
      const received: TxnEvent[] = [];
      const txnEventNames: TxnEvent[] = ["onElementsChanged", "onModelsChanged", "onModelGeometryChanged", "onCommit", "onCommitted", "onChangesApplied", "onBeforeUndoRedo", "onAfterUndoRedo"];
      for (const event of txnEventNames) {
        imodel.txns[event].addListener(() => {
          received.push(event);
        });
      }

      const expected: TxnEvent[] = [];
      const expectEvents = (additionalEvents: TxnEvent[]) => {
        for (const additionalEvent of additionalEvents)
          expected.push(additionalEvent);

        expect(received).to.deep.equal(expected);
      };

      const expectCommit = (evts: TxnEvent[]) => expectEvents(["onCommit", ...evts, "onCommitted"]);

      const editor = await ElementEditor3d.start(imodel);
      const editing = new EditingFunctions(imodel);

      const dictModelId = await imodel.models.getDictionaryModel();
      const category = await editing.categories.createAndInsertSpatialCategory(dictModelId, Guid.createValue(), { color: 0 });
      await imodel.saveChanges();
      expectCommit(["onElementsChanged"]);

      const model = await editing.models.createAndInsertPhysicalModel(await editing.codes.makeModelCode(imodel.models.repositoryModelId, Guid.createValue()));
      await imodel.saveChanges();
      expectCommit(["onElementsChanged", "onModelsChanged"]);

      const insertLine = async () => {
        const segment = LineSegment3d.create(new Point3d(0, 0, 0), new Point3d(1, 1, 1));
        const geom = IModelJson.Writer.toIModelJson(segment);
        const props = { classFullName: "Generic:PhysicalObject", model, category, code: Code.createEmpty() };
        await editor.createElement(props, segment.point0Ref, new YawPitchRollAngles(), geom);
        const ret = await editor.writeReturningProps();
        expect(Array.isArray(ret)).to.be.true;
        expect(ret.length).to.equal(1);
        expect(ret[0].id).not.to.be.undefined;
        return ret[0].id!;
      };

      const elem1 = await insertLine();
      await imodel.saveChanges();
      expectCommit(["onElementsChanged", "onModelGeometryChanged"]);

      await editor.startModifyingElements([elem1]);
      await editor.applyTransform(Transform.createTranslationXYZ(1, 0, 0).toJSON());
      await editor.write();
      await imodel.saveChanges();
      expectCommit(["onElementsChanged", "onModelGeometryChanged"]);

      await IModelWriteRpcInterface.getClientForRouting(imodel.routingContext.token).deleteElements(imodel.getRpcProps(), [elem1]);
      await imodel.saveChanges();
      expectCommit(["onElementsChanged", "onModelGeometryChanged"]);

      const undo = async () => IpcApp.callIpcHost("reverseSingleTxn", imodel.key);
      const expectUndoRedo = (evts: TxnEvent[]) => expectEvents(["onBeforeUndoRedo", ...evts, "onChangesApplied", "onAfterUndoRedo"]);

      await undo();
      expectUndoRedo(["onElementsChanged", "onModelGeometryChanged"]);
      await undo();
      expectUndoRedo(["onElementsChanged", "onModelGeometryChanged"]);
      await undo();
      expectUndoRedo(["onElementsChanged", "onModelGeometryChanged"]);
      await undo();
      expectUndoRedo(["onElementsChanged", "onModelsChanged"]);
      await undo();
      expectUndoRedo(["onElementsChanged"]);

      const redo = async () => IpcApp.callIpcHost("reinstateTxn", imodel.key);
      await redo();
      expectUndoRedo(["onElementsChanged"]);
      await redo();
      expectUndoRedo(["onElementsChanged", "onModelsChanged"]);
      await redo();
      expectUndoRedo(["onElementsChanged", "onModelGeometryChanged"]);
      await redo();
      expectUndoRedo(["onElementsChanged", "onModelGeometryChanged"]);
      await redo();
      expectUndoRedo(["onElementsChanged", "onModelGeometryChanged"]);
    });
  }
});
