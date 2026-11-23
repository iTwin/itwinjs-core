/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Id64, Id64String, IModelStatus } from "@itwin/core-bentley";
import { LineSegment3d, Point2d, Point3d } from "@itwin/core-geometry";
import { Code, GeometricElement2dProps, GeometryPartProps, GeometryStreamBuilder, IModel, IModelError, SheetProps, SubCategoryAppearance } from "@itwin/core-common";
import { EditTxn, withEditTxn } from "../../EditTxn";
import { DrawingCategory } from "../../Category";
import { DrawingGraphic, GeometryPart, Sheet, SheetBorderPrototype, SheetPrototype } from "../../Element";
import { ElementTreeDeleter } from "../../ElementTreeWalker";
import { SnapshotDb } from "../../IModelDb";
import { DocumentListModel, DrawingModel, SheetModel } from "../../Model";
import { SheetHasSheetPrototype, SheetPrototypeHasSheetBorderPrototype } from "../../NavigationRelationship";
import { IModelTestUtils } from "../IModelTestUtils";

describe("SheetPrototype", () => {
  describe("with BisCore < 01.00.27", () => {
    let db: SnapshotDb;

    before(() => {
      const seedFileName = IModelTestUtils.resolveAssetFile("mirukuru.ibim");
      const testFileName = IModelTestUtils.prepareOutputFile("SheetPrototype", "OldBisCore.bim");
      db = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
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
    let drawingCategoryId: Id64String;

    const testSchemaXml = `<?xml version="1.0" encoding="UTF-8"?>
<ECSchema schemaName="TestSheetProto" alias="tsp" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
  <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
  <ECEntityClass typeName="TestSheetModel">
    <BaseClass>bis:SheetModel</BaseClass>
  </ECEntityClass>
  <ECEntityClass typeName="TestDrawingModel">
    <BaseClass>bis:DrawingModel</BaseClass>
  </ECEntityClass>
</ECSchema>`;

    before(async () => {
      db = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("SheetPrototype", "NewBisCore.bim"), { rootSubject: { name: "SheetPrototype" } });
      await db.importSchemaStrings([testSchemaXml]);
      documentListModelId = withEditTxn(db, (txn) => DocumentListModel.insert(txn, IModel.rootSubjectId, "DocumentList"));
      drawingCategoryId = withEditTxn(db, (txn) => DrawingCategory.insert(txn, IModel.dictionaryId, "PrototypeContent", new SubCategoryAppearance()));
    });

    after(() => db.close());

    const insertGraphic = (txn: EditTxn, modelId: Id64String, partId?: Id64String): Id64String => {
      const builder = new GeometryStreamBuilder();
      if (partId)
        builder.appendGeometryPart2d(partId);
      else
        builder.appendGeometry(LineSegment3d.create(Point3d.createZero(), Point3d.create(1, 0, 0)));

      const props: GeometricElement2dProps = {
        classFullName: DrawingGraphic.classFullName,
        model: modelId,
        category: drawingCategoryId,
        code: Code.createEmpty(),
        placement: { origin: Point2d.createZero(), angle: 0 },
        geom: builder.geometryStream,
      };
      return txn.insertElement(props);
    };

    const insertSheet = (txn: EditTxn, prototypeId: Id64String, name: string): Id64String => {
      const sheetProps: SheetProps = {
        classFullName: Sheet.classFullName,
        model: documentListModelId,
        code: Sheet.createCode(db, documentListModelId, name),
        sheetPrototype: new SheetHasSheetPrototype(prototypeId),
      };
      return txn.insertElement(sheetProps);
    };

    it("inserts a SheetPrototype and SheetBorderPrototype with their sub-models", () => {
      const borderId = withEditTxn(db, (txn) => SheetBorderPrototype.insert(txn, { definitionModelId: IModel.dictionaryId, height: 0.297, width: 0.42 }));
      const border = db.elements.getElement<SheetBorderPrototype>(borderId);
      expect(border).instanceof(SheetBorderPrototype);
      expect(border.height).to.equal(0.297);
      expect(border.width).to.equal(0.42);

      const borderModel = db.models.getModel(borderId);
      expect(borderModel).instanceof(DrawingModel);
      expect(borderModel.modeledElement.relClassName).to.equal("BisCore:DrawingModelBreaksDownSheetBorderPrototype");

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
      expect(model.modeledElement.relClassName).to.equal("BisCore:SheetModelBreaksDownSheetPrototype");
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

    it("enforces the sub-model class of prototypes and borders, allowing subclasses", () => {
      const { prototypeId, borderId } = withEditTxn(db, (txn) => ({
        prototypeId: SheetPrototype.create({ iModel: db, definitionModelId: IModel.dictionaryId }).insert(txn),
        borderId: SheetBorderPrototype.create({ iModel: db, definitionModelId: IModel.dictionaryId }).insert(txn),
      }));

      withEditTxn(db, (txn) => {
        expect(() => txn.insertModel({ classFullName: DrawingModel.classFullName, modeledElement: { id: prototypeId } }))
          .to.throw(IModelError).with.property("errorNumber", IModelStatus.WrongModel);
        expect(() => txn.insertModel({ classFullName: SheetModel.classFullName, modeledElement: { id: borderId } }))
          .to.throw(IModelError).with.property("errorNumber", IModelStatus.WrongModel);
      });

      withEditTxn(db, (txn) => {
        txn.insertModel({ classFullName: "TestSheetProto:TestSheetModel", modeledElement: { id: prototypeId }, isTemplate: true });
        txn.insertModel({ classFullName: "TestSheetProto:TestDrawingModel", modeledElement: { id: borderId }, isTemplate: true });
      });
      expect(db.models.getModel(prototypeId).classFullName).to.equal("TestSheetProto:TestSheetModel");
      expect(db.models.getModel(borderId).classFullName).to.equal("TestSheetProto:TestDrawingModel");
    });

    it("rejects creating a SheetPrototype whose borderId is not a SheetBorderPrototype", () => {
      const prototypeId = withEditTxn(db, (txn) => SheetPrototype.insert(txn, { definitionModelId: IModel.dictionaryId }));
      expect(() => SheetPrototype.create({ iModel: db, definitionModelId: IModel.dictionaryId, borderId: prototypeId }))
        .to.throw("is not a SheetBorderPrototype");
      expect(() => SheetPrototype.create({ iModel: db, definitionModelId: IModel.dictionaryId, borderId: "0x123456789" }))
        .to.throw("is not a SheetBorderPrototype");
    });

    it("deleteDefinitionElements keeps prototypes used by sheets and borders used by prototypes, and deletes unused ones", () => {
      const { borderId, usedProtoId, unusedProtoId } = withEditTxn(db, (txn) => {
        const border = SheetBorderPrototype.insert(txn, { definitionModelId: IModel.dictionaryId });
        const usedProto = SheetPrototype.insert(txn, { definitionModelId: IModel.dictionaryId, borderId: border });
        insertSheet(txn, usedProto, "Sheet using prototype");
        return { borderId: border, usedProtoId: usedProto, unusedProtoId: SheetPrototype.insert(txn, { definitionModelId: IModel.dictionaryId }) };
      });

      const used = withEditTxn(db, (txn) => txn.deleteDefinitionElements([usedProtoId, unusedProtoId, borderId]));
      expect([...used].sort()).to.deep.equal([borderId, usedProtoId].sort());
      expect(db.elements.tryGetElementProps(usedProtoId)).not.to.be.undefined;
      expect(db.elements.tryGetElementProps(borderId)).not.to.be.undefined;
      expect(db.elements.tryGetElementProps(unusedProtoId)).to.be.undefined;
      expect(db.models.tryGetModelProps(unusedProtoId)).to.be.undefined;
    });

    it("deleteDefinitionElements deletes a part used only by graphics in a deleted border's sub-model", () => {
      const { protoId, borderId, partId, graphicId } = withEditTxn(db, (txn) => {
        const border = SheetBorderPrototype.insert(txn, { definitionModelId: IModel.dictionaryId });
        const proto = SheetPrototype.insert(txn, { definitionModelId: IModel.dictionaryId, borderId: border });
        const partBuilder = new GeometryStreamBuilder();
        partBuilder.appendGeometry(LineSegment3d.create(Point3d.createZero(), Point3d.create(1, 0, 0)));
        const partProps: GeometryPartProps = {
          classFullName: GeometryPart.classFullName,
          model: IModel.dictionaryId,
          code: GeometryPart.createCode(db, IModel.dictionaryId, "BorderPart"),
          geom: partBuilder.geometryStream,
        };
        const part = txn.insertElement(partProps);
        return { protoId: proto, borderId: border, partId: part, graphicId: insertGraphic(txn, border, part) };
      });

      const used = withEditTxn(db, (txn) => txn.deleteDefinitionElements([protoId, borderId, partId]));
      expect(used.size).to.equal(0);
      expect(db.elements.tryGetElementProps(protoId)).to.be.undefined;
      expect(db.elements.tryGetElementProps(borderId)).to.be.undefined;
      expect(db.models.tryGetModelProps(borderId)).to.be.undefined;
      expect(db.elements.tryGetElementProps(graphicId)).to.be.undefined;
      expect(db.elements.tryGetElementProps(partId)).to.be.undefined;
    });

    it("ElementTreeDeleter preserves the populated sub-models of prototypes and borders that are still in use", () => {
      const { protoId, borderId, protoGraphicId, borderGraphicId, sheetId } = withEditTxn(db, (txn) => {
        const border = SheetBorderPrototype.insert(txn, { definitionModelId: IModel.dictionaryId });
        const proto = SheetPrototype.insert(txn, { definitionModelId: IModel.dictionaryId, borderId: border });
        return {
          protoId: proto,
          borderId: border,
          protoGraphicId: insertGraphic(txn, proto),
          borderGraphicId: insertGraphic(txn, border),
          sheetId: insertSheet(txn, proto, "Sheet using populated prototype"),
        };
      });

      withEditTxn(db, (txn) => {
        const deleter = new ElementTreeDeleter(txn);
        deleter.deleteNormalElements(protoId);
        deleter.deleteNormalElements(borderId);
        deleter.deleteSpecialElements();
      });

      for (const id of [protoId, borderId]) {
        expect(db.elements.tryGetElementProps(id)).not.to.be.undefined;
        expect(db.models.tryGetModelProps(id)).not.to.be.undefined;
      }
      expect(db.elements.tryGetElementProps(protoGraphicId)).not.to.be.undefined;
      expect(db.elements.tryGetElementProps(borderGraphicId)).not.to.be.undefined;
      expect(db.elements.getElement<Sheet>(sheetId).sheetPrototype?.id).to.equal(protoId);
    });

    it("deleteElementTree deletes an unused prototype and border together with their populated sub-models", () => {
      const { protoId, borderId, protoGraphicId, borderGraphicId } = withEditTxn(db, (txn) => {
        const border = SheetBorderPrototype.insert(txn, { definitionModelId: IModel.dictionaryId });
        const proto = SheetPrototype.insert(txn, { definitionModelId: IModel.dictionaryId, borderId: border });
        return { protoId: proto, borderId: border, protoGraphicId: insertGraphic(txn, proto), borderGraphicId: insertGraphic(txn, border) };
      });

      withEditTxn(db, (txn) => {
        const deleter = new ElementTreeDeleter(txn);
        deleter.deleteNormalElements(protoId);
        deleter.deleteNormalElements(borderId);
        deleter.deleteSpecialElements();
      });

      for (const id of [protoId, borderId, protoGraphicId, borderGraphicId])
        expect(db.elements.tryGetElementProps(id)).to.be.undefined;
      expect(db.models.tryGetModelProps(protoId)).to.be.undefined;
      expect(db.models.tryGetModelProps(borderId)).to.be.undefined;
    });
  });
});
