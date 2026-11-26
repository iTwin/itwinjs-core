/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Id64, Id64String, IModelStatus } from "@itwin/core-bentley";
import { LineSegment3d, Point2d, Point3d, Range2d } from "@itwin/core-geometry";
import { Code, CodeScopeSpec, GeometricElement2dProps, GeometryPartProps, GeometryStreamBuilder, IModel, IModelError, QueryBinder, SheetProps, SubCategoryAppearance, SubjectProps, ViewAttachmentProps } from "@itwin/core-common";
import { EditTxn, withEditTxn } from "../../EditTxn";
import { DrawingCategory } from "../../Category";
import { DisplayStyle2d } from "../../DisplayStyle";
import { DrawingGraphic, GeometryPart, Sheet, SheetBorderPrototype, SheetPrototype, Subject } from "../../Element";
import { ElementTreeDeleter } from "../../ElementTreeWalker";
import { SnapshotDb } from "../../IModelDb";
import { DocumentListModel, DrawingModel, SheetModel } from "../../Model";
import { SheetHasSheetPrototype, SheetPrototypeHasSheetBorderPrototype } from "../../NavigationRelationship";
import { CategorySelector, DrawingViewDefinition, ViewAttachment } from "../../ViewDefinition";
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
    let scopeSpecId: Id64String;

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
      scopeSpecId = withEditTxn(db, (txn) => db.codeSpecs.insert(txn, "SheetPrototypeScopeSpec", CodeScopeSpec.Type.RelatedElement));
    });

    after(() => db.close());

    const insertGraphic = (txn: EditTxn, modelId: Id64String, partId?: Id64String, code = Code.createEmpty()): Id64String => {
      const builder = new GeometryStreamBuilder();
      if (partId)
        builder.appendGeometryPart2d(partId);
      else
        builder.appendGeometry(LineSegment3d.create(Point3d.createZero(), Point3d.create(1, 0, 0)));

      const props: GeometricElement2dProps = {
        classFullName: DrawingGraphic.classFullName,
        model: modelId,
        category: drawingCategoryId,
        code,
        placement: { origin: Point2d.createZero(), angle: 0 },
        geom: builder.geometryStream,
      };
      return txn.insertElement(props);
    };

    const sheetProps = (name: string, links?: Pick<SheetProps, "sheetPrototype" | "sheetTemplate">): SheetProps => ({
      classFullName: Sheet.classFullName,
      model: documentListModelId,
      code: Sheet.createCode(db, documentListModelId, name),
      ...links,
    });

    const insertSheet = (txn: EditTxn, prototypeId: Id64String, name: string): Id64String => {
      return txn.insertElement(sheetProps(name, { sheetPrototype: new SheetHasSheetPrototype(prototypeId) }));
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
      const sheetId = withEditTxn(db, (txn) => txn.insertElement({
        ...sheetProps("Sheet from prototype", { sheetPrototype: new SheetHasSheetPrototype(prototypeId) }),
        height: 0.297,
        width: 0.42,
      } as SheetProps));

      const sheet = db.elements.getElement<Sheet>(sheetId);
      expect(sheet).instanceof(Sheet);
      expect(sheet.sheetPrototype?.id).to.equal(prototypeId);
      expect(sheet.sheetPrototype?.relClassName?.replace(".", ":")).to.equal(SheetHasSheetPrototype.classFullName);
      expect(sheet.getReferenceIds().has(`e${prototypeId}`)).to.be.true;
      expect((sheet.toJSON() as SheetProps).sheetPrototype?.id).to.equal(prototypeId);
    });

    it("records a sheetPrototype on a legacy Sheet that already has a sheetTemplate", () => {
      const { protoId, templateId, sheetId } = withEditTxn(db, (txn) => {
        const template = txn.insertElement({ classFullName: "BisCore:SheetTemplate", model: IModel.dictionaryId, code: Code.createEmpty() });
        // Legacy sheets hold the template as a navigation property.
        const sheet = txn.insertElement({ ...sheetProps("Legacy sheet"), sheetTemplate: { id: template } } as unknown as SheetProps);
        return { protoId: SheetPrototype.insert(txn, { definitionModelId: IModel.dictionaryId }), templateId: template, sheetId: sheet };
      });
      const queryLinks = () => db.withQueryReader("SELECT SheetTemplate.Id, SheetPrototype.Id FROM bis.Sheet WHERE ECInstanceId=?", (reader) => {
        reader.step();
        return [reader.current[0], reader.current[1]];
      }, new QueryBinder().bindId(1, sheetId));
      expect(queryLinks()).to.deep.equal([templateId, undefined]);

      const props = db.elements.getElementProps<SheetProps>(sheetId);
      withEditTxn(db, (txn) => txn.updateElement({ ...props, sheetPrototype: new SheetHasSheetPrototype(protoId) }));
      expect(queryLinks()).to.deep.equal([templateId, protoId]);
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

    // Inserts unused prototypes whose sub-model graphics use each other as code scope.
    const insertCrossScopedPrototypes = (txn: EditTxn, name: string) => {
      const protoA = SheetPrototype.insert(txn, { definitionModelId: IModel.dictionaryId });
      const protoB = SheetPrototype.insert(txn, { definitionModelId: IModel.dictionaryId });
      const graphicA = insertGraphic(txn, protoA);
      const graphicB = insertGraphic(txn, protoB, undefined, new Code({ spec: scopeSpecId, scope: graphicA, value: `${name}B` }));
      txn.updateElement({ ...db.elements.getElementProps(graphicA), code: new Code({ spec: scopeSpecId, scope: graphicB, value: `${name}A` }) });
      return { protoA, protoB, graphicA, graphicB };
    };

    it("deleteDefinitionElements deletes unused prototypes whose sub-models reference each other", () => {
      const ids = withEditTxn(db, (txn) => insertCrossScopedPrototypes(txn, "Mutual"));

      const used = withEditTxn(db, (txn) => txn.deleteDefinitionElements([ids.protoA, ids.protoB]));
      expect(used.size).to.equal(0);
      for (const id of [ids.protoA, ids.protoB, ids.graphicA, ids.graphicB])
        expect(db.elements.tryGetElementProps(id)).to.be.undefined;
    });

    // Inserts a Subject outside any prototype sub-model that uses `scopeId` as its code scope.
    const insertScopedSubject = (txn: EditTxn, scopeId: Id64String, value: string): Id64String => {
      const subjectProps: SubjectProps = {
        classFullName: Subject.classFullName,
        model: IModel.repositoryModelId,
        parent: { id: IModel.rootSubjectId, relClassName: "BisCore:SubjectOwnsSubjects" },
        code: new Code({ spec: scopeSpecId, scope: scopeId, value }),
      };
      return txn.insertElement(subjectProps);
    };

    it("deleteDefinitionElements keeps only the prototype whose sub-model content is referenced from outside", () => {
      const { ids, protoC, graphicC } = withEditTxn(db, (txn) => {
        const pair = insertCrossScopedPrototypes(txn, "Mixed");
        const proto = SheetPrototype.insert(txn, { definitionModelId: IModel.dictionaryId });
        const graphic = insertGraphic(txn, proto);
        insertScopedSubject(txn, graphic, "ExternalReference");
        return { ids: pair, protoC: proto, graphicC: graphic };
      });

      const used = withEditTxn(db, (txn) => txn.deleteDefinitionElements([ids.protoA, ids.protoB, protoC]));
      expect([...used]).to.deep.equal([protoC]);
      for (const id of [ids.protoA, ids.protoB, ids.graphicA, ids.graphicB])
        expect(db.elements.tryGetElementProps(id)).to.be.undefined;
      expect(db.elements.tryGetElementProps(protoC)).not.to.be.undefined;
      expect(db.elements.tryGetElementProps(graphicC)).not.to.be.undefined;
    });

    it("deleteDefinitionElements keeps a prototype with several sub-model elements referenced from outside", () => {
      const { protoId, graphicIds } = withEditTxn(db, (txn) => {
        const proto = SheetPrototype.insert(txn, { definitionModelId: IModel.dictionaryId });
        const graphics = [insertGraphic(txn, proto), insertGraphic(txn, proto)];
        graphics.forEach((graphic, i) => insertScopedSubject(txn, graphic, `MultipleReferences${i}`));
        return { protoId: proto, graphicIds: graphics };
      });

      const used = withEditTxn(db, (txn) => txn.deleteDefinitionElements([protoId]));
      expect([...used]).to.deep.equal([protoId]);
      for (const id of [protoId, ...graphicIds])
        expect(db.elements.tryGetElementProps(id)).not.to.be.undefined;
    });

    it("deleteDefinitionElements deletes a prototype and border linked by a view of the border attached to the prototype's sheet model", () => {
      const ids = withEditTxn(db, (txn) => {
        const border = SheetBorderPrototype.insert(txn, { definitionModelId: IModel.dictionaryId });
        const proto = SheetPrototype.insert(txn, { definitionModelId: IModel.dictionaryId, borderId: border });
        const categorySelector = CategorySelector.insert(txn, IModel.dictionaryId, "BorderViewCategories", [drawingCategoryId]);
        const displayStyle = DisplayStyle2d.insert(txn, IModel.dictionaryId, "BorderViewStyle");
        const view = DrawingViewDefinition.insert(txn, IModel.dictionaryId, "BorderView", border, categorySelector, displayStyle, Range2d.createXYXY(0, 0, 1, 1));
        const attachmentProps: ViewAttachmentProps = {
          classFullName: ViewAttachment.classFullName,
          model: proto,
          category: drawingCategoryId,
          code: Code.createEmpty(),
          placement: { origin: Point2d.createZero(), angle: 0 },
          view: { id: view },
        };
        return { proto, border, categorySelector, displayStyle, view, attachment: txn.insertElement(attachmentProps), graphic: insertGraphic(txn, border) };
      });

      const used = withEditTxn(db, (txn) => txn.deleteDefinitionElements([ids.proto, ids.border, ids.view, ids.categorySelector, ids.displayStyle]));
      expect([...used]).to.deep.equal([]);
      for (const id of Object.values(ids))
        expect(db.elements.tryGetElementProps(id)).to.be.undefined;
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
