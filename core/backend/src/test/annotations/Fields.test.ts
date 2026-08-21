/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Code, ElementAspectProps, FieldPropertyHost, FieldPropertyPath, FieldPropertyType, FieldRun, FieldValue, formatFieldValueWithSpecProvider, PhysicalElementProps, SubCategoryAppearance, TextAnnotation, TextBlock, TextBlockProps, TextRun, traverseTextBlockComponent } from "@itwin/core-common";
import { FormatDefinition, FormatterSpec, FormattingSpecEntry, FormattingSpecProvider } from "@itwin/core-quantity";
import { FormatSet } from "@itwin/ecschema-metadata";
import { IModelDb, StandaloneDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";
import { createUpdateContext, updateField, updateFields } from "../../internal/annotations/fields";
import { BeUnorderedUiEvent, DbResult, Id64, Id64String, ProcessDetector } from "@itwin/core-bentley";
import { FieldFormattingSpecProvider } from "../../annotations/FieldFormattingSpecProvider";
import { SpatialCategory } from "../../Category";
import { Point3d, XYAndZ, YawPitchRollAngles } from "@itwin/core-geometry";
import { Schema, Schemas } from "../../Schema";
import { ClassRegistry } from "../../ClassRegistry";
import { PhysicalElement } from "../../Element";
import { ElementOwnsUniqueAspect, ElementUniqueAspect, FontFile, IModelElementCloneContext, TextAnnotation3d } from "../../core-backend";
import { ElementDrivesTextAnnotation, TextAnnotationUsesTextStyleByDefault } from "../../annotations/ElementDrivesTextAnnotation";
import { EditTxn, withEditTxn } from "../../EditTxn";

function isIntlSupported(): boolean {
  // Node in the mobile add-on does not include Intl, so this test fails. Right now, mobile
  // users are not expected to do any editing, but long term we will attempt to find a better
  // solution.
  return !ProcessDetector.isMobileAppBackend;
}

//cspell: ignore classid ecdbmap oldval reqs uppercased

function insertTestElement(txn: EditTxn, model: Id64String, category: Id64String, overrides?: Partial<TestElementProps>, aspectProp = 999): Id64String {
  const props: TestElementProps = {
    classFullName: "Fields:TestElement",
    model,
    category,
    code: Code.createEmpty(),
    intProp: 100,
    point: { x: 1, y: 2, z: 3 },
    strings: ["a", "b", `"name": "c"`],
    dateStrings: ["2025-08-28T13:45:30.123Z"],
    datetime: new Date("2025-08-28T13:45:30.123Z"),
    lengthProp: 2.5,
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
      // Deliberately present-but-null, to pin that a JSON null resolves to no value rather than
      // to a FieldValue the formatters would have to stringify.
      nullProp: null,
      lengthMeters: 2.5,
      readings: [1.5, null, "text"],
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

  const elemId = txn.insertElement(props);
  const aspectProps: TestAspectProps = {
    classFullName: TestAspect.classFullName,
    aspectProp,
    element: new ElementOwnsUniqueAspect(elemId),
  };
  txn.insertAspect(aspectProps);

  return elemId;
}

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
  <ECSchemaReference name='ECDbMap' version='02.00.04' alias='ecdbmap' />
  <ECSchemaReference name="Formats" version="01.00.00" alias="f"/>
  <ECSchemaReference name="Units"   version="01.00.09" alias="u"/>

  <KindOfQuantity typeName="LENGTH" displayLabel="Length" persistenceUnit="u:M" relativeError="0.0001" presentationUnits="f:DefaultRealU(4)[u:M]"/>

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
    <ECProperty propertyName="lengthProp" typeName="double" kindOfQuantity="LENGTH"/>
    <ECArrayProperty propertyName="strings" typeName="string" minOccurs="0" maxOccurs="unbounded"/>
    <ECArrayProperty propertyName="dateStrings" typeName="string" extendedTypeName="DateTime" minOccurs="0" maxOccurs="unbounded"/>
    <ECStructProperty propertyName="outerStruct" typeName="OuterStruct"/>
    <ECStructArrayProperty propertyName="outerStructs" typeName="OuterStruct" minOccurs="0" maxOccurs="unbounded"/>
    <ECProperty propertyName="intEnum" typeName="IntEnum"/>
  </ECEntityClass>

  <ECEntityClass typeName="TestAspect" modifier="None">
    <BaseClass>bis:ElementUniqueAspect</BaseClass>
    <ECProperty propertyName="aspectProp" typeName="int"/>
  </ECEntityClass>

  <ECEntityClass typeName="TestElementStringProp" modifier="Abstract">
    <ECCustomAttributes>
      <QueryView xmlns="ECDbMap.02.00.04">
        <Query>
          SELECT
            jo.ECInstanceId,
            ec_classid('Fields', 'TestElementStringProp') [ECClassId],
            json_extract(jo.jsonProperties, '$.stringProp') [StringProp]
          FROM Fields.TestElement jo
        </Query>
      </QueryView>
    </ECCustomAttributes>
    <ECProperty propertyName="StringProp" typeName="string" />
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
  dateStrings: string[];
  datetime: Date;
  lengthProp: number;
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
  declare public dateStrings: string[];
  declare public datetime: Date;
  declare public lengthProp: number;
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
}

/** Builds a decimal [FormatDefinition] rendering a magnitude in `unitName` with `unitLabel`. */
function decimalFormat(unitName: string, unitLabel: string, precision = 4): FormatDefinition {
  return {
    composite: { includeZero: true, units: [{ label: unitLabel, name: unitName }] },
    formatTraits: ["keepSingleZero", "showUnitLabel"],
    precision,
    type: "Decimal",
    uomSeparator: " ",
  };
}

/** Wraps a KindOfQuantity -> format map in a metric [FormatSet]. */
function toFormatSet(formats: Record<string, FormatDefinition> = {}): FormatSet {
  return { name: "TestSet", label: "Test Set", unitSystem: "metric", formats };
}

describe("Field evaluation", () => {
  let imodel: StandaloneDb;
  let model: Id64String;
  let category: Id64String;
  let sourceElementId: Id64String;

  before(async () => {
    const iModelPath = IModelTestUtils.prepareOutputFile("UpdateFieldsContext", "test.bim");
    imodel = StandaloneDb.createEmpty(iModelPath, { rootSubject: { name: "UpdateFieldsContext" }, enableTransactions: true });

    await registerTestSchema(imodel);

    await withEditTxn(imodel, async (txn) => {
      model = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(txn, Code.createEmpty(), true)[1];
      category = SpatialCategory.insert(txn, StandaloneDb.dictionaryId, "UpdateFieldsContextCategory", new SubCategoryAppearance());
      await imodel.fonts.embedFontFile({
        file: FontFile.createFromTrueTypeFileName(IModelTestUtils.resolveFontFile("Karla-Regular.ttf"))
      });
      sourceElementId = insertTestElement(txn, model, category);
    });
  });

  after(() => {
    imodel.close();
  });

  function evaluateField(propertyPath: FieldPropertyPath, propertyHost: FieldPropertyHost | Id64String, deletedDependency = false, formatOptions?: FieldRun["formatOptions"]): FieldValue | undefined {
    if (typeof propertyHost === "string") {
      propertyHost = { schemaName: "Fields", className: "TestElement", elementId: propertyHost };
    }

    const field = FieldRun.create({
      propertyPath,
      propertyHost,
      formatOptions,
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

    it("supports properties of EC views", () => {
      expectValue("abc", { propertyName: "stringProp" }, { schemaName: "Fields", className: "TestElementStringProp", elementId: sourceElementId });
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
        expectValue(index + 1, { propertyName: "outerStruct", accessors: ["innerStruct", "doubles", index] }, sourceElementId);
        expectValue(3 - index, { propertyName: "outerStruct", accessors: ["innerStruct", "doubles", -1 - index] }, sourceElementId);
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

      const context = createUpdateContext(sourceElementId, imodel, false);

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

    it("deduces the type of an array leaf from the schema rather than from the value", () => {
      // Regression: the type used to be inferred by sniffing `typeof value` whenever the
      // terminal EC property was a String primitive reached through accessors. Since a String
      // *array* property also reports isPrimitive(), legitimate array leaves took the
      // JSON-in-string branch and lost their schema-declared extended type.
      const propertyHost = { elementId: sourceElementId, schemaName: "Fields", className: "TestElement" };
      expect(getPropertyType(propertyHost, { propertyName: "strings", accessors: [0] })).to.equal("string");
      expect(getPropertyType(propertyHost, { propertyName: "dateStrings", accessors: [0] })).to.equal("datetime");
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

  describe("evaluateFields (quantity formatting)", () => {
    // Registers a provider for `imodel` whose adopted FormatSet is `formats`, pre-warmed with
    // exactly what `block`'s fields require. Mirrors the documented collect -> warm -> evaluate
    // workflow: the app supplies FormatSets at registration time and evaluation is synchronous.
    async function register(block: TextBlock, formats: Record<string, FormatDefinition> = {}): Promise<FieldFormattingSpecProvider> {
      return ElementDrivesTextAnnotation.registerFieldFormattingProvider({
        iModel: imodel,
        formatSet: toFormatSet(formats),
        requirements: ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel: imodel, block }),
      });
    }

    afterEach(() => {
      ElementDrivesTextAnnotation.unregisterFieldFormattingProvider(imodel);
    });

    it("preserves non-quantity field formatting", async () => {
      const textBlock = TextBlock.create();
      const stringField = FieldRun.create({
        propertyHost: { elementId: sourceElementId, schemaName: "Fields", className: "TestElement" },
        propertyPath: { propertyName: "strings", accessors: [0] },
        formatOptions: { prefix: "[", suffix: "]" },
        cachedContent: "old",
      });
      textBlock.appendRun(stringField);

      await register(textBlock);
      const updatedCount = ElementDrivesTextAnnotation.evaluateFields({ iModel: imodel, block: textBlock });

      expect(updatedCount).to.equal(1);
      expect(stringField.cachedContent).to.equal("[a]");
    });

    // --- QuantityFieldFormatOptions ---

    const propertyHost = { elementId: "", schemaName: "Fields", className: "TestElement" };
    const doublesPath: FieldPropertyPath = { propertyName: "outerStruct", accessors: ["innerStruct", "doubles", 0] };

    async function runEvaluate(field: FieldRun, formats: Record<string, FormatDefinition> = {}): Promise<{ updatedCount: number, content: string }> {
      const textBlock = TextBlock.create();
      textBlock.appendRun(field);
      await register(textBlock, formats);
      const updatedCount = ElementDrivesTextAnnotation.evaluateFields({ iModel: imodel, block: textBlock });
      return { updatedCount, content: field.cachedContent };
    }

    it("converts persistence meters to millimeters using a kindOfQuantity override", async () => {
      const field = FieldRun.create({
        propertyHost: { ...propertyHost, elementId: sourceElementId },
        propertyPath: doublesPath,
        formatOptions: {
          quantity: {
            persistenceUnit: "Units.M",
            kindOfQuantity: "MyKoq.LengthMm",
          },
        },
        cachedContent: "old",
      });

      const { updatedCount, content } = await runEvaluate(field, { "MyKoq.LengthMm": decimalFormat("Units.MM", "mm", 2) });

      expect(updatedCount).to.equal(1);
      // doubles[0] === 1 m -> 1000 mm
      expect(content).to.equal("1000 mm");
    });

    it("still uses the property's KindOfQuantity when only persistenceUnit is overridden", async () => {
      // Regression: setting `formatOptions.quantity.persistenceUnit` alone must not suppress the
      // property's own KindOfQuantity — the two overrides are independent.
      const field = FieldRun.create({
        propertyHost: { ...propertyHost, elementId: sourceElementId },
        propertyPath: { propertyName: "lengthProp" },
        formatOptions: {
          quantity: {
            persistenceUnit: "Units.M",
          },
        },
        cachedContent: "old",
      });

      const { updatedCount, content } = await runEvaluate(field, { "Fields.LENGTH": decimalFormat("Units.MM", "mm", 2) });

      expect(updatedCount).to.equal(1);
      // lengthProp = 2.5 m persisted; property KoQ Fields.LENGTH still drives format lookup;
      // the adopted FormatSet's mm format converts to 2500 mm.
      expect(content).to.equal("2500 mm");
    });

    it("falls back to the property's KindOfQuantity when the override KoQ isn't in the FormatSet", async () => {
      // The caller pins a preferred KoQ (Missing.KOQ) but the adopted FormatSet only knows about
      // the property's KoQ (Fields.LENGTH). The formatter should use the property-side pair
      // rather than dropping to raw output.
      const field = FieldRun.create({
        propertyHost: { ...propertyHost, elementId: sourceElementId },
        propertyPath: { propertyName: "lengthProp" },
        formatOptions: {
          quantity: {
            kindOfQuantity: "Missing.KOQ",
          },
        },
        cachedContent: "old",
      });

      const { updatedCount, content } = await runEvaluate(field, { "Fields.LENGTH": decimalFormat("Units.MM", "mm", 2) });

      expect(updatedCount).to.equal(1);
      expect(content).to.equal("2500 mm");
    });

    it("marks the field invalid when a quantity property value is missing", async () => {
      const field = FieldRun.create({
        propertyHost: { ...propertyHost, elementId: sourceElementId },
        // maybeNull has no value on the test element.
        propertyPath: { propertyName: "maybeNull" },
        formatOptions: {
          quantity: {
            persistenceUnit: "Units.M",
          },
        },
        cachedContent: "old",
      });

      const { updatedCount, content } = await runEvaluate(field);

      expect(updatedCount).to.equal(1);
      expect(content).to.equal(FieldRun.invalidContentIndicator);
    });
  });

  describe("evaluateFields (adopted FormatSet)", () => {
    async function register(block: TextBlock, formats: Record<string, FormatDefinition> = {}): Promise<FieldFormattingSpecProvider> {
      return ElementDrivesTextAnnotation.registerFieldFormattingProvider({
        iModel: imodel,
        formatSet: toFormatSet(formats),
        requirements: ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel: imodel, block }),
      });
    }

    afterEach(() => {
      ElementDrivesTextAnnotation.unregisterFieldFormattingProvider(imodel);
    });

    it("resolves KoQ formats from the adopted FormatSet", async () => {
      const inlineFormat = decimalFormat("Units.MM", "mm", 2);

      const block = TextBlock.create();
      const field = FieldRun.create({
        propertyHost: { elementId: sourceElementId, schemaName: "Fields", className: "TestElement" },
        propertyPath: { propertyName: "lengthProp" },
        cachedContent: "old",
      });
      block.appendRun(field);

      await register(block, { "Fields.LENGTH": inlineFormat });
      const updated = ElementDrivesTextAnnotation.evaluateFields({ iModel: imodel, block });

      expect(updated).to.equal(1);
      // lengthProp = 2.5 m -> 2500 mm via the adopted FormatSet.
      expect(field.cachedContent).to.equal("2500 mm");
    });
  });

  describe("JSON-in-string properties", () => {
    // `JsonProperties` is a plain String column; accessors index into the parsed JSON, so none
    // of these paths have an EC property — and therefore no schema-side KindOfQuantity — behind
    // the leaf.
    function jsonPath(...accessors: Array<string | number>): FieldPropertyPath {
      return { propertyName: "JsonProperties", accessors };
    }

    function evaluateJson(accessors: Array<string | number>, formatOptions?: FieldRun["formatOptions"]): FieldValue | undefined {
      return evaluateField(jsonPath(...accessors), sourceElementId, false, formatOptions);
    }

    it("indexes into a deserialized JSON object", () => {
      expect(evaluateJson(["stringProp"])?.value).to.equal("abc");
      expect(evaluateJson(["bool"])?.value).to.equal(true);
      expect(evaluateJson(["zoo", "address", "zipcode"])?.value).to.equal(12345);
    });

    it("indexes into a deserialized JSON array, including negative indices", () => {
      expect(evaluateJson(["ints", 0])?.value).to.equal(10);
      expect(evaluateJson(["ints", 3])?.value).to.equal(13);
      expect(evaluateJson(["ints", -1])?.value).to.equal(13);
      expect(evaluateJson(["zoo", "birds", 1, "sound"])?.value).to.equal("scree!");
    });

    it("returns undefined for a JSON null leaf rather than an unformattable value", () => {
      // A JSON null is not a FieldPrimitiveValue. Producing one here used to yield a
      // `{ value: null, type: "string" }` FieldValue whose formatter called `null.toString()`.
      expect(evaluateJson(["nullProp"])).to.be.undefined;
      expect(evaluateJson(["readings", 1])).to.be.undefined;
    });

    it("does not throw when a field resolves to a JSON null", () => {
      const fieldRun = FieldRun.create({
        propertyHost: { elementId: sourceElementId, schemaName: "Fields", className: "TestElement" },
        propertyPath: jsonPath("nullProp"),
        cachedContent: "stale",
      });

      const context = createUpdateContext(sourceElementId, imodel, false);
      expect(() => updateField(fieldRun, context)).to.not.throw();
      expect(fieldRun.cachedContent).to.equal(FieldRun.invalidContentIndicator);
    });

    it("returns undefined for a missing key or an out-of-range index", () => {
      expect(evaluateJson(["nope"])).to.be.undefined;
      expect(evaluateJson(["zoo", "address", "street"])).to.be.undefined;
      expect(evaluateJson(["ints", 4])).to.be.undefined;
      expect(evaluateJson(["ints", -5])).to.be.undefined;
    });

    it("returns undefined when the path stops on a JSON object or array", () => {
      expect(evaluateJson(["zoo"])).to.be.undefined;
      expect(evaluateJson(["ints"])).to.be.undefined;
    });

    it("returns undefined when indexing past a JSON scalar", () => {
      expect(evaluateJson(["stringProp", "more"])).to.be.undefined;
      expect(evaluateJson(["bool", 0])).to.be.undefined;
    });

    it("keeps the raw string when the property is not indexed", () => {
      const value = evaluateField({ propertyName: "JsonProperties" }, sourceElementId);
      expect(value?.type).to.equal("string");
      expect(value?.value).to.be.a("string").and.to.contain("stringProp");
    });

    it("types string and boolean leaves from the parsed JSON", () => {
      expect(evaluateJson(["stringProp"])?.type).to.equal("string");
      expect(evaluateJson(["bool"])?.type).to.equal("boolean");
      expect(evaluateJson(["readings", 2])?.type).to.equal("string");
    });

    it("types a numeric leaf as a quantity", () => {
      // JSON carries no units, so the field is expected to declare its own KoQ and persistence
      // unit. An incomplete key isn't an error: it produces no format candidates and renders
      // through the same raw fallback a string leaf would have used.
      expect(evaluateJson(["lengthMeters"])?.type).to.equal("quantity");
      expect(evaluateJson(["lengthMeters"], { quantity: { kindOfQuantity: "AecUnits.LENGTH" } })?.type).to.equal("quantity");
      expect(evaluateJson(["lengthMeters"], { quantity: { kindOfQuantity: "AecUnits.LENGTH", persistenceUnit: "Units.M" } })?.type).to.equal("quantity");
    });

    it("carries no property-side KoQ for a numeric leaf", () => {
      // There is no EC property behind a JSON leaf, so the only pair the formatter can build is
      // the one the field supplies.
      const value = evaluateJson(["lengthMeters"], { quantity: { kindOfQuantity: "AecUnits.LENGTH", persistenceUnit: "Units.M" } });
      expect(value?.value).to.equal(2.5);
      expect(value?.kindOfQuantityFullName).to.be.undefined;
      expect(value?.persistenceUnitFullName).to.be.undefined;
    });

    it("renders a numeric leaf as its raw value when the field supplies an incomplete key", () => {
      // The user-visible half of the contract: "quantity" with no resolvable (KoQ, unit) pair is
      // indistinguishable from the plain string rendering, and records no pre-warm miss.
      const provider: FormattingSpecProvider = {
        onFormattingReady: new BeUnorderedUiEvent(),
        getSpecsByNameAndUnit: () => undefined,
        formatQuantity: (m) => `FORMATTED:${m}`,
      };

      let missed = false;
      for (const quantity of [undefined, { kindOfQuantity: "AecUnits.LENGTH" }, { persistenceUnit: "Units.M" }]) {
        const value = evaluateJson(["lengthMeters"], quantity ? { quantity } : undefined);
        expect(value?.type).to.equal("quantity");
        expect(formatFieldValueWithSpecProvider(value!, quantity ? { quantity } : undefined, provider, () => { missed = true; })).to.equal("2.5");
      }

      expect(missed, "an unformattable JSON leaf is not an under-warmed requirement").to.be.false;
    });
  });

  describe("collectFieldFormattingRequirements", () => {
    function makeField(propertyPath: FieldPropertyPath, formatOptions?: FieldRun["formatOptions"]): FieldRun {
      return FieldRun.create({
        propertyHost: { elementId: sourceElementId, schemaName: "Fields", className: "TestElement" },
        propertyPath,
        formatOptions,
      });
    }

    function makeBlock(...fields: FieldRun[]): TextBlock {
      const block = TextBlock.create();
      for (const f of fields) {
        block.appendRun(f);
      }
      return block;
    }

    it("returns the property's KoQ + persistence unit for a quantity field", () => {
      const block = makeBlock(makeField({ propertyName: "lengthProp" }));
      const reqs = ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel: imodel, block });
      expect(reqs).to.have.length(1);
      expect(reqs[0].name).to.equal("Fields.LENGTH");
      expect(reqs[0].persistenceUnitName).to.equal("Units.M");
    });

    it("uses kindOfQuantity and persistenceUnit overrides when supplied", () => {
      const block = makeBlock(makeField(
        { propertyName: "outerStruct", accessors: ["innerStruct", "doubles", 0] },
        { quantity: { kindOfQuantity: "AecUnits.LENGTH", persistenceUnit: "Units.M" } },
      ));
      const reqs = ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel: imodel, block });
      expect(reqs).to.have.length(1);
      expect(reqs[0].name).to.equal("AecUnits.LENGTH");
      expect(reqs[0].persistenceUnitName).to.equal("Units.M");
    });

    it("prefers kindOfQuantity override but also emits the property KoQ as a fallback pre-warm", () => {
      // Fields with a kindOfQuantity override should emit both the effective pair (override
      // KoQ + property persistence unit) and the property-side pair. That way apps pre-warming
      // via this API cover the formatter's runtime fallback if the override name isn't in the
      // active FormatSet.
      const block = makeBlock(makeField(
        { propertyName: "lengthProp" },
        { quantity: { kindOfQuantity: "AecUnits.LENGTH" } },
      ));
      const reqs = ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel: imodel, block });
      expect(reqs).to.have.length(2);
      const sorted = [...reqs].sort((a, b) => a.name.localeCompare(b.name));
      expect(sorted[0]).to.deep.equal({ name: "AecUnits.LENGTH", persistenceUnitName: "Units.M" });
      expect(sorted[1]).to.deep.equal({ name: "Fields.LENGTH", persistenceUnitName: "Units.M" });
    });

    it("skips non-quantity fields", () => {
      const block = makeBlock(
        makeField({ propertyName: "intProp" }),
        makeField({ propertyName: "strings", accessors: [0] }),
        makeField({ propertyName: "datetime" }),
      );
      const reqs = ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel: imodel, block });
      expect(reqs).to.have.length(0);
    });

    it("skips quantity/coordinate fields whose property has no KoQ and no override", () => {
      const block = makeBlock(
        // point3d property has no KoQ.
        makeField({ propertyName: "point" }),
        // struct-array leaf double has no KoQ.
        makeField({ propertyName: "outerStruct", accessors: ["innerStruct", "doubles", 0] }),
      );
      const reqs = ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel: imodel, block });
      expect(reqs).to.have.length(0);
    });

    it("deduplicates identical requirements", () => {
      const block = makeBlock(
        makeField({ propertyName: "lengthProp" }),
        makeField({ propertyName: "lengthProp" }),
        makeField({ propertyName: "lengthProp" }, { quantity: { kindOfQuantity: "AecUnits.LENGTH" } }),
        makeField({ propertyName: "lengthProp" }, { quantity: { kindOfQuantity: "AecUnits.LENGTH" } }),
      );
      const reqs = ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel: imodel, block });
      expect(reqs).to.have.length(2);
      expect(reqs.map((r) => r.name).sort()).to.deep.equal(["AecUnits.LENGTH", "Fields.LENGTH"]);
    });

    it("returns nothing for a block with no fields", () => {
      const block = makeBlock();
      const reqs = ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel: imodel, block });
      expect(reqs).to.have.length(0);
    });

    it("skips a JSON-in-string field whose quantity key is incomplete", () => {
      // A JSON leaf has no property-side pair, so a half-specified key yields no requirement —
      // matching the runtime, which falls through to the raw representation.
      const block = makeBlock(
        makeField({ propertyName: "JsonProperties", accessors: ["lengthMeters"] }),
        makeField({ propertyName: "JsonProperties", accessors: ["lengthMeters"] }, { quantity: { kindOfQuantity: "AecUnits.LENGTH" } }),
        makeField({ propertyName: "JsonProperties", accessors: ["lengthMeters"] }, { quantity: { persistenceUnit: "Units.M" } }),
      );
      const reqs = ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel: imodel, block });
      expect(reqs).to.have.length(0);
    });

    it("emits the field-supplied pair for a JSON-in-string field with both overrides", () => {
      // The evaluation path types this leaf "quantity", so pre-warm has to cover it or the
      // synchronous txn callback would persist a raw value.
      const block = makeBlock(makeField(
        { propertyName: "JsonProperties", accessors: ["lengthMeters"] },
        { quantity: { kindOfQuantity: "AecUnits.LENGTH", persistenceUnit: "Units.M" } },
      ));
      const reqs = ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel: imodel, block });
      expect(reqs).to.deep.equal([{ name: "AecUnits.LENGTH", persistenceUnitName: "Units.M" }]);
    });
  });

  describe("registerFieldFormattingProvider (sync path)", () => {
    // Ids referenced by fields via formatOptions.quantity.formatSet and supplied per-field
    // through the `formatSets` array at registration time. PRIMARY is the "normal" FormatSet
    // under test; SECONDARY exercises multi-FormatSet routing.
    const PRIMARY_FORMAT_SET = "0x111";
    const SECONDARY_FORMAT_SET = "0x222";

    // Registers a provider for `imodel` with the given per-field FormatSets, pre-warmed for the
    // single (Fields.LENGTH, Units.M) requirement the length-field tests use.
    async function registerSets(formatSets: ReadonlyArray<{ id: Id64String, formats: Record<string, FormatDefinition> }>): Promise<FieldFormattingSpecProvider> {
      return ElementDrivesTextAnnotation.registerFieldFormattingProvider({
        iModel: imodel,
        formatSets: formatSets.map(({ id, formats }) => ({ id, formatSet: toFormatSet(formats) })),
        requirements: [{ name: "Fields.LENGTH", persistenceUnitName: "Units.M" }],
      });
    }

    // A mm FormatSet: 2.5 m -> "2500 mm".
    function mmSet(): Record<string, FormatDefinition> {
      return { "Fields.LENGTH": decimalFormat("Units.MM", "mm", 2) };
    }

    afterEach(() => {
      ElementDrivesTextAnnotation.unregisterFieldFormattingProvider(imodel);
      // Clean up any TextAnnotation3d elements produced below so we don't leak state
      // (and their ElementDrivesTextAnnotation relationships) into later describe
      // blocks that assert on relationship counts.
      const ids: Id64String[] = [];
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      imodel.withPreparedStatement("SELECT ECInstanceId FROM BisCore.TextAnnotation3d", (stmt) => {
        while (stmt.step() === DbResult.BE_SQLITE_ROW)
          ids.push(stmt.getValue(0).getId());
      });
      if (ids.length > 0)
        withEditTxn(imodel, (txn) => { for (const id of ids) txn.deleteElement(id); });
    });

    it("routes evaluateFields quantity formatting through a registered provider", async () => {
      await registerSets([{ id: PRIMARY_FORMAT_SET, formats: mmSet() }]);

      const textBlock = TextBlock.create();
      const field = FieldRun.create({
        propertyHost: { elementId: sourceElementId, schemaName: "Fields", className: "TestElement" },
        propertyPath: { propertyName: "lengthProp" },
        formatOptions: { quantity: { formatSet: PRIMARY_FORMAT_SET } },
        cachedContent: "old",
      });
      textBlock.appendRun(field);

      const updated = ElementDrivesTextAnnotation.evaluateFields({ iModel: imodel, block: textBlock });

      expect(updated).to.equal(1);
      // lengthProp = 2.5 m -> 2500 mm.
      expect(field.cachedContent).to.equal("2500 mm");
    });

    it("routes quantity formatting through provider.formatQuantity, not spec.applyFormatting", () => {
      // Regression: the sync path must honor the FormattingSpecProvider contract by rendering
      // magnitudes via `provider.formatQuantity(magnitude, spec)`, so caller-side hooks
      // (caching, telemetry, per-call substitution) apply. Directly calling
      // `spec.applyFormatting` would bypass those hooks silently. Exercised directly against the
      // internal helper with a hand-rolled provider so the two entry points differ observably.
      const fakeSpec = { applyFormatting: (m: number) => `SPEC:${m}` } as unknown as FormatterSpec;
      const provider: FormattingSpecProvider = {
        onFormattingReady: new BeUnorderedUiEvent(),
        getSpecsByNameAndUnit(args) {
          if (args.name === "Fields.LENGTH" && args.persistenceUnitName === "Units.M") {
            return { formatterSpec: fakeSpec } as FormattingSpecEntry;
          }
          return undefined;
        },
        formatQuantity: (m) => `PROVIDER:${m}`,
      };

      const value: FieldValue = { value: 2.5, type: "quantity", kindOfQuantityFullName: "Fields.LENGTH", persistenceUnitFullName: "Units.M" };
      const result = formatFieldValueWithSpecProvider(value, undefined, provider);

      expect(result).to.equal("PROVIDER:2.5");
    });

    it("routes coordinate formatting through provider.formatQuantity for each component", () => {
      // Same as above but for coordinate values — every component should render via
      // `provider.formatQuantity`, not `spec.applyFormatting`.
      const fakeSpec = { applyFormatting: (m: number) => `SPEC:${m}` } as unknown as FormatterSpec;
      const provider: FormattingSpecProvider = {
        onFormattingReady: new BeUnorderedUiEvent(),
        getSpecsByNameAndUnit(args) {
          if (args.name === "Fields.LENGTH" && args.persistenceUnitName === "Units.M") {
            return { formatterSpec: fakeSpec } as FormattingSpecEntry;
          }
          return undefined;
        },
        formatQuantity: (m) => `PROVIDER:${m}`,
      };

      const value: FieldValue = { value: { x: 1, y: 2, z: 3 }, type: "coordinate", kindOfQuantityFullName: "Fields.LENGTH", persistenceUnitFullName: "Units.M" };
      const result = formatFieldValueWithSpecProvider(value, undefined, provider);

      expect(result).to.equal("(PROVIDER:1, PROVIDER:2, PROVIDER:3)");
    });

    it("falls back to the raw string when neither the FormatSet nor the schema resolves a format", async () => {
      // A genuine raw fallback: the point property has no KoQ, and the override KoQ resolves in
      // neither the (empty) FormatSet nor the iModel's schemas. The field drops to its raw
      // representation and the shortfall is recorded as a miss.
      const block = TextBlock.create();
      const field = FieldRun.create({
        propertyHost: { elementId: sourceElementId, schemaName: "Fields", className: "TestElement" },
        propertyPath: { propertyName: "point" },
        formatOptions: { quantity: { formatSet: PRIMARY_FORMAT_SET, kindOfQuantity: "Missing.KOQ", persistenceUnit: "Units.M" } },
        cachedContent: "old",
      });
      block.appendRun(field);

      const provider = await ElementDrivesTextAnnotation.registerFieldFormattingProvider({
        iModel: imodel,
        formatSets: [{ id: PRIMARY_FORMAT_SET, formatSet: toFormatSet({}) }],
        requirements: ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel: imodel, block }),
      });

      const updated = ElementDrivesTextAnnotation.evaluateFields({ iModel: imodel, block });

      expect(updated).to.equal(1);
      expect(field.cachedContent).to.equal("(1, 2, 3)");
      expect(Array.from(provider.misses).some((m) => m.name === "Missing.KOQ" && m.persistenceUnitName === "Units.M")).to.be.true;
    });

    it("falls through to the schema format when a field's FormatSet lacks an entry for its KoQ", async () => {
      // A field naming a FormatSet whose formats lack its KindOfQuantity still resolves the
      // schema presentation format rather than dropping to the raw string.
      const block = TextBlock.create();
      const field = FieldRun.create({
        propertyHost: { elementId: sourceElementId, schemaName: "Fields", className: "TestElement" },
        propertyPath: { propertyName: "lengthProp" },
        formatOptions: { quantity: { formatSet: SECONDARY_FORMAT_SET } },
        cachedContent: "old",
      });
      block.appendRun(field);

      await ElementDrivesTextAnnotation.registerFieldFormattingProvider({
        iModel: imodel,
        formatSets: [{ id: SECONDARY_FORMAT_SET, formatSet: toFormatSet({}) }],
        requirements: ElementDrivesTextAnnotation.collectFieldFormattingRequirements({ iModel: imodel, block }),
      });

      const updated = ElementDrivesTextAnnotation.evaluateFields({ iModel: imodel, block });

      expect(updated).to.equal(1);
      // Fields.LENGTH schema presentation: 2.5 m -> "2.5 m".
      expect(field.cachedContent).to.equal("2.5 m");
    });

    it("preserves prior behavior when no provider is registered", () => {
      // Sanity check: no provider registered -> raw string formatting as before.
      const textBlock = TextBlock.create();
      const field = FieldRun.create({
        propertyHost: { elementId: sourceElementId, schemaName: "Fields", className: "TestElement" },
        propertyPath: { propertyName: "lengthProp" },
        cachedContent: "old",
      });
      textBlock.appendRun(field);

      const updated = ElementDrivesTextAnnotation.evaluateFields({ iModel: imodel, block: textBlock });

      expect(updated).to.equal(1);
      expect(field.cachedContent).to.equal("2.5");
    });

    it("preserves prior coordinate behavior when no provider is registered", () => {
      const textBlock = TextBlock.create();
      const field = FieldRun.create({
        propertyHost: { elementId: sourceElementId, schemaName: "Fields", className: "TestElement" },
        propertyPath: { propertyName: "point" },
        cachedContent: "old",
      });
      textBlock.appendRun(field);

      const updated = ElementDrivesTextAnnotation.evaluateFields({ iModel: imodel, block: textBlock });

      expect(updated).to.equal(1);
      expect(field.cachedContent).to.equal("(1, 2, 3)");
    });

    it("preserves prior behavior on the txn callback path when no provider is registered", () => {
      const textBlock = TextBlock.create();
      const field = FieldRun.create({
        styleOverrides: { font: { name: "Karla" } },
        propertyHost: { elementId: sourceElementId, schemaName: "Fields", className: "TestElement" },
        propertyPath: { propertyName: "lengthProp" },
        cachedContent: "old",
      });
      textBlock.appendRun(field);

      const annotationElementId = insertAnnotationElement(textBlock);
      withEditTxn(imodel, (txn) => {
        ElementDrivesTextAnnotation.updateFieldDependencies(txn, annotationElementId);
      });

      const reloaded = imodel.elements.getElement<TextAnnotation3d>(annotationElementId);
      const reloadedBlock = reloaded.getAnnotation()?.textBlock;
      expect(reloadedBlock).to.not.be.undefined;
      let reloadedField: FieldRun | undefined;
      for (const { child } of traverseTextBlockComponent(reloadedBlock!)) {
        if (child.type === "field") {
          reloadedField = child;
          break;
        }
      }
      expect(reloadedField).to.not.be.undefined;
      expect(reloadedField!.cachedContent).to.equal("2.5");
    });

    it("registers and unregisters the provider for an iModel", async () => {
      await registerSets([{ id: PRIMARY_FORMAT_SET, formats: mmSet() }]);
      expect(ElementDrivesTextAnnotation.getFieldFormattingProvider(imodel)).to.not.be.undefined;

      ElementDrivesTextAnnotation.unregisterFieldFormattingProvider(imodel);
      expect(ElementDrivesTextAnnotation.getFieldFormattingProvider(imodel)).to.be.undefined;
    });

    it("routes each field to the FormatSet identified by formatOptions.quantity.formatSet", async () => {
      // Supply two FormatSets under distinct ids and confirm each field picks the one that
      // matches its formatOptions.quantity.formatSet.
      await registerSets([
        { id: PRIMARY_FORMAT_SET, formats: { "Fields.LENGTH": decimalFormat("Units.MM", "mm", 2) } },
        { id: SECONDARY_FORMAT_SET, formats: { "Fields.LENGTH": decimalFormat("Units.CM", "cm", 2) } },
      ]);

      const block = TextBlock.create();
      const primaryField = FieldRun.create({
        propertyHost: { elementId: sourceElementId, schemaName: "Fields", className: "TestElement" },
        propertyPath: { propertyName: "lengthProp" },
        formatOptions: { quantity: { formatSet: PRIMARY_FORMAT_SET } },
        cachedContent: "old",
      });
      const secondaryField = FieldRun.create({
        propertyHost: { elementId: sourceElementId, schemaName: "Fields", className: "TestElement" },
        propertyPath: { propertyName: "lengthProp" },
        formatOptions: { quantity: { formatSet: SECONDARY_FORMAT_SET } },
        cachedContent: "old",
      });
      block.appendRun(primaryField);
      block.appendRun(secondaryField);

      const updated = ElementDrivesTextAnnotation.evaluateFields({ iModel: imodel, block });

      expect(updated).to.equal(2);
      expect(primaryField.cachedContent).to.equal("2500 mm");
      expect(secondaryField.cachedContent).to.equal("250 cm");
    });

    it("falls through to the adopted FormatSet when a field's formatSet is unset", async () => {
      // A field with no formatSet routes to the adopted (default) FormatSet rather than raw.
      await ElementDrivesTextAnnotation.registerFieldFormattingProvider({
        iModel: imodel,
        formatSet: toFormatSet({ "Fields.LENGTH": decimalFormat("Units.MM", "mm", 2) }),
        requirements: [{ name: "Fields.LENGTH", persistenceUnitName: "Units.M" }],
      });

      const block = TextBlock.create();
      const field = FieldRun.create({
        propertyHost: { elementId: sourceElementId, schemaName: "Fields", className: "TestElement" },
        propertyPath: { propertyName: "lengthProp" },
        cachedContent: "old",
      });
      block.appendRun(field);

      const updated = ElementDrivesTextAnnotation.evaluateFields({ iModel: imodel, block });

      expect(updated).to.equal(1);
      expect(field.cachedContent).to.equal("2500 mm");
    });

    it("records a miss when a field's requirement was never pre-warmed, then formats after warmUp", async () => {
      const block = TextBlock.create();
      const field = FieldRun.create({
        propertyHost: { elementId: sourceElementId, schemaName: "Fields", className: "TestElement" },
        propertyPath: { propertyName: "lengthProp" },
        cachedContent: "old",
      });
      block.appendRun(field);

      // requirements: [] skips the sweep, so nothing is pre-warmed.
      const provider = await ElementDrivesTextAnnotation.registerFieldFormattingProvider({
        iModel: imodel,
        formatSet: toFormatSet({ "Fields.LENGTH": decimalFormat("Units.MM", "mm", 2) }),
        requirements: [],
      });

      let updated = ElementDrivesTextAnnotation.evaluateFields({ iModel: imodel, block });
      expect(updated).to.equal(1);
      // No spec pre-warmed -> raw fallback, and a miss recorded.
      expect(field.cachedContent).to.equal("2.5");
      const misses = Array.from(provider.misses);
      expect(misses.some((m) => m.name === "Fields.LENGTH" && m.persistenceUnitName === "Units.M")).to.be.true;

      // Warm the missing requirement and re-evaluate; it now formats.
      await provider.warmUp([{ name: "Fields.LENGTH", persistenceUnitName: "Units.M" }]);
      updated = ElementDrivesTextAnnotation.evaluateFields({ iModel: imodel, block });
      expect(updated).to.equal(1);
      expect(field.cachedContent).to.equal("2500 mm");
    });

    it("collectIModelFieldFormattingRequirements sweeps dependency-tracked annotations in the iModel", () => {
      const sourceId = withEditTxn(imodel, (txn) => insertTestElement(txn, model, category));
      insertAnnotationWithLengthField(sourceId);

      const reqs = ElementDrivesTextAnnotation.collectIModelFieldFormattingRequirements(imodel);

      expect(reqs.some((r) => r.name === "Fields.LENGTH" && r.persistenceUnitName === "Units.M")).to.be.true;
    });

    function readFieldCachedContentById(annotationElementId: Id64String): string | undefined {
      const reloaded = imodel.elements.getElement<TextAnnotation3d>(annotationElementId);
      const reloadedBlock = reloaded.getAnnotation()?.textBlock;
      if (!reloadedBlock) return undefined;
      for (const { child } of traverseTextBlockComponent(reloadedBlock)) {
        if (child.type === "field") {
          return child.cachedContent;
        }
      }
      return undefined;
    }

    function insertAnnotationWithLengthField(sourceId: Id64String): Id64String {
      const textBlock = TextBlock.create();
      const field = FieldRun.create({
        styleOverrides: { font: { name: "Karla" } },
        propertyHost: { elementId: sourceId, schemaName: "Fields", className: "TestElement" },
        propertyPath: { propertyName: "lengthProp" },
        formatOptions: { quantity: { formatSet: PRIMARY_FORMAT_SET } },
        cachedContent: "old",
      });
      textBlock.appendRun(field);
      const annotationElementId = insertAnnotationElement(textBlock);
      withEditTxn(imodel, (txn) => {
        ElementDrivesTextAnnotation.updateFieldDependencies(txn, annotationElementId);
      });
      return annotationElementId;
    }

    it("routes txn-driven field updates through the registered provider", async () => {
      await registerSets([{ id: PRIMARY_FORMAT_SET, formats: mmSet() }]);

      const annotationElementId = insertAnnotationWithLengthField(sourceElementId);

      expect(readFieldCachedContentById(annotationElementId)).to.equal("2500 mm");
    });

    it("Formats persisted cachedContent when the source element is later updated", async () => {
      // Update-path counterpart to the insert path above. Confirms the txn callback fired via
      // onRootChangedArg also routes through the registered provider.
      await registerSets([{ id: PRIMARY_FORMAT_SET, formats: mmSet() }]);

      const sourceId = withEditTxn(imodel, (txn) => insertTestElement(txn, model, category));
      const annotationElementId = insertAnnotationWithLengthField(sourceId);
      expect(readFieldCachedContentById(annotationElementId)).to.equal("2500 mm");

      // Mutate the source to fire the txn callback.
      const source = imodel.elements.getElement<TestElement>(sourceId);
      source.lengthProp = 4.25;
      withEditTxn(imodel, "source update", (txn) => {
        source.update(txn);
        txn.saveChanges("source update");
      });

      expect(readFieldCachedContentById(annotationElementId)).to.equal("4250 mm");
    });

    it("Does not re-format existing annotations when a provider is registered after save", async () => {
      // Contract: registering a provider does not walk existing annotations. Persisted
      // cachedContent stays at whatever the previous save produced until the next source update.
      const sourceId = withEditTxn(imodel, (txn) => insertTestElement(txn, model, category));
      // No provider registered yet -> insert persists the raw fallback.
      const annotationElementId = insertAnnotationWithLengthField(sourceId);
      expect(readFieldCachedContentById(annotationElementId)).to.equal("2.5");

      await registerSets([{ id: PRIMARY_FORMAT_SET, formats: mmSet() }]);

      // Registration alone must not touch persisted content.
      expect(readFieldCachedContentById(annotationElementId)).to.equal("2.5");
    });

    it("Regresses persisted cachedContent to raw when the provider is unregistered before a source update", async () => {
      // Contract: once a provider is unregistered, the next txn callback rewrites cachedContent
      // through the raw fallback, overwriting a previously-formatted value.
      await registerSets([{ id: PRIMARY_FORMAT_SET, formats: mmSet() }]);

      const sourceId = withEditTxn(imodel, (txn) => insertTestElement(txn, model, category));
      const annotationElementId = insertAnnotationWithLengthField(sourceId);
      expect(readFieldCachedContentById(annotationElementId)).to.equal("2500 mm");

      ElementDrivesTextAnnotation.unregisterFieldFormattingProvider(imodel);

      const source = imodel.elements.getElement<TestElement>(sourceId);
      source.lengthProp = 3.5;
      withEditTxn(imodel, "source update after unregister", (txn) => {
        source.update(txn);
        txn.saveChanges("source update after unregister");
      });

      // Previously-formatted "2500 mm" is overwritten by the raw fallback.
      expect(readFieldCachedContentById(annotationElementId)).to.equal("3.5");
    });

    it("evaluateFields mutates the in-memory TextBlock but does not persist to the element on its own", async () => {
      // Contract: evaluateFields formats in place and returns a count. Persistence is the
      // caller's responsibility (setAnnotation + element.update inside an EditTxn).
      const sourceId = withEditTxn(imodel, (txn) => insertTestElement(txn, model, category));
      const annotationElementId = insertAnnotationWithLengthField(sourceId);
      const persistedBefore = readFieldCachedContentById(annotationElementId);
      expect(persistedBefore).to.equal("2.5");

      await registerSets([{ id: PRIMARY_FORMAT_SET, formats: mmSet() }]);

      const reloaded = imodel.elements.getElement<TextAnnotation3d>(annotationElementId);
      const annotation = reloaded.getAnnotation()!;
      const inMemoryBlock = annotation.textBlock;

      // Evaluating in memory must not touch the persisted disk copy — nothing called `update`.
      ElementDrivesTextAnnotation.evaluateFields({ iModel: imodel, block: inMemoryBlock });

      expect(readFieldCachedContentById(annotationElementId)).to.equal(persistedBefore);
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
    return withEditTxn(imodel, (txn) => txn.insertElement(elem.toJSON()));
  }

  describe("ElementDrivesTextAnnotation", () => {
    async function expectNumRelationships(expected: number, targetId?: Id64String): Promise<void> {
      const where = targetId ? ` WHERE TargetECInstanceId=${targetId}` : "";
      const ecsql = `SELECT COUNT(*) FROM BisCore.ElementDrivesTextAnnotation ${where}`;
      const reader = imodel.createQueryReader(ecsql);
      expect(await reader.step()).to.be.true;
      expect(reader.current[0]).to.equal(expected);
    }

    it("can be inserted", async () => {
      await expectNumRelationships(0);

      const targetId = insertAnnotationElement(undefined);
      expect(targetId).not.to.equal(Id64.invalid);

      const target = imodel.elements.getElement(targetId);
      expect(target.classFullName).to.equal("BisCore:TextAnnotation3d");
      expect(target).instanceof(TextAnnotation3d);

      const targetAnno = imodel.elements.getElement<TextAnnotation3d>(targetId);
      expect(targetAnno).instanceof(TextAnnotation3d);

      const rel = ElementDrivesTextAnnotation.create(imodel, sourceElementId, targetId);
      const relId = withEditTxn(imodel, (txn) => txn.insertRelationship(rel.toJSON()));
      expect(relId).not.to.equal(Id64.invalid);

      await expectNumRelationships(1);

      const relationship = imodel.relationships.getInstance("BisCore:ElementDrivesTextAnnotation", relId);
      expect(relationship.sourceId).to.equal(sourceElementId);
      expect(relationship.targetId).to.equal(targetId);
    });

    function createField(propertyHost: Id64String | FieldPropertyHost, cachedContent: string, propertyName = "intProp", accessors?: Array<string | number>): FieldRun {
      if (typeof propertyHost === "string") {
        propertyHost = { schemaName: "Fields", className: "TestElement", elementId: propertyHost };
      }

      return FieldRun.create({
        styleOverrides: { font: { name: "Karla" } },
        propertyHost,
        cachedContent,
        propertyPath: { propertyName, accessors },
      });
    }

    describe("updateFieldDependencies", () => {
      it("creates exactly one relationship for each unique source element on insert and update", async () => {
        const source1 = withEditTxn(imodel, (editTxn) => insertTestElement(editTxn, model, category));
        const block = TextBlock.create();
        block.appendRun(createField(source1, "1"));
        const targetId = insertAnnotationElement(block);

        await expectNumRelationships(1, targetId);

        const source2 = withEditTxn(imodel, (editTxn) => insertTestElement(editTxn, model, category));
        const target = imodel.elements.getElement<TextAnnotation3d>(targetId);
        const anno = target.getAnnotation()!;
        anno.textBlock.appendRun(createField(source2, "2a"));
        target.setAnnotation(anno);
        withEditTxn(imodel, (txn) => target.update(txn));

        await expectNumRelationships(2, targetId);

        anno.textBlock.appendRun(createField(source2, "2b"));
        target.setAnnotation(anno);
        withEditTxn(imodel, (txn) => target.update(txn));

        await expectNumRelationships(2, targetId);

        const source3 = withEditTxn(imodel, (editTxn) => insertTestElement(editTxn, model, category));
        anno.textBlock.appendRun(createField(source3, "3"));
        target.setAnnotation(anno);
        withEditTxn(imodel, (txn) => target.update(txn));

        await expectNumRelationships(3, targetId);
      });

      it("deletes stale relationships", async () => {
        const sourceA = withEditTxn(imodel, (editTxn) => insertTestElement(editTxn, model, category));
        const sourceB = withEditTxn(imodel, (editTxn) => insertTestElement(editTxn, model, category));

        const block = TextBlock.create();
        block.appendRun(createField(sourceA, "A"));
        block.appendRun(createField(sourceB, "B"));
        const targetId = insertAnnotationElement(block);

        await expectNumRelationships(2, targetId);
        expect(imodel.relationships.tryGetInstance(ElementDrivesTextAnnotation.classFullName, { targetId, sourceId: sourceA })).not.to.be.undefined;
        expect(imodel.relationships.tryGetInstance(ElementDrivesTextAnnotation.classFullName, { targetId, sourceId: sourceB })).not.to.be.undefined;

        const target = imodel.elements.getElement<TextAnnotation3d>(targetId);
        const anno = target.getAnnotation()!;

        // Remove the sourceA FieldRun from the first paragraph.
        const p1 = anno.textBlock.children[0];
        p1.children.shift();

        target.setAnnotation(anno);
        withEditTxn(imodel, (txn) => target.update(txn));

        await expectNumRelationships(1, targetId);
        expect(imodel.relationships.tryGetInstance(ElementDrivesTextAnnotation.classFullName, { targetId, sourceId: sourceA })).to.be.undefined;
        expect(imodel.relationships.tryGetInstance(ElementDrivesTextAnnotation.classFullName, { targetId, sourceId: sourceB })).not.to.be.undefined;

        anno.textBlock.children.length = 0;
        anno.textBlock.appendRun(createField(sourceA, "A2"));
        target.setAnnotation(anno);
        withEditTxn(imodel, (txn) => target.update(txn));

        await expectNumRelationships(1, targetId);
        expect(imodel.relationships.tryGetInstance(ElementDrivesTextAnnotation.classFullName, { targetId, sourceId: sourceA })).not.to.be.undefined;
        expect(imodel.relationships.tryGetInstance(ElementDrivesTextAnnotation.classFullName, { targetId, sourceId: sourceB })).to.be.undefined;

        anno.textBlock.children.length = 0;
        anno.textBlock.appendRun(TextRun.create({
          styleOverrides: { font: { name: "Karla" } },
          content: "not a field",
        }));
        target.setAnnotation(anno);
        withEditTxn(imodel, (txn) => target.update(txn));

        await expectNumRelationships(0, targetId);
        expect(imodel.relationships.tryGetInstance(ElementDrivesTextAnnotation.classFullName, { targetId, sourceId: sourceA })).to.be.undefined;
        expect(imodel.relationships.tryGetInstance(ElementDrivesTextAnnotation.classFullName, { targetId, sourceId: sourceB })).to.be.undefined;
      });

      it("ignores invalid source element Ids", async () => {
        const source = withEditTxn(imodel, (editTxn) => insertTestElement(editTxn, model, category));
        const block = TextBlock.create();
        block.appendRun(createField(Id64.invalid, "invalid"));
        block.appendRun(createField("0xbaadf00d", "non-existent"));
        block.appendRun(createField(source, "valid"));

        const targetId = insertAnnotationElement(block);
        await expectNumRelationships(1, targetId);
      });
    });

    function expectText(expected: string, elemId: Id64String, db?: StandaloneDb): void {
      db = db ?? imodel;
      const elem = db.elements.getElement<TextAnnotation3d>(elemId);
      const anno = elem.getAnnotation()!;
      const actual = anno.textBlock.stringify();
      expect(actual).to.equal(expected);
    }

    it("evaluates cachedContent when annotation element is inserted", () => {
      const sourceId = withEditTxn(imodel, (editTxn) => insertTestElement(editTxn, model, category));
      const block = TextBlock.create();
      block.appendRun(createField(sourceId, "initial cached content"));
      expect(block.stringify()).to.equal("initial cached content");

      const targetId = insertAnnotationElement(block);

      const target = imodel.elements.getElement<TextAnnotation3d>(targetId);
      expect(target.getAnnotation()!.textBlock.stringify()).to.equal("100");
    });

    it("updates fields when source element is modified or deleted", () => {
      const sourceId = withEditTxn(imodel, (editTxn) => insertTestElement(editTxn, model, category));
      const block = TextBlock.create();
      block.appendRun(createField(sourceId, "old value"));;

      const targetId = insertAnnotationElement(block);

      const target = imodel.elements.getElement<TextAnnotation3d>(targetId);
      expect(target.getAnnotation()).not.to.be.undefined;

      expectText("100", targetId);

      let source = imodel.elements.getElement<TestElement>(sourceId);
      source.intProp = 50;

      expectText("100", targetId);

      withEditTxn(imodel, "delete source element fields", (txn) => {
        source.update(txn);
        expectText("100", targetId);
        txn.saveChanges("update source element fields");

        source = imodel.elements.getElement<TestElement>(sourceId);
        expect(source.intProp).to.equal(50);
        expectText("50", targetId);

        source.delete(txn);
        expectText("50", targetId);
      });
      expectText(FieldRun.invalidContentIndicator, targetId);
    });

    it("updates fields when source element aspect is modified, deleted, or recreated", () => {
      const sourceId = withEditTxn(imodel, (editTxn) => insertTestElement(editTxn, model, category));
      const block = TextBlock.create();
      block.appendRun(createField({ elementId: sourceId, schemaName: "Fields", className: "TestAspect" }, "", "aspectProp"));

      const targetId = insertAnnotationElement(block);
      expectText("999", targetId);

      const aspects = imodel.elements.getAspects(sourceId, "Fields:TestAspect");
      expect(aspects.length).to.equal(1);
      const aspect = aspects[0] as TestAspect;
      expect(aspect.aspectProp).to.equal(999);

      aspect.aspectProp = 12345;
      const newAspect: TestAspectProps = {
        element: new ElementOwnsUniqueAspect(sourceId),
        classFullName: TestAspect.classFullName,
        aspectProp: 42,
      };

      withEditTxn(imodel, "recreate source aspect fields", (txn) => {
        txn.updateAspect(aspect.toJSON());
        txn.saveChanges("update source aspect fields");
        expectText("12345", targetId);

        txn.deleteAspect([aspect.id]);
        txn.saveChanges("delete source aspect fields");
        expectText(FieldRun.invalidContentIndicator, targetId);

        txn.insertAspect(newAspect);
        txn.saveChanges("recreate source aspect fields");
        expectText("42", targetId);
      });
    });

    it("updates only fields for specific modified element", () => {
      const sourceA = withEditTxn(imodel, (editTxn) => insertTestElement(editTxn, model, category));
      const sourceB = withEditTxn(imodel, (editTxn) => insertTestElement(editTxn, model, category));
      const block = TextBlock.create();
      block.appendRun(createField(sourceA, "A"));
      block.appendRun(createField(sourceB, "B"));

      const targetId = insertAnnotationElement(block);
      expectText("100100", targetId);

      const sourceElem = imodel.elements.getElement<TestElement>(sourceB);
      sourceElem.intProp = 123;
      withEditTxn(imodel, (txn) => sourceElem.update(txn));

      expectText("100123", targetId);
    });

    it("supports complex property paths", () => {
      const sourceId = withEditTxn(imodel, (editTxn) => insertTestElement(editTxn, model, category));
      const block = TextBlock.create();
      block.appendRun(createField(sourceId, "", "outerStruct", ["innerStructs", 1, "doubles", -2]));
      const targetId = insertAnnotationElement(block);
      expectText("2", targetId);

      const source = imodel.elements.getElement<TestElement>(sourceId);
      source.outerStruct.innerStructs[1].doubles[3] = 12.5;
      withEditTxn(imodel, (txn) => source.update(txn));
      expectText("12.5", targetId);
    });

    it("updates EC view fields when the element changes if the EC view queries the element directly", () => {
      const sourceId = withEditTxn(imodel, (editTxn) => insertTestElement(editTxn, model, category));
      const block = TextBlock.create();
      block.appendRun(createField({
        elementId: sourceId, schemaName: "Fields", className: "TestElementStringProp",
      }, "cached-content", "StringProp"));

      const targetId = insertAnnotationElement(block);

      const target = imodel.elements.getElement<TextAnnotation3d>(targetId);
      expect(target.getAnnotation()).not.to.be.undefined;

      expectText("abc", targetId);

      let source = imodel.elements.getElement<TestElement>(sourceId);
      source.jsonProperties.stringProp = "zyx";

      expectText("abc", targetId);

      withEditTxn(imodel, "delete EC view fields", (txn) => {
        source.update(txn);
        expectText("abc", targetId);
        txn.saveChanges("update EC view fields");

        expectText("zyx", targetId);

        source = imodel.elements.getElement<TestElement>(sourceId);
        expect(source.jsonProperties.stringProp).to.equal("zyx");
        expectText("zyx", targetId);

        source.delete(txn);
        expectText("zyx", targetId);
      });
      expectText(FieldRun.invalidContentIndicator, targetId);
    });

    describe("remapFields", () => {
      let dstIModel: StandaloneDb;
      let dstModel: Id64String;
      let dstCategory: Id64String;
      let dstSourceElementId: Id64String;

      before(async () => {
        const path = IModelTestUtils.prepareOutputFile("RemapFields", `dst.bim`);
        dstIModel = StandaloneDb.createEmpty(path, { rootSubject: { name: `RemapFields-dst` }, enableTransactions: true });
        await registerTestSchema(dstIModel);

        // Insert additional unused elements to ensure element Ids differ between src and dst iModels
        const modelAndElement = withEditTxn(dstIModel, (txn) => {
          for (let i = 0; i < 3; i++) {
            IModelTestUtils.createAndInsertPhysicalPartitionAndModel(txn, Code.createEmpty(), true);
          }
          const ids = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(txn, Code.createEmpty(), true);
          dstCategory = SpatialCategory.insert(txn, StandaloneDb.dictionaryId, `dstCat`, new SubCategoryAppearance());
          return ids;
        });
        expect(modelAndElement[0]).to.equal(modelAndElement[1]);

        dstModel = modelAndElement[1];
        dstSourceElementId = withEditTxn(dstIModel, (txn) => insertTestElement(txn, dstModel, dstCategory, {
          intProp: 200,
          point: { x: -1, y: -2, z: -3 },
          strings: ["x", "y", "z"],
          intEnum: 2,
        }, 1234));

        await withEditTxn(dstIModel, async () => {
          await dstIModel.fonts.embedFontFile({
            file: FontFile.createFromTrueTypeFileName(IModelTestUtils.resolveFontFile("Karla-Regular.ttf"))
          });
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

      it("invalidates field host if source element not remapped", () => {
        const elem = createAnnotationElement(TextBlock.create(getTextBlockJson()));
        expectHostIds(elem, sourceElementId, category);

        const context = new IModelElementCloneContext(imodel, dstIModel);

        ElementDrivesTextAnnotation.remapFields(elem, context);
        expectHostIds(elem, Id64.invalid, Id64.invalid);
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
        propertyPath: { propertyName: "datetime" },
        cachedContent: "oldval",
        formatOptions: {
          dateTime: {
            formatOptions: {
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


