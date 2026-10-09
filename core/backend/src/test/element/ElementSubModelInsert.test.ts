/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the repository root for full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { spy as sinonSpy } from "sinon";
import { Id64, Id64String, IModelStatus } from "@itwin/core-bentley";
import { Code, IModel, IModelError } from "@itwin/core-common";
import { ClassRegistry } from "../../ClassRegistry";
import { withEditTxn } from "../../EditTxn";
import { Document, Drawing, OnSubModelPropsArg, SectionDrawing, Sheet, TemplateRecipe2d } from "../../Element";
import { EntityClassType } from "../../Entity";
import { GenericSchema } from "../../domains/GenericSchema";
import { SnapshotDb } from "../../IModelDb";
import { DefinitionModel, DocumentListModel, DrawingModel, Model, SectionDrawingModel, SheetModel } from "../../Model";
import { Schema, Schemas } from "../../Schema";
import { IModelTestUtils } from "../IModelTestUtils";

class TestSubModelSchema extends Schema {
  public static override get schemaName(): string { return "TestSubModel"; }
}

/** A Sheet subclass that overrides the hook and defers to the inherited validation via `super`. */
class TestSheetSpy extends Sheet {
  public static override get className(): string { return "TestSheetSpy"; }
  public static override onSubModelInsert(arg: OnSubModelPropsArg): void {
    super.onSubModelInsert(arg);
  }
}

/** A Sheet subclass that widens the inherited rule to also permit a DrawingModel. */
class TestSheetWidened extends Sheet {
  public static override get className(): string { return "TestSheetWidened"; }
  protected static override get allowedSubModelClasses(): Array<EntityClassType<Model>> { return [SheetModel, DrawingModel]; }
}

/** A Sheet subclass that replaces the hook without calling `super`, opting out of validation. */
class TestSheetUnvalidated extends Sheet {
  public static override get className(): string { return "TestSheetUnvalidated"; }
  public static override onSubModelInsert(_arg: OnSubModelPropsArg): void { }
}

/** A domain ISubModeledElement unrelated to Sheet/Drawing that opts in by overriding only the getter. */
class TestRestrictedDocument extends Document {
  public static override get className(): string { return "TestRestrictedDocument"; }
  protected static override get allowedSubModelClasses(): Array<EntityClassType<Model>> { return [DrawingModel]; }
}

const testSchemaXml = `<?xml version="1.0" encoding="UTF-8"?>
<ECSchema schemaName="TestSubModel" alias="tsm" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
  <ECSchemaReference name="BisCore" version="01.00.04" alias="bis"/>
  <ECCustomAttributes>
    <SchemaHasBehavior xmlns="BisCore.01.00.00"/>
  </ECCustomAttributes>
  <ECEntityClass typeName="TestSheetModel">
    <BaseClass>bis:SheetModel</BaseClass>
  </ECEntityClass>
  <ECEntityClass typeName="TestSheetGenerated">
    <BaseClass>bis:Sheet</BaseClass>
  </ECEntityClass>
  <ECEntityClass typeName="TestSheetSpy">
    <BaseClass>bis:Sheet</BaseClass>
  </ECEntityClass>
  <ECEntityClass typeName="TestSheetWidened">
    <BaseClass>bis:Sheet</BaseClass>
  </ECEntityClass>
  <ECEntityClass typeName="TestSheetUnvalidated">
    <BaseClass>bis:Sheet</BaseClass>
  </ECEntityClass>
  <ECEntityClass typeName="TestHostDocument">
    <BaseClass>bis:Document</BaseClass>
    <BaseClass>bis:ISubModeledElement</BaseClass>
  </ECEntityClass>
  <ECEntityClass typeName="TestRestrictedDocument">
    <BaseClass>bis:Document</BaseClass>
    <BaseClass>bis:ISubModeledElement</BaseClass>
  </ECEntityClass>
</ECSchema>`;

