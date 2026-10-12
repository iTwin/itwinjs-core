/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Id64, Id64String, IModelStatus } from "@itwin/core-bentley";
import { IModel, IModelError, SheetProps } from "@itwin/core-common";
import { withEditTxn } from "../../EditTxn";
import { Sheet, SheetBorderPrototype, SheetPrototype } from "../../Element";
import { SnapshotDb } from "../../IModelDb";
import { DocumentListModel, DrawingModel, SheetModel } from "../../Model";
import { SheetHasSheetPrototype, SheetPrototypeHasSheetBorderPrototype } from "../../NavigationRelationship";
import { IModelTestUtils } from "../IModelTestUtils";

describe("SheetPrototype", () => {
  describe("with BisCore < 01.00.27", () => {
    let db: SnapshotDb;

    before(() => {
      db = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("SheetPrototype", "OldBisCore.bim"), { rootSubject: { name: "SheetPrototype" } });
    });

    after(() => db.close());

    it("throws", () => {
      expect(() => SheetPrototype.create({ iModel: db, definitionModelId: IModel.dictionaryId })).to.throw("SheetPrototype requires BisCore v01.00.27 or newer");
      expect(() => SheetBorderPrototype.create({ iModel: db, definitionModelId: IModel.dictionaryId })).to.throw("SheetBorderPrototype requires BisCore v01.00.27 or newer");
    });
  });

  describe("with BisCore >= 01.00.27", () => {
    let db: SnapshotDb;
    let documentListModelId: Id64String;

    before(async () => {
      db = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("SheetPrototype", "NewBisCore.bim"), { rootSubject: { name: "SheetPrototype" } });
      // TODO: remove this upgrade once @bentley/imodeljs-native ships BisCore 01.00.27.
      await db.importSchemas([IModelTestUtils.resolveAssetFile("SheetPrototype/BisCore.01.00.27.ecschema.xml")]);
      documentListModelId = withEditTxn(db, (txn) => DocumentListModel.insert(txn, IModel.rootSubjectId, "DocumentList"));
    });

    after(() => db.close());

    it("inserts a SheetBorderPrototype sub-modeled by a DrawingModel", () => {
      const borderId = withEditTxn(db, (txn) => SheetBorderPrototype.insert(txn, { definitionModelId: IModel.dictionaryId, height: 0.297, width: 0.42 }));
      expect(Id64.isValidId64(borderId)).to.be.true;

      const border = db.elements.getElement<SheetBorderPrototype>(borderId);
      expect(border).instanceof(SheetBorderPrototype);
      expect(border.height).to.equal(0.297);
      expect(border.width).to.equal(0.42);

      const model = db.models.getModel(borderId);
      expect(model).instanceof(DrawingModel);
      expect(model.modeledElement.id).to.equal(borderId);
    });

    it("inserts a SheetPrototype sub-modeled by a SheetModel and references its border", () => {
      const borderId = withEditTxn(db, (txn) => SheetBorderPrototype.insert(txn, { definitionModelId: IModel.dictionaryId, height: 0.297, width: 0.42 }));
      const prototypeId = withEditTxn(db, (txn) => SheetPrototype.insert(txn, {
        definitionModelId: IModel.dictionaryId,
        scale: 50,
        height: 0.297,
        width: 0.42,
        borderId,
      }));
      expect(Id64.isValidId64(prototypeId)).to.be.true;

      const prototype = db.elements.getElement<SheetPrototype>(prototypeId);
      expect(prototype).instanceof(SheetPrototype);
      expect(prototype.scale).to.equal(50);
      expect(prototype.height).to.equal(0.297);
      expect(prototype.width).to.equal(0.42);
      expect(prototype.border?.id).to.equal(borderId);
      expect(prototype.border?.relClassName?.replace(".", ":")).to.equal(SheetPrototypeHasSheetBorderPrototype.classFullName);
      expect(prototype.getReferenceIds().has(`e${borderId}`)).to.be.true;

      const model = db.models.getModel(prototypeId);
      expect(model).instanceof(SheetModel);
      expect(model.modeledElement.id).to.equal(prototypeId);
    });

    it("records the prototype a Sheet was created from", () => {
      const prototypeId = withEditTxn(db, (txn) => SheetPrototype.insert(txn, { definitionModelId: IModel.dictionaryId, height: 0.297, width: 0.42 }));
      const sheetProps: SheetProps = {
        classFullName: Sheet.classFullName,
        model: documentListModelId,
        code: Sheet.createCode(db, documentListModelId, "Sheet from prototype"),
        height: 0.297,
        width: 0.42,
        sheetPrototype: new SheetHasSheetPrototype(prototypeId),
      };
      const sheetId = withEditTxn(db, (txn) => txn.insertElement(sheetProps));

      const sheet = db.elements.getElement<Sheet>(sheetId);
      expect(sheet).instanceof(Sheet);
      expect(sheet.sheetPrototype?.id).to.equal(prototypeId);
      expect(sheet.sheetPrototype?.relClassName?.replace(".", ":")).to.equal(SheetHasSheetPrototype.classFullName);
      expect(sheet.getReferenceIds().has(`e${prototypeId}`)).to.be.true;
      expect((sheet.toJSON() as SheetProps).sheetPrototype?.id).to.equal(prototypeId);
    });

    it("rejects a SheetPrototype sub-modeled by a DrawingModel", () => {
      const prototypeId = withEditTxn(db, (txn) => SheetPrototype.create({ iModel: db, definitionModelId: IModel.dictionaryId }).insert(txn));
      withEditTxn(db, (txn) => {
        expect(() => txn.insertModel({ classFullName: DrawingModel.classFullName, modeledElement: { id: prototypeId } }))
          .to.throw(IModelError).with.property("errorNumber", IModelStatus.WrongModel);
      });
    });

    it("rejects a SheetBorderPrototype sub-modeled by a SheetModel", () => {
      const borderId = withEditTxn(db, (txn) => SheetBorderPrototype.create({ iModel: db, definitionModelId: IModel.dictionaryId }).insert(txn));
      withEditTxn(db, (txn) => {
        expect(() => txn.insertModel({ classFullName: SheetModel.classFullName, modeledElement: { id: borderId } }))
          .to.throw(IModelError).with.property("errorNumber", IModelStatus.WrongModel);
      });
    });
  });
});
