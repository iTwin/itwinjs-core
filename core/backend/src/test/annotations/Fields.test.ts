/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Code, FieldPropertyHost, FieldPropertyPath, FieldRun, SubCategoryAppearance } from "@itwin/core-common";
import { SnapshotDb } from "../../IModelDb";
import { IModelTestUtils, TestPhysicalObjectProps } from "../IModelTestUtils";
import { createUpdateContext, FieldProperty, updateField } from "../../internal/annotations/fields";
import { Id64String } from "@itwin/core-bentley";
import { SpatialCategory } from "../../Category";
import { Point3d, YawPitchRollAngles } from "@itwin/core-geometry";
import { KnownTestLocations } from "../KnownTestLocations";
import * as path from "path";

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

describe.only("UpdateFieldsContext", () => {
  let imodel: SnapshotDb;
  let model: Id64String;
  let category: Id64String;
  let elementId: Id64String;

  before(async () => {
    IModelTestUtils.registerTestBimSchema();

    const iModelPath = IModelTestUtils.prepareOutputFile("UpdateFieldsContext", "test.bim");
    imodel = SnapshotDb.createEmpty(iModelPath, { rootSubject: { name: "UpdateFieldsContext" } });

    const schemaPathname = path.join(KnownTestLocations.assetsDir, "TestBim.ecschema.xml");
    await imodel.importSchemas([schemaPathname]); // will throw an exception if import fails
    imodel.saveChanges();

    model = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(imodel, Code.createEmpty(), true)[1];
    category = SpatialCategory.insert(imodel, SnapshotDb.dictionaryId, "UpdateFieldsContextCategory", new SubCategoryAppearance());
    elementId = insertElement();
  });

  after(() => {
    imodel.close();
  });
  
  function insertElement(): Id64String {
    // ###TODO gotta insert our own schema for testing complex access strings.
    const props: TestPhysicalObjectProps = {
      classFullName: "TestBim:TestPhysicalObject",
      model,
      category,
      code: Code.createEmpty(),
      intProperty: 100,
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
        propertyHost = { schemaName: "TestBim", className: "TestPhysicalObject", elementId: propertyHost };
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
      expectValue(100, { propertyName: "intProperty" });
    });

    it("treats points as primitive values", () => {
      
    });

    it("returns a primitive array value", () => {
      
    });

    it("supports negative array indices", () => {
      
    });
  
    it("returns undefined if the dependency was deleted", () => {
      expectValue(undefined, { propertyName: "intProperty" }, elementId, true);
    });

    it("returns undefined if the host element does not exist", () => {
      expectValue(undefined, { propertyName: "intProperty" }, "0xbaadf00d");
    });

    it("returns undefined if the host element is not of the specified class or a subclass thereof", () => {
      
    });

    it("returns undefined if an access string is specified for a non-object property", () => {
      expectValue(undefined, { propertyName: "intProperty", accessors: ["property"] });
    });
  
    it("returns undefined if the specified property does not exist", () => {
      expectValue(undefined, { propertyName: "nonExistentProperty" });
    });

    it("returns undefined if the specified class does not exist", () => {
      
    });

    it("returns undefined if the specified class is not an entity class", () => {
      
    });
  
    it("returns undefined if the specified property is null", () => {
      
    });

    it("returns undefined if an array index is specified for a non-array property", () => {
      expectValue(undefined, { propertyName: "intProperty", accessors: [0] });
    });

    it("returns undefined if an array index is out of bounds", () => {
      
    });
    
    it("returns undefined for a non-primitive value", () => {
      
    });
  
    it("returns arbitrarily-nested properties of structs", () => {
      
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


