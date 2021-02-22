/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { JsonParser } from "../../src/Deserialization/JsonParser";
import { ECObjectsError } from "../../src/Exception";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";

describe("JsonParser", () => {
  let parser: JsonParser;

  describe("getItems/findItem", () => {

    it("should throw for missing schemaItemType", () => {
      parser = new JsonParser(createSchemaJsonWithItems({ TestEntity: {} }));
      assert.throws(() => parser.findItem("TestEntity"), ECObjectsError, `The SchemaItem TestSchema.TestEntity is missing the required 'schemaItemType' attribute.`);

      parser = new JsonParser(createSchemaJsonWithItems({ TestEntity: {} }));
      assert.throws(() => [...parser.getItems()], ECObjectsError, `The SchemaItem TestSchema.TestEntity is missing the required 'schemaItemType' attribute.`);
    });

    it("should throw for invalid schemaItemType", () => {
      const json = {
        TestEntity: { schemaItemType: 0 },
      };

      parser = new JsonParser(createSchemaJsonWithItems(json));
      assert.throws(() => parser.findItem("TestEntity"), ECObjectsError, `The SchemaItem TestSchema.TestEntity has an invalid 'schemaItemType' attribute. It should be of type 'string'.`);

      parser = new JsonParser(createSchemaJsonWithItems(json));
      assert.throws(() => [...parser.getItems()], ECObjectsError, `The SchemaItem TestSchema.TestEntity has an invalid 'schemaItemType' attribute. It should be of type 'string'.`);
    });

    it("should throw for invalid name", () => {
      const json = {
        0: { schemaItemType: "EntityClass" },
      };

      parser = new JsonParser(createSchemaJsonWithItems(json));
      assert.throws(() => parser.findItem("0"), ECObjectsError, `A SchemaItem in TestSchema has an invalid 'name' attribute. '0' is not a valid ECName.`);

      parser = new JsonParser(createSchemaJsonWithItems(json));
      assert.throws(() => [...parser.getItems()], ECObjectsError, `A SchemaItem in TestSchema has an invalid 'name' attribute. '0' is not a valid ECName.`);
    });
  });

  describe("parseCustomAttributeClass", () => {
    const baseJson = { schemaItemType: "CustomAttributeClass" };

    beforeEach(() => {
      parser = new JsonParser(createSchemaJsonWithItems({ TestCustomAttribute: baseJson }));
      parser.findItem("TestCustomAttribute");
    });

    it("should throw for missing appliesTo", () => {
      assert.throws(() => parser.parseCustomAttributeClass({ ...baseJson }), ECObjectsError, `The CustomAttributeClass TestSchema.TestCustomAttribute is missing the required 'appliesTo' attribute.`);
    });

    it("should throw for invalid appliesTo", () => {
      const json = {
        ...baseJson,
        appliesTo: 0,
      };
      assert.throws(() => parser.parseCustomAttributeClass(json), ECObjectsError, `The CustomAttributeClass TestSchema.TestCustomAttribute has an invalid 'appliesTo' attribute. It should be of type 'string'.`);
    });
  });

  describe("parseEntityClass", () => {
    const baseJson = { schemaItemType: "EntityClass" };

    beforeEach(() => {
      parser = new JsonParser(createSchemaJsonWithItems({ TestEntity: baseJson }));
      parser.findItem("TestEntity");
    });

    function testInvalidAttribute(attributeName: string, expectedType: string, value: any) {
      const json: any = {
        ...baseJson,
        [attributeName]: value,
      };
      assert.throws(() => parser.parseEntityClass(json), ECObjectsError, `The SchemaItem TestSchema.TestEntity has an invalid '${attributeName}' attribute. It should be of type '${expectedType}'.`);
    }

    it("should throw for invalid description", () => testInvalidAttribute("description", "string", 0));
    it("should throw for invalid label", () => testInvalidAttribute("label", "string", 0));

    it("should throw for invalid modifier", async () => {
      const json: any = { ...baseJson, modifier: 0 };
      assert.throws(() => parser.parseEntityClass(json), ECObjectsError, `The ECClass TestSchema.TestEntity has an invalid 'modifier' attribute. It should be of type 'string'.`);
    });

    it("should throw for invalid baseClass", async () => {
      const json: any = { ...baseJson, baseClass: 0 };
      assert.throws(() => parser.parseEntityClass(json), ECObjectsError, `The ECClass TestSchema.TestEntity has an invalid 'baseClass' attribute. It should be of type 'string'.`);
    });

    it("should throw for invalid mixins", () => {
      let json: any = { ...baseJson, mixins: 0 };
      assert.throws(() => parser.parseEntityClass(json), ECObjectsError, `The ECEntityClass TestSchema.TestEntity has an invalid 'mixins' attribute. It should be of type 'string[]'.`);

      json = { ...baseJson, mixins: [0] };
      assert.throws(() => parser.parseEntityClass(json), ECObjectsError, `The ECEntityClass TestSchema.TestEntity has an invalid 'mixins' attribute. It should be of type 'string[]'.`);
    });
  });

  describe("parseEnumeration", () => {
    const baseJson = { schemaItemType: "Enumeration" };

    beforeEach(() => {
      parser = new JsonParser(createSchemaJsonWithItems({ TestEnumeration: baseJson }));
      parser.findItem("TestEnumeration");
    });

    it("should throw for missing type", () => {
      const json = { ...baseJson };
      assert.throws(() => parser.parseEnumeration(json), ECObjectsError, `The Enumeration TestSchema.TestEnumeration is missing the required 'type' attribute.`);
    });

    it("should throw for invalid type", () => {
      const json = { ...baseJson, type: 0 };
      assert.throws(() => parser.parseEnumeration(json), ECObjectsError, `The Enumeration TestSchema.TestEnumeration has an invalid 'type' attribute. It should be of type 'string'.`);
    });

    it("should throw for type not int or string", () => {
      const json = { ...baseJson, type: "ThisIsNotRight" };
      assert.throws(() => parser.parseEnumeration(json), ECObjectsError, `The Enumeration TestSchema.TestEnumeration has an invalid 'type' attribute. It should be either "int" or "string".`);
    });

    it("should throw for invalid isStrict", () => {
      const json = { ...baseJson, type: "int", isStrict: 0 };
      assert.throws(() => parser.parseEnumeration(json), ECObjectsError, `The Enumeration TestSchema.TestEnumeration has an invalid 'isStrict' attribute. It should be of type 'boolean'.`);
    });

    it("should throw for mismatched type", () => {
      let json: any = {
        ...baseJson,
        type: "string",
        enumerators: [
          {
            name: "testEnumerator",
            value: 0, // should throw as typeof(value) !== string
          },
        ],
      };
      assert.throws(() => parser.parseEnumeration(json), ECObjectsError, `The Enumeration TestSchema.TestEnumeration has an incompatible type. It must be "string", not "int".`);

      json = {
        ...baseJson,
        type: "int",
        enumerators: [
          {
            name: "testEnumerator",
            value: "test", // should throw as typeof(value) !== int
          },
        ],
      };
      assert.throws(() => parser.parseEnumeration(json), ECObjectsError, `The Enumeration TestSchema.TestEnumeration has an incompatible type. It must be "int", not "string".`);
    });

    it("should throw for enumerators not an array", () => {
      const json: any = { ...baseJson, type: "int", enumerators: 0 };
      assert.throws(() => parser.parseEnumeration(json), ECObjectsError, `The Enumeration TestSchema.TestEnumeration has an invalid 'enumerators' attribute. It should be of type 'object[]'.`);
    });

    it("should throw for enumerators not an array of objects", () => {
      const json: any = { ...baseJson, type: "int", enumerators: [0] };
      assert.throws(() => parser.parseEnumeration(json), ECObjectsError, `The Enumeration TestSchema.TestEnumeration has an invalid 'enumerators' attribute. It should be of type 'object[]'.`);
    });

    it("should throw for enumerator description not a string", () => {
      const json = {
        ...baseJson,
        type: "string",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          { name: "ONEVALUE", value: "one", label: "Label for the first value", description: 1 },
        ],
      };
      assert.throws(() => parser.parseEnumeration(json), ECObjectsError, `The Enumeration TestSchema.TestEnumeration has an enumerator with an invalid 'description' attribute. It should be of type 'string'.`);
    });

    it("should throw for enumerator with missing name", () => {
      const json = {
        ...baseJson,
        type: "string",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          { value: "one", label: "Label for the first value", description: "Description for the first value" },
        ],
      };
      assert.throws(() => parser.parseEnumeration(json), ECObjectsError, `The Enumeration TestSchema.TestEnumeration has an enumerator that is missing the required attribute 'name'.`);
    });

    it("should throw for enumerator with missing value", () => {
      const json = {
        ...baseJson,
        type: "string",
        isStrict: false,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        enumerators: [
          { name: "one", label: "Label for the first value", description: "Description for the first value" },
        ],
      };
      assert.throws(() => parser.parseEnumeration(json), ECObjectsError, `The Enumeration TestSchema.TestEnumeration has an enumerator that is missing the required attribute 'value'.`);
    });
  });

  describe("parseFormat", () => {
    const baseJson = {
      schemaItemType: "Format",
      type: "fractional",
      label: "myfi4",
      description: "A format description",
      roundFactor: 0.0,
      showSignOption: "onlyNegative",
      formatTraits: "keepSingleZero|trailZeroes",
      precision: 4,
      decimalSeparator: ".",
      thousandSeparator: ",",
      uomSeparator: " ",
    };

    beforeEach(() => {
      parser = new JsonParser(createSchemaJsonWithItems({ AmerMYFI4: baseJson }));
      parser.findItem("AmerMYFI4");
    });

    it("should throw for description not a string", () => {
      const json = {
        ...baseJson,
        description: 12345678,
      };
      assert.throws(() => parser.parseFormat(json), ECObjectsError, `The SchemaItem TestSchema.AmerMYFI4 has an invalid 'description' attribute. It should be of type 'string'.`);
    });

    it("should throw for missing type", () => {
      const json: Partial<typeof baseJson> = {
        ...baseJson,
      };
      delete json.type;
      assert.throws(() => parser.parseFormat(json), ECObjectsError, `The Format TestSchema.AmerMYFI4 does not have the required 'type' attribute.`);
    });

    it("should throw for invalid showSignOption", () => {
      const json = {
        ...baseJson,
        showSignOption: 456,
      };
      assert.throws(() => parser.parseFormat(json), ECObjectsError, `The Format TestSchema.AmerMYFI4 has an invalid 'showSignOption' attribute. It should be of type 'string'.`);
    });

    it("should throw for invalid composite", () => {
      const json = {
        includeZero: false,
        schemaItemType: "Format",
        name: "AmerMYFI4",
        type: "fractional",
        precision: 4,
        composite: {
          includeZero: false,
          spacer: 1,
          units: [
            {
              name: "TestSchema.MILE",
              label: "mile(s)",
            },
          ],
        },
      };
      assert.throws(() => parser.parseFormat(json), ECObjectsError, `The Format TestSchema.AmerMYFI4 has a Composite with an invalid 'spacer' attribute.`);
    });
  });

  describe("parseInvertedUnit", () => {
    const baseJson = { schemaItemType: "InvertedUnit" };

    beforeEach(() => {
      parser = new JsonParser(createSchemaJsonWithItems({ HORIZONTAL_PER_VERTICAL: baseJson }));
      parser.findItem("HORIZONTAL_PER_VERTICAL");
    });

    it("should throw for invalid label", () => {
      const json = {
        ...baseJson,
        label: 5,
        unitSystem: "ExampleSchema.INTERNATIONAL",
        invertsUnit: "ExampleSchema.VERTICAL_PER_HORIZONTAL",
      };
      assert.throws(() => parser.parseInvertedUnit(json), ECObjectsError, `The SchemaItem TestSchema.HORIZONTAL_PER_VERTICAL has an invalid 'label' attribute. It should be of type 'string'.`);
    });

    it("should throw for invalid description", () => {
      const json = {
        ...baseJson,
        description: 5,
        unitSystem: "ExampleSchema.INTERNATIONAL",
        invertsUnit: "ExampleSchema.VERTICAL_PER_HORIZONTAL",
      };
      assert.throws(() => parser.parseInvertedUnit(json), ECObjectsError, `The SchemaItem TestSchema.HORIZONTAL_PER_VERTICAL has an invalid 'description' attribute. It should be of type 'string'.`);
    });

    it("should throw for missing invertsUnit", () => {
      const json = {
        ...baseJson,
        unitSystem: "ExampleSchema.INTERNATIONAL",
      };
      assert.throws(() => parser.parseInvertedUnit(json), ECObjectsError, `The InvertedUnit TestSchema.HORIZONTAL_PER_VERTICAL does not have the required 'invertsUnit' attribute.`);
    });

    it("should throw for missing unitSystem", () => {
      const json = {
        ...baseJson,
        invertsUnit: "TestSchema.VERTICAL_PER_HORIZONTAL",
      };
      assert.throws(() => parser.parseInvertedUnit(json), ECObjectsError, `The InvertedUnit TestSchema.HORIZONTAL_PER_VERTICAL does not have the required 'unitSystem' attribute.`);
    });
  });

  describe("parseKindOfQuantity", () => {
    const baseJson = {
      schemaItemType: "KindOfQuantity",
      name: "TestKindOfQuantity",
      label: "SomeDisplayLabel",
      description: "A really long description...",
    };

    beforeEach(() => {
      parser = new JsonParser(createSchemaJsonWithItems({ TestKindOfQuantity: baseJson }));
      parser.findItem("TestKindOfQuantity");
    });

    function testInvalidAttribute(attributeName: string, expectedType: string, value: any) {
      const json: any = {
        ...baseJson,
        relativeError: 0,
        presentationUnits: ["Formats.CM"],
        persistenceUnit: "Formats.DefaultReal",
        [attributeName]: value, // will overwrite previously defined objects
      };
      assert.throws(() => parser.parseKindOfQuantity(json), ECObjectsError, `The KindOfQuantity TestSchema.TestKindOfQuantity has an invalid '${attributeName}' attribute. It should be of type '${expectedType}'.`);
    }

    it("should throw for invalid relativeError", () => { testInvalidAttribute("relativeError", "number", false); });
    it("should throw for invalid presentationUnits", () => { testInvalidAttribute("presentationUnits", `string' or 'string[]`, false); });
    it("should throw for invalid persistenceUnit", () => { testInvalidAttribute("persistenceUnit", "string", false); });

    // should throw for missing relativeError
    const missingRelativeError = {
      ...baseJson,
      presentationUnits: ["Formats.IN"],
      persistenceUnit: "Formats.IN",
    };
    it("should throw for missing relativeError", () => {
      assert.throws(() => parser.parseKindOfQuantity(missingRelativeError), ECObjectsError, `The KindOfQuantity TestSchema.TestKindOfQuantity is missing the required 'relativeError' attribute.`);
    });

    // should throw for missing persistenceUnit
    const missingPersistenceUnit = {
      ...baseJson,
      relativeError: 1.234,
      presentationUnits: ["Formats.IN"],
    };
    it("should throw for missing persistenceUnit", () => {
      assert.throws(() => parser.parseKindOfQuantity(missingPersistenceUnit), ECObjectsError, `The KindOfQuantity TestSchema.TestKindOfQuantity is missing the required 'persistenceUnit' attribute.`);
    });
  });

  describe("parseMixin", () => {
    const baseJson = { schemaItemType: "Mixin" };

    beforeEach(() => {
      parser = new JsonParser(createSchemaJsonWithItems({ TestMixin: baseJson }));
      parser.findItem("TestMixin");
    });

    it("should throw for missing appliesTo", () => {
      assert.throws(() => parser.parseMixin({ ...baseJson }), ECObjectsError, `The Mixin TestSchema.TestMixin is missing the required 'appliesTo' attribute.`);
    });

    it("should throw for invalid appliesTo", () => {
      const json = { ...baseJson, appliesTo: 0 };
      assert.throws(() => parser.parseMixin(json), ECObjectsError, `The Mixin TestSchema.TestMixin has an invalid 'appliesTo' attribute. It should be of type 'string'.`);
    });
  });

  describe("parsePhenomenon", () => {
    const baseJson = { schemaItemType: "Phenomenon" };

    beforeEach(() => {
      parser = new JsonParser(createSchemaJsonWithItems({ AREA: baseJson }));
      parser.findItem("AREA");
    });

    it("should throw for invalid label", () => {
      const json = {
        ...baseJson,
        label: 48,
        definition: "Units.LENGTH(2)",
      };
      assert.throws(() => parser.parsePhenomenon(json), ECObjectsError, `The SchemaItem TestSchema.AREA has an invalid 'label' attribute. It should be of type 'string'.`);
    });

    it("should throw for invalid description", () => {
      const json = {
        ...baseJson,
        description: 5,
        definition: "Units.LENGTH(2)",
      };
      assert.throws(() => parser.parsePhenomenon(json), ECObjectsError, `The SchemaItem TestSchema.AREA has an invalid 'description' attribute. It should be of type 'string'.`);
    });

    it("should throw for missing definition", () => {
      const json = {
        ...baseJson,
      };
      assert.throws(() => parser.parsePhenomenon(json), ECObjectsError, `The Phenomenon TestSchema.AREA does not have the required 'definition' attribute.`);
    });

    it("should throw for invalid definition", () => {
      const json = {
        ...baseJson,
        definition: 2,
      };
      assert.throws(() => parser.parsePhenomenon(json), ECObjectsError, `The Phenomenon TestSchema.AREA has an invalid 'definition' attribute. It should be of type 'string'.`);
    });
  });

  describe("parsePrimitiveProperty", () => {
    const baseJson = { schemaItemType: "EntityClass" };

    beforeEach(() => {
      parser = new JsonParser(createSchemaJsonWithItems({ TestClass: baseJson }));
      parser.findItem("TestClass");
    });

    const mustBeArrayJson = {
      name: "BadProp",
      label: "SomeDisplayLabel",
      type: "PrimitiveArrayProperty",
      description: "A really long description...",
      customAttributes: "CoreCustomAttributes.HiddenSchema",
    };

    it("should throw for invalid customAttributes", () => {
      assert.throws(() => parser.parsePrimitiveProperty(mustBeArrayJson), ECObjectsError, "The ECProperty TestSchema.TestClass.BadProp has an invalid 'customAttributes' attribute. It should be of type 'array'.");
    });

    function testInvalidAttribute(attributeName: string, expectedType: string, value: any) {
      const json: any = {
        name: "TestProp",
        type: "PrimitiveProperty",
        typeName: "string",
        label: "Some display label",
        description: "Some really long description...",
        priority: 0,
        isReadOnly: true,
        category: "TestCategory",
        kindOfQuantity: "TestKindOfQuantity",
        inherited: false,
        customAttributes: [],
        [attributeName]: value, // overwrites previously defined objects
      };
      let err = (typeof (json.name) !== "string") ? `An ECProperty in TestSchema.TestClass ` : `The ECProperty TestSchema.TestClass.TestProp `;
      err += `has an invalid '${attributeName}' attribute. It should be of type '${expectedType}'.`;
      assert.throws(() => parser.parsePrimitiveProperty(json), ECObjectsError, err);
    }

    it("should throw for invalid label", () => { testInvalidAttribute("label", "string", false); });
    it("should throw for invalid description", () => { testInvalidAttribute("description", "string", false); });
    it("should throw for invalid priority", () => { testInvalidAttribute("priority", "number", false); });
    it("should throw for invalid isReadOnly", () => { testInvalidAttribute("isReadOnly", "boolean", 1.234); });
    it("should throw for invalid category", () => { testInvalidAttribute("category", "string", false); });
    it("should throw for invalid kindOfQuantity", () => { testInvalidAttribute("kindOfQuantity", "string", false); });
    it("should throw for invalid inherited", () => { testInvalidAttribute("inherited", "boolean", 1.234); });
    it("should throw for invalid customAttributes", () => { testInvalidAttribute("category", "string", false); });
    it("should throw for invalid typeName", () => { testInvalidAttribute("typeName", "string", 0); });
    it("should throw for invalid minLength", () => { testInvalidAttribute("minLength", "number", "0"); });
    it("should throw for invalid maxLength", () => { testInvalidAttribute("maxLength", "number", "0"); });
    it("should throw for invalid minValue", () => { testInvalidAttribute("minValue", "number", "0"); });
    it("should throw for invalid maxValue", () => { testInvalidAttribute("maxValue", "number", "0"); });
    it("should throw for invalid extendedTypeName", () => { testInvalidAttribute("extendedTypeName", "string", 0); });
  });

  describe("parsePrimitiveArrayProperty", () => {
    const baseJson = { schemaItemType: "EntityClass" };

    beforeEach(() => {
      parser = new JsonParser(createSchemaJsonWithItems({ TestClass: baseJson }));
      parser.findItem("TestClass");
    });

    it("should throw for invalid minOccurs", () => {
      const json = {
        name: "TestProperty",
        type: "PrimitiveProperty",
        minOccurs: "0",
      };
      assert.throws(() => parser.parsePrimitiveArrayProperty(json), ECObjectsError);
    });

    it("should throw for invalid maxOccurs", () => {
      const json = {
        name: "TestProperty",
        type: "PrimitiveProperty",
        maxOccurs: "0",
      };
      assert.throws(() => parser.parsePrimitiveArrayProperty(json), ECObjectsError);
    });
  });

  describe("parsePropertyCategory", () => {
    const baseJson = { schemaItemType: "PropertyCategory" };

    beforeEach(() => {
      parser = new JsonParser(createSchemaJsonWithItems({ TestCategory: baseJson }));
      parser.findItem("TestCategory");
    });

    it("should throw for invalid priority", () => {
      const json = {
        ...baseJson,
        priority: "1",
      };
      assert.throws(() => parser.parsePropertyCategory(json), ECObjectsError, `The PropertyCategory TestSchema.TestCategory has an invalid 'priority' attribute. It should be of type 'number'.`);
    });
  });

  describe("parseRelationshipClass", () => {
    const validConstraintJson = {
      polymorphic: true,
      multiplicity: "(1..1)",
      roleLabel: "owns",
      constraintClasses: [
        "TestSchema.TestTargetEntity",
      ],
    };

    const baseJson = {
      schemaItemType: "RelationshipClass",
      strength: "holding",
      strengthDirection: "backward",
      source: validConstraintJson,
      target: validConstraintJson,
    };

    function withInvalidConstraint(end: "source" | "target", json: any) {
      const badJson = { ...baseJson };
      badJson[end] = { ...validConstraintJson, ...json };
      return badJson;
    }

    beforeEach(() => {
      parser = new JsonParser(createSchemaJsonWithItems({ TestRelationship: baseJson }));
      parser.findItem("TestRelationship");
    });

    it("should throw for invalid strength", () => {
      const json = {
        ...baseJson,
        strength: 0,
      };
      assert.throws(() => parser.parseRelationshipClass(json), ECObjectsError, `The RelationshipClass TestSchema.TestRelationship has an invalid 'strength' attribute. It should be of type 'string'.`);
    });

    it("should throw for invalid strengthDirection", () => {
      const json = {
        ...baseJson,
        strengthDirection: 0,
      };
      assert.throws(() => parser.parseRelationshipClass(json), ECObjectsError, `The RelationshipClass TestSchema.TestRelationship has an invalid 'strengthDirection' attribute. It should be of type 'string'.`);
    });

    it("should throw for invalid roleLabel", () => {
      const json = { roleLabel: 0 };
      assert.throws(() => parser.parseRelationshipClass(withInvalidConstraint("source", json)), ECObjectsError, `The Source Constraint of TestSchema.TestRelationship has an invalid 'roleLabel' attribute. It should be of type 'string'.`);
      assert.throws(() => parser.parseRelationshipClass(withInvalidConstraint("target", json)), ECObjectsError, `The Target Constraint of TestSchema.TestRelationship has an invalid 'roleLabel' attribute. It should be of type 'string'.`);
    });

    it("should throw for invalid polymorphic", () => {
      const json = { polymorphic: "0" };
      assert.throws(() => parser.parseRelationshipClass(withInvalidConstraint("source", json)), ECObjectsError, `The Source Constraint of TestSchema.TestRelationship has an invalid 'polymorphic' attribute. It should be of type 'boolean'.`);
      assert.throws(() => parser.parseRelationshipClass(withInvalidConstraint("target", json)), ECObjectsError, `The Target Constraint of TestSchema.TestRelationship has an invalid 'polymorphic' attribute. It should be of type 'boolean'.`);
    });

    it("should throw for invalid multiplicity", () => {
      const json = { multiplicity: 0 };
      assert.throws(() => parser.parseRelationshipClass(withInvalidConstraint("source", json)), ECObjectsError, `The Source Constraint of TestSchema.TestRelationship has an invalid 'multiplicity' attribute. It should be of type 'string'.`);
      assert.throws(() => parser.parseRelationshipClass(withInvalidConstraint("target", json)), ECObjectsError, `The Target Constraint of TestSchema.TestRelationship has an invalid 'multiplicity' attribute. It should be of type 'string'.`);
    });

    it("should throw for invalid abstractConstraint", () => {
      const json = { abstractConstraint: 0 };
      assert.throws(() => parser.parseRelationshipClass(withInvalidConstraint("source", json)), ECObjectsError);
      assert.throws(() => parser.parseRelationshipClass(withInvalidConstraint("target", json)), ECObjectsError);
    });

    it("should throw for invalid constraintClasses", () => {
      assert.throws(() => parser.parseRelationshipClass(withInvalidConstraint("source", { constraintClasses: 0 })), ECObjectsError);
      assert.throws(() => parser.parseRelationshipClass(withInvalidConstraint("source", { constraintClasses: [0] })), ECObjectsError);

      assert.throws(() => parser.parseRelationshipClass(withInvalidConstraint("target", { constraintClasses: 0 })), ECObjectsError);
      assert.throws(() => parser.parseRelationshipClass(withInvalidConstraint("target", { constraintClasses: [0] })), ECObjectsError);
    });

    it("should throw for invalid constraint customAttributes", () => {
      const json = {
        customAttributes: "array",
      };
      assert.throws(() => parser.parseRelationshipClass(withInvalidConstraint("source", json)), ECObjectsError, `The Source Constraint of TestSchema.TestRelationship has an invalid 'customAttributes' attribute. It should be of type 'array'.`);
      assert.throws(() => parser.parseRelationshipClass(withInvalidConstraint("target", json)), ECObjectsError, `The Target Constraint of TestSchema.TestRelationship has an invalid 'customAttributes' attribute. It should be of type 'array'.`);
    });

  });

  describe("parseSchema", () => {
    it("should throw for missing name", () => {
      const json = createSchemaJsonWithItems({});
      delete json.name;
      parser = new JsonParser(json);
      assert.throws(() => parser.parseSchema(), ECObjectsError, "An ECSchema is missing the required 'name' attribute.");
    });

    it("should throw for invalid name", () => {
      const json = createSchemaJsonWithItems({});
      json.name = 0;
      parser = new JsonParser(json);
      assert.throws(() => parser.parseSchema(), ECObjectsError, `An ECSchema has an invalid 'name' attribute. It should be of type 'string'.`);
    });

    it("should throw for missing $schema", () => {
      const json = createSchemaJsonWithItems({});
      delete json.$schema;
      parser = new JsonParser(json);
      assert.throws(() => parser.parseSchema(), ECObjectsError, `The ECSchema TestSchema is missing the required \'$schema\' attribute.`);
    });

    it("should throw for invalid version", () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "BadSchema",
        version: 0,
      };
      parser = new JsonParser(json);
      assert.throws(() => parser.parseSchema(), ECObjectsError, `The ECSchema BadSchema has an invalid 'version' attribute. It should be of type 'string'.`);
    });

    it("should throw for missing version", () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "BadSchema",
      };
      parser = new JsonParser(json);
      assert.throws(() => parser.parseSchema(), ECObjectsError, "The ECSchema BadSchema is missing the required 'version' attribute.");
    });

    function testInvalidAttribute(attributeName: string, expectedType: string, value: any) {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        [attributeName]: value,
      };
      parser = new JsonParser(json);
      assert.throws(() => parser.parseSchema(), ECObjectsError, `The ECSchema TestSchema has an invalid '${attributeName}' attribute. It should be of type '${expectedType}'.`);
    }

    it("should throw for invalid alias", () => testInvalidAttribute("alias", "string", 0));
    it("should throw for invalid label", () => testInvalidAttribute("label", "string", 0));
    it("should throw for invalid description", () => testInvalidAttribute("description", "string", 0));
  });

  describe("getSchemaCustomAttributes", () => {
    it("should throw for invalid customAttributes", () => {
      const json = createSchemaJsonWithItems({});

      json.customAttributes = "CoreCustomAttributes.HiddenSchema";
      parser = new JsonParser(json);
      assert.throws(() => [...parser.getSchemaCustomAttributeProviders()], ECObjectsError, "The Schema TestSchema has an invalid 'customAttributes' attribute. It should be of type 'object[]'.");

      json.customAttributes = ["CoreCustomAttributes.HiddenSchema"];
      parser = new JsonParser(json);
      assert.throws(() => [...parser.getSchemaCustomAttributeProviders()], ECObjectsError, "The Schema TestSchema has an invalid 'customAttributes' attribute. It should be of type 'object[]'.");
    });

    it("should throw for customAttribute with missing className", () => {
      const json = createSchemaJsonWithItems({});
      json.customAttributes = [
        {},
      ];

      parser = new JsonParser(json);
      assert.throws(() => [...parser.getSchemaCustomAttributeProviders()], ECObjectsError, "A CustomAttribute in TestSchema.customAttributes is missing the required 'className' attribute.");
    });

    it("should throw for customAttribute with invalid className", () => {
      const json = createSchemaJsonWithItems({});
      json.customAttributes = [
        { className: 0 },
      ];

      parser = new JsonParser(json);
      assert.throws(() => [...parser.getSchemaCustomAttributeProviders()], ECObjectsError, "A CustomAttribute in TestSchema.customAttributes has an invalid 'className' attribute. It should be of type 'string'.");
    });
  });
});
