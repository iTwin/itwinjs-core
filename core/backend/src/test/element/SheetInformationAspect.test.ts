/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { IModelDb, SnapshotDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";
import { Guid, Id64String } from "@itwin/core-bentley";
import { DocumentPartition, Sheet } from "../../Element";
import { DocumentListModel, SheetModel } from "../../Model";
import { GeometricModel2dProps, IModel, RelatedElement, SheetInformation, SheetProps } from "@itwin/core-common";
import { SheetInformationAspect } from "../../ElementAspect";

async function getOrCreateDocumentList(iModel: IModelDb): Promise<Id64String> {
  const documentListName = "SheetList";
  let documentListModelId: string | undefined;

  // Attempt to find an existing document partition and document list model
  const ids = iModel.queryEntityIds({ from: DocumentPartition.classFullName, where: `CodeValue = '${documentListName}'`});
  if (ids.size === 1) {
    documentListModelId = ids.values().next().value;
  }

  // If they do not exist, create the document partition and document list model
  if (documentListModelId === undefined) {
    const subjectId = iModel.elements.getRootSubject().id;
    await iModel.locks.acquireLocks({
      shared: subjectId,
    });
    documentListModelId = DocumentListModel.insert(iModel, subjectId, documentListName);
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
  const sheetElementId = iModel.elements.insertElement(sheetElementProps);

  const sheetModelProps: GeometricModel2dProps = {
    classFullName: SheetModel.classFullName,
    modeledElement: { id: sheetElementId, relClassName: "BisCore:ModelModelsElement" } as RelatedElement,
  };
  const sheetModelId = iModel.models.insertModel(sheetModelProps);

  return sheetModelId;
};

describe.only("SheetInformationAspect", () => {
  describe("with BisCore < 00.01.25", () => {
    let db: SnapshotDb;
    let sheetId: Id64String;

    before(async () => {
      const seedFileName = IModelTestUtils.resolveAssetFile("mirukuru.ibim");
      const testFileName = IModelTestUtils.prepareOutputFile("ProjectInformationRecord", "ProjectInformationRecordTest.bim");
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
          () => SheetInformationAspect.setSheetInformation({ designedBy: "me" }, sheetId, db)
        ).to.throw("SheetInformationAspect requires BisCore v01.00.25 or newer");
      });
    });
  });

  describe("with BisCore >= 00.01.25", () => {
    let db: SnapshotDb;

    before(async () => {
      db = SnapshotDb.createEmpty(
        IModelTestUtils.prepareOutputFile("SheetInformationAspect", "SheetInformationAspect.bim"),
        { rootSubject: { name: "SheetInformationAspect" } }
      );
    });

    after(() => db.close());

    function getSheetInfo(elemId: string): SheetInformation | undefined {
      return SheetInformationAspect.getSheetInformation(elemId, db);
    }

    function setSheetInfo(elemId: string, info: SheetInformation | undefined): void {
      SheetInformationAspect.setSheetInformation(info, elemId, db);
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
        const info = { designedBy: "me", checkedBy: "you", designedDate: new Date(Date.now()), drawnBy: "Bob Ross" };
        setSheetInfo(sheetId, info);
        expect(getSheetInfo(sheetId)).to.deep.equal(info);
      });
    });

    describe("setSheetInformation", () => {
      it("inserts aspect if it doesn't already exist", () => {

      });

      it("omits undefined fields", () => {

      });

      it("updates existing aspect", () => {

      });

      it("deletes existing aspect if information is undefined", () => {

      });

      it("is a no-op if information is undefined and no aspect exists", () => {

      });

      it("throws if element is not a valid Sheet", () => {

      });

      it("creates SheetOwnsSheetInformationAspect relationships", () => {

      });
    })
  });
});
