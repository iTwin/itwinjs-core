/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { IModelDb, SnapshotDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";
import { DbResult, Guid, Id64String } from "@itwin/core-bentley";
import { DocumentPartition, Sheet } from "../../Element";
import { DocumentListModel, SheetModel } from "../../Model";
import { EditTxnError, GeometricModel2dProps, IModel, RelatedElement, SheetInformation, SheetProps } from "@itwin/core-common";
import { SheetInformationAspect } from "../../ElementAspect";
import { SheetOwnsSheetInformationAspect } from "../../NavigationRelationship";
import { EditTxn, withEditTxn } from "../../EditTxn";

async function getOrCreateDocumentList(iModel: IModelDb): Promise<Id64String> {
  const documentListName = "SheetList";
  let documentListModelId: string | undefined;

  // Attempt to find an existing document partition and document list model
  const ids = iModel.queryEntityIds({ from: DocumentPartition.classFullName, where: `CodeValue = '${documentListName}'` });
  if (ids.size === 1) {
    documentListModelId = ids.values().next().value;
  }

  // If they do not exist, create the document partition and document list model
  if (documentListModelId === undefined) {
    const subjectId = iModel.elements.getRootSubject().id;
    await iModel.locks.acquireLocks({
      shared: subjectId,
    });
    documentListModelId = withEditTxn(iModel, (txn) => DocumentListModel.insert(txn, subjectId, documentListName));
  }

  return documentListModelId;
};

async function insertSheet(iModel: IModelDb): Promise<Id64String> {
  const sheetName = Guid.createValue();

  const createSheetProps = {
    height: 42,
    width: 42,
    scale: 42,
  };
  // Get or make documentListModelId
  const modelId = await getOrCreateDocumentList(iModel);

  // Acquire locks and create sheet
  await iModel.locks.acquireLocks({ shared: modelId });
  const sheetElementProps: SheetProps = {
    ...createSheetProps,
    classFullName: Sheet.classFullName,
    code: Sheet.createCode(iModel, modelId, sheetName),
    model: modelId,
  };
  return withEditTxn(iModel, (txn) => {
    const sheetElementId = txn.insertElement(sheetElementProps);
    const sheetModelProps: GeometricModel2dProps = {
      classFullName: SheetModel.classFullName,
      modeledElement: { id: sheetElementId, relClassName: "BisCore:ModelModelsElement" } as RelatedElement,
    };
    return txn.insertModel(sheetModelProps);
  });
};

describe("SheetInformationAspect", () => {
  describe("with BisCore < 00.01.25", () => {
    let db: SnapshotDb;
    let sheetId: Id64String;

    before(async () => {
      const seedFileName = IModelTestUtils.resolveAssetFile("mirukuru.ibim");
      const testFileName = IModelTestUtils.prepareOutputFile("SheetInformationAspect", "OldBisCore.bim");
      db = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
      sheetId = await insertSheet(db);
    });

    after(() => db.close());

    describe("getSheetInformation", () => {
      it("returns undefined", () => {
        expect(SheetInformationAspect.getSheetInformation(sheetId, db)).to.be.undefined;
      });
    });

    describe("setSheetInformation", () => {
      it("throws", () => {
        expect(
          () => withEditTxn(db, (txn) => SheetInformationAspect.setSheetInformation(txn, { designedBy: "me" }, sheetId))
        ).to.throw("SheetInformationAspect requires BisCore v01.00.25 or newer");
      });
    });
  });

  describe("with BisCore >= 00.01.25", () => {
    let db: SnapshotDb;
    const designedDate = new Date("2011-10-05T14:48:00.000Z");
    expect(designedDate.toISOString()).to.equal("2011-10-05T14:48:00.000Z");

    before(async () => {
      db = SnapshotDb.createEmpty(
        IModelTestUtils.prepareOutputFile("SheetInformationAspect", "NewBisCore.bim"),
        { rootSubject: { name: "SheetInformationAspect" } }
      );
    });

    after(() => db.close());

    function getSheetInfo(elemId: string): SheetInformation | undefined {
      return SheetInformationAspect.getSheetInformation(elemId, db);
    }

    function setSheetInfo(elemId: string, info: SheetInformation | undefined): void {
      withEditTxn(db, (txn) => SheetInformationAspect.setSheetInformation(txn, info, elemId));
    }

    describe("getSheetInformation", () => {
      it("returns undefined if no aspect exists", async () => {
        const sheetId = await insertSheet(db);
        expect(getSheetInfo(sheetId)).to.be.undefined;
      });

      it("returns undefined if element is not a valid Sheet", () => {
        expect(getSheetInfo(IModel.rootSubjectId)).to.be.undefined;
      });

      it("returns information if aspect exists", async () => {
        const sheetId = await insertSheet(db);
        const info = { designedBy: "me", checkedBy: "you", designedDate, drawnBy: "Bob Ross" };
        setSheetInfo(sheetId, info);
        expect(getSheetInfo(sheetId)).to.deep.equal(info);
      });
    });

    describe("setSheetInformation", () => {
      it("inserts aspect if it doesn't already exist", async () => {
        const sheetId = await insertSheet(db);
        expect(getSheetInfo(sheetId)).to.be.undefined;

        const info = { designedBy: "me", checkedBy: "you", designedDate, drawnBy: "Bob Ross" };
        setSheetInfo(sheetId, info);
        expect(getSheetInfo(sheetId)).to.deep.equal(info);
      });

      it("omits undefined fields", async () => {
        const info = { designedBy: "me" };
        const sheetId = await insertSheet(db);
        setSheetInfo(sheetId, info);
        expect(getSheetInfo(sheetId)).to.deep.equal({ designedBy: "me", checkedBy: undefined, designedDate: undefined, drawnBy: undefined });
      });

      it("includes fields set to empty strings", async () => {
        const info = { designedBy: "", checkedBy: "", designedDate, drawnBy: "" };
        const sheetId = await insertSheet(db);
        setSheetInfo(sheetId, info);
        expect(getSheetInfo(sheetId)).to.deep.equal(info);
      });

      it("updates existing aspect", async () => {
        const sheetId = await insertSheet(db);
        const initialInfo = { designedBy: "me", checkedBy: "you", designedDate, drawnBy: "Bob Ross" };
        setSheetInfo(sheetId, initialInfo);
        expect(getSheetInfo(sheetId)).to.deep.equal(initialInfo);

        const updatedInfo = { designedBy: "you", checkedBy: "me", designedDate, drawnBy: "Pablo Picasso" };
        setSheetInfo(sheetId, updatedInfo);
        expect(getSheetInfo(sheetId)).to.deep.equal(updatedInfo);
      });

      it("selectively updates existing aspect", async () => {
        const sheetId = await insertSheet(db);
        const initialInfo = { designedBy: "me", checkedBy: "you", designedDate, drawnBy: "Bob Ross" };
        setSheetInfo(sheetId, initialInfo);
        expect(getSheetInfo(sheetId)).to.deep.equal(initialInfo);

        const updatedInfo = { designedBy: "my buddy Gary" };
        setSheetInfo(sheetId, updatedInfo);
        expect(getSheetInfo(sheetId)).to.deep.equal({ designedDate, designedBy: "my buddy Gary", checkedBy: "you", drawnBy: "Bob Ross" });
      });

      it("deletes existing aspect if information is undefined", async () => {
        const sheetId = await insertSheet(db);
        const info = { designedBy: "me", checkedBy: "you", designedDate, drawnBy: "Bob Ross" };
        setSheetInfo(sheetId, info);
        expect(getSheetInfo(sheetId)).to.deep.equal(info);
        setSheetInfo(sheetId, undefined);
        expect(getSheetInfo(sheetId)).to.be.undefined;
      });

      it("is a no-op if information is undefined and no aspect exists", async () => {
        const sheetId = await insertSheet(db);
        expect(getSheetInfo(sheetId)).to.be.undefined;
        setSheetInfo(sheetId, undefined);
        expect(getSheetInfo(sheetId)).to.be.undefined;
      });

      it("throws if element is not a Sheet", () => {
        const info = { designedBy: "me", checkedBy: "you", designedDate, drawnBy: "Bob Ross" };
        expect(() => setSheetInfo(IModel.rootSubjectId, info)).to.throw("SheetInformationAspect can only be applied to a Sheet element");
      });

      it("supports deprecated setSheetInformation overload when implicit writes are allowed", async () => {
        const previousEnforcement = EditTxn.implicitWriteEnforcement;
        EditTxn.implicitWriteEnforcement = "allow";

        try {
          const sheetId = await insertSheet(db);
          const info = { designedBy: "legacy", checkedBy: "legacy-check", designedDate, drawnBy: "legacy-draw" };

          // eslint-disable-next-line @typescript-eslint/no-deprecated
          SheetInformationAspect.setSheetInformation(info, sheetId, db);
          expect(getSheetInfo(sheetId)).to.deep.equal(info);

          // eslint-disable-next-line @typescript-eslint/no-deprecated
          SheetInformationAspect.setSheetInformation(undefined, sheetId, db);
          expect(getSheetInfo(sheetId)).to.be.undefined;
        } finally {
          EditTxn.implicitWriteEnforcement = previousEnforcement;
        }
      });

      it("rejects deprecated setSheetInformation overload when implicit writes are disallowed", async () => {
        const previousEnforcement = EditTxn.implicitWriteEnforcement;
        EditTxn.implicitWriteEnforcement = "throw";

        try {
          const sheetId = await insertSheet(db);
          const info = { designedBy: "legacy", checkedBy: "legacy-check", designedDate, drawnBy: "legacy-draw" };

          // eslint-disable-next-line @typescript-eslint/no-deprecated
          expect(() => SheetInformationAspect.setSheetInformation(info, sheetId, db)).to.throw().that.satisfies((error: unknown) =>
            EditTxnError.isError(error, "implicit-txn-write-disallowed"));
        } finally {
          EditTxn.implicitWriteEnforcement = previousEnforcement;
        }
      });

      it("creates SheetOwnsSheetInformationAspect relationships", async () => {
        const sheetId = await insertSheet(db);

        function countRelationships(): number {
          // eslint-disable-next-line @typescript-eslint/no-deprecated
          return db.withPreparedStatement(`SELECT COUNT(*) FROM ${SheetOwnsSheetInformationAspect.classFullName} WHERE SourceECInstanceId=${sheetId}`, (stmt) => {
            expect(stmt.step()).to.equal(DbResult.BE_SQLITE_ROW);
            return stmt.getValue(0).getInteger();
          });
        }

        expect(countRelationships()).to.equal(0);
        setSheetInfo(sheetId, { designedBy: "me", checkedBy: "you", designedDate, drawnBy: "Bob Ross" });
        expect(countRelationships()).to.equal(1);
      });
    })
  });
});