describe("Sub-model insert validation", () => {
  let imodel: SnapshotDb;
  let documentListModelId: Id64String;

  before(async () => {
    GenericSchema.registerSchema();
    Schemas.registerSchema(TestSubModelSchema);
    ClassRegistry.register(TestSheetSpy, TestSubModelSchema);
    ClassRegistry.register(TestSheetWidened, TestSubModelSchema);
    ClassRegistry.register(TestSheetUnvalidated, TestSubModelSchema);
    ClassRegistry.register(TestRestrictedDocument, TestSubModelSchema);

    const iModelPath = IModelTestUtils.prepareOutputFile("SubModelInsert", "SubModelInsert.bim");
    imodel = SnapshotDb.createEmpty(iModelPath, { rootSubject: { name: "SubModelInsertTest" } });
    await imodel.importSchemaStrings([testSchemaXml]);
    documentListModelId = withEditTxn(imodel, (txn) => DocumentListModel.insert(txn, SnapshotDb.rootSubjectId, "DocumentList"));
  });

  after(() => {
    imodel.close();
    Schemas.unregisterSchema(TestSubModelSchema.schemaName);
  });

  function insertHost(classFullName: string, modelId: Id64String = documentListModelId): Id64String {
    const id = withEditTxn(imodel, (txn) => txn.insertElement({ classFullName, model: modelId, code: Code.createEmpty() }));
    expect(Id64.isValidId64(id)).to.be.true;
    return id;
  }

  function insertSubModel(modelClassFullName: string, modeledElementId: Id64String): Id64String {
    return withEditTxn(imodel, (txn) => txn.insertModel({ classFullName: modelClassFullName, modeledElement: { id: modeledElementId } }));
  }

  function expectAccepted(hostClassFullName: string, modelClassFullName: string, hostModelId?: Id64String): void {
    const hostId = insertHost(hostClassFullName, hostModelId);
    const modelId = insertSubModel(modelClassFullName, hostId);
    expect(modelId).to.equal(hostId);
    expect(imodel.models.getModel(modelId).classFullName).to.equal(modelClassFullName);
  }

  function expectRejected(hostClassFullName: string, modelClassFullName: string, hostModelId?: Id64String): void {
    const hostId = insertHost(hostClassFullName, hostModelId);
    let error: unknown;
    try {
      insertSubModel(modelClassFullName, hostId);
    } catch (err) {
      error = err;
    }

    expect(error).to.be.instanceOf(IModelError);
    expect((error as IModelError).errorNumber).to.equal(IModelStatus.WrongModel);
    expect((error as IModelError).message).to.contain("must be sub-modeled by");
    expect(imodel.models.tryGetModel(hostId)).to.be.undefined;
  }

  describe("accepts", () => {
    it("Sheet + SheetModel", () => expectAccepted(Sheet.classFullName, SheetModel.classFullName));
    it("Drawing + DrawingModel", () => expectAccepted(Drawing.classFullName, DrawingModel.classFullName));
    it("SectionDrawing + DrawingModel", () => expectAccepted(SectionDrawing.classFullName, DrawingModel.classFullName));
    it("SectionDrawing + SectionDrawingModel", () => expectAccepted(SectionDrawing.classFullName, SectionDrawingModel.classFullName));
    it("SectionDrawing + Generic:GraphicalModel3d", () => expectAccepted(SectionDrawing.classFullName, "Generic:GraphicalModel3d"));
    it("TemplateRecipe2d + DrawingModel", () => expectAccepted(TemplateRecipe2d.classFullName, DrawingModel.classFullName, IModel.dictionaryId));
    it("Sheet + SheetModel subclass without a JS class", () => expectAccepted(Sheet.classFullName, "TestSubModel:TestSheetModel"));
    it("no allowedSubModelClasses → any model accepted", () => {
      expectAccepted("TestSubModel:TestHostDocument", SheetModel.classFullName);
      expectAccepted("TestSubModel:TestHostDocument", DrawingModel.classFullName);
    });
    it("Sheet subclass that widens allowedSubModelClasses + DrawingModel", () => expectAccepted(TestSheetWidened.classFullName, DrawingModel.classFullName));
    it("Sheet subclass that overrides onSubModelInsert without super + DrawingModel", () => expectAccepted(TestSheetUnvalidated.classFullName, DrawingModel.classFullName));
    it("Document subclass with allowedSubModelClasses + DrawingModel", () => expectAccepted(TestRestrictedDocument.classFullName, DrawingModel.classFullName));
  });

  describe("rejects with IModelStatus.WrongModel", () => {
    it("Sheet + DrawingModel", () => expectRejected(Sheet.classFullName, DrawingModel.classFullName));
    it("Drawing + SheetModel", () => expectRejected(Drawing.classFullName, SheetModel.classFullName));
    it("SectionDrawing + SheetModel", () => expectRejected(SectionDrawing.classFullName, SheetModel.classFullName));
    it("TemplateRecipe2d + SheetModel", () => expectRejected(TemplateRecipe2d.classFullName, SheetModel.classFullName, IModel.dictionaryId));
    it("Sheet subclass without a JS class + DrawingModel", () => expectRejected("TestSubModel:TestSheetGenerated", DrawingModel.classFullName));
    it("Document subclass with allowedSubModelClasses + SheetModel", () => expectRejected(TestRestrictedDocument.classFullName, SheetModel.classFullName));
  });

  it("invokes an overriding subclass hook that defers to the inherited validation", () => {
    const spy = sinonSpy(TestSheetSpy, "onSubModelInsert");
    try {
      expectAccepted(TestSheetSpy.classFullName, SheetModel.classFullName);
      expect(spy.calledOnce).to.be.true;
      expect(spy.getCall(0).args[0].subModelProps.classFullName).to.equal(SheetModel.classFullName);

      expectRejected(TestSheetSpy.classFullName, DrawingModel.classFullName);
      expect(spy.calledTwice).to.be.true;
      expect(spy.getCall(1).threw()).to.be.true;
    } finally {
      spy.restore();
    }
  });

  it("rejects sub-model insertion when required domain behavior is not registered", () => {
    const hostId = insertHost(TestRestrictedDocument.classFullName);
    Schemas.unregisterSchema(TestSubModelSchema.schemaName);

    try {
      let error: unknown;
      try {
        insertSubModel(DefinitionModel.classFullName, hostId);
      } catch (err) {
        error = err;
      }

      expect(error).to.be.instanceOf(IModelError);
      expect((error as IModelError).errorNumber).to.equal(IModelStatus.WrongHandler);
      expect(imodel.models.tryGetModel(hostId)).to.be.undefined;
    } finally {
      Schemas.registerSchema(TestSubModelSchema);
      ClassRegistry.register(TestSheetSpy, TestSubModelSchema);
      ClassRegistry.register(TestSheetWidened, TestSubModelSchema);
      ClassRegistry.register(TestSheetUnvalidated, TestSubModelSchema);
      ClassRegistry.register(TestRestrictedDocument, TestSubModelSchema);
    }
  });
});
