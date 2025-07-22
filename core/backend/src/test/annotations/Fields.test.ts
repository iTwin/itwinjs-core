/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Code, FieldPropertyHost, FieldPropertyPath, FieldRun, PhysicalElementProps, SubCategoryAppearance } from "@itwin/core-common";
import { IModelDb, SnapshotDb } from "../../IModelDb";
import { IModelTestUtils } from "../IModelTestUtils";
import { createUpdateContext, FieldProperty, updateField } from "../../internal/annotations/fields";
import { Id64String } from "@itwin/core-bentley";
import { SpatialCategory } from "../../Category";
import { Point3d, XYAndZ, YawPitchRollAngles } from "@itwin/core-geometry";
import { Schema, Schemas } from "../../Schema";
import { ClassRegistry } from "../../ClassRegistry";
import { PhysicalElement } from "../../Element";

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
        return { value: propertyValue, metadata: { } as any };
      }
      return undefined;
    },
  });

  it("does nothing if hostElementId does not match", () => {
    const fieldRun = FieldRun.create({
      styleName: "fieldStyle",
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
      styleName: "fieldStyle",
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
      styleName: "fieldStyle",
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
      styleName: "fieldStyle",
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
      styleName: "fieldStyle",
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
}

class FieldsSchema extends Schema {
  public static override get schemaName() { return "Fields"; }
}

async function registerTestSchema(iModel: IModelDb): Promise<void> {
  if (!Schemas.getRegisteredSchema("Fields")) {
    Schemas.registerSchema(FieldsSchema);
    ClassRegistry.register(TestElement, FieldsSchema);
  }

  await iModel.importSchemaStrings([fieldsSchemaXml]);
  iModel.saveChanges();
}

describe.only("UpdateFieldsContext", () => {
  let imodel: SnapshotDb;
  let model: Id64String;
  let category: Id64String;
  let elementId: Id64String;

  before(async () => {
    const iModelPath = IModelTestUtils.prepareOutputFile("UpdateFieldsContext", "test.bim");
    imodel = SnapshotDb.createEmpty(iModelPath, { rootSubject: { name: "UpdateFieldsContext" } });

    await registerTestSchema(imodel);

    model = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(imodel, Code.createEmpty(), true)[1];
    category = SpatialCategory.insert(imodel, SnapshotDb.dictionaryId, "UpdateFieldsContextCategory", new SubCategoryAppearance());
    elementId = insertElement();
  });

  after(() => {
    imodel.close();
  });
  
  function insertElement(): Id64String {
    const props: TestElementProps = {
      classFullName: "Fields:TestElement",
      model,
      category,
      code: Code.createEmpty(),
      intProp: 100,
      point: { x: 1, y: 2, z: 3 },
      strings: ["a", "b", "c"],
      outerStruct: {
        innerStruct: { bool: false, doubles: [1, 2, 3 ] },
        innerStructs: [{ bool: true, doubles: [] }, { bool: false, doubles: [0] }],
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
        string: "abc",
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
    imodel.saveChanges();
    return id;
  }

  describe.only("getProperty", () => {
    function expectValue(expected: any, propertyPath: FieldPropertyPath, propertyHost: FieldPropertyHost | Id64String = elementId, deletedDependency = false): void {
      if (typeof propertyHost === "string") {
        propertyHost = { schemaName: "Fields", className: "TestElement", elementId: propertyHost };
      }

      const field = FieldRun.create({
        propertyPath,
        propertyHost,
        styleName: "style",
      });

      const context = createUpdateContext(propertyHost.elementId, imodel, deletedDependency);
      const actual = context.getProperty(field);
      expect(actual?.value).to.equal(expected);
    }

    it("returns a primitive property value", () => {
      expectValue(100, { propertyName: "intProp" });
    });

    it("treats points as primitive values", () => {
      
    });

    it("returns a primitive array value", () => {
      expectValue("a", { propertyName: "strings", accessors: [0] });
      expectValue("b", { propertyName: "strings", accessors: [1] });
      expectValue("c", { propertyName: "strings", accessors: [2] });
    });

    it("supports negative array indices", () => {
      expectValue("a", { propertyName: "strings", accessors: [-3] });
      expectValue("b", { propertyName: "strings", accessors: [-2] });
      expectValue("c", { propertyName: "strings", accessors: [-1] });
    });
  
    it("returns undefined if the dependency was deleted", () => {
      expectValue(undefined, { propertyName: "intProp" }, elementId, true);
    });

    it("returns undefined if the host element does not exist", () => {
      expectValue(undefined, { propertyName: "intProp" }, "0xbaadf00d");
    });

    it("returns undefined if the host element is not of the specified class or a subclass thereof", () => {
      
    });

    it("returns undefined if an access string is specified for a non-object property", () => {
      expectValue(undefined, { propertyName: "intProp", accessors: ["property"] });
    });
  
    it("returns undefined if the specified property does not exist", () => {
      expectValue(undefined, { propertyName: "nonExistentProperty" });
    });

    it("returns undefined if the specified class does not exist", () => {
      
    });

    it("returns undefined if the specified class is not an entity class", () => {
      
    });
  
    it("returns undefined if the specified property is null", () => {
      expectValue(undefined, { propertyName: "maybeNull" });
    });

    it("returns undefined if an array index is specified for a non-array property", () => {
      expectValue(undefined, { propertyName: "intProp", accessors: [0] });
    });

    it("returns undefined if an array index is out of bounds", () => {
      for (const index of [3, 4, -4, -5]) {
        expectValue(undefined, { propertyName: "strings", accessors: [index] });
      }
    });
    
    it("returns undefined for a non-primitive value", () => {
      expectValue(undefined, { propertyName: "strings" });
      expectValue(undefined, { propertyName: "outerStruct" });
      expectValue(undefined, { propertyName: "outerStruct", accessors: ["innerStruct"] });
      expectValue(undefined, { propertyName: "outerStructs" });
      expectValue(undefined, { propertyName: "outerStructs", accessors: [0] });
      expectValue(undefined, { propertyName: "outerStructs", accessors: [0, "innerStruct"] });
    });
  
    it("returns arbitrarily-nested properties of structs and struct arrays", () => {
      expectValue(false, { propertyName: "outerStruct", accessors: ["innerStruct", "bool"] });
      for (const index of [0, 1, 2]) {
        expectValue(index + 1, { propertyName: "outerStruct", accessors: ["innerStruct", "doubles", index]} );
        expectValue(3 - index, { propertyName: "outerStruct", accessors: ["innerStruct", "doubles", -1 - index] });
      }
    });

    it("returns arbitrarily-nested JSON properties", () => {
      expectValue("abc", { propertyName: "jsonProperties", jsonAccessors: ["string"]});

      expectValue(10, { propertyName: "jsonProperties", jsonAccessors: ["ints", 0] });
      expectValue(13, { propertyName: "jsonProperties", jsonAccessors: ["ints", 3] });
      expectValue(13, { propertyName: "jsonProperties", jsonAccessors: ["ints", -1] });
      expectValue(11, { propertyName: "jsonProperties", jsonAccessors: ["ints", -3] });

      expectValue(12345, { propertyName: "jsonProperties", jsonAccessors: ["zoo", "address", "zipcode"] });
      expectValue("scree!", { propertyName: "jsonProperties", jsonAccessors: ["zoo", "birds", 1, "sound"] });
    });
  });
});


