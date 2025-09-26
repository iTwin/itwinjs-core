/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Code, ElementAspectProps, FieldPropertyHost, FieldPropertyPath, FieldPropertyType, FieldRun, FieldValue, PhysicalElementProps, SubCategoryAppearance, TextAnnotation, TextBlock, TextBlockProps, TextRun } from "@itwin/core-common";
import { IModelDb, StandaloneDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";
import { createUpdateContext, updateField, updateFields } from "../../internal/annotations/fields";
import { DbResult, Id64, Id64String, ProcessDetector } from "@itwin/core-bentley";
import { SpatialCategory } from "../../Category";
import { Point3d, XYAndZ, YawPitchRollAngles } from "@itwin/core-geometry";
import { Schema, Schemas } from "../../Schema";
import { ClassRegistry } from "../../ClassRegistry";
import { PhysicalElement } from "../../Element";
import { ElementOwnsUniqueAspect, ElementUniqueAspect, FontFile, IModelElementCloneContext, TextAnnotation3d } from "../../core-backend";
import { ElementDrivesTextAnnotation, TextAnnotationUsesTextStyleByDefault } from "../../annotations/ElementDrivesTextAnnotation";

function isIntlSupported(): boolean {
  // Node in the mobile add-on does not include Intl, so this test fails. Right now, mobile
  // users are not expected to do any editing, but long term we will attempt to find a better
  // solution.
  return !ProcessDetector.isMobileAppBackend;
}

function createTestElement(imodel: StandaloneDb, model: Id64String, category: Id64String, overrides?: Partial<TestElementProps>, aspectProp = 999): Id64String {
  const props: TestElementProps = {
    classFullName: "Fields:TestElement",
    model,
    category,
    code: Code.createEmpty(),
    intProp: 100,
    point: { x: 1, y: 2, z: 3 },
    strings: ["a", "b", `"name": "c"`],
    datetime: new Date("2025-08-28T13:45:30.123Z"),
    intEnum: 1,
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
      bool: true,
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
    ...overrides,
  };

  const id = imodel.elements.insertElement(props);

  const aspectProps: TestAspectProps = {
    classFullName: TestAspect.classFullName,
    aspectProp,
    element: new ElementOwnsUniqueAspect(id),
  };
  imodel.elements.insertAspect(aspectProps);

  imodel.saveChanges();
  return id;
}

describe.only("updateField", () => {
  const mockElementId = "0x1";
  const mockPath: FieldPropertyPath = {
    propertyName: "mockProperty",
    accessors: [0, "nestedProperty"],
  };
  const mockCachedContent = "cachedContent";
  const mockUpdatedContent = "updatedContent";

  const createMockContext = (elementId: string, propertyValue?: string) => ({
    hostElementId: elementId,
    getProperty: (field: FieldRun): FieldValue | undefined => {
      const propertyPath = field.propertyPath;
      if (
        propertyPath.propertyName === "mockProperty" &&
        propertyPath.accessors?.[0] === 0 &&
        propertyPath.accessors?.[1] === "nestedProperty" &&
        propertyValue !== undefined
      ) {
        return { value: propertyValue, type: "string" };
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

  <ECEnumeration typeName="IntEnum" backingTypeName="int">
    <ECEnumerator name="one" displayLabel="One" value="1" />
    <ECEnumerator name="two" displayLabel="Two" value="2"/>
  </ECEnumeration>

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
    <ECProperty propertyName="datetime" typeName="dateTime"/>
    <ECArrayProperty propertyName="strings" typeName="string" minOccurs="0" maxOccurs="unbounded"/>
    <ECStructProperty propertyName="outerStruct" typeName="OuterStruct"/>
    <ECStructArrayProperty propertyName="outerStructs" typeName="OuterStruct" minOccurs="0" maxOccurs="unbounded"/>
    <ECProperty propertyName="intEnum" typeName="IntEnum"/>
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
  datetime: Date;
  outerStruct: OuterStruct;
  outerStructs: OuterStruct[];
  intEnum?: number;
}

class TestElement extends PhysicalElement {
  public static override get className() { return "TestElement"; }
  declare public intProp: number;
  declare public point: XYAndZ;
  declare public maybeNull?: number;
  declare public strings: string[];
  declare public datetime: Date;
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

describe.only("Field evaluation", () => {
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

  function insertTestElement(overrides?: Partial<TestElementProps>, aspectProp?: number): Id64String {
    return createTestElement(imodel, model, category, overrides, aspectProp);
  }

  function evaluateField(propertyPath: FieldPropertyPath, propertyHost: FieldPropertyHost | Id64String, deletedDependency = false): FieldValue | undefined {
    if (typeof propertyHost === "string") {
      propertyHost = { schemaName: "Fields", className: "TestElement", elementId: propertyHost };
    }

    const field = FieldRun.create({
      propertyPath,
      propertyHost,
    });

    const context = createUpdateContext(propertyHost.elementId, imodel, deletedDependency);
    return context.getProperty(field);
  }

  describe("getProperty", () => {
    function expectValue(expected: any, propertyPath: FieldPropertyPath, propertyHost: FieldPropertyHost | Id64String, deletedDependency = false): void {
      expect(evaluateField(propertyPath, propertyHost, deletedDependency)?.value).to.deep.equal(expected);
    }

    it("returns a primitive property value", () => {
      expectValue(100, { propertyName: "intProp" }, sourceElementId);
    });

    it("returns an integer enum property value", () => {
      expectValue(1, { propertyName: "intEnum" }, sourceElementId);
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

    it("returns the value of a property of an aspect", () => {
      expect(imodel.elements.getAspects(sourceElementId, "Fields:TestAspect").length).to.equal(1);
      expectValue(999, { propertyName: "aspectProp" }, { elementId: sourceElementId, schemaName: "Fields", className: "TestAspect" });
    });

    it("should fail to evaluate if prop type does not match", () => {
      const fieldRun = FieldRun.create({
        propertyHost: { elementId: sourceElementId, schemaName: "Fields", className: "TestElement" },
        propertyPath: { propertyName: "string", accessors: [0] },
        cachedContent: "oldValue",
        formatOptions: {
          case: "upper",
          prefix: "Value: ",
          suffix: "!"
        }
      });

      const context =  createUpdateContext(sourceElementId, imodel, false);

      const updated = updateField(fieldRun, context);

      expect(updated).to.be.true;
      expect(fieldRun.cachedContent).to.equal(FieldRun.invalidContentIndicator);
    });

    function getPropertyType(propertyHost: FieldPropertyHost, propertyPath: string | FieldPropertyPath): FieldPropertyType | undefined {
      if (typeof propertyPath === "string") {
        propertyPath = { propertyName: propertyPath };
      }

      return evaluateField(propertyPath, propertyHost)?.type;
    }

    it("deduces type for primitive properties", () => {
      const propertyHost = { elementId: sourceElementId, schemaName: "Fields", className: "TestElement" };
      expect(getPropertyType(propertyHost, "intProp")).to.equal("string");
      expect(getPropertyType(propertyHost, "point")).to.equal("coordinate");
      expect(getPropertyType(propertyHost, { propertyName: "strings", accessors: [0] })).to.equal("string");
      expect(getPropertyType(propertyHost, "intEnum")).to.equal("int-enum");
      expect(getPropertyType(propertyHost, { propertyName: "outerStruct", accessors: ["innerStruct", "doubles", 0] })).to.equal("quantity");
      expect(getPropertyType(propertyHost, { propertyName: "outerStruct", accessors: ["innerStruct", "bool"] })).to.equal("boolean");

      propertyHost.schemaName = "BisCore";
      propertyHost.className = "GeometricElement3d";
      expect(getPropertyType(propertyHost, "LastMod")).to.equal("datetime");
      expect(getPropertyType(propertyHost, "FederationGuid")).to.equal("string");
    });

    it("returns undefined for non-primitive properties", () => {
      const propertyHost = { elementId: sourceElementId, schemaName: "Fields", className: "TestElement" };
      expect(getPropertyType(propertyHost, "outerStruct")).to.equal(undefined);
      expect(getPropertyType(propertyHost, "outerStructs")).to.equal(undefined);
    });

    it("returns undefined for invalid property paths", () => {
      const propertyHost = { elementId: sourceElementId, schemaName: "Fields", className: "TestElement" };
      expect(getPropertyType(propertyHost, "unknownPropertyName")).to.be.undefined;
    });

    it("should return undefined for unsupported primitive types", () => {
      const host = { elementId: sourceElementId, schemaName: "BisCore", className: "GeometricElement3d" };
      expect(getPropertyType(host, "GeometryStream")).to.be.undefined;
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

  function createAnnotationElement(textBlock: TextBlock | undefined): TextAnnotation3d {
    const elem = TextAnnotation3d.fromJSON({
      model,
      category,
      code: Code.createEmpty(),
      placement: {
        origin: { x: 0, y: 0, z: 0 },
        angles: YawPitchRollAngles.createDegrees(0, 0, 0).toJSON(),
      },
      classFullName: TextAnnotation3d.classFullName,
      defaultTextStyle: new TextAnnotationUsesTextStyleByDefault("0x123").toJSON(),
    }, imodel);

    if (textBlock) {
      const annotation = TextAnnotation.fromJSON({ textBlock: textBlock.toJSON() });
      elem.setAnnotation(annotation);
    }

    return elem;
  }

  function insertAnnotationElement(textBlock: TextBlock | undefined): Id64String {
    const elem = createAnnotationElement(textBlock);
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

    function createField(propertyHost: Id64String | FieldPropertyHost, cachedContent: string, propertyName = "intProp", accessors?: Array<string | number>): FieldRun {
      if (typeof propertyHost === "string") {
        propertyHost = { schemaName: "Fields", className: "TestElement", elementId: propertyHost };
      }

      return FieldRun.create({
        styleOverrides: { fontName: "Karla" },
        propertyHost,
        cachedContent,
        propertyPath: { propertyName, accessors },
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

        // Remove the sourceA FieldRun from the first paragraph.
        const p1 = anno.textBlock.children[0];
        p1.children.shift();

        target.setAnnotation(anno);
        target.update();
        imodel.saveChanges();

        expectNumRelationships(1, targetId);
        expect(imodel.relationships.tryGetInstance(ElementDrivesTextAnnotation.classFullName, { targetId, sourceId: sourceA })).to.be.undefined;
        expect(imodel.relationships.tryGetInstance(ElementDrivesTextAnnotation.classFullName, { targetId, sourceId: sourceB })).not.to.be.undefined;

        anno.textBlock.children.length = 0;
        anno.textBlock.appendRun(createField(sourceA, "A2"));
        target.setAnnotation(anno);
        target.update();
        imodel.saveChanges();

        expectNumRelationships(1, targetId);
        expect(imodel.relationships.tryGetInstance(ElementDrivesTextAnnotation.classFullName, { targetId, sourceId: sourceA })).not.to.be.undefined;
        expect(imodel.relationships.tryGetInstance(ElementDrivesTextAnnotation.classFullName, { targetId, sourceId: sourceB })).to.be.undefined;

        anno.textBlock.children.length = 0;
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

    it("evaluates cachedContent when annotation element is inserted", () => {
      const sourceId = insertTestElement();
      const block = TextBlock.create();
      block.appendRun(createField(sourceId, "initial cached content"));
      expect(block.stringify()).to.equal("initial cached content");

      const targetId = insertAnnotationElement(block);
      imodel.saveChanges();

      const target = imodel.elements.getElement<TextAnnotation3d>(targetId);
      expect(target.getAnnotation()!.textBlock.stringify()).to.equal("100");
    });

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
      const targetId = insertAnnotationElement(block);
      imodel.saveChanges();
      expectText("2", targetId);

      const source = imodel.elements.getElement<TestElement>(sourceId);
      source.outerStruct.innerStructs[1].doubles[3] = 12.5;
      source.update();
      imodel.saveChanges();
      expectText("12.5", targetId);
    });

    describe("remapFields", () => {
      let dstIModel: StandaloneDb;
      let dstModel: Id64String;
      let dstCategory: Id64String;
      let dstSourceElementId: Id64String;

      before(async () => {
        const path = IModelTestUtils.prepareOutputFile("RemapFields", `dst.bim`);
        dstIModel = StandaloneDb.createEmpty(path, { rootSubject: { name: `RemapFields-dst` }, allowEdit: JSON.stringify({ txns: true })});
        await registerTestSchema(dstIModel);

        // Insert additional unused elements to ensure element Ids differ between src and dst iModels
        for (let i = 0; i < 3; i++) {
          IModelTestUtils.createAndInsertPhysicalPartitionAndModel(dstIModel, Code.createEmpty(), true);
        }

        const modelAndElement = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(dstIModel, Code.createEmpty(), true);
        expect(modelAndElement[0]).to.equal(modelAndElement[1]);

        dstModel = modelAndElement[1];
        dstCategory = SpatialCategory.insert(dstIModel, StandaloneDb.dictionaryId, `dstCat`, new SubCategoryAppearance());
        dstSourceElementId = createTestElement(dstIModel, dstModel, dstCategory, {
          intProp: 200,
          point: { x: -1, y: -2, z: -3 },
          strings: ["x", "y", "z"],
          intEnum: 2,
        }, 1234);

        await dstIModel.fonts.embedFontFile({
          file: FontFile.createFromTrueTypeFileName(IModelTestUtils.resolveFontFile("Karla-Regular.ttf"))
        });

        expect(dstCategory).not.to.equal(category);
        expect(dstModel).not.to.equal(model);
        expect(dstSourceElementId).not.to.equal(sourceElementId);
      });

      after(() => {
        dstIModel.close();
      });

      function getTextBlockJson(): TextBlockProps {
        return {
          children: [{
            children: [{
              type: "field",
              propertyHost: {
                elementId: sourceElementId,
                schemaName: "Fields",
                className: "TestElement",
              },
              propertyPath: { propertyName: "intProp" },
              cachedContent: "intProp",
            }, {
              type: "field",
              propertyHost: {
                elementId: category,
                schemaName: "BisCore",
                className: "Element",
              },
              propertyPath: { propertyName: "CodeValue" },
              cachedContent: "CodeValue"
            }],
          }],
        };
      }

      function expectHostIds(elem: TextAnnotation3d, host1: Id64String, host2: Id64String): void {
        const anno = elem.getAnnotation()!;
        expect(anno.textBlock.children.length).to.equal(1);
        const para = anno.textBlock.children[0];
        expect(para.children.length).to.equal(2);
        expect(para.children.every((x) => x.type === "field"));
        const field1 = para.children[0] as FieldRun;
        expect(field1.propertyHost.elementId).to.equal(host1);
        const field2 = para.children[1] as FieldRun;
        expect(field2.propertyHost.elementId).to.equal(host2);
      }

      it("remaps field hosts", () => {
        const elem = createAnnotationElement(TextBlock.create(getTextBlockJson()));
        expectHostIds(elem, sourceElementId, category);

        const context = new IModelElementCloneContext(imodel, dstIModel);
        context.remapElement(sourceElementId, dstSourceElementId);
        context.remapElement(category, dstCategory);

        ElementDrivesTextAnnotation.remapFields(elem, context);
        expectHostIds(elem, dstSourceElementId, dstCategory);
      });

      it("preserves original Id if cloning within the same iModel and source element is not remapped", () => {
        const elem = createAnnotationElement(TextBlock.create(getTextBlockJson()));
        expectHostIds(elem, sourceElementId, category);

        const context = new IModelElementCloneContext(imodel);
        context.remapElement(category, model);

        ElementDrivesTextAnnotation.remapFields(elem, context);
        expectHostIds(elem, sourceElementId, model);

      });

      it("invalidates field host if source element not remapped and cloning between iModels", () => {
        const elem = createAnnotationElement(TextBlock.create(getTextBlockJson()));
        expectHostIds(elem, sourceElementId, category);

        const context = new IModelElementCloneContext(imodel, dstIModel);

        ElementDrivesTextAnnotation.remapFields(elem, context);
        expectHostIds(elem, Id64.invalid, Id64.invalid);
      });

      it("remaps and re-evaluates fields in context of target iModel", () => {

      });
    });
  });

  describe("Format Validation", () => {
    it("validates formatting options for string property type", () => {
      // Create a FieldRun with string property type and some format options
      const fieldRun = FieldRun.create({
        propertyHost: { elementId: sourceElementId, schemaName: "Fields", className: "TestElement" },
        propertyPath: { propertyName: "strings", accessors: [0] },
        cachedContent: "oldValue",
        formatOptions: {
          case: "upper",
          prefix: "Value: ",
          suffix: "!"
        }
      });

      // Context returns a string value for the property
      const context = {
        hostElementId: sourceElementId,
        getProperty: () => { return { value: "abc", type: "string" as const } },
      };

      // Update the field and check the result
      const updated = updateField(fieldRun, context);

      // The formatted value should be uppercased and have prefix/suffix applied
      expect(updated).to.be.true;
      expect(fieldRun.cachedContent).to.equal("Value: ABC!");
    });

    it("validates formatting options for datetime objects", function () {
      if (!isIntlSupported()) {
        this.skip();
      }

      const propertyHost = { elementId: sourceElementId, schemaName: "Fields", className: "TestElement" };
      const fieldRun = FieldRun.create({
        propertyHost,
        propertyPath: { propertyName: "datetime"},
        cachedContent: "oldval",
        formatOptions: {
          dateTime: {
            formatOptions:{
              month: "short",
              day: "2-digit",
              year: "numeric",
              timeZone: "UTC"
            },
            locale: "en-US",
         },
        },
      });

      const context = createUpdateContext(sourceElementId, imodel, false);
      const updated = updateField(fieldRun, context);

      expect(updated).to.be.true;
      expect(fieldRun.cachedContent).to.equal("Aug 28, 2025");
    });
  });
});
