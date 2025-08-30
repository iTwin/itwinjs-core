/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Code, ElementAspectProps, FieldPropertyHost, FieldPropertyPath, FieldRun, PhysicalElementProps, SubCategoryAppearance, TextAnnotation, TextBlock, TextRun } from "@itwin/core-common";
import { IModelDb, StandaloneDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";
import { createUpdateContext, FieldProperty, updateField, updateFields } from "../../internal/annotations/fields";
import { DbResult, Id64, Id64String } from "@itwin/core-bentley";
import { SpatialCategory } from "../../Category";
import { Point3d, XYAndZ, YawPitchRollAngles } from "@itwin/core-geometry";
import { Schema, Schemas } from "../../Schema";
import { ClassRegistry } from "../../ClassRegistry";
import { PhysicalElement } from "../../Element";
import { ElementOwnsUniqueAspect, ElementUniqueAspect, FontFile, TextAnnotation3d } from "../../core-backend";
import { ElementDrivesTextAnnotation, TextAnnotationUsesTextStyle } from "../../annotations/ElementDrivesTextAnnotation";

describe("updateField", () => {
  const mockElementId = "0x1";
  const mockPath: FieldPropertyPath = {
    propertyName: "mockProperty",
    accessors: [0, "nestedProperty"],
  };
  const mockCachedContent = "cachedContent";
  const mockUpdatedContent = "updatedContent";

  const createMockContext = (elementId: string, propertyValue?: string) => ({
    hostElementId: elementId,
    getProperty: (field: FieldRun): FieldProperty | undefined => {
      const propertyPath = field.propertyPath;
      if (
        propertyPath.propertyName === "mockProperty" &&
        propertyPath.accessors?.[0] === 0 &&
        propertyPath.accessors?.[1] === "nestedProperty" &&
        propertyValue !== undefined
      ) {
        return { value: propertyValue, metadata: {} as any };
      }
      return undefined;
    },
  });

  it("does nothing if hostElementId does not match", () => {
    const fieldRun = FieldRun.create({
      propertyHost: { elementId: mockElementId, schemaName: "TestSchema", className: "TestClass" },
      propertyPath: mockPath,
      cachedContent: mockCachedContent,
    });

    const context = createMockContext("0x2", mockUpdatedContent);
    const result = updateField(fieldRun, context);

    expect(result).to.be.false;
    expect(fieldRun.cachedContent).to.equal(mockCachedContent);
  });

  it("produces invalid content indicator if property value is undefined", () => {
    const fieldRun = FieldRun.create({
      propertyHost: { elementId: mockElementId, schemaName: "TestSchema", className: "TestClass" },
      propertyPath: mockPath,
      cachedContent: mockCachedContent,
    });

    const context = createMockContext(mockElementId);
    const result = updateField(fieldRun, context);

    expect(result).to.be.true;
    expect(fieldRun.cachedContent).to.equal(FieldRun.invalidContentIndicator);
  });

  it("returns false if cached content matches new content", () => {
    const fieldRun = FieldRun.create({
      propertyHost: { elementId: mockElementId, schemaName: "TestSchema", className: "TestClass" },
      propertyPath: mockPath,
      cachedContent: mockCachedContent,
    });

    const context = createMockContext(mockElementId, mockCachedContent);
    const result = updateField(fieldRun, context);

    expect(result).to.be.false;
    expect(fieldRun.cachedContent).to.equal(mockCachedContent);
  });

  it("returns true and updates cached content if new content is different", () => {
    const fieldRun = FieldRun.create({
      propertyHost: { elementId: mockElementId, schemaName: "TestSchema", className: "TestClass" },
      propertyPath: mockPath,
      cachedContent: mockCachedContent,
    });

    const context = createMockContext(mockElementId, mockUpdatedContent);
    const result = updateField(fieldRun, context);

    expect(result).to.be.true;
    expect(fieldRun.cachedContent).to.equal(mockUpdatedContent);
  });

  it("resolves to invalid content indicator if an exception occurs", () => {
    const fieldRun = FieldRun.create({
      propertyHost: { elementId: mockElementId, schemaName: "TestSchema", className: "TestClass" },
      propertyPath: mockPath,
      cachedContent: mockCachedContent,
    });

    const context = {
      hostElementId: mockElementId,
      getProperty: () => {
        throw new Error("Test exception");
      },
    };

    const result = updateField(fieldRun, context);

    expect(result).to.be.true;
    expect(fieldRun.cachedContent).to.equal(FieldRun.invalidContentIndicator);
  });
});

const fieldsSchemaXml = `
<?xml version="1.0" encoding="UTF-8"?>
<ECSchema schemaName="Fields" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
  <ECSchemaReference name="BisCore" version="01.00.04" alias="bis"/>

  <ECStructClass typeName="InnerStruct" modifier="None">
    <ECProperty propertyName="bool" typeName="boolean"/>
    <ECArrayProperty propertyName="doubles" typeName="double" minOccurs="0" maxOccurs="unbounded"/>
  </ECStructClass>

  <ECStructClass typeName="OuterStruct" modifier="None">
    <ECStructProperty propertyName="innerStruct" typeName="InnerStruct"/>
    <ECStructArrayProperty propertyName="innerStructs" typeName="InnerStruct" minOccurs="0" maxOccurs="unbounded"/>
  </ECStructClass>

  <ECEntityClass typeName="TestElement" modifier="None">
    <BaseClass>bis:PhysicalElement</BaseClass>
    <ECProperty propertyName="intProp" typeName="int"/>
    <ECProperty propertyName="point" typeName="point3d"/>
    <ECProperty propertyName="maybeNull" typeName="int"/>
    <ECArrayProperty propertyName="strings" typeName="string" minOccurs="0" maxOccurs="unbounded"/>
    <ECStructProperty propertyName="outerStruct" typeName="OuterStruct"/>
    <ECStructArrayProperty propertyName="outerStructs" typeName="OuterStruct" minOccurs="0" maxOccurs="unbounded"/>
  </ECEntityClass>

  <ECEntityClass typeName="TestAspect" modifier="None">
    <BaseClass>bis:ElementUniqueAspect</BaseClass>
    <ECProperty propertyName="aspectProp" typeName="int"/>
  </ECEntityClass>
</ECSchema>
`;

interface InnerStruct {
  bool: boolean;
  doubles: number[];
}

interface OuterStruct {
  innerStruct: InnerStruct;
  innerStructs: InnerStruct[];
}

interface TestElementProps extends PhysicalElementProps {
  intProp: number;
  point: XYAndZ;
  maybeNull?: number;
  strings: string[];
  outerStruct: OuterStruct;
  outerStructs: OuterStruct[];
}

class TestElement extends PhysicalElement {
  public static override get className() { return "TestElement"; }
  declare public intProp: number;
  declare public point: XYAndZ;
  declare public maybeNull?: number;
  declare public strings: string[];
  declare public outerStruct: OuterStruct;
  declare public outerStructs: OuterStruct[];
}

class TestAspect extends ElementUniqueAspect {
  public static override get className() { return "TestAspect"; }

  declare public aspectProp: number;
}

interface TestAspectProps extends ElementAspectProps {
  aspectProp: number;
}

class FieldsSchema extends Schema {
  public static override get schemaName() { return "Fields"; }
}

async function registerTestSchema(iModel: IModelDb): Promise<void> {
  if (!Schemas.getRegisteredSchema("Fields")) {
    Schemas.registerSchema(FieldsSchema);
    ClassRegistry.register(TestElement, FieldsSchema);
    ClassRegistry.register(TestAspect, FieldsSchema);
  }

  await iModel.importSchemaStrings([fieldsSchemaXml]);
  iModel.saveChanges();
}

describe("Field evaluation", () => {
  let imodel: StandaloneDb;
  let model: Id64String;
  let category: Id64String;
  let sourceElementId: Id64String;

  before(async () => {
    const iModelPath = IModelTestUtils.prepareOutputFile("UpdateFieldsContext", "test.bim");
    imodel = StandaloneDb.createEmpty(iModelPath, { rootSubject: { name: "UpdateFieldsContext" }, allowEdit: JSON.stringify({ txns: true } )});

    await registerTestSchema(imodel);

    model = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(imodel, Code.createEmpty(), true)[1];
    category = SpatialCategory.insert(imodel, StandaloneDb.dictionaryId, "UpdateFieldsContextCategory", new SubCategoryAppearance());
    sourceElementId = insertTestElement();

    await imodel.fonts.embedFontFile({
      file: FontFile.createFromTrueTypeFileName(IModelTestUtils.resolveFontFile("Karla-Regular.ttf"))
    });
  });

  after(() => {
    imodel.close();
  });

  function insertTestElement(): Id64String {
    const props: TestElementProps = {
      classFullName: "Fields:TestElement",
      model,
      category,
      code: Code.createEmpty(),
      intProp: 100,
      point: { x: 1, y: 2, z: 3 },
      strings: ["a", "b", `"name": "c"`],
      outerStruct: {
        innerStruct: { bool: false, doubles: [1, 2, 3] },
        innerStructs: [{ bool: true, doubles: [] }, { bool: false, doubles: [5, 4, 3, 2, 1] }],
      },
      outerStructs: [{
        innerStruct: { bool: true, doubles: [10, 9] },
        innerStructs: [{ bool: false, doubles: [5] }],
      }],
      placement: {
        origin: new Point3d(1, 2, 0),
        angles: new YawPitchRollAngles(),
      },
      jsonProperties: {
        stringProp: "abc",
        ints: [10, 11, 12, 13],
        zoo: {
          address: {
            zipcode: 12345,
          },
          birds: [
            { name: "duck", sound: "quack" },
            { name: "hawk", sound: "scree!" },
          ],
        },
      },
    };

    const id = imodel.elements.insertElement(props);

    const aspectProps: TestAspectProps = {
      classFullName: TestAspect.classFullName,
      aspectProp: 999,
      element: new ElementOwnsUniqueAspect(id),
    };
    imodel.elements.insertAspect(aspectProps);

    imodel.saveChanges();
    return id;
  }

  describe("getProperty", () => {
    function expectValue(expected: any, propertyPath: FieldPropertyPath, propertyHost: FieldPropertyHost | Id64String, deletedDependency = false): void {
      if (typeof propertyHost === "string") {
        propertyHost = { schemaName: "Fields", className: "TestElement", elementId: propertyHost };
      }

      const field = FieldRun.create({
        propertyPath,
        propertyHost,
      });

      const context = createUpdateContext(propertyHost.elementId, imodel, deletedDependency);
      const actual = context.getProperty(field);
      expect(actual?.value).to.deep.equal(expected);
    }

    it("returns a primitive property value", () => {
      expectValue(100, { propertyName: "intProp" }, sourceElementId);
    });

    it("treats points as primitive values", () => {
      expectValue({ x: 1, y: 2, z: 3 }, { propertyName: "point" }, sourceElementId);
      expectValue(undefined, { propertyName: "point", accessors: ["x"] }, sourceElementId);
    });

    it("returns a primitive array value", () => {
      expectValue("a", { propertyName: "strings", accessors: [0] }, sourceElementId);
      expectValue("b", { propertyName: "strings", accessors: [1] }, sourceElementId);
      expectValue(`"name": "c"`, { propertyName: "strings", accessors: [2] }, sourceElementId);
    });

    it("supports negative array indices", () => {
      expectValue("a", { propertyName: "strings", accessors: [-3] }, sourceElementId);
      expectValue("b", { propertyName: "strings", accessors: [-2] }, sourceElementId);
      expectValue(`"name": "c"`, { propertyName: "strings", accessors: [-1] }, sourceElementId);
    });

    it("returns undefined if the dependency was deleted", () => {
      expectValue(undefined, { propertyName: "intProp" }, sourceElementId, true);
    });

    it("returns undefined if the host element does not exist", () => {
      expectValue(undefined, { propertyName: "intProp" }, "0xbaadf00d");
    });

    it("returns undefined if the host element is not of the specified class or a subclass thereof", () => {
      expectValue(undefined, { propertyName: "origin" }, { schemaName: "BisCore", className: "GeometricElement2d", elementId: sourceElementId });
    });

    it("returns undefined if an access string is specified for a non-object property", () => {
      expectValue(undefined, { propertyName: "intProp", accessors: ["property"] }, sourceElementId);
    });

    it("returns undefined if the specified property does not exist", () => {
      expectValue(undefined, { propertyName: "nonExistentProperty" }, sourceElementId);
    });

    it("returns undefined if the specified property is null", () => {
      expectValue(undefined, { propertyName: "maybeNull" }, sourceElementId);
    });

    it("returns undefined if an array index is specified for a non-array property", () => {
      expectValue(undefined, { propertyName: "intProp", accessors: [0] }, sourceElementId);
    });

    it("returns undefined if an array index is out of bounds", () => {
      for (const index of [3, 4, -4, -5]) {
        expectValue(undefined, { propertyName: "strings", accessors: [index] }, sourceElementId);
      }
    });

    it("returns undefined for a non-primitive value", () => {
      expectValue(undefined, { propertyName: "strings" }, sourceElementId);
      expectValue(undefined, { propertyName: "outerStruct" }, sourceElementId);
      expectValue(undefined, { propertyName: "outerStruct", accessors: ["innerStruct"] }, sourceElementId);
      expectValue(undefined, { propertyName: "outerStructs" }, sourceElementId);
      expectValue(undefined, { propertyName: "outerStructs", accessors: [0] }, sourceElementId);
      expectValue(undefined, { propertyName: "outerStructs", accessors: [0, "innerStruct"] }, sourceElementId);
    });

    it("returns arbitrarily-nested properties of structs and struct arrays", () => {
      expectValue(false, { propertyName: "outerStruct", accessors: ["innerStruct", "bool"] }, sourceElementId);
      for (const index of [0, 1, 2]) {
        expectValue(index + 1, { propertyName: "outerStruct", accessors: ["innerStruct", "doubles", index] },sourceElementId);
        expectValue(3 - index, { propertyName: "outerStruct", accessors: ["innerStruct", "doubles", -1 - index] },sourceElementId);
      }

      expectValue(9, { propertyName: "outerStructs", accessors: [0, "innerStruct", "doubles", 1] }, sourceElementId);
      expectValue(false, { propertyName: "outerStructs", accessors: [0, "innerStructs", -1, "bool"] }, sourceElementId);
      expectValue(5, { propertyName: "outerStructs", accessors: [0, "innerStructs", 0, "doubles", 0] }, sourceElementId);
    });

    it("returns arbitrarily-nested JSON properties", () => {
      expectValue("abc", { propertyName: "jsonProperties", jsonAccessors: ["stringProp"] }, sourceElementId);

      expectValue(10, { propertyName: "jsonProperties", jsonAccessors: ["ints", 0] }, sourceElementId);
      expectValue(13, { propertyName: "jsonProperties", jsonAccessors: ["ints", 3] }, sourceElementId);
      expectValue(13, { propertyName: "jsonProperties", jsonAccessors: ["ints", -1] }, sourceElementId);
      expectValue(11, { propertyName: "jsonProperties", jsonAccessors: ["ints", -3] }, sourceElementId);

      expectValue(12345, { propertyName: "jsonProperties", jsonAccessors: ["zoo", "address", "zipcode"] }, sourceElementId);
      expectValue("scree!", { propertyName: "jsonProperties", jsonAccessors: ["zoo", "birds", 1, "sound"] }, sourceElementId);
    });

    it("returns undefined if JSON accessors applied to non-JSON property", () => {
      expectValue(undefined, { propertyName: "int", jsonAccessors: ["whatever"] }, sourceElementId);
      expectValue(undefined, { propertyName: "strings", accessors: [2, "name"] }, sourceElementId);
      expectValue(undefined, { propertyName: "outerStruct", accessors: ["innerStruct"], jsonAccessors: ["bool"] }, sourceElementId);
    });

    it("returns the value of a property of an aspect", () => {
      expect(imodel.elements.getAspects(sourceElementId, "Fields:TestAspect").length).to.equal(1);
      expectValue(999, { propertyName: "aspectProp" }, { elementId: sourceElementId, schemaName: "Fields", className: "TestAspect" });
    });
  });

  describe("updateFields", () => {
    it("recomputes cached content", () => {
      const textBlock = TextBlock.create();
      const fieldRun = FieldRun.create({
        propertyHost: { elementId: sourceElementId, schemaName: "Fields", className: "TestElement" },
        propertyPath: { propertyName: "intProp" },
        cachedContent: "oldValue",
      });

      textBlock.appendRun(fieldRun);

      const context = createUpdateContext(sourceElementId, imodel, false);
      const updatedCount = updateFields(textBlock, context);

      expect(updatedCount).to.equal(1);
      expect(fieldRun.cachedContent).to.equal("100"); // `intProp` value from the test element
    });

    it("does not update a field if recomputed content matches cached content", () => {
      const textBlock = TextBlock.create();
      const fieldRun = FieldRun.create({
        propertyHost: { elementId: sourceElementId, schemaName: "Fields", className: "TestElement" },
        propertyPath: { propertyName: "intProp" },
        cachedContent: "100",
      });

      textBlock.appendRun(fieldRun);

      const context = createUpdateContext(sourceElementId, imodel, false);
      const updatedCount = updateFields(textBlock, context);

      expect(updatedCount).to.equal(0);
      expect(fieldRun.cachedContent).to.equal("100");
    });

    it("returns the number of fields updated", () => {
      const textBlock = TextBlock.create();
      const fieldRun1 = FieldRun.create({
        propertyHost: { elementId: sourceElementId, schemaName: "Fields", className: "TestElement" },
        propertyPath: { propertyName: "intProp" },
        cachedContent: "100",
      });

      const fieldRun2 = FieldRun.create({
        propertyHost: { elementId: sourceElementId, schemaName: "Fields", className: "TestElement" },
        propertyPath: { propertyName: "strings", accessors: [0] },
        cachedContent: "oldValue",
      });

      textBlock.appendRun(fieldRun1);
      textBlock.appendRun(fieldRun2);

      const context = createUpdateContext(sourceElementId, imodel, false);
      const updatedCount = updateFields(textBlock, context);

      expect(updatedCount).to.equal(1);
      expect(fieldRun1.cachedContent).to.equal("100");
      expect(fieldRun2.cachedContent).to.equal("a");
    });
  });

  function insertAnnotationElement(textBlock: TextBlock | undefined): Id64String {
    const elem = TextAnnotation3d.fromJSON({
      model,
      category,
      code: Code.createEmpty(),
      placement: {
        origin: { x: 0, y: 0, z: 0 },
        angles: YawPitchRollAngles.createDegrees(0, 0, 0).toJSON(),
      },
      classFullName: TextAnnotation3d.classFullName,
      defaultTextStyle: new TextAnnotationUsesTextStyle("0x123").toJSON(),
    }, imodel);

    if (textBlock) {
      const annotation = TextAnnotation.fromJSON({ textBlock: textBlock.toJSON() });
      elem.setAnnotation(annotation);
    }

    return elem.insert();
  }

  describe("ElementDrivesTextAnnotation", () => {
    function expectNumRelationships(expected: number, targetId?: Id64String): void {
      const where = targetId ? ` WHERE TargetECInstanceId=${targetId}` : "";
      const ecsql = `SELECT COUNT(*) FROM BisCore.ElementDrivesTextAnnotation ${where}`;
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      imodel.withPreparedStatement(ecsql, (stmt) => {
        expect(stmt.step()).to.equal(DbResult.BE_SQLITE_ROW);
        expect(stmt.getValue(0).getInteger()).to.equal(expected);
      });
    }

    it("can be inserted", () => {
      expectNumRelationships(0);

      const targetId = insertAnnotationElement(undefined);
      expect(targetId).not.to.equal(Id64.invalid);

      const target = imodel.elements.getElement(targetId);
      expect(target.classFullName).to.equal("BisCore:TextAnnotation3d");
      expect(target).instanceof(TextAnnotation3d);

      const targetAnno = imodel.elements.getElement<TextAnnotation3d>(targetId);
      expect(targetAnno).instanceof(TextAnnotation3d);

      const rel = ElementDrivesTextAnnotation.create(imodel, sourceElementId, targetId);
      const relId = rel.insert();
      expect(relId).not.to.equal(Id64.invalid);

      expectNumRelationships(1);

      const relationship = imodel.relationships.getInstance("BisCore:ElementDrivesTextAnnotation", relId);
      expect(relationship.sourceId).to.equal(sourceElementId);
      expect(relationship.targetId).to.equal(targetId);
    });

    function createField(propertyHost: Id64String | FieldPropertyHost, cachedContent: string, propertyName = "intProp", accessors?: Array<string | number>, jsonAccessors?: Array<string | number>): FieldRun {
      if (typeof propertyHost === "string") {
        propertyHost = { schemaName: "Fields", className: "TestElement", elementId: propertyHost };
      }

      return FieldRun.create({
        styleOverrides: { fontName: "Karla" },
        propertyHost,
        cachedContent,
        propertyPath: { propertyName, accessors, jsonAccessors },
      });
    }

    describe("updateFieldDependencies", () => {
      it("creates exactly one relationship for each unique source element on insert and update", () => {
        const source1 = insertTestElement();
        const block = TextBlock.create();
        block.appendRun(createField(source1, "1"));
        const targetId = insertAnnotationElement(block);
        imodel.saveChanges();

        expectNumRelationships(1, targetId);

        const source2 = insertTestElement();
        const target = imodel.elements.getElement<TextAnnotation3d>(targetId);
        const anno = target.getAnnotation()!;
        anno.textBlock.appendRun(createField(source2, "2a"));
        target.setAnnotation(anno);
        target.update();
        imodel.saveChanges();

        expectNumRelationships(2, targetId);

        anno.textBlock.appendRun(createField(source2, "2b"));
        target.setAnnotation(anno);
        target.update();
        imodel.saveChanges();

        expectNumRelationships(2, targetId);

        const source3 = insertTestElement();
        anno.textBlock.appendRun(createField(source3, "3"));
        target.setAnnotation(anno);
        target.update();
        imodel.saveChanges();

        expectNumRelationships(3, targetId);
      });

      it("deletes stale relationships", () => {
        const sourceA = insertTestElement();
        const sourceB = insertTestElement();

        const block = TextBlock.create();
        block.appendRun(createField(sourceA, "A"));
        block.appendRun(createField(sourceB, "B"));
        const targetId = insertAnnotationElement(block);
        imodel.saveChanges();

        expectNumRelationships(2, targetId);
        expect(imodel.relationships.tryGetInstance(ElementDrivesTextAnnotation.classFullName, { targetId, sourceId: sourceA })).not.to.be.undefined;
        expect(imodel.relationships.tryGetInstance(ElementDrivesTextAnnotation.classFullName, { targetId, sourceId: sourceB })).not.to.be.undefined;

        const target = imodel.elements.getElement<TextAnnotation3d>(targetId);
        const anno = target.getAnnotation()!;
        anno.textBlock.paragraphs[0].runs.shift();
        target.setAnnotation(anno);
        target.update();
        imodel.saveChanges();

        expectNumRelationships(1, targetId);
        expect(imodel.relationships.tryGetInstance(ElementDrivesTextAnnotation.classFullName, { targetId, sourceId: sourceA })).to.be.undefined;
        expect(imodel.relationships.tryGetInstance(ElementDrivesTextAnnotation.classFullName, { targetId, sourceId: sourceB })).not.to.be.undefined;

        anno.textBlock.paragraphs.length = 0;
        anno.textBlock.appendRun(createField(sourceA, "A2"));
        target.setAnnotation(anno);
        target.update();
        imodel.saveChanges();

        expectNumRelationships(1, targetId);
        expect(imodel.relationships.tryGetInstance(ElementDrivesTextAnnotation.classFullName, { targetId, sourceId: sourceA })).not.to.be.undefined;
        expect(imodel.relationships.tryGetInstance(ElementDrivesTextAnnotation.classFullName, { targetId, sourceId: sourceB })).to.be.undefined;

        anno.textBlock.paragraphs.length = 0;
        anno.textBlock.appendRun(TextRun.create({
          styleOverrides: { fontName: "Karla" },
          content: "not a field",
        }));
        target.setAnnotation(anno);
        target.update();
        imodel.saveChanges();

        expectNumRelationships(0, targetId);
        expect(imodel.relationships.tryGetInstance(ElementDrivesTextAnnotation.classFullName, { targetId, sourceId: sourceA })).to.be.undefined;
        expect(imodel.relationships.tryGetInstance(ElementDrivesTextAnnotation.classFullName, { targetId, sourceId: sourceB })).to.be.undefined;
      });

      it("ignores invalid source element Ids", () => {
        const source = insertTestElement();
        const block = TextBlock.create();
        block.appendRun(createField(Id64.invalid, "invalid"));
        block.appendRun(createField("0xbaadf00d", "non-existent"));
        block.appendRun(createField(source, "valid"));

        const targetId = insertAnnotationElement(block);
        imodel.saveChanges();
        expectNumRelationships(1, targetId);
      });
    });

    function expectText(expected: string, elemId: Id64String): void {
      const elem = imodel.elements.getElement<TextAnnotation3d>(elemId);
      const anno = elem.getAnnotation()!;
      const actual = anno.textBlock.stringify();
      expect(actual).to.equal(expected);
    }

    it("updates fields when source element is modified or deleted", () => {
      const sourceId = insertTestElement();
      const block = TextBlock.create();
      block.appendRun(createField(sourceId, "old value"));;

      const targetId = insertAnnotationElement(block);
      imodel.saveChanges();

      const target = imodel.elements.getElement<TextAnnotation3d>(targetId);
      expect(target.getAnnotation()).not.to.be.undefined;

      expectText("100", targetId);

      let source = imodel.elements.getElement<TestElement>(sourceId);
      source.intProp = 50;
      source.update();

      expectText("100", targetId);

      imodel.saveChanges();

      source = imodel.elements.getElement<TestElement>(sourceId);
      expect(source.intProp).to.equal(50);

      expectText("50", targetId);

      imodel.elements.deleteElement(sourceId);
      expectText("50", targetId);

      imodel.saveChanges();
      expectText(FieldRun.invalidContentIndicator, targetId);
    });

    it("updates fields when source element aspect is modified, deleted, or recreated", () => {
      const sourceId = insertTestElement();
      const block = TextBlock.create();
      block.appendRun(createField({ elementId: sourceId, schemaName: "Fields", className: "TestAspect" }, "", "aspectProp"));

      const targetId = insertAnnotationElement(block);
      imodel.saveChanges();
      expectText("999", targetId);

      const aspects = imodel.elements.getAspects(sourceId, "Fields:TestAspect");
      expect(aspects.length).to.equal(1);
      const aspect = aspects[0] as TestAspect;
      expect(aspect.aspectProp).to.equal(999);

      aspect.aspectProp = 12345;
      imodel.elements.updateAspect(aspect.toJSON());
      imodel.saveChanges();
      expectText("12345", targetId);

      imodel.elements.deleteAspect([aspect.id]);
      imodel.saveChanges();
      expectText(FieldRun.invalidContentIndicator, targetId);

      const newAspect: TestAspectProps = {
        element: new ElementOwnsUniqueAspect(sourceId),
        classFullName: TestAspect.classFullName,
        aspectProp: 42,
      };
      imodel.elements.insertAspect(newAspect);
      imodel.saveChanges();
      expectText("42", targetId);
    });

    it("updates only fields for specific modified element", () => {
      const sourceA = insertTestElement();
      const sourceB = insertTestElement();
      const block = TextBlock.create();
      block.appendRun(createField(sourceA, "A"));
      block.appendRun(createField(sourceB, "B"));

      const targetId = insertAnnotationElement(block);
      imodel.saveChanges();
      expectText("100100", targetId);

      const sourceElem = imodel.elements.getElement<TestElement>(sourceB);
      sourceElem.intProp = 123;
      sourceElem.update();
      imodel.saveChanges();

      expectText("100123", targetId);
    });

    it("supports complex property paths", () => {
      const sourceId = insertTestElement();
      const block = TextBlock.create();
      block.appendRun(createField(sourceId, "", "outerStruct", ["innerStructs", 1, "doubles", -2]));
      block.appendRun(createField(sourceId, "", "jsonProperties", undefined, ["zoo", "birds", 0, "name"]));
      const targetId = insertAnnotationElement(block);
      imodel.saveChanges();
      expectText("2duck", targetId);

      const source = imodel.elements.getElement<TestElement>(sourceId);
      source.outerStruct.innerStructs[1].doubles[3] = 12.5;
      source.jsonProperties.zoo.birds[0].name = "parrot";
      source.update();
      imodel.saveChanges();
      expectText("12.5parrot", targetId);
    });
  });
});


