/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { ECObjectsError } from "../../src/Exception";
import { XmlParser } from "../../src/Deserialization/XmlParser";
import { createSchemaXmlWithItems } from "../TestUtils/DeserializationHelpers";
import {
  CustomAttributeClassProps, EntityClassProps, EnumerationProps, EnumeratorProps, FormatProps, InvertedUnitProps, KindOfQuantityProps,
  MixinProps, PhenomenonProps, ConstantProps, PrimitivePropertyProps, EnumerationPropertyProps, PrimitiveArrayPropertyProps, NavigationPropertyProps,
  PropertyCategoryProps, SchemaProps, RelationshipConstraintProps, RelationshipClassProps,
} from "../../src/Deserialization/JsonProps";

describe("XmlParser", () => {
  const INT_MAX = 2147483647;
  let parser: XmlParser;

  describe("getItems / findItem", () => {
    it("should throw for an invalid typeName", () => {
      const itemsXml = `
      <ECEntityClass typeName="01a">
      </ECEntityClass>
      `;
      parser = new XmlParser(createSchemaXmlWithItems(itemsXml));
      assert.throws(() => parser.findItem("01a"), ECObjectsError, `A SchemaItem in TestSchema has an invalid 'typeName' attribute. '01a' is not a valid ECName.`);

      parser = new XmlParser(createSchemaXmlWithItems(itemsXml));
      assert.throws(() => [...parser.getItems()], ECObjectsError, `A SchemaItem in TestSchema has an invalid 'typeName' attribute. '01a' is not a valid ECName.`);
    });

    it("should throw for missing typeName", () => {
      const itemsXml = `
      <ECEntityClass>
      </ECEntityClass>
      `;

      parser = new XmlParser(createSchemaXmlWithItems(itemsXml));
      assert.throws(() => parser.findItem("Anything"), ECObjectsError, `A SchemaItem in TestSchema is missing the required 'typeName' attribute.`);

      parser = new XmlParser(createSchemaXmlWithItems(itemsXml));
      assert.throws(() => [...parser.getItems()], ECObjectsError, `A SchemaItem in TestSchema is missing the required 'typeName' attribute.`);
    });

    it("should throw for an invalid SchemaItem type", () => {
      const itemsXml = `
      <ECIntruder typeName="Muhuhahaha">
      </ECIntruder>
      `;

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
      </ECEntityClass>
      `;
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
      </ECCustomAttributeClass>
      `;
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
      </ECCustomAttributeClass>
      `;
      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestCustomAttributeClass");
      if (findResult === undefined)
        throw new Error("Expected finding CustomAttributeClass to be successful");

      const [, , itemElement] = findResult;

      const expectedProps = {
        label: "TestLabel",
        description: "Test description",
        modifier: "None",
        baseClass: "TestBaseClass",
        appliesTo: "AnotherClass",
      } as CustomAttributeClassProps;

      const actualProps = parser.parseCustomAttributeClass(itemElement);
      assert.deepEqual(actualProps, expectedProps);
    });

    it("should throw for missing appliesTo", () => {
      const itemXml = `
      <ECCustomAttributeClass typeName="TestCustomAttributeClass">
      </ECCustomAttributeClass>
      `;
      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestCustomAttributeClass");
      if (findResult === undefined)
        throw new Error("Expected finding CustomAttributeClass to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseCustomAttributeClass(itemElement), ECObjectsError, `The CustomAttributeClass TestSchema.${itemName} is missing the required 'appliesTo' attribute.`);
    });
  });

  describe("parseEntityClass", () => {
    it("should parse props correctly", () => {
      const itemXml = `
      <ECEntityClass typeName="TestEntityClass" description="Test description" displayLabel="TestLabel" modifier="Abstract">
        <BaseClass>TestBaseClass</BaseClass>
        <BaseClass>TestMixin</BaseClass>
        <BaseClass>TestMixin2</BaseClass>
      </ECEntityClass>
      `;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEntityClass");
      if (findResult === undefined)
        throw new Error("Expected finding EntityClass to be successful");

      const [, , itemElement] = findResult;

      const expectedProps = {
        label: "TestLabel",
        description: "Test description",
        modifier: "Abstract",
        baseClass: "TestBaseClass",
        mixins: ["TestMixin", "TestMixin2"],
      } as EntityClassProps;

      const actualProps = parser.parseEntityClass(itemElement);
      assert.deepEqual(actualProps, expectedProps);
    });
  });

  describe("parseEnumeration", () => {
    it("should parse props correctly", () => {
      const itemXml = `
      <ECEnumeration typeName="TestEnumeration" backingTypeName="int" isStrict="true">
        <ECEnumerator name="None" value="0" displayLabel="NoneLabel"/>
        <ECEnumerator name="Some" value="1" displayLabel="SomeLabel"/>
      </ECEnumeration>
      `;

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
      </ECEnumeration>
      `;

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
      </ECEnumeration>
      `;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEnumeration");
      if (findResult === undefined)
        throw new Error("Expected finding Enumeration to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseEnumeration(itemElement), ECObjectsError, `The Enumeration TestSchema.${itemName} has an invalid 'backingTypeName' attribute. It should be either "int" or "string".`);
    });

    it("should throw for missing isStrict attribute", () => {
      const itemXml = `
      <ECEnumeration typeName="TestEnumeration" backingTypeName="int">
        <ECEnumerator name="None" value="0" displayLabel="NoneLabel"/>
        <ECEnumerator name="Some" value="1" displayLabel="SomeLabel"/>
      </ECEnumeration>
      `;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEnumeration");
      if (findResult === undefined)
        throw new Error("Expected finding Enumeration to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseEnumeration(itemElement), ECObjectsError, `The Enumeration TestSchema.${itemName} is missing the required 'isStrict' attribute.`);
    });

    it("should throw for invalid isStrict attribute", () => {
      const itemXml = `
      <ECEnumeration typeName="TestEnumeration" backingTypeName="int" isStrict="nice">
        <ECEnumerator name="None" value="0" displayLabel="NoneLabel"/>
        <ECEnumerator name="Some" value="1" displayLabel="SomeLabel"/>
      </ECEnumeration>
      `;

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
      </ECEnumeration>
      `;

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
      </ECEnumeration>
      `;

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
      </ECEnumeration>
      `;

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
      <Format typeName="TestFormat" type="decimal" precision="4" uomSeparator="" formatTraits="keepSingleZero|keepDecimalPoint|showUnitLabel">
        <Composite spacer="">
            <Unit label="&#176;">u:ARC_DEG</Unit>
            <Unit label="'">u:ARC_MINUTE</Unit>
        </Composite>
      </Format>
      `;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestFormat");
      if (findResult === undefined)
        throw new Error("Expected finding Format to be successful");

      const [, , itemElement] = findResult;

      const composite = {
        spacer: "",
        units: [
          {
            name: "u:ARC_DEG",
            label: "°",
          },
          {
            name: "u:ARC_MINUTE",
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

      const actualProps = parser.parseFormat(itemElement);
      assert.deepEqual(actualProps, expectedProps);
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
      </Format>
      `;

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
      const itemXml = `
      <InvertedUnit typeName="TestInvertedUnit" invertsUnit="TestUnit" unitSystem="SI" />
      `;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestInvertedUnit");
      if (findResult === undefined)
        throw new Error("Expected finding InvertedUnit to be successful");
      const [, , itemElement] = findResult;

      const expectedProps = {
        invertsUnit: "TestUnit",
        unitSystem: "SI",
        description: undefined,
        label: undefined,
      } as InvertedUnitProps;

      const actualProps = parser.parseInvertedUnit(itemElement);
      assert.deepEqual(actualProps, expectedProps);
    });

    it("should throw for missing invertsUnit attribute", () => {
      const itemXml = `
      <InvertedUnit typeName="TestInvertedUnit" unitSystem="SI" />
      `;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestInvertedUnit");
      if (findResult === undefined)
        throw new Error("Expected finding InvertedUnit to be successful");
      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseInvertedUnit(itemElement), ECObjectsError, `The InvertedUnit TestSchema.${itemName} is missing the required 'invertsUnit' attribute.`);
    });

    it("should throw for missing unitSystem attribute", () => {
      const itemXml = `
      <InvertedUnit typeName="TestInvertedUnit" invertsUnit="TestUnit"/>
      `;

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
      const itemXml = `
      <KindOfQuantity typeName="TestKoQ" persistenceUnit="RAD" presentationUnits="UN1;UN2" relativeError="1e-2" />
      `;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestKoQ");
      if (findResult === undefined)
        throw new Error("Expected finding KindOfQuantity to be successful");

      const [, , itemElement] = findResult;

      const expectedProps = {
        persistenceUnit: "RAD",
        presentationUnits: ["UN1", "UN2"],
        relativeError: 0.01,
        label: undefined,
        description: undefined,
      } as KindOfQuantityProps;

      const actualProps = parser.parseKindOfQuantity(itemElement);
      assert.deepEqual(actualProps, expectedProps);
    });

    it("should throw for missing persistenceUnit attribute", () => {
      const itemXml = `
      <KindOfQuantity typeName="TestKoQ" relativeError="1e-2" />
      `;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestKoQ");
      if (findResult === undefined)
        throw new Error("Expected finding KindOfQuantity to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseKindOfQuantity(itemElement), ECObjectsError, `The KindOfQuantity TestSchema.${itemName} is missing the required 'persistenceUnit' attribute.`);
    });

    it("should throw for missing relativeError attribute", () => {
      const itemXml = `
      <KindOfQuantity typeName="TestKoQ" persistenceUnit="RAD"/>
      `;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestKoQ");
      if (findResult === undefined)
        throw new Error("Expected finding KindOfQuantity to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseKindOfQuantity(itemElement), ECObjectsError, `The KindOfQuantity TestSchema.${itemName} is missing the required 'relativeError' attribute.`);
    });

    it("should throw for invalid relativeError attribute", () => {
      const itemXml = `
      <KindOfQuantity typeName="TestKoQ" persistenceUnit="RAD" relativeError="someerror" />
      `;

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
      </ECEntityClass>
      `;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestMixin");
      if (findResult === undefined)
        throw new Error("Expected finding Mixin to be successful");

      const [, , itemElement] = findResult;

      const expectedProps = {
        appliesTo: "TestEntityClass",
        modifier: "Abstract",
        label: undefined,
        description: undefined,
        baseClass: undefined,
      } as MixinProps;

      const actualProps = parser.parseMixin(itemElement);
      assert.deepEqual(actualProps, expectedProps);
    });

    it("should throw for missing IsMixin tag", () => {
      const itemXml = `
      <ECEntityClass typeName="TestMixin">
        <ECCustomAttributes>
        </ECCustomAttributes>
      </ECEntityClass>
      `;

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
            <IsMixin>
            </IsMixin>
        </ECCustomAttributes>
      </ECEntityClass>
      `;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestMixin");
      if (findResult === undefined)
        throw new Error("Expected finding Mixin to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseMixin(itemElement), ECObjectsError, `The Mixin TestSchema.${itemName} is missing the required 'AppliesToEntityClass' tag.`);
    });
  });

  describe("parsePhenomenon", () => {
    it("should parse props correctly", () => {
      const itemXml = `
      <Phenomenon typeName="TestPhenomenon" definition="LENGTH*BREADTH" displayLabel="Area"/>
      `;

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
      const itemXml = `
      <Phenomenon typeName="TestPhenomenon" displayLabel="Area"/>
      `;

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
      const itemXml = `
      <Constant typeName="TestConstant" phenomenon="LENGTH_RATIO" definition="ONE" numerator="3.1415926" displayLabel="Pi"/>
      `;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestConstant");
      if (findResult === undefined)
        throw new Error("Expected finding Constant to be successful");

      const [, , itemElement] = findResult;

      const expectedProps = {
        phenomenon: "LENGTH_RATIO",
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
      const itemXml = `
      <Constant typeName="TestConstant" definition="ONE" numerator="3.1415926" displayLabel="Pi"/>
      `;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestConstant");
      if (findResult === undefined)
        throw new Error("Expected finding Constant to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseConstant(itemElement), ECObjectsError, `The Constant TestSchema.${itemName} is missing the required 'phenomenon' attribute.`);
    });

    it("should throw for missing definition attribute", () => {
      const itemXml = `
      <Constant typeName="TestConstant" phenomenon="LENGTH_RATIO" numerator="3.1415926" displayLabel="Pi"/>
      `;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestConstant");
      if (findResult === undefined)
        throw new Error("Expected finding Constant to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseConstant(itemElement), ECObjectsError, `The Constant TestSchema.${itemName} is missing the required 'definition' attribute.`);
    });

    it("should throw for invalid numerator attribute", () => {
      const itemXml = `
      <Constant typeName="TestConstant" phenomenon="LENGTH_RATIO" definition="ONE" numerator="threepointonefour" displayLabel="Pi"/>
      `;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestConstant");
      if (findResult === undefined)
        throw new Error("Expected finding Constant to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseConstant(itemElement), ECObjectsError, `The Constant TestSchema.${itemName} has an invalid 'numerator' attribute. It should be a numeric value.`);
    });

    it("should throw for invalid denominator attribute", () => {
      const itemXml = `
      <Constant typeName="TestConstant" phenomenon="LENGTH_RATIO" definition="ONE" denominator="threepointonefour" displayLabel="PiInverse"/>
      `;

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
      </ECEntityClass>
      `;

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
      } as PrimitivePropertyProps;

      const actualProps = parser.parsePrimitiveProperty(propertyElement);
      assert.deepEqual(actualProps, expectedProps);
    });

    it("should throw for missing propertyName", () => {
      const itemXml = `
      <ECEntityClass typeName="TestEntityClass" description="Test description" displayLabel="TestLabel" modifier="Abstract">
        <ECProperty typeName="double"/>
      </ECEntityClass>
      `;

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
      </ECEntityClass>
      `;

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
      </ECEntityClass>
      `;

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
        <ECProperty propertyName="TestPrimitiveProperty" typeName="double" isReadOnly="yes"/>
      </ECEntityClass>
      `;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestEntityClass");
      if (findResult === undefined)
        throw new Error("Expected finding EntityClass with PrimitiveProperty to be successful");

      const [, , parentElement] = findResult;
      const propertiesResult = Array.from(parser.getProperties(parentElement));
      if (propertiesResult.length === 0)
        throw new Error("Expected finding EntityClass PrimitiveProperty to be successful");

      const [propName, , propElement] = propertiesResult[0];
      assert.throws(() => parser.parsePrimitiveProperty(propElement), ECObjectsError, `The ECProperty TestSchema.TestEntityClass.${propName} has an invalid 'isReadOnly' attribute. It should be either "true" or "false".`);
    });

    it("should throw for invalid inherited attribute", () => {
      const itemXml = `
      <ECEntityClass typeName="TestEntityClass" description="Test description" displayLabel="TestLabel" modifier="Abstract">
        <ECProperty propertyName="TestPrimitiveProperty" typeName="double" inherited="no"/>
      </ECEntityClass>
      `;

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
      </ECEntityClass>
      `;

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
      </ECEntityClass>
      `;

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
      </ECEntityClass>
      `;

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
      </ECEntityClass>
      `;

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

  describe("parseEnumerationProperty", () => {
    it("should parse props correctly", () => {
      const itemXml = `
      <ECEntityClass typeName="TestEntityClass" description="Test description" displayLabel="TestLabel" modifier="Abstract">
        <ECProperty propertyName="TestEnumerationProperty" typeName="double"/>
      </ECEntityClass>
      `;

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
        typeName: "double",
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
      } as EnumerationPropertyProps;

      const actualProps = parser.parseEnumerationProperty(propertyElement);
      assert.deepEqual(actualProps, expectedProps);
    });
  });

  describe("parsePrimitiveArrayProperty", () => {
    it("should parse props correctly", () => {
      const itemXml = `
        <ECEntityClass typeName="TestEntityClass" description="Test description" displayLabel="TestLabel" modifier="Abstract">
          <ECArrayProperty propertyName="TestArrayProperty" typeName="double" minOccurs="0" maxOccurs="1000"/>
        </ECEntityClass>
        `;

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
        </ECEntityClass>
        `;

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
        </ECEntityClass>
        `;

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
        </ECEntityClass>
        `;

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
          <ECNavigationProperty propertyName="TestNavigationProperty" relationshipName="TestRelationship" direction="Forward"/>
        </ECEntityClass>
        `;

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
        relationshipName: "TestRelationship",
        direction: "Forward",
        label: undefined,
        description: undefined,
        category: undefined,
        inherited: undefined,
        isReadOnly: undefined,
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
        </ECEntityClass>
        `;

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
        </ECEntityClass>
        `;

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
      const itemXml = `
      <PropertyCategory typeName="TestPropCategory" priority="0"/>
      `;

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
      const itemXml = `
      <PropertyCategory typeName="TestPropCategory"/>
      `;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestPropCategory");
      if (findResult === undefined)
        throw new Error("Expected finding PropertyCategory to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parsePropertyCategory(itemElement), ECObjectsError, `The PropertyCategory TestSchema.${itemName} is missing the required 'priority' attribute.`);
    });

    it("should throw for invalid priority attribute", () => {
      const itemXml = `
      <PropertyCategory typeName="TestPropCategory" priority="low"/>
      `;

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
        <Source multiplicity="(0..1)" polymorphic="false" roleLabel="breaks down">
            <Class class="TestSourceClass"/>
        </Source>
        <Target multiplicity="(1..1)" polymorphic="tRuE" roleLabel="is broken down by">
            <Class class="TestTargetClass"/>
        </Target>
      </ECRelationshipClass>
      `;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestRelationshipClass");
      if (findResult === undefined)
        throw new Error("Expected finding TestRelationshipClass to be successful");

      const [, , itemElement] = findResult;

      const source = {
        multiplicity: "(0..1)",
        roleLabel: "breaks down",
        polymorphic: false,
        constraintClasses: ["TestSourceClass"],
        abstractConstraint: undefined,
      } as RelationshipConstraintProps;

      const target = {
        multiplicity: "(1..1)",
        roleLabel: "is broken down by",
        polymorphic: true,
        constraintClasses: ["TestTargetClass"],
        abstractConstraint: undefined,
      } as RelationshipConstraintProps;

      const expectedProps = {
        strength: "embedding",
        strengthDirection: "Backward",
        source,
        target,
        modifier: "Sealed",
        label: undefined,
        description: undefined,
        baseClass: undefined,
      } as RelationshipClassProps;

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
      </ECRelationshipClass>
      `;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestRelationshipClass");
      if (findResult === undefined)
        throw new Error("Expected finding TestRelationshipClass to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseRelationshipClass(itemElement), ECObjectsError, `The RelationshipClass TestSchema.${itemName} is missing the required 'strength' attribute.`);
    });

    it("should throw for missing strengthDirection attribute", () => {
      const itemXml = `
      <ECRelationshipClass typeName="TestRelationshipClass" strength="embedding" modifier="Sealed">
        <Source multiplicity="(0..1)" polymorphic="false" roleLabel="breaks down">
            <Class class="TestSourceClass"/>
        </Source>
        <Target multiplicity="(1..1)" polymorphic="true" roleLabel="is broken down by">
            <Class class="TestTargetClass"/>
        </Target>
      </ECRelationshipClass>
      `;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestRelationshipClass");
      if (findResult === undefined)
        throw new Error("Expected finding TestRelationshipClass to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseRelationshipClass(itemElement), ECObjectsError, `The RelationshipClass TestSchema.${itemName} is missing the required 'strengthDirection' attribute.`);
    });

    it("should throw for missing Source constraint tag", () => {
      const itemXml = `
      <ECRelationshipClass typeName="TestRelationshipClass" strength="embedding" strengthDirection="Backward" modifier="Sealed">
        <Target multiplicity="(1..1)" polymorphic="true" roleLabel="is broken down by">
            <Class class="TestTargetClass"/>
        </Target>
      </ECRelationshipClass>
      `;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestRelationshipClass");
      if (findResult === undefined)
        throw new Error("Expected finding TestRelationshipClass to be successful");

      const [itemName, , itemElement] = findResult;
      assert.throws(() => parser.parseRelationshipClass(itemElement), ECObjectsError, `The RelationshipClass TestSchema.${itemName} is missing the required Source constraint tag.`);
    });

    it("should throw for missing Target constraint tag", () => {
      const itemXml = `
      <ECRelationshipClass typeName="TestRelationshipClass" strength="embedding" strengthDirection="Backward" modifier="Sealed">
        <Source multiplicity="(0..1)" polymorphic="false" roleLabel="breaks down">
            <Class class="TestSourceClass"/>
        </Source>
      </ECRelationshipClass>
      `;

      parser = new XmlParser(createSchemaXmlWithItems(itemXml));
      const findResult = parser.findItem("TestRelationshipClass");
      if (findResult === undefined)
        throw new Error("Expected finding TestRelationshipClass to be successful");

      const [itemName, , itemElement] = findResult;
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
        </ECRelationshipClass>
        `;

        parser = new XmlParser(createSchemaXmlWithItems(itemXml));
        const findResult = parser.findItem("TestRelationshipClass");
        if (findResult === undefined)
          throw new Error("Expected finding TestRelationshipClass to be successful");

        const [itemName, , itemElement] = findResult;
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
        </ECRelationshipClass>
        `;

        parser = new XmlParser(createSchemaXmlWithItems(itemXml));
        const findResult = parser.findItem("TestRelationshipClass");
        if (findResult === undefined)
          throw new Error("Expected finding TestRelationshipClass to be successful");

        const [itemName, , itemElement] = findResult;
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
        </ECRelationshipClass>
        `;

        parser = new XmlParser(createSchemaXmlWithItems(itemXml));
        const findResult = parser.findItem("TestRelationshipClass");
        if (findResult === undefined)
          throw new Error("Expected finding TestRelationshipClass to be successful");

        const [itemName, , itemElement] = findResult;
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
        </ECRelationshipClass>
        `;

        parser = new XmlParser(createSchemaXmlWithItems(itemXml));
        const findResult = parser.findItem("TestRelationshipClass");
        if (findResult === undefined)
          throw new Error("Expected finding TestRelationshipClass to be successful");

        const [itemName, , itemElement] = findResult;
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
        </ECRelationshipClass>
        `;

        parser = new XmlParser(createSchemaXmlWithItems(itemXml));
        const findResult = parser.findItem("TestRelationshipClass");
        if (findResult === undefined)
          throw new Error("Expected finding TestRelationshipClass to be successful");

        const [itemName, , itemElement] = findResult;
        assert.throws(() => parser.parseRelationshipClass(itemElement), ECObjectsError, `The Source Constraint of TestSchema.${itemName} is missing the required Class tags.`);
      });
    });
  });

  describe("parseSchema", () => {
    it("should parse props correctly", () => {
      const schemaDoc = createSchemaXmlWithItems(``);
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

  describe("getSchemaCustomAttributes", () => {
    it.skip("should parse props correctly", () => { });
  });
});
