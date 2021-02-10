/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import sinon = require("sinon");
import { assert, expect } from "chai";
import { CAProviderTuple } from "../../src/Deserialization/AbstractParser";
import {
  ConstantProps, EntityClassProps, EnumerationPropertyProps, EnumerationProps, EnumeratorProps, FormatProps, InvertedUnitProps, MixinProps,
  NavigationPropertyProps, PhenomenonProps, PrimitiveArrayPropertyProps, PrimitivePropertyProps, PropertyCategoryProps, SchemaProps,
  SchemaReferenceProps, StructArrayPropertyProps,
} from "../../src/Deserialization/JsonProps";
import { XmlParser } from "../../src/Deserialization/XmlParser";
import { CustomAttributeClass, Schema, SchemaContext } from "../../src/ecschema-metadata";
import { ECObjectsError } from "../../src/Exception";
import { createSchemaJsonWithItems, createSchemaXmlWithItems } from "../TestUtils/DeserializationHelpers";

describe("XmlParser", () => {
  const INT_MAX = 2147483647;
  let parser: XmlParser;

  describe("getItems / findItem", () => {
    it("should throw for an invalid typeName", () => {
      const itemsXml = `<ECEntityClass typeName="01a"/>`;
      parser = new XmlParser(createSchemaXmlWithItems(itemsXml));
      assert.throws(() => parser.findItem("01a"), ECObjectsError, `A SchemaItem in TestSchema has an invalid 'typeName' attribute. '01a' is not a valid ECName.`);

      parser = new XmlParser(createSchemaXmlWithItems(itemsXml));
      assert.throws(() => [...parser.getItems()], ECObjectsError, `A SchemaItem in TestSchema has an invalid 'typeName' attribute. '01a' is not a valid ECName.`);
    });

    it("should throw for missing typeName", () => {
      const itemsXml = `<ECEntityClass/>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemsXml));
      assert.throws(() => parser.findItem("Anything"), ECObjectsError, `A SchemaItem in TestSchema is missing the required 'typeName' attribute.`);

      parser = new XmlParser(createSchemaXmlWithItems(itemsXml));
      assert.throws(() => [...parser.getItems()], ECObjectsError, `A SchemaItem in TestSchema is missing the required 'typeName' attribute.`);
    });

    it("should throw for an invalid SchemaItem type", () => {
      const itemsXml = `<ECIntruder typeName="Muhuhahaha"></ECIntruder>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemsXml));
      assert.throws(() => parser.findItem("Muhuhahaha"), ECObjectsError, `A SchemaItem in TestSchema has an invalid type. 'ECIntruder' is not a valid SchemaItem type.`);

      parser = new XmlParser(createSchemaXmlWithItems(itemsXml));
      assert.throws(() => [...parser.getItems()], ECObjectsError, `A SchemaItem in TestSchema has an invalid type. 'ECIntruder' is not a valid SchemaItem type.`);
    });

    it("should differentiate a Mixin from an ECEntityClass", () => {
      const itemsXml = `
        <ECEntityClass typeName="TestMixin" modifier="Abstract">
          <ECCustomAttributes>
            <IsMixin>
                <AppliesToEntityClass>TestEntityClass</AppliesToEntityClass>
            </IsMixin>
          </ECCustomAttributes>
        </ECEntityClass>`;
      parser = new XmlParser(createSchemaXmlWithItems(itemsXml));
      const [, itemType] = Array.from(parser.getItems())[0];
      assert.strictEqual(itemType, "Mixin");
    });

    it("should only get/search top-level items", () => {
      const itemsXml = `
        <ECEntityClass typeName="TestMixin" modifier="Abstract">
          <ECCustomAttributes>
            <IsMixin>
                <AppliesToEntityClass>TestEntityClass</AppliesToEntityClass>
            </IsMixin>
          </ECCustomAttributes>
        </ECEntityClass>
        <ECCustomAttributeClass typeName="TestCustomAttributeClass" appliesTo="AnotherClass" description="Test description" displayLabel="TestLabel" modifier="None">
          <BaseClass>TestBaseClass</BaseClass>
          <ECEntityClass typeName="NestedClass"></ECEntityClass>
        </ECCustomAttributeClass>`;
      parser = new XmlParser(createSchemaXmlWithItems(itemsXml));
      const items = Array.from(parser.getItems());
      assert.strictEqual(items.length, 2);
      assert(undefined !== parser.findItem("TestMixin"));
      assert(undefined !== parser.findItem("TestCustomAttributeClass"));
      assert(undefined === parser.findItem("NestedClass"));
    });
  });

  describe("parseCustomAttributeClass", () => {
    it("should parse props correctly", () => {
      const itemXml = `
        <ECCustomAttributeClass typeName="TestCustomAttributeClass" appliesTo="AnotherClass" description="Test description" displayLabel="TestLabel" modifier="None">
          <BaseClass>TestBaseClass</BaseClass>
        </ECCustomAttributeClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestCustomAttributeClass");
      if (findResult === undefined)
        throw new Error("Expected finding CustomAttributeClass to be successful");

      const [, , itemElement] = findResult;

      const expectedProps = {
        label: "TestLabel",
        description: "Test description",
        modifier: "None",
        baseClass: "TestSchema.TestBaseClass",
        appliesTo: "AnotherClass",
      };

      const actualProps = parser.parseCustomAttributeClass(itemElement);
      assert.deepEqual(actualProps, expectedProps);
    });

    it("should throw for missing appliesTo", () => {
      const itemXml = `
      <ECCustomAttributeClass typeName="TestCustomAttributeClass">
      </ECCustomAttributeClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestCustomAttributeClass");
      if (findResult === undefined)
        throw new Error("Expected finding CustomAttributeClass to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseCustomAttributeClass(itemElement), ECObjectsError, `The CustomAttributeClass TestSchema.${itemName} is missing the required 'appliesTo' attribute.`);
    });
  });

  describe("parseEntityClass", () => {
    function testParseEntityClass(itemXml: string, itemName: string, expectedReferenceSchema: SchemaReferenceProps[], expectedEntityProps: EntityClassProps): void {
      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem(itemName);
      if (findResult === undefined)
        throw new Error("Expected finding EntityClass to be successful");

      const actualReferenceSchema: SchemaReferenceProps[] = Array.from(parser.getReferences());
      assert.deepEqual(actualReferenceSchema, expectedReferenceSchema);

      const [, , itemElement] = findResult;
      const actualProps = parser.parseEntityClass(itemElement);
      assert.deepEqual(actualProps, expectedEntityProps);
    }

    it("should parse props correctly", () => {
      const itemXml = `
      <ECEntityClass typeName="TestEntityClass" description="Test description" displayLabel="TestLabel" modifier="Abstract">
        <BaseClass>TestBaseClass</BaseClass>
        <BaseClass>TestMixin</BaseClass>
        <BaseClass>TestMixin2</BaseClass>
      </ECEntityClass>`;

      const expectedProps = {
        label: "TestLabel",
        description: "Test description",
        modifier: "Abstract",
        baseClass: "TestSchema.TestBaseClass",
        mixins: ["TestSchema.TestMixin", "TestSchema.TestMixin2"],
      } as EntityClassProps;

      testParseEntityClass(itemXml, "TestEntityClass", [], expectedProps);
    });

    it("item has schema alias:className base", async () => {
      const itemXml = `
        <ECSchemaReference name="BisCore" alias="bis" version="1.0.0"></ECSchemaReference>
        <ECEntityClass typeName="Entity" description="Test class" displayLabel="Test" modifier="None">
          <BaseClass>testschema:Element</BaseClass>
          <BaseClass>testschema:Mixin1</BaseClass>
          <BaseClass>testschema:Mixin2</BaseClass>
          <ECProperty propertyName="intProps" typeName="int"/>
          <ECProperty propertyName="stringProps" typeName="string"/>
        </ECEntityClass>
      `;

      const expectedReferenceSchema = [
        {
          name: "BisCore",
          version: "1.0.0"
        } as SchemaReferenceProps
      ];

      const expectedProps = {
        description: "Test class",
        label: "Test",
        modifier: "None",
        baseClass: "TestSchema.Element",
        mixins: ["TestSchema.Mixin1", "TestSchema.Mixin2"],
      } as EntityClassProps;

      testParseEntityClass(itemXml, "Entity", expectedReferenceSchema, expectedProps);
    });

    it("item has ref alias:className base", async () => {
      const itemXml = `
        <ECSchemaReference name="BisCore" alias="bis" version="1.0.0"></ECSchemaReference>
        <ECSchemaReference name="CoreCustomAttribute" alias="CoreCA" version="1.0.0"></ECSchemaReference>
        <ECEntityClass typeName="Entity" description="Test class" displayLabel="Test" modifier="None">
          <BaseClass>bis:Element</BaseClass>
          <BaseClass>bis:Mixin1</BaseClass>
          <BaseClass>CoreCa:ElementMixin1</BaseClass>
          <BaseClass>CorEcA:ElementMixin2</BaseClass>
          <ECProperty propertyName="intProps" typeName="int"/>
          <ECProperty propertyName="stringProps" typeName="string"/>
        </ECEntityClass>
      `;

      const expectedReferenceSchema = [
        {
          name: "BisCore",
          version: "1.0.0"
        } as SchemaReferenceProps,
        {
          name: "CoreCustomAttribute",
          version: "1.0.0"
        } as SchemaReferenceProps
      ];

      const expectedProps = {
        description: "Test class",
        label: "Test",
        modifier: "None",
        baseClass: "BisCore.Element",
        mixins: ["BisCore.Mixin1", "CoreCustomAttribute.ElementMixin1", "CoreCustomAttribute.ElementMixin2"],
      } as EntityClassProps;

      testParseEntityClass(itemXml, "Entity", expectedReferenceSchema, expectedProps);

    });

    it("item has invalid alias:className base", async () => {
      const itemXml = `
        <ECSchemaReference name="BisCore" alias="bis" version="1.0.0"></ECSchemaReference>
        <ECEntityClass typeName="Entity" description="Test class" modifier="None">
          <BaseClass>invalid:Element</BaseClass>
          <ECProperty propertyName="intProps" typeName="int"/>
          <ECProperty propertyName="stringProps" typeName="string"/>
        </ECEntityClass>
      `;
      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("Entity");
      if (findResult === undefined)
        throw new Error("Expected finding Entity to be successful");

      const [, , itemElement] = findResult;
      expect(() => { parser.parseEntityClass(itemElement); }).to.throw("No valid schema found for alias invalid");
    });
  });

  describe("parseStructClass", () => {
    it("should parse props correctly", () => {
      const itemXml = `
      <ECStructClass typeName="TestStructClass" description="Test description" displayLabel="TestLabel" modifier="Abstract">
        <BaseClass>TestBaseStructClass</BaseClass>
      </ECStructClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestStructClass");
      if (findResult === undefined)
        throw new Error("Expected finding StructClass to be successful");

      const [, , itemElement] = findResult;

      const expectedProps = {
        label: "TestLabel",
        description: "Test description",
        modifier: "Abstract",
        baseClass: "TestSchema.TestBaseStructClass",
      } as EntityClassProps;

      const actualProps = parser.parseStructClass(itemElement);
      assert.deepEqual(actualProps, expectedProps);
    });
  });

  describe("parseEnumeration", () => {
    it("should parse props correctly", () => {
      const itemXml = `
      <ECEnumeration typeName="TestEnumeration" backingTypeName="int" isStrict="true">
        <ECEnumerator name="None" value="0" displayLabel="NoneLabel"/>
        <ECEnumerator name="Some" value="1" displayLabel="SomeLabel"/>
      </ECEnumeration>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEnumeration");
      if (findResult === undefined)
        throw new Error("Expected finding Enumeration to be successful");

      const [, , itemElement] = findResult;

      const enumerators = [
        {
          name: "None",
          value: 0,
          label: "NoneLabel",
          description: undefined,
        } as EnumeratorProps,
        {
          name: "Some",
          value: 1,
          label: "SomeLabel",
          description: undefined,
        } as EnumeratorProps,
      ];

      const expectedProps = {
        type: "int",
        isStrict: true,
        enumerators,
        description: undefined,
        label: undefined,
      } as EnumerationProps;

      const actualProps = parser.parseEnumeration(itemElement);
      assert.deepEqual(actualProps, expectedProps);
    });

    it("should throw or missing backingTypeName", () => {
      const itemXml = `
      <ECEnumeration typeName="TestEnumeration" isStrict="true">
        <ECEnumerator name="None" value="0" displayLabel="NoneLabel"/>
        <ECEnumerator name="Some" value="1" displayLabel="SomeLabel"/>
      </ECEnumeration>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEnumeration");
      if (findResult === undefined)
        throw new Error("Expected finding Enumeration to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseEnumeration(itemElement), ECObjectsError, `The Enumeration TestSchema.${itemName} is missing the required 'backingTypeName' attribute.`);
    });

    it("should throw for invalid backingTypeName", () => {
      const itemXml = `
        <ECEnumeration typeName="TestEnumeration" backingTypeName="boolean" isStrict="true">
          <ECEnumerator name="None" value="0" displayLabel="NoneLabel"/>
          <ECEnumerator name="Some" value="1" displayLabel="SomeLabel"/>
        </ECEnumeration>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEnumeration");
      if (findResult === undefined)
        throw new Error("Expected finding Enumeration to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseEnumeration(itemElement), ECObjectsError, `The Enumeration TestSchema.${itemName} has an invalid 'backingTypeName' attribute. It should be either "int" or "string".`);
    });

    it("missing isStrict attribute results in isStrict set to true", () => {
      const itemXml = `
        <ECEnumeration typeName="TestEnumeration" backingTypeName="int">
          <ECEnumerator name="None" value="0" displayLabel="NoneLabel"/>
          <ECEnumerator name="Some" value="1" displayLabel="SomeLabel"/>
        </ECEnumeration>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEnumeration");
      if (findResult === undefined)
        throw new Error("Expected finding Enumeration to be successful");

      const [, , itemElement] = findResult;
      const props = parser.parseEnumeration(itemElement);
      assert.equal(props.isStrict, true, "Expected property isStrict to be set to true if missing from xml.");
    });

    it("should throw for invalid isStrict attribute", () => {
      const itemXml = `
        <ECEnumeration typeName="TestEnumeration" backingTypeName="int" isStrict="nice">
          <ECEnumerator name="None" value="0" displayLabel="NoneLabel"/>
          <ECEnumerator name="Some" value="1" displayLabel="SomeLabel"/>
        </ECEnumeration>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEnumeration");
      if (findResult === undefined)
        throw new Error("Expected finding Enumeration to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseEnumeration(itemElement), ECObjectsError, `The Enumeration TestSchema.${itemName} has an invalid 'isStrict' attribute. It should either be "true" or "false".`);
    });

    it("should throw for enumerator with missing name", () => {
      const itemXml = `
        <ECEnumeration typeName="TestEnumeration" backingTypeName="int" isStrict="true">
          <ECEnumerator value="0" displayLabel="NoneLabel"/>
          <ECEnumerator name="Some" value="1" displayLabel="SomeLabel"/>
        </ECEnumeration>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEnumeration");
      if (findResult === undefined)
        throw new Error("Expected finding Enumeration to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseEnumeration(itemElement), ECObjectsError, `The Enumeration TestSchema.${itemName} has an enumerator that is missing the required attribute 'name'.`);
    });

    it("should throw for enumerator with missing value", () => {
      const itemXml = `
        <ECEnumeration typeName="TestEnumeration" backingTypeName="int" isStrict="true">
          <ECEnumerator name="None" value="0" displayLabel="NoneLabel"/>
          <ECEnumerator name="Some" displayLabel="SomeLabel"/>
        </ECEnumeration>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEnumeration");
      if (findResult === undefined)
        throw new Error("Expected finding Enumeration to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseEnumeration(itemElement), ECObjectsError, `The Enumeration TestSchema.${itemName} has an enumerator that is missing the required attribute 'value'.`);
    });

    it("should throw for int enumeration with non-numeric values", () => {
      const itemXml = `
        <ECEnumeration typeName="TestEnumeration" backingTypeName="int" isStrict="true">
          <ECEnumerator name="None" value="a" displayLabel="NoneLabel"/>
          <ECEnumerator name="Some" value="1" displayLabel="SomeLabel"/>
        </ECEnumeration>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEnumeration");
      if (findResult === undefined)
        throw new Error("Expected finding Enumeration to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseEnumeration(itemElement), ECObjectsError, `The Enumeration TestSchema.${itemName} of type "int" has an enumerator with a non-integer value.`);
    });
  });

  describe("parseFormat", () => {
    it("should parse props corrtectly", () => {
      const itemXml = `
        <ECSchemaReference name="Units" alias="u" version="1.0.0"></ECSchemaReference>
        <Format typeName="TestFormat" type="decimal" precision="4" uomSeparator="" formatTraits="keepSingleZero|keepDecimalPoint|showUnitLabel">
          <Composite spacer="">
              <Unit label="&#176;">u:ARC_DEG</Unit>
              <Unit label="'">u:ARC_MINUTE</Unit>
          </Composite>
        </Format>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestFormat");
      if (findResult === undefined)
        throw new Error("Expected finding Format to be successful");

      const [, , itemElement] = findResult;

      const expectedReferenceSchema = [
        {
          name: "Units",
          version: "1.0.0"
        } as SchemaReferenceProps
      ];

      const composite = {
        spacer: "",
        units: [
          {
            name: "Units.ARC_DEG",
            label: "°",
          },
          {
            name: "Units.ARC_MINUTE",
            label: "'",
          },
        ],
        includeZero: undefined,
      };

      const expectedProps = {
        type: "decimal",
        precision: 4,
        uomSeparator: "",
        formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
        composite,
        description: undefined,
        label: undefined,
        roundFactor: undefined,
        minWidth: undefined,
        showSignOption: undefined,
        decimalSeparator: undefined,
        thousandSeparator: undefined,
        scientificType: undefined,
        stationOffsetSize: undefined,
        stationSeparator: undefined,
      } as FormatProps;

      const actualReferenceSchema: SchemaReferenceProps[] = Array.from(parser.getReferences());
      const actualProps = parser.parseFormat(itemElement);
      assert.deepEqual(actualProps, expectedProps);
      assert.deepEqual(actualReferenceSchema, expectedReferenceSchema);
    });

    it("should throw for missing type", () => {
      const itemXml = `
      <Format typeName="TestFormat"/>
      `;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestFormat");
      if (findResult === undefined)
        throw new Error("Expected finding Format to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseFormat(itemElement), ECObjectsError, `The Format TestSchema.${itemName} is missing the required 'type' attribute.`);
    });

    it("should throw for invalid precision attribute", () => { });
    it("should throw for invalid roundFactor attribute", () => { });
    it("should throw for invalid minWidth attribute", () => { });
    it("should throw for invalid stationOffsetSize attribute", () => { });

    it("should throw for composite with missing Unit tags", () => {
      const itemXml = `
        <Format typeName="TestFormat" type="decimal" formatTraits="keepSingleZero|keepDecimalPoint|showUnitLabel">
          <Composite spacer="">
          </Composite>
        </Format>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestFormat");
      if (findResult === undefined)
        throw new Error("Expected finding Format to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseFormat(itemElement), ECObjectsError, `The Format TestSchema.${itemName} has an invalid 'Composite' element. It should have 1-4 Unit elements.`);
    });

    it("should throw for invalid composite includeZero attribute", () => { });
  });

  describe("parseInvertedUnit", () => {
    it("should parse props correctly", () => {
      const itemXml = `<InvertedUnit typeName="TestInvertedUnit" invertsUnit="TestUnit" unitSystem="SI" />`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestInvertedUnit");
      if (findResult === undefined)
        throw new Error("Expected finding InvertedUnit to be successful");
      const [, , itemElement] = findResult;

      const expectedProps = {
        invertsUnit: "TestSchema.TestUnit",
        unitSystem: "TestSchema.SI",
        description: undefined,
        label: undefined,
      } as InvertedUnitProps;

      const actualProps = parser.parseInvertedUnit(itemElement);
      assert.deepEqual(actualProps, expectedProps);
    });

    it("should throw for missing invertsUnit attribute", () => {
      const itemXml = `<InvertedUnit typeName="TestInvertedUnit" unitSystem="SI" />`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestInvertedUnit");
      if (findResult === undefined)
        throw new Error("Expected finding InvertedUnit to be successful");
      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseInvertedUnit(itemElement), ECObjectsError, `The InvertedUnit TestSchema.${itemName} is missing the required 'invertsUnit' attribute.`);
    });

    it("should throw for missing unitSystem attribute", () => {
      const itemXml = `<InvertedUnit typeName="TestInvertedUnit" invertsUnit="TestUnit"/>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestInvertedUnit");
      if (findResult === undefined)
        throw new Error("Expected finding InvertedUnit to be successful");
      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseInvertedUnit(itemElement), ECObjectsError, `The InvertedUnit TestSchema.${itemName} is missing the required 'unitSystem' attribute.`);
    });
  });

  describe("parseKindOfQuantity", () => {
    it("should parse props correctly", () => {
      const itemXml = `<KindOfQuantity typeName="TestKoQ" persistenceUnit="RAD" presentationUnits="UN1;UN2" relativeError="1e-2" />`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestKoQ");
      if (findResult === undefined)
        throw new Error("Expected finding KindOfQuantity to be successful");

      const [, , itemElement] = findResult;

      const expectedProps = {
        persistenceUnit: "TestSchema.RAD",
        presentationUnits: ["TestSchema.UN1", "TestSchema.UN2"],
        relativeError: 0.01,
        label: undefined,
        description: undefined,
      };

      const actualProps = parser.parseKindOfQuantity(itemElement);
      assert.deepEqual(actualProps, expectedProps);
    });

    it("should parse props correctly when using persistenceUnit and presentationUnits from Units schema", () => {
      const itemXml = `
        <ECSchemaReference name="Units" alias="u" version="1.0.0"></ECSchemaReference>
        <ECSchemaReference name="Formats" alias="f" version="1.0.0"></ECSchemaReference>
        <KindOfQuantity typeName="TestKoQ" persistenceUnit="u:RAD"
                        presentationUnits="f:DoubleUnitFormat(6)[f:YRD|yard(s)][u:FT|u:feet];f:QuadUnitFormat(6)[f:MILE|mile(s)][u:YRD|yard(s)][f:FT|feet][f:IN|inch(es)]" relativeError="1e-2" />`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestKoQ");
      if (findResult === undefined)
        throw new Error("Expected finding KindOfQuantity to be successful");

      const [, , itemElement] = findResult;

      const expectedReferenceSchema = [
        {
          name: "Units",
          version: "1.0.0"
        } as SchemaReferenceProps,
        {
          name: "Formats",
          version: "1.0.0"
        } as SchemaReferenceProps

      ];

      const expectedProps = {
        persistenceUnit: "Units.RAD",
        presentationUnits: [
          "Formats.DoubleUnitFormat(6)[Formats.YRD|yard(s)][Units.FT|u:feet]",
          "Formats.QuadUnitFormat(6)[Formats.MILE|mile(s)][Units.YRD|yard(s)][Formats.FT|feet][Formats.IN|inch(es)]"],
        relativeError: 0.01,
        label: undefined,
        description: undefined,
      };

      const actualReferenceSchema = Array.from(parser.getReferences());
      const actualProps = parser.parseKindOfQuantity(itemElement);
      assert.deepEqual(actualProps, expectedProps);
      assert.deepEqual(actualReferenceSchema, expectedReferenceSchema);
    });

    it("should throw for missing persistenceUnit attribute", () => {
      const itemXml = `<KindOfQuantity typeName="TestKoQ" relativeError="1e-2" />`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestKoQ");
      if (findResult === undefined)
        throw new Error("Expected finding KindOfQuantity to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseKindOfQuantity(itemElement), ECObjectsError, `The KindOfQuantity TestSchema.${itemName} is missing the required 'persistenceUnit' attribute.`);
    });

    it("should throw for missing relativeError attribute", () => {
      const itemXml = `<KindOfQuantity typeName="TestKoQ" persistenceUnit="RAD"/>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestKoQ");
      if (findResult === undefined)
        throw new Error("Expected finding KindOfQuantity to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseKindOfQuantity(itemElement), ECObjectsError, `The KindOfQuantity TestSchema.${itemName} is missing the required 'relativeError' attribute.`);
    });

    it("should throw for invalid relativeError attribute", () => {
      const itemXml = `<KindOfQuantity typeName="TestKoQ" persistenceUnit="RAD" relativeError="someerror" />`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestKoQ");
      if (findResult === undefined)
        throw new Error("Expected finding KindOfQuantity to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseKindOfQuantity(itemElement), ECObjectsError, `The KindOfQuantity TestSchema.${itemName} has an invalid 'relativeError' attribute. It should be a numeric value.`);
    });
  });

  describe("parseMixin", () => {
    it("should parse props correctly", () => {
      const itemXml = `
        <ECEntityClass typeName="TestMixin" modifier="Abstract">
          <ECCustomAttributes>
              <IsMixin>
                  <AppliesToEntityClass>TestEntityClass</AppliesToEntityClass>
              </IsMixin>
          </ECCustomAttributes>
        </ECEntityClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestMixin");
      if (findResult === undefined)
        throw new Error("Expected finding Mixin to be successful");

      const [, , itemElement] = findResult;

      const expectedProps = {
        appliesTo: "TestSchema.TestEntityClass",
        modifier: "Abstract",
        baseClass: undefined,
        description: undefined,
        label: undefined,
      } as MixinProps;

      const actualProps = parser.parseMixin(itemElement);
      assert.deepEqual(actualProps, expectedProps);
    });

    it("should throw for missing IsMixin tag", () => {
      const itemXml = `
        <ECEntityClass typeName="TestMixin">
          <ECCustomAttributes/>
        </ECEntityClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestMixin");
      if (findResult === undefined)
        throw new Error("Expected finding Mixin to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseMixin(itemElement), ECObjectsError, `The Mixin TestSchema.${itemName} is missing the required 'IsMixin' tag.`);
    });

    it("should throw for missing AppliesToEntityClass tag", () => {
      const itemXml = `
        <ECEntityClass typeName="TestMixin">
          <ECCustomAttributes>
              <IsMixin/>
          </ECCustomAttributes>
        </ECEntityClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestMixin");
      if (findResult === undefined)
        throw new Error("Expected finding Mixin to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseMixin(itemElement), ECObjectsError, `The Mixin TestSchema.${itemName} is missing the required 'AppliesToEntityClass' tag.`);
    });

    it("should throw for multiple base classes", () => {
      const itemXml = `
        <ECEntityClass typeName="TestMixin" modifier="Abstract">
          <ECCustomAttributes>
              <IsMixin>
                  <AppliesToEntityClass>TestEntityClass</AppliesToEntityClass>
              </IsMixin>
          </ECCustomAttributes>
          <BaseClass>BaseMixin1</BaseClass>
          <BaseClass>BaseMixin2</BaseClass>
        </ECEntityClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestMixin");
      if (findResult === undefined)
        throw new Error("Expected finding Mixin to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseMixin(itemElement), ECObjectsError, `The Mixin TestSchema.${itemName} has more than one base class which is not allowed.`);
    });
  });

  describe("parsePhenomenon", () => {
    it("should parse props correctly", () => {
      const itemXml = `<Phenomenon typeName="TestPhenomenon" definition="LENGTH*BREADTH" displayLabel="Area"/>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestPhenomenon");
      if (findResult === undefined)
        throw new Error("Expected finding Phenomenon to be successful");

      const [, , itemElement] = findResult;

      const expectedProps = {
        definition: "LENGTH*BREADTH",
        label: "Area",
        description: undefined,
      } as PhenomenonProps;

      const actualProps = parser.parsePhenomenon(itemElement);
      assert.deepEqual(actualProps, expectedProps);
    });

    it("should throw for missing definition attribute", () => {
      const itemXml = `<Phenomenon typeName="TestPhenomenon" displayLabel="Area"/>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestPhenomenon");
      if (findResult === undefined)
        throw new Error("Expected finding Phenomenon to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parsePhenomenon(itemElement), ECObjectsError, `The Phenomenon TestSchema.${itemName} is missing the required 'definition' attribute.`);
    });
  });

  describe("parseConstant", () => {
    it("should parse props correctly", () => {
      const itemXml = `<Constant typeName="TestConstant" phenomenon="LENGTH_RATIO" definition="ONE" numerator="3.1415926" displayLabel="Pi"/>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestConstant");
      if (findResult === undefined)
        throw new Error("Expected finding Constant to be successful");

      const [, , itemElement] = findResult;

      const expectedProps = {
        phenomenon: "TestSchema.LENGTH_RATIO",
        definition: "ONE",
        numerator: 3.1415926,
        denominator: undefined,
        label: "Pi",
        description: undefined,
      } as ConstantProps;

      const actualProps = parser.parseConstant(itemElement);
      assert.deepEqual(actualProps, expectedProps);
    });

    it("should throw for missing phenomenon attribute", () => {
      const itemXml = `<Constant typeName="TestConstant" definition="ONE" numerator="3.1415926" displayLabel="Pi"/>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestConstant");
      if (findResult === undefined)
        throw new Error("Expected finding Constant to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseConstant(itemElement), ECObjectsError, `The Constant TestSchema.${itemName} is missing the required 'phenomenon' attribute.`);
    });

    it("should throw for missing definition attribute", () => {
      const itemXml = `<Constant typeName="TestConstant" phenomenon="LENGTH_RATIO" numerator="3.1415926" displayLabel="Pi"/>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestConstant");
      if (findResult === undefined)
        throw new Error("Expected finding Constant to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseConstant(itemElement), ECObjectsError, `The Constant TestSchema.${itemName} is missing the required 'definition' attribute.`);
    });

    it("should throw for invalid numerator attribute", () => {
      const itemXml = `<Constant typeName="TestConstant" phenomenon="LENGTH_RATIO" definition="ONE" numerator="threepointonefour" displayLabel="Pi"/>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestConstant");
      if (findResult === undefined)
        throw new Error("Expected finding Constant to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseConstant(itemElement), ECObjectsError, `The Constant TestSchema.${itemName} has an invalid 'numerator' attribute. It should be a numeric value.`);
    });

    it("should throw for invalid denominator attribute", () => {
      const itemXml = `<Constant typeName="TestConstant" phenomenon="LENGTH_RATIO" definition="ONE" denominator="threepointonefour" displayLabel="PiInverse"/>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestConstant");
      if (findResult === undefined)
        throw new Error("Expected finding Constant to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseConstant(itemElement), ECObjectsError, `The Constant TestSchema.${itemName} has an invalid 'denominator' attribute. It should be a numeric value.`);
    });
  });

  describe("parsePrimitiveProperty", () => {
    it("should parse props correctly", () => {
      const itemXml = `
        <ECEntityClass typeName="TestEntityClass" description="Test description" displayLabel="TestLabel" modifier="Abstract">
          <ECProperty propertyName="TestPrimitiveProperty" typeName="double"/>
        </ECEntityClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEntityClass");
      if (findResult === undefined)
        throw new Error("Expected finding EntityClass with Property to be successful");

      const [, , parentElement] = findResult;
      const propertiesResult = Array.from(parser.getProperties(parentElement));
      if (propertiesResult.length === 0)
        throw new Error("Expected parsing EntityClass with PrimitiveProperty to be successful");

      const [, , propertyElement] = propertiesResult[0];

      const expectedProps = {
        name: "TestPrimitiveProperty",
        type: "primitiveproperty",
        typeName: "double",
        category: undefined,
        description: undefined,
        extendedTypeName: undefined,
        inherited: undefined,
        isReadOnly: undefined,
        kindOfQuantity: undefined,
        label: undefined,
        maxLength: undefined,
        maxValue: undefined,
        minLength: undefined,
        minValue: undefined,
        priority: undefined,
      } as PrimitivePropertyProps;

      const actualProps = parser.parsePrimitiveProperty(propertyElement);
      assert.deepEqual(actualProps, expectedProps);
    });

    it("Enumeration property, should parse props correctly", () => {
      const itemXml = `
        <ECEntityClass typeName="TestEntityClass" description="Test description" displayLabel="TestLabel" modifier="Abstract">
          <ECProperty propertyName="TestEnumerationProperty" typeName="TestEnumeration"/>
        </ECEntityClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEntityClass");
      if (findResult === undefined)
        throw new Error("Expected finding EntityClass with PrimitiveProperty (Enumeration) to be successful");

      const [, , parentElement] = findResult;
      const propertiesResult = Array.from(parser.getProperties(parentElement));
      if (propertiesResult.length === 0)
        throw new Error("Expected parsing EntityClass PrimitiveProperty (Enumeration) to be successful");

      const [, , propertyElement] = propertiesResult[0];

      const expectedProps = {
        name: "TestEnumerationProperty",
        type: "primitiveproperty",
        typeName: "TestSchema.TestEnumeration",
        category: undefined,
        description: undefined,
        extendedTypeName: undefined,
        inherited: undefined,
        isReadOnly: undefined,
        kindOfQuantity: undefined,
        label: undefined,
        maxLength: undefined,
        maxValue: undefined,
        minLength: undefined,
        minValue: undefined,
        priority: undefined,
      } as EnumerationPropertyProps;

      const actualProps = parser.parsePrimitiveProperty(propertyElement);
      assert.deepEqual(actualProps, expectedProps);
    });

    it("should throw for missing propertyName", () => {
      const itemXml = `
        <ECEntityClass typeName="TestEntityClass" description="Test description" displayLabel="TestLabel" modifier="Abstract">
          <ECProperty typeName="double"/>
        </ECEntityClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEntityClass");
      if (findResult === undefined)
        throw new Error("Expected finding EntityClass with PrimitiveProperty to be successful");

      const [, , parentElement] = findResult;
      assert.throws(() => Array.from(parser.getProperties(parentElement)), ECObjectsError, `An ECProperty in TestSchema.TestEntityClass is missing the required 'propertyName' attribute.`);
    });

    it("should throw for missing typeName", () => {
      const itemXml = `
        <ECEntityClass typeName="TestEntityClass" description="Test description" displayLabel="TestLabel" modifier="Abstract">
          <ECProperty propertyName="TestPrimitiveProperty"/>
        </ECEntityClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEntityClass");
      if (findResult === undefined)
        throw new Error("Expected finding EntityClass with PrimitiveProperty to be successful");

      const [, , parentElement] = findResult;
      const propertiesResult = Array.from(parser.getProperties(parentElement));
      if (propertiesResult.length === 0)
        throw new Error("Expected finding EntityClass PrimitiveProperty to be successful");

      const [propName, , propEelement] = propertiesResult[0];
      assert.throws(() => parser.parsePrimitiveProperty(propEelement), ECObjectsError, `The ECProperty TestSchema.TestEntityClass.${propName} is missing the required 'typeName' attribute.`);
    });

    it("should throw for invalid priority attribute", () => {
      const itemXml = `
        <ECEntityClass typeName="TestEntityClass" description="Test description" displayLabel="TestLabel" modifier="Abstract">
          <ECProperty propertyName="TestPrimitiveProperty" typeName="double" priority="high"/>
        </ECEntityClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEntityClass");
      if (findResult === undefined)
        throw new Error("Expected finding EntityClass with PrimitiveProperty to be successful");

      const [, , parentElement] = findResult;
      const propertiesResult = Array.from(parser.getProperties(parentElement));
      if (propertiesResult.length === 0)
        throw new Error("Expected finding EntityClass PrimitiveProperty to be successful");

      const [propName, , propElement] = propertiesResult[0];
      assert.throws(() => parser.parsePrimitiveProperty(propElement), ECObjectsError, `The ECProperty TestSchema.TestEntityClass.${propName} has an invalid 'priority' attribute. It should be a numeric value.`);
    });

    it("should throw for invalid isReadOnly attribute", () => {
      const itemXml = `
        <ECEntityClass typeName="TestEntityClass" description="Test description" displayLabel="TestLabel" modifier="Abstract">
          <ECProperty propertyName="TestPrimitiveProperty" typeName="double" readOnly="yes"/>
        </ECEntityClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEntityClass");
      if (findResult === undefined)
        throw new Error("Expected finding EntityClass with PrimitiveProperty to be successful");

      const [, , parentElement] = findResult;
      const propertiesResult = Array.from(parser.getProperties(parentElement));
      if (propertiesResult.length === 0)
        throw new Error("Expected finding EntityClass PrimitiveProperty to be successful");

      const [propName, , propElement] = propertiesResult[0];
      assert.throws(() => parser.parsePrimitiveProperty(propElement), ECObjectsError, `The ECProperty TestSchema.TestEntityClass.${propName} has an invalid 'readOnly' attribute. It should be either "true" or "false".`);
    });

    it("should throw for invalid inherited attribute", () => {
      const itemXml = `
        <ECEntityClass typeName="TestEntityClass" description="Test description" displayLabel="TestLabel" modifier="Abstract">
          <ECProperty propertyName="TestPrimitiveProperty" typeName="double" inherited="no"/>
        </ECEntityClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEntityClass");
      if (findResult === undefined)
        throw new Error("Expected finding EntityClass with PrimitiveProperty to be successful");

      const [, , parentElement] = findResult;
      const propertiesResult = Array.from(parser.getProperties(parentElement));
      if (propertiesResult.length === 0)
        throw new Error("Expected finding EntityClass PrimitiveProperty to be successful");

      const [propName, , propElement] = propertiesResult[0];
      assert.throws(() => parser.parsePrimitiveProperty(propElement), ECObjectsError, `The ECProperty TestSchema.TestEntityClass.${propName} has an invalid 'inherited' attribute. It should be either "true" or "false".`);

    });

    it("should throw for invalid minimumLength attribute", () => {
      const itemXml = `
        <ECEntityClass typeName="TestEntityClass" description="Test description" displayLabel="TestLabel" modifier="Abstract">
          <ECProperty propertyName="TestPrimitiveProperty" typeName="double" minimumLength="None"/>
        </ECEntityClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEntityClass");
      if (findResult === undefined)
        throw new Error("Expected finding EntityClass with PrimitiveProperty to be successful");

      const [, , parentElement] = findResult;
      const propertiesResult = Array.from(parser.getProperties(parentElement));
      if (propertiesResult.length === 0)
        throw new Error("Expected finding EntityClass PrimitiveProperty to be successful");

      const [propName, , propElement] = propertiesResult[0];
      assert.throws(() => parser.parsePrimitiveProperty(propElement), ECObjectsError, `The ECProperty TestSchema.TestEntityClass.${propName} has an invalid 'minimumLength' attribute. It should be a numeric value.`);
    });

    it("should throw for invalid maximumLength attribute", () => {
      const itemXml = `
        <ECEntityClass typeName="TestEntityClass" description="Test description" displayLabel="TestLabel" modifier="Abstract">
          <ECProperty propertyName="TestPrimitiveProperty" typeName="double" maximumLength="Some"/>
        </ECEntityClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEntityClass");
      if (findResult === undefined)
        throw new Error("Expected finding EntityClass with PrimitiveProperty to be successful");

      const [, , parentElement] = findResult;
      const propertiesResult = Array.from(parser.getProperties(parentElement));
      if (propertiesResult.length === 0)
        throw new Error("Expected finding EntityClass PrimitiveProperty to be successful");

      const [propName, , propElement] = propertiesResult[0];
      assert.throws(() => parser.parsePrimitiveProperty(propElement), ECObjectsError, `The ECProperty TestSchema.TestEntityClass.${propName} has an invalid 'maximumLength' attribute. It should be a numeric value.`);
    });

    it("should throw for invalid minimumValue attribute", () => {
      const itemXml = `
        <ECEntityClass typeName="TestEntityClass" description="Test description" displayLabel="TestLabel" modifier="Abstract">
          <ECProperty propertyName="TestPrimitiveProperty" typeName="double" minimumValue="Val"/>
        </ECEntityClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEntityClass");
      if (findResult === undefined)
        throw new Error("Expected finding EntityClass with PrimitiveProperty to be successful");

      const [, , parentElement] = findResult;
      const propertiesResult = Array.from(parser.getProperties(parentElement));
      if (propertiesResult.length === 0)
        throw new Error("Expected finding EntityClass PrimitiveProperty to be successful");

      const [propName, , propElement] = propertiesResult[0];
      assert.throws(() => parser.parsePrimitiveProperty(propElement), ECObjectsError, `The ECProperty TestSchema.TestEntityClass.${propName} has an invalid 'minimumValue' attribute. It should be a numeric value.`);
    });

    it("should throw for invalid maximumValue attribute", () => {
      const itemXml = `
        <ECEntityClass typeName="TestEntityClass" description="Test description" displayLabel="TestLabel" modifier="Abstract">
          <ECProperty propertyName="TestPrimitiveProperty" typeName="double" maximumValue="Real Big"/>
        </ECEntityClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEntityClass");
      if (findResult === undefined)
        throw new Error("Expected finding EntityClass with PrimitiveProperty to be successful");

      const [, , parentElement] = findResult;
      const propertiesResult = Array.from(parser.getProperties(parentElement));
      if (propertiesResult.length === 0)
        throw new Error("Expected finding EntityClass PrimitiveProperty to be successful");

      const [propName, , propElement] = propertiesResult[0];
      assert.throws(() => parser.parsePrimitiveProperty(propElement), ECObjectsError, `The ECProperty TestSchema.TestEntityClass.${propName} has an invalid 'maximumValue' attribute. It should be a numeric value.`);
    });
  });

  describe("parseStructProperty", () => {
    it("should parse props correctly", () => {
      const itemXml = `
        <ECEntityClass typeName="TestEntityClass" description="Test description" displayLabel="TestLabel" modifier="Abstract">
          <ECStructProperty propertyName="TestStructProperty" typeName="TestStruct"/>
        </ECEntityClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEntityClass");
      if (findResult === undefined)
        throw new Error("Expected finding EntityClass with Property to be successful");

      const [, , parentElement] = findResult;
      const propertiesResult = Array.from(parser.getProperties(parentElement));
      if (propertiesResult.length === 0)
        throw new Error("Expected parsing EntityClass with StructProperty to be successful");

      const [, , propertyElement] = propertiesResult[0];

      const expectedProps = {
        name: "TestStructProperty",
        type: "structproperty",
        typeName: "TestSchema.TestStruct",
        category: undefined,
        description: undefined,
        inherited: undefined,
        isReadOnly: undefined,
        kindOfQuantity: undefined,
        label: undefined,
        priority: undefined,
      } as PrimitivePropertyProps;

      const actualProps = parser.parseStructProperty(propertyElement);
      assert.deepEqual(actualProps, expectedProps);
    });
  });

  describe("parseStructArrayProperty", () => {
    it("should parse props correctly", () => {
      const itemXml = `
        <ECEntityClass typeName="TestEntityClass" description="Test description" displayLabel="TestLabel" modifier="Abstract">
          <ECStructArrayProperty propertyName="TestStructArrayProperty" typeName="TestSchema:TestStruct" minOccurs="0" maxOccurs="1000"/>
        </ECEntityClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEntityClass");
      if (findResult === undefined)
        throw new Error("Expected finding EntityClass with ArrayProperty to be successful");

      const [, , parentElement] = findResult;
      const propertiesResult = Array.from(parser.getProperties(parentElement));
      if (propertiesResult.length === 0)
        throw new Error("Expected parsing EntityClass StructArrayProperty to be successful");

      const [, , propertyElement] = propertiesResult[0];

      const expectedProps = {
        name: "TestStructArrayProperty",
        type: "structarrayproperty",
        typeName: "TestSchema.TestStruct",
        minOccurs: 0,
        maxOccurs: 1000,
        label: undefined,
        description: undefined,
        category: undefined,
        inherited: undefined,
        isReadOnly: undefined,
        kindOfQuantity: undefined,
        priority: undefined,
      } as StructArrayPropertyProps;

      const actualProps = parser.parseStructArrayProperty(propertyElement);
      assert.deepEqual(actualProps, expectedProps);
    });
  });

  describe("parsePrimitiveArrayProperty", () => {
    it("should parse props correctly", () => {
      const itemXml = `
        <ECEntityClass typeName="TestEntityClass" description="Test description" displayLabel="TestLabel" modifier="Abstract">
          <ECArrayProperty propertyName="TestArrayProperty" typeName="double" minOccurs="0" maxOccurs="1000"/>
        </ECEntityClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEntityClass");
      if (findResult === undefined)
        throw new Error("Expected finding EntityClass with ArrayProperty to be successful");

      const [, , parentElement] = findResult;
      const propertiesResult = Array.from(parser.getProperties(parentElement));
      if (propertiesResult.length === 0)
        throw new Error("Expected parsing EntityClass ArrayProperty to be successful");

      const [, , propertyElement] = propertiesResult[0];

      const expectedProps = {
        name: "TestArrayProperty",
        type: "primitivearrayproperty",
        typeName: "double",
        minOccurs: 0,
        maxOccurs: 1000,
        label: undefined,
        description: undefined,
        category: undefined,
        extendedTypeName: undefined,
        inherited: undefined,
        isReadOnly: undefined,
        kindOfQuantity: undefined,
        maxLength: undefined,
        minLength: undefined,
        minValue: undefined,
        maxValue: undefined,
        priority: undefined,
      } as PrimitiveArrayPropertyProps;

      const actualProps = parser.parsePrimitiveArrayProperty(propertyElement);
      assert.deepEqual(actualProps, expectedProps);
    });

    it("should throw for invalid minOccurs attribute", () => {
      const itemXml = `
        <ECEntityClass typeName="TestEntityClass" description="Test description" displayLabel="TestLabel" modifier="Abstract">
          <ECArrayProperty propertyName="TestArrayProperty" typeName="double" minOccurs="minimum"/>
        </ECEntityClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEntityClass");
      if (findResult === undefined)
        throw new Error("Expected finding EntityClass with ArrayProperty to be successful");

      const [, , parentElement] = findResult;
      const propertiesResult = Array.from(parser.getProperties(parentElement));
      if (propertiesResult.length === 0)
        throw new Error("Expected finding EntityClass ArrayProperty to be successful");

      const [propName, , propElement] = propertiesResult[0];
      assert.throws(() => parser.parsePrimitiveArrayProperty(propElement), ECObjectsError, `The ECProperty TestSchema.TestEntityClass.${propName} has an invalid 'minOccurs' attribute. It should be a numeric value.`);
    });

    it("should throw for invalid maxOccurs attribute", () => {
      const itemXml = `
        <ECEntityClass typeName="TestEntityClass" description="Test description" displayLabel="TestLabel" modifier="Abstract">
          <ECArrayProperty propertyName="TestArrayProperty" typeName="double" maxOccurs="maximum"/>
        </ECEntityClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEntityClass");
      if (findResult === undefined)
        throw new Error("Expected finding EntityClass with ArrayProperty to be successful");

      const [, , parentElement] = findResult;
      const propertiesResult = Array.from(parser.getProperties(parentElement));
      if (propertiesResult.length === 0)
        throw new Error("Expected finding EntityClass ArrayProperty to be successful");

      const [propName, , propElement] = propertiesResult[0];
      assert.throws(() => parser.parsePrimitiveArrayProperty(propElement), ECObjectsError, `The ECProperty TestSchema.TestEntityClass.${propName} has an invalid 'maxOccurs' attribute. It should be a numeric value.`);
    });

    it("it should accept 'unbounded' as valid maxOccurs attribute", () => {
      const itemXml = `
        <ECEntityClass typeName="TestEntityClass" description="Test description" displayLabel="TestLabel" modifier="Abstract">
          <ECArrayProperty propertyName="TestArrayProperty" typeName="double" maxOccurs="unbounded"/>
        </ECEntityClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEntityClass");
      if (findResult === undefined)
        throw new Error("Expected finding EntityClass with ArrayProperty to be successful");

      const [, , parentElement] = findResult;
      const propertiesResult = Array.from(parser.getProperties(parentElement));
      if (propertiesResult.length === 0)
        throw new Error("Expected finding EntityClass ArrayProperty to be successful");

      const [propName, , propElement] = propertiesResult[0];
      assert.doesNotThrow(() => parser.parsePrimitiveArrayProperty(propElement), ECObjectsError, `The ECProperty TestSchema.TestEntityClass.${propName} has an invalid 'maxOccurs' attribute. It should be a numeric value.`);
      const actualProps = parser.parsePrimitiveArrayProperty(propElement);
      assert.strictEqual(actualProps.maxOccurs, INT_MAX);
    });
  });

  describe("parseNavigationProperty", () => {
    it("should parse props correctly", () => {
      const itemXml = `
        <ECEntityClass typeName="TestEntityClass" description="Test description" displayLabel="TestLabel" modifier="Abstract">
          <ECNavigationProperty propertyName="TestNavigationProperty" relationshipName="TestRelationship" direction="Forward" readOnly="true"/>
        </ECEntityClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEntityClass");
      if (findResult === undefined)
        throw new Error("Expected finding EntityClass with NavigationProperty to be successful");

      const [, , parentElement] = findResult;
      const propertiesResult = Array.from(parser.getProperties(parentElement));
      if (propertiesResult.length === 0)
        throw new Error("Expected parsing EntityClass NavigationProperty to be successful");

      const [, , propertyElement] = propertiesResult[0];

      const expectedProps = {
        name: "TestNavigationProperty",
        type: "navigationproperty",
        relationshipName: "TestSchema.TestRelationship",
        direction: "Forward",
        isReadOnly: true,
        label: undefined,
        description: undefined,
        category: undefined,
        inherited: undefined,
        kindOfQuantity: undefined,
        priority: undefined,
      } as NavigationPropertyProps;

      const actualProps = parser.parseNavigationProperty(propertyElement);
      assert.deepEqual(actualProps, expectedProps);
    });

    it("should throw for missing relationshipName attribute", () => {
      const itemXml = `
        <ECEntityClass typeName="TestEntityClass" description="Test description" displayLabel="TestLabel" modifier="Abstract">
          <ECNavigationProperty propertyName="TestNavigationProperty" direction="Forward"/>
        </ECEntityClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEntityClass");
      if (findResult === undefined)
        throw new Error("Expected finding EntityClass with NavigationProperty to be successful");

      const [, , parentElement] = findResult;
      const propertiesResult = Array.from(parser.getProperties(parentElement));
      if (propertiesResult.length === 0)
        throw new Error("Expected finding EntityClass NavigationProperty to be successful");

      const [propName, , propElement] = propertiesResult[0];
      assert.throws(() => parser.parseNavigationProperty(propElement), ECObjectsError, `The ECNavigationProperty TestSchema.TestEntityClass.${propName} is missing the required 'relationshipName' property.`);
    });

    it("should throw for missing direction attribute", () => {
      const itemXml = `
        <ECEntityClass typeName="TestEntityClass" description="Test description" displayLabel="TestLabel" modifier="Abstract">
          <ECNavigationProperty propertyName="TestNavigationProperty" relationshipName="TestRelationship"/>
        </ECEntityClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEntityClass");
      if (findResult === undefined)
        throw new Error("Expected finding EntityClass with NavigationProperty to be successful");

      const [, , parentElement] = findResult;
      const propertiesResult = Array.from(parser.getProperties(parentElement));
      if (propertiesResult.length === 0)
        throw new Error("Expected finding EntityClass NavigationProperty to be successful");

      const [propName, , propElement] = propertiesResult[0];
      assert.throws(() => parser.parseNavigationProperty(propElement), ECObjectsError, `The ECNavigationProperty TestSchema.TestEntityClass.${propName} is missing the required 'direction' property.`);
    });
  });

  describe("parsePropertyCategory", () => {
    it("should parse props correctly", () => {
      const itemXml = `<PropertyCategory typeName="TestPropCategory" priority="0"/>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestPropCategory");
      if (findResult === undefined)
        throw new Error("Expected finding PropertyCategory to be successful");

      const [, , itemElement] = findResult;

      const expectedProps = {
        priority: 0,
        label: undefined,
        description: undefined,
      } as PropertyCategoryProps;

      const actualProps = parser.parsePropertyCategory(itemElement);
      assert.deepEqual(actualProps, expectedProps);
    });

    it("should throw for missing priority attribute", () => {
      const itemXml = `<PropertyCategory typeName="TestPropCategory"/>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestPropCategory");
      if (findResult === undefined)
        throw new Error("Expected finding PropertyCategory to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parsePropertyCategory(itemElement), ECObjectsError, `The PropertyCategory TestSchema.${itemName} is missing the required 'priority' attribute.`);
    });

    it("should throw for invalid priority attribute", () => {
      const itemXml = `<PropertyCategory typeName="TestPropCategory" priority="low"/>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestPropCategory");
      if (findResult === undefined)
        throw new Error("Expected finding PropertyCategory to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parsePropertyCategory(itemElement), ECObjectsError, `The PropertyCategory TestSchema.${itemName} has an invalid 'priority' attribute. It should be a numeric value.`);
    });
  });

  describe("parseRelationshipClass", () => {
    it("should parse props correctly", () => {
      const itemXml = `
        <ECRelationshipClass typeName="TestRelationshipClass" strength="embedding" strengthDirection="Backward" modifier="Sealed">
          <Source multiplicity="(0..1)" polymorphic="false" roleLabel="breaks down" abstractConstraint="TestSourceClass">
              <Class class="TestSourceClass"/>
          </Source>
          <Target multiplicity="(1..1)" polymorphic="tRuE" roleLabel="is broken down by" abstractConstraint="TestTargetClass">
              <Class class="TestTargetClass"/>
          </Target>
        </ECRelationshipClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestRelationshipClass");
      if (findResult === undefined)
        throw new Error("Expected finding TestRelationshipClass to be successful");

      const [, , itemElement] = findResult;

      const expectedProps = {
        strength: "embedding",
        strengthDirection: "Backward",
        source: {
          multiplicity: "(0..1)",
          roleLabel: "breaks down",
          polymorphic: false,
          constraintClasses: ["TestSchema.TestSourceClass"],
          abstractConstraint: "TestSchema.TestSourceClass",
        },
        target: {
          multiplicity: "(1..1)",
          roleLabel: "is broken down by",
          polymorphic: true,
          constraintClasses: ["TestSchema.TestTargetClass"],
          abstractConstraint: "TestSchema.TestTargetClass",
        },
        modifier: "Sealed",
        baseClass: undefined,
        description: undefined,
        label: undefined,
      };

      const actualProps = parser.parseRelationshipClass(itemElement);
      assert.deepEqual(actualProps, expectedProps);
    });

    it("should throw for missing strength attribute", () => {
      const itemXml = `
        <ECRelationshipClass typeName="TestRelationshipClass" strengthDirection="Backward" modifier="Sealed">
          <Source multiplicity="(0..1)" polymorphic="false" roleLabel="breaks down">
            <Class class="TestSourceClass"/>
          </Source>
          <Target multiplicity="(1..1)" polymorphic="true" roleLabel="is broken down by">
            <Class class="TestTargetClass"/>
          </Target>
        </ECRelationshipClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestRelationshipClass");
      assert.isDefined(findResult, "Expected finding TestRelationshipClass to be successful");
      const [itemName, , itemElement] = findResult!;
      assert.throws(() => parser.parseRelationshipClass(itemElement), ECObjectsError, `The RelationshipClass TestSchema.${itemName} is missing the required 'strength' attribute.`);
    });

    it("Should set to 'Forward' for missing strengthDirection attribute", () => {
      const itemXml = `
        <ECRelationshipClass typeName="TestRelationshipClass" strength="embedding" modifier="Sealed">
          <Source multiplicity="(0..1)" polymorphic="false" roleLabel="breaks down">
            <Class class="TestSourceClass"/>
          </Source>
          <Target multiplicity="(1..1)" polymorphic="true" roleLabel="is broken down by">
            <Class class="TestTargetClass"/>
          </Target>
        </ECRelationshipClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestRelationshipClass");
      assert.isDefined(findResult, "Expected finding TestRelationshipClass to be successful");
      const [, , itemElement] = findResult!;

      const actualProps = parser.parseRelationshipClass(itemElement);
      assert.equal(actualProps.strengthDirection, "Forward");
    });

    it("should throw for missing Source constraint tag", () => {
      const itemXml = `
        <ECRelationshipClass typeName="TestRelationshipClass" strength="embedding" strengthDirection="Backward" modifier="Sealed">
          <Target multiplicity="(1..1)" polymorphic="true" roleLabel="is broken down by">
            <Class class="TestTargetClass"/>
          </Target>
        </ECRelationshipClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestRelationshipClass");
      assert.isDefined(findResult, "Expected finding TestRelationshipClass to be successful");
      const [itemName, , itemElement] = findResult!;
      assert.throws(() => parser.parseRelationshipClass(itemElement), ECObjectsError, `The RelationshipClass TestSchema.${itemName} is missing the required Source constraint tag.`);
    });

    it("should throw for missing Target constraint tag", () => {
      const itemXml = `
        <ECRelationshipClass typeName="TestRelationshipClass" strength="embedding" strengthDirection="Backward" modifier="Sealed">
          <Source multiplicity="(0..1)" polymorphic="false" roleLabel="breaks down">
              <Class class="TestSourceClass"/>
          </Source>
        </ECRelationshipClass>`;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestRelationshipClass");
      assert.isDefined(findResult, "Expected finding TestRelationshipClass to be successful");
      const [itemName, , itemElement] = findResult!;
      assert.throws(() => parser.parseRelationshipClass(itemElement), ECObjectsError, `The RelationshipClass TestSchema.${itemName} is missing the required Target constraint tag.`);
    });

    describe("parseRelationshipConstraintProps", () => {
      it("should throw for missing multiplicity attribute", () => {
        const itemXml = `
          <ECRelationshipClass typeName="TestRelationshipClass" strength="embedding" strengthDirection="Backward" modifier="Sealed">
            <Source polymorphic="false" roleLabel="breaks down">
              <Class class="TestSourceClass"/>
            </Source>
            <Target multiplicity="(1..1)" polymorphic="true" roleLabel="is broken down by">
              <Class class="TestTargetClass"/>
            </Target>
          </ECRelationshipClass>`;

        parser = new XmlParser(createSchemaXmlWithItems(itemXml));
        const findResult = parser.findItem("TestRelationshipClass");
        assert.isDefined(findResult, "Expected finding TestRelationshipClass to be successful");
        const [itemName, , itemElement] = findResult!;
        assert.throws(() => parser.parseRelationshipClass(itemElement), ECObjectsError, `The Source Constraint of TestSchema.${itemName} is missing the required 'multiplicity' attribute.`);
      });

      it("should throw for missing roleLabel attribute", () => {
        const itemXml = `
          <ECRelationshipClass typeName="TestRelationshipClass" strength="embedding" strengthDirection="Backward" modifier="Sealed">
            <Source multiplicity="(0..1)" polymorphic="false" roleLabel="breaks down">
              <Class class="TestSourceClass"/>
            </Source>
            <Target multiplicity="(1..1)" polymorphic="true">
              <Class class="TestTargetClass"/>
            </Target>
          </ECRelationshipClass>`;

        parser = new XmlParser(createSchemaXmlWithItems(itemXml));
        const findResult = parser.findItem("TestRelationshipClass");
        assert.isDefined(findResult, "Expected finding TestRelationshipClass to be successful");
        const [itemName, , itemElement] = findResult!;
        assert.throws(() => parser.parseRelationshipClass(itemElement), ECObjectsError, `The Target Constraint of TestSchema.${itemName} is missing the required 'roleLabel' attribute.`);
      });

      it("should throw for missing polymorphic attribute", () => {
        const itemXml = `
          <ECRelationshipClass typeName="TestRelationshipClass" strength="embedding" strengthDirection="Backward" modifier="Sealed">
            <Source multiplicity="(0..1)" roleLabel="breaks down">
              <Class class="TestSourceClass"/>
            </Source>
            <Target multiplicity="(1..1)" polymorphic="true" roleLabel="is broken down by">
              <Class class="TestTargetClass"/>
            </Target>
          </ECRelationshipClass>`;

        parser = new XmlParser(createSchemaXmlWithItems(itemXml));
        const findResult = parser.findItem("TestRelationshipClass");
        assert.isDefined(findResult, "Expected finding TestRelationshipClass to be successful");
        const [itemName, , itemElement] = findResult!;
        assert.throws(() => parser.parseRelationshipClass(itemElement), ECObjectsError, `The Source Constraint of TestSchema.${itemName} is missing the required 'polymorphic' attribute.`);
      });

      it("should throw for invalid polymorphic attribute", () => {
        const itemXml = `
          <ECRelationshipClass typeName="TestRelationshipClass" strength="embedding" strengthDirection="Backward" modifier="Sealed">
            <Source multiplicity="(0..1)" polymorphic="false" roleLabel="breaks down">
              <Class class="TestSourceClass"/>
            </Source>
            <Target multiplicity="(1..1)" polymorphic="yes" roleLabel="is broken down by">
              <Class class="TestTargetClass"/>
            </Target>
          </ECRelationshipClass>`;

        parser = new XmlParser(createSchemaXmlWithItems(itemXml));
        const findResult = parser.findItem("TestRelationshipClass");
        assert.isDefined(findResult, "Expected finding TestRelationshipClass to be successful");
        const [itemName, , itemElement] = findResult!;
        assert.throws(() => parser.parseRelationshipClass(itemElement), ECObjectsError, `The Target Constraint of TestSchema.${itemName} has an invalid 'polymorphic' attribute. It should either be "true" or "false".`);
      });

      it("should throw for missing constraint Class tags", () => {
        const itemXml = `
          <ECRelationshipClass typeName="TestRelationshipClass" strength="embedding" strengthDirection="Backward" modifier="Sealed">
            <Source multiplicity="(0..1)" polymorphic="false" roleLabel="breaks down">
            </Source>
            <Target multiplicity="(1..1)" polymorphic="true" roleLabel="is broken down by">
              <Class class="TestTargetClass"/>
            </Target>
          </ECRelationshipClass>`;

        parser = new XmlParser(createSchemaXmlWithItems(itemXml));
        const findResult = parser.findItem("TestRelationshipClass");
        assert.isDefined(findResult, "Expected finding TestRelationshipClass to be successful");
        const [itemName, , itemElement] = findResult!;
        assert.throws(() => parser.parseRelationshipClass(itemElement), ECObjectsError, `The Source Constraint of TestSchema.${itemName} is missing the required Class tags.`);
      });
    });
  });

  describe("parseSchema", () => {
    it("should parse props correctly", () => {
      const schemaDoc = createSchemaXmlWithItems(``, true);
      parser = new XmlParser(schemaDoc);

      const expectedProps = {
        name: "TestSchema",
        $schema: "http://www.bentley.com/schemas/Bentley.ECXML.3.2",
        version: "01.00.00",
        alias: "testschema",
        description: "A test schema",
        label: undefined,
      } as SchemaProps;

      const actualProps = parser.parseSchema();
      assert.deepEqual(actualProps, expectedProps);
    });

    it("invalid xmlns host (replacing dots with numbers), should throw", () => {
      const schemaDoc = createSchemaXmlWithItems(``, true);
      // this xmlns string passes without escaping the '.' in the xmlns regex.
      schemaDoc.documentElement.setAttribute("xmlns", "http://www1bentley2com/schemas/Bentley3ECXML4352");
      parser = new XmlParser(schemaDoc);
      assert.throws(() => parser.parseSchema(), ECObjectsError, `The ECSchema TestSchema has an invalid 'xmlns' attribute`);
    });

    it("should throw for missing xmnls ($schema) attribute", () => {
      const schemaDoc = createSchemaXmlWithItems(``);
      schemaDoc.documentElement.removeAttribute("xmlns");
      parser = new XmlParser(schemaDoc);
      assert.throws(() => parser.parseSchema(), ECObjectsError, `The ECSchema TestSchema is missing a required 'xmlns' attribute`);
    });

    it("should throw for missing schemaName (name) attribute", () => {
      const schemaDoc = createSchemaXmlWithItems(``);
      schemaDoc.documentElement.removeAttribute("schemaName");
      parser = new XmlParser(schemaDoc);
      assert.throws(() => parser.parseSchema(), ECObjectsError, `An ECSchema is missing a required 'schemaName' attribute`);
    });

    it("should throw for missing version attribute", () => {
      const schemaDoc = createSchemaXmlWithItems(``);
      schemaDoc.documentElement.removeAttribute("version");
      parser = new XmlParser(schemaDoc);
      assert.throws(() => parser.parseSchema(), ECObjectsError, `The ECSchema TestSchema is missing a required 'version' attribute`);
    });

    it("should throw for missing alias attribute", () => {
      const schemaDoc = createSchemaXmlWithItems(``);
      schemaDoc.documentElement.removeAttribute("alias");
      parser = new XmlParser(schemaDoc);
      assert.throws(() => parser.parseSchema(), ECObjectsError, `The ECSchema TestSchema is missing a required 'alias' attribute`);
    });
  });

  describe("CustomAttribute Instance Parsing Tests", () => {
    function createSchemaJson(propertyJson: any): any {
      return createSchemaJsonWithItems({
        TestCustomAttribute: {
          schemaItemType: "CustomAttributeClass",
          modifier: "Sealed",
          appliesTo: "AnyClass, Schema, AnyProperty",
          ...propertyJson,
        },
        TestIntEnumeration: {
          schemaItemType: "Enumeration",
          type: "int",
          enumerators: [
            {
              name: "FirstValue",
              value: 1,
            },
          ],
        },
        TestStringEnumeration: {
          schemaItemType: "Enumeration",
          type: "string",
          enumerators: [
            {
              name: "FirstValue",
              value: "A",
            },
          ],
        },
        TestStructClass: {
          schemaItemType: "StructClass",
          properties: [
            {
              name: "StringProperty",
              type: "PrimitiveProperty",
              typeName: "string",
            },
            {
              name: "IntProperty",
              type: "PrimitiveProperty",
              typeName: "int",
            },
            {
              name: "BoolProperty",
              type: "PrimitiveProperty",
              typeName: "boolean",
            },
          ],
        },
      });
    }

    async function getTestCAClass(propertyJson: any): Promise<CustomAttributeClass | undefined> {
      const schemaJson = createSchemaJson(propertyJson);
      const schema = await Schema.fromJson(schemaJson, new SchemaContext());
      return schema.getItem<CustomAttributeClass>("TestCustomAttribute");
    }

    function getCAProviders(itemXml: string, expectedProviders: number = 1): CAProviderTuple[] {
      const schemaDoc = createSchemaXmlWithItems(itemXml);
      parser = new XmlParser(schemaDoc);
      const providers = Array.from(parser.getSchemaCustomAttributeProviders());
      expect(providers.length).to.equal(expectedProviders);
      return providers;
    }

    it("should return CAProviderTuple(s) properly", () => {
      const itemXml = `
        <ECCustomAttributes>
          <TestAttribute1 xmlns="TestSchema.1.0"/>
          <TestAttribute2 xmlns="TestSchema.1.0"/>
        </ECCustomAttributes>`;
      const schemaDoc = createSchemaXmlWithItems(itemXml);
      parser = new XmlParser(schemaDoc);

      const providers = Array.from(parser.getSchemaCustomAttributeProviders());
      expect(providers.length).to.equal(2, "Expected CustomAttribute Providers to be returned.");
      expect(providers[0][0]).to.equal("TestSchema.TestAttribute1");
      expect(providers[0][1]).to.not.be.undefined;
      expect(providers[1][0]).to.equal("TestSchema.TestAttribute2");
      expect(providers[1][1]).to.not.be.undefined;
    });

    it("No ECCustomAttributes tag, should return empty iterable.", () => {
      const schemaDoc = createSchemaXmlWithItems("");
      parser = new XmlParser(schemaDoc);

      const providers = Array.from(parser.getSchemaCustomAttributeProviders());
      expect(providers.length).to.equal(0);
    });

    it("Empty ECCustomAttributes tag, should return empty iterable.", () => {
      const itemXml = `<ECCustomAttributes></ECCustomAttributes>`;
      const schemaDoc = createSchemaXmlWithItems(itemXml);
      parser = new XmlParser(schemaDoc);

      const providers = Array.from(parser.getSchemaCustomAttributeProviders());
      expect(providers.length).to.equal(0);
    });

    it("CustomAttributeProvider should provide valid CustomAttribute.", async () => {
      const itemXml = `
        <ECCustomAttributes>
          <TestCustomAttribute xmlns="TestSchema.1.0"/>
        </ECCustomAttributes>`;

      const testClass = await getTestCAClass("");
      const providers = getCAProviders(itemXml);

      // Call Provider
      const caInstance = providers[0][1](testClass!);

      expect(providers[0][0]).to.equal("TestSchema.TestCustomAttribute");
      expect(caInstance).to.not.be.undefined;
      expect(caInstance.className).to.equal("TestSchema.TestCustomAttribute");
    });

    it("Schema CustomAttribute with no xmlns, CustomAttribute defined in schema, CustomAttributeProvider should provide valid CustomAttribute with current schema namespace.", async () => {
      const itemXml = `
        <ECCustomAttributes>
          <TestCustomAttribute/>
        </ECCustomAttributes>`;

      const testClass = await getTestCAClass("");
      const providers = getCAProviders(itemXml);

      // Call Provider
      const caInstance = providers[0][1](testClass!);

      expect(providers[0][0]).to.equal("TestSchema.TestCustomAttribute");
      expect(caInstance).to.not.be.undefined;
      expect(caInstance.className).to.equal("TestSchema.TestCustomAttribute");
    });

    it("EntityClass CustomAttribute wih no xmlns, CustomAttribute defined in schema, CustomAttributeProvider should provide valid CustomAttribute with current schema namespace.", async () => {
      const itemXml = `
        <ECEntityClass typeName="TestEntityClass">
          <ECCustomAttributes>
            <TestAttribute/>
          </ECCustomAttributes>
        </ECEntityClass>`;

      const schemaDoc = createSchemaXmlWithItems(itemXml);
      parser = new XmlParser(schemaDoc);
      const entityElements = schemaDoc.getElementsByTagName("ECEntityClass");
      const providers = Array.from(parser.getClassCustomAttributeProviders(entityElements[0]));

      expect(providers.length).to.equal(1);
      expect(providers[0][0]).to.equal("TestSchema.TestAttribute");
    });

    it("CustomAttributeProvider should not provide Mixin CustomAttribute.", async () => {
      const itemXml = `
        <ECEntityClass typeName="TestEntityClass">
          <ECCustomAttributes>
            <TestAttribute xmlns="TestSchema.1.0"/>
            <IsMixin xmlns="CoreCustomAttributes.1.0">
              <AppliesToEntityClass>Element</AppliesToEntityClass>
            </IsMixin>
          </ECCustomAttributes>
        </ECEntityClass>`;
      const schemaDoc = createSchemaXmlWithItems(itemXml);
      parser = new XmlParser(schemaDoc);
      const entityElements = schemaDoc.getElementsByTagName("ECEntityClass");
      const providers = Array.from(parser.getClassCustomAttributeProviders(entityElements[0]));

      expect(providers.length).to.equal(1);
      expect(providers[0][0]).to.equal("TestSchema.TestAttribute");
    });

    describe("Property Parsing Tests", () => {
      describe("Boolean Parsing Tests", () => {
        it("With value set to 'True', CustomAttributeProvider should provide valid instance.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty>True</TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "boolean",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          const caInstance = providers[0][1](testClass!);

          expect(caInstance.TestProperty).to.equal(true);
        });

        it("With value set to 'False', CustomAttributeProvider should provide valid instance.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty>False</TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "boolean",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          const caInstance = providers[0][1](testClass!);

          expect(caInstance.TestProperty).to.equal(false);
        });

        it("With value set to nothing, throws.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty></TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "boolean",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          expect(() => providers[0][1](testClass!)).to.throw(ECObjectsError, "Primitive property 'TestProperty' has an invalid property value.");
        });

        it("With invalid value, throws.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty>bad</TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "boolean",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          expect(() => providers[0][1](testClass!)).to.throw(ECObjectsError, "Property 'TestProperty' has an invalid property value. An boolean value was expected.");
        });
      });
      describe("Integer Parsing Tests", () => {
        it("With valid value, CustomAttributeProvider should provide valid instance.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty>100</TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "int",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          const caInstance = providers[0][1](testClass!);

          expect(caInstance.TestProperty).to.equal(100);
        });

        it("With value set to nothing, throws.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty></TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "int",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          expect(() => providers[0][1](testClass!)).to.throw(ECObjectsError, "Primitive property 'TestProperty' has an invalid property value.");
        });

        it("With invalid value, throws.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty>bad</TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "int",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          expect(() => providers[0][1](testClass!)).to.throw(ECObjectsError, "Property 'TestProperty' has an invalid property value. An integer value was expected.");
        });
        it("With float value, throws.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty>1.1</TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "int",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          expect(() => providers[0][1](testClass!)).to.throw(ECObjectsError, "Property 'TestProperty' has an invalid property value. An integer value was expected.");
        });
      });

      describe("Double Parsing Tests", () => {
        it("With valid value, CustomAttributeProvider should provide valid instance.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty>100.01</TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "double",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          const caInstance = providers[0][1](testClass!);

          expect(caInstance.TestProperty).to.equal(100.01);
        });

        it("With value set to nothing, throws.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty></TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "double",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          expect(() => providers[0][1](testClass!)).to.throw(ECObjectsError, "Primitive property 'TestProperty' has an invalid property value.");
        });

        it("With invalid value, throws.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty>bad</TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "double",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          expect(() => providers[0][1](testClass!)).to.throw(ECObjectsError, "Property 'TestProperty' has an invalid property value. A double value was expected.");
        });
      });

      describe("Date Parsing Tests", () => {
        it("With valid value, CustomAttributeProvider should provide valid instance.", async () => {
          const now = Date.now();
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty>${now}</TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "dateTime",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          const caInstance = providers[0][1](testClass!);

          expect(caInstance.TestProperty.getTime()).to.equal(now);
        });

        it("With value set to nothing, throws.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty></TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "int",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          expect(() => providers[0][1](testClass!)).to.throw(ECObjectsError, "Primitive property 'TestProperty' has an invalid property value.");
        });

        it("With invalid value, throws.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty>bad</TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "dateTime",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          expect(() => providers[0][1](testClass!)).to.throw(ECObjectsError, "Property 'TestProperty' has an invalid property value. A date in milliseconds was expected.");
        });
      });

      describe("Point 2D Parsing Tests", () => {
        it("With valid value, CustomAttributeProvider should provide valid instance.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty>100,200</TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "Point2d",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          const caInstance = providers[0][1](testClass!);

          expect(caInstance.TestProperty.x).to.equal(100);
          expect(caInstance.TestProperty.y).to.equal(200);
        });

        it("With value set to nothing, throws.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty></TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "Point2d",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          expect(() => providers[0][1](testClass!)).to.throw(ECObjectsError, "Primitive property 'TestProperty' has an invalid property value.");
        });

        it("With invalid value, throws.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty>bad</TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "Point2d",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          expect(() => providers[0][1](testClass!)).to.throw(ECObjectsError, "Property 'TestProperty' has an invalid property value. A Point 2D value was expected.");
        });
      });

      describe("Point 3D Parsing Tests", () => {
        it("With valid value, CustomAttributeProvider should provide valid instance.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty>100,200,300</TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "Point3d",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          const caInstance = providers[0][1](testClass!);

          expect(caInstance.TestProperty.x).to.equal(100);
          expect(caInstance.TestProperty.y).to.equal(200);
          expect(caInstance.TestProperty.z).to.equal(300);
        });

        it("With value set to nothing, throws.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty></TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "Point3d",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          expect(() => providers[0][1](testClass!)).to.throw(ECObjectsError, "Primitive property 'TestProperty' has an invalid property value.");
        });

        it("With invalid value, throws.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty>bad</TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "Point3d",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          expect(() => providers[0][1](testClass!)).to.throw(ECObjectsError, "Property 'TestProperty' has an invalid property value. A Point 3D value was expected.");
        });
      });

      /** TODO - Currently treated as strings */
      describe("Geometry Parsing Tests", () => {
        it("With valid value, CustomAttributeProvider should provide valid instance.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty>Some Geometry</TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "Bentley.Geometry.Common.IGeometry",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          const caInstance = providers[0][1](testClass!);

          expect(caInstance.TestProperty).to.equal("Some Geometry");
        });
      });

      /** TODO - Currently treated as strings */
      describe("Binary Parsing Tests", () => {
        it("With valid value, CustomAttributeProvider should provide valid instance.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty>Binary Value</TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "binary",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          const caInstance = providers[0][1](testClass!);

          expect(caInstance.TestProperty).to.equal("Binary Value");
        });
      });

      describe("Primitive Array Parsing Tests", () => {
        it("With string values, parses successfully.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty>
                  <string>StringA</string>
                  <string>StringB</string>
                  <string>StringC</string>
                </TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveArrayProperty",
                typeName: "string",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          const caInstance = providers[0][1](testClass!);

          expect(caInstance.TestProperty[0]).to.equal("StringA");
          expect(caInstance.TestProperty[1]).to.equal("StringB");
          expect(caInstance.TestProperty[2]).to.equal("StringC");
        });

        it("With boolean values, parses successfully.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty>
                  <boolean>true</boolean>
                  <boolean>false</boolean>
                  <boolean>true</boolean>
                </TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveArrayProperty",
                typeName: "boolean",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          const caInstance = providers[0][1](testClass!);

          expect(caInstance.TestProperty[0]).to.equal(true);
          expect(caInstance.TestProperty[1]).to.equal(false);
          expect(caInstance.TestProperty[2]).to.equal(true);
        });

        it("With integer values, parses successfully.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty>
                  <int>1</int>
                  <int>2</int>
                  <int>3</int>
                </TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveArrayProperty",
                typeName: "int",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          const caInstance = providers[0][1](testClass!);

          expect(caInstance.TestProperty[0]).to.equal(1);
          expect(caInstance.TestProperty[1]).to.equal(2);
          expect(caInstance.TestProperty[2]).to.equal(3);
        });

        it("With double values, parses successfully.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty>
                  <double>1.1</double>
                  <double>2.1</double>
                  <double>3.1</double>
                </TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveArrayProperty",
                typeName: "double",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          const caInstance = providers[0][1](testClass!);

          expect(caInstance.TestProperty[0]).to.equal(1.1);
          expect(caInstance.TestProperty[1]).to.equal(2.1);
          expect(caInstance.TestProperty[2]).to.equal(3.1);
        });
      });

      describe("CustomAttribute Struct Property Parsing Tests", () => {
        it("parses successfully.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestStructProperty>
                  <StringProperty>test</StringProperty>
                  <IntProperty>1</IntProperty>
                  <BoolProperty>True</BoolProperty>
                </TestStructProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestStructProperty",
                type: "StructProperty",
                typeName: "TestSchema.TestStructClass",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          const caInstance = providers[0][1](testClass!);

          expect(caInstance.TestStructProperty).to.not.be.undefined;
          expect(caInstance.TestStructProperty.StringProperty).to.equal("test");
          expect(caInstance.TestStructProperty.IntProperty).to.equal(1);
          expect(caInstance.TestStructProperty.BoolProperty).to.equal(true);
        });
      });

      describe("CustomAttribute StructArray Property Parsing Tests", () => {
        it("parses successfully.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestStructArrayProperty>
                  <TestStructProperty>
                    <StringProperty>test1</StringProperty>
                    <IntProperty>1</IntProperty>
                    <BoolProperty>True</BoolProperty>
                  </TestStructProperty>
                  <TestStructProperty>
                    <StringProperty>test2</StringProperty>
                    <IntProperty>2</IntProperty>
                    <BoolProperty>False</BoolProperty>
                  </TestStructProperty>
                </TestStructArrayProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestStructArrayProperty",
                type: "StructArrayProperty",
                typeName: "TestSchema.TestStructClass",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          const caInstance = providers[0][1](testClass!);

          expect(caInstance.TestStructArrayProperty).to.not.be.undefined;
          expect(caInstance.TestStructArrayProperty.length).to.equal(2);
          expect(caInstance.TestStructArrayProperty[0].StringProperty).to.equal("test1");
          expect(caInstance.TestStructArrayProperty[0].IntProperty).to.equal(1);
          expect(caInstance.TestStructArrayProperty[0].BoolProperty).to.equal(true);
          expect(caInstance.TestStructArrayProperty[1].StringProperty).to.equal("test2");
          expect(caInstance.TestStructArrayProperty[1].IntProperty).to.equal(2);
          expect(caInstance.TestStructArrayProperty[1].BoolProperty).to.equal(false);
        });
      });

      describe("Enumeration Parsing Tests", () => {
        it("With valid integer value, CustomAttributeProvider should provide valid instance.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty>1</TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "TestSchema.TestIntEnumeration",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          const caInstance = providers[0][1](testClass!);

          expect(caInstance.TestProperty).to.equal(1);
        });

        it("With valid string value, CustomAttributeProvider should provide valid instance.", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty>A</TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "TestSchema.TestStringEnumeration",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);

          // Call Provider
          const caInstance = providers[0][1](testClass!);

          expect(caInstance.TestProperty).to.equal("A");
        });

        it("Enumeration lookup returns undefined, throws", async () => {
          const itemXml = `
            <ECCustomAttributes>
              <TestAttribute xmlns="TestSchema.1.0">
                <TestProperty>A</TestProperty>
              </TestAttribute>
            </ECCustomAttributes>`;

          const propertyJson = {
            properties: [
              {
                name: "TestProperty",
                type: "PrimitiveProperty",
                typeName: "TestSchema.TestStringEnumeration",
              },
            ],
          };

          const testClass = await getTestCAClass(propertyJson);
          const providers = getCAProviders(itemXml);
          sinon.stub(testClass!.schema, "lookupItemSync").withArgs("TestSchema.TestStringEnumeration").returns(undefined);

          expect(() => providers[0][1](testClass!)).to.throw(ECObjectsError, `The Enumeration class 'TestSchema.TestStringEnumeration' could not be found.`);
        });
      });
    });
  });
});
