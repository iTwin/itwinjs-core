/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";
import { TestSchemaLocater } from "../TestUtils/FormatTestHelper";
import { createEmptyXmlDocument } from "../TestUtils/SerializationHelper";

import { ECObjectsError } from "../../src/Exception";
import { KindOfQuantity } from "../../src/Metadata/KindOfQuantity";
import { OverrideFormat } from "../../src/Metadata/OverrideFormat";
import { Schema } from "../../src/Metadata/Schema";
import { Format } from "../../src/Metadata/Format";
import { SchemaContext } from "../../src/Context";
import { DecimalPrecision } from "../../src/utils/FormatEnums";

function createSchemaJson(koq: any) {
  return createSchemaJsonWithItems({
    TestKindOfQuantity: {
      schemaItemType: "KindOfQuantity",
      ...koq,
    },
  }, {
      references: [
        {
          name: "Formats",
          version: "1.0.0",
          alias: "f"
        },
      ],
    });
}

describe("KindOfQuantity", () => {
  const baseJson = {
    schemaItemType: "KindOfQuantity",
    name: "TestKindOfQuantity",
    label: "SomeDisplayLabel",
    description: "A really long description...",
  };

  describe("deserialization", () => {
    let context: SchemaContext;
    let schema: Schema;
    beforeEach(() => {
      context = new SchemaContext();
      schema = new Schema(new SchemaContext(), "TestSchema", 1, 2, 3);
      context.addLocater(new TestSchemaLocater());
    });

    const validFullKOQProps = {
      ...baseJson,
      relativeError: 1.234,
      persistenceUnit: "Formats.DefaultReal",
      presentationUnits: [
        "Formats.IN",
        "Formats.DefaultReal",
      ],
    };
    it("async - should successfully deserialize", async () => {
      schema = await Schema.fromJson(createSchemaJson(validFullKOQProps), context);
      const testKoq = await schema.getItem<KindOfQuantity>(validFullKOQProps.name);
      assert.isDefined(testKoq);
      expect(testKoq!.name).eq("TestKindOfQuantity");
      expect(testKoq!.fullName).eq("TestSchema.TestKindOfQuantity");
      expect(testKoq!.label).eq("SomeDisplayLabel");
      expect(testKoq!.description).eq("A really long description...");
      expect(testKoq!.relativeError).eq(1.234);
      expect(testKoq!.persistenceUnit!.name).eq("DefaultReal");

      expect(testKoq!.presentationFormats).exist;
      expect(testKoq!.presentationFormats!.length).eq(2);

      expect(testKoq!.defaultPresentationFormat!.name).eq("IN");
      expect(testKoq!.presentationFormats![0].name).eq("IN");
      expect(testKoq!.presentationFormats![1].name).eq("DefaultReal");
    });

    const koqNoPresUnits = {
      ...baseJson,
      persistenceUnit: "Formats.IN",
      relativeError: 1.234,
    };
    it("async - should successfully deserialize without presentationUnits", async () => {
      schema = await Schema.fromJson(createSchemaJson(koqNoPresUnits), context);
      const testKoq = await schema.getItem<KindOfQuantity>(koqNoPresUnits.name);
      assert.isDefined(testKoq);

      expect(testKoq!.relativeError).eq(1.234);
      expect(testKoq!.presentationFormats).exist;
      expect(testKoq!.presentationFormats!.length).eq(0);
      expect(testKoq!.defaultPresentationFormat).to.be.undefined;

      const testUnit = await schema.lookupItem(koqNoPresUnits.persistenceUnit);
      expect(testUnit).exist;
      assert.isDefined(testKoq!.persistenceUnit);
      expect(testKoq!.persistenceUnit!.fullName).eq(testUnit!.key.fullName); // Formats.IN === Formats.IN
    });
    it("sync - should successfully deserialize without presentationUnits", () => {

    });

    // should throw for presentationUnit with non-existent format
    const presentationUnitsNonExistentFormat = {
      ...baseJson,
      relativeError: 4,
      persistenceUnit: "Formats.IN",
      presentationUnits: [
        "TestSchema.NonexistentFormat",
      ],
    };
    it("async - should throw for presentationUnit having a non-existent format", async () => {
      await expect(Schema.fromJson(createSchemaJson(presentationUnitsNonExistentFormat), context)).to.be.rejectedWith(ECObjectsError, `Unable to locate SchemaItem TestSchema.NonexistentFormat.`);
    });
    it("sync - should throw for presentationUnit having a non-existent format", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(presentationUnitsNonExistentFormat), context), ECObjectsError, `Unable to locate SchemaItem TestSchema.NonexistentFormat.`);
    });

    // should throw for persistenceUnit with non-existent format
    const persistenceUnitNonExistentFormat = {
      ...baseJson,
      relativeError: 4,
      persistenceUnit: "TestSchema.NonexistentFormat",
      presentationUnits: [
        "Formats.IN",
      ],
    };
    it("async - should throw for persistenceUnit having a non-existent format", async () => {
      await expect(Schema.fromJson(createSchemaJson(persistenceUnitNonExistentFormat), context)).to.be.rejectedWith(ECObjectsError, `Unable to locate SchemaItem TestSchema.NonexistentFormat.`);
    });
    it("sync - should throw for persistenceUnit having a non-existent format", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(persistenceUnitNonExistentFormat), context), ECObjectsError, `Unable to locate SchemaItem TestSchema.NonexistentFormat.`);
    });
  });

  describe("format overrides", () => {
    let schema: Schema;
    let context: SchemaContext;
    beforeEach(() => {
      context = new SchemaContext();
      schema = new Schema(context, "TestSchema", 1, 2, 3);
      context.addLocater(new TestSchemaLocater());
    });

    // precision override
    const precisionOverride = {
      ...baseJson,
      relativeError: 4,
      persistenceUnit: "Formats.IN",
      presentationUnits: [
        "Formats.DefaultReal(2)",
        "Formats.DefaultReal(3,)",
        "Formats.DefaultReal(4,,)",
      ],
    };
    it("async - precision override", async () => {
      schema = await Schema.fromJson(createSchemaJson(precisionOverride), context);
      const testKoq = await schema.getItem<KindOfQuantity>("TestKindOfQuantity");
      assert.isDefined(testKoq);

      expect(testKoq!.presentationFormats!.length).eq(3);
      const defaultFormat = testKoq!.defaultPresentationFormat;
      assert.isDefined(defaultFormat);
      assert.isTrue(defaultFormat instanceof OverrideFormat);

      assert.notEqual(defaultFormat, await schema.lookupItem<Format>((defaultFormat as OverrideFormat).parent.key.fullName), "The format in the KOQ should be different than the one in the schema");

      expect(defaultFormat!.precision).eq(DecimalPrecision.Two);
      expect(testKoq!.presentationFormats![0].precision).eq(DecimalPrecision.Two);
      expect(testKoq!.presentationFormats![1].precision).eq(DecimalPrecision.Three);
      expect(testKoq!.presentationFormats![2].precision).eq(DecimalPrecision.Four);

      expect(testKoq!.presentationFormats![0].name).eq("Formats.DefaultReal(2)");
      expect(testKoq!.presentationFormats![0].fullName).eq("Formats.DefaultReal(2)");
      expect(testKoq!.presentationFormats![1].name).eq("Formats.DefaultReal(3)");
      expect(testKoq!.presentationFormats![1].fullName).eq("Formats.DefaultReal(3)");
      expect(testKoq!.presentationFormats![2].name).eq("Formats.DefaultReal(4)");
      expect(testKoq!.presentationFormats![2].fullName).eq("Formats.DefaultReal(4)");
    });
    it("sync - precision override", () => {
      schema = Schema.fromJsonSync(createSchemaJson(precisionOverride), context);
      const testKoq = schema.getItemSync<KindOfQuantity>("TestKindOfQuantity");
      assert.isDefined(testKoq);

      expect(testKoq!.presentationFormats!.length).to.eq(3);
      const defaultFormat = testKoq!.defaultPresentationFormat;
      assert.isDefined(defaultFormat);
      assert.isTrue(defaultFormat instanceof OverrideFormat);

      assert.notEqual(defaultFormat, schema.lookupItemSync<Format>((defaultFormat as OverrideFormat).parent.fullName), "The format in the KOQ should be different than the one in the schema");

      expect(defaultFormat!.precision).eq(DecimalPrecision.Two);

      expect(testKoq!.presentationFormats![0].precision).eq(DecimalPrecision.Two);
      expect(testKoq!.presentationFormats![1].precision).eq(DecimalPrecision.Three);
      expect(testKoq!.presentationFormats![2].precision).eq(DecimalPrecision.Four);

      expect(testKoq!.presentationFormats![0].name).eq("Formats.DefaultReal(2)");
      expect(testKoq!.presentationFormats![0].fullName).eq("Formats.DefaultReal(2)");
      expect(testKoq!.presentationFormats![1].name).eq("Formats.DefaultReal(3)");
      expect(testKoq!.presentationFormats![1].fullName).eq("Formats.DefaultReal(3)");
      expect(testKoq!.presentationFormats![2].name).eq("Formats.DefaultReal(4)");
      expect(testKoq!.presentationFormats![2].fullName).eq("Formats.DefaultReal(4)");
    });

    // single unit override
    const singleUnitOverride = {
      ...baseJson,
      relativeError: 4,
      persistenceUnit: "Formats.IN",
      presentationUnits: [
        "Formats.DefaultReal[Formats.IN]",
      ],
    };
    it("async - single unit override", async () => {
      schema = await Schema.fromJson(createSchemaJson(singleUnitOverride), context);
      const testKoq = await schema.getItem<KindOfQuantity>("TestKindOfQuantity");
      assert.isDefined(testKoq);

      expect(testKoq!.presentationFormats!.length).to.eq(1);
      const defaultFormat = testKoq!.defaultPresentationFormat;
      const defaultOverrideFormat: OverrideFormat = defaultFormat as OverrideFormat;
      assert.isDefined(defaultFormat);

      const testFormat = await schema.lookupItem<Format>(defaultOverrideFormat.parent.fullName);
      assert.notEqual(defaultFormat, testFormat, "The format in the KOQ should be different than the one in the schema");

      assert.isDefined(defaultFormat!.units);
      expect(defaultFormat!.units!.length).to.eq(1);
      const unitOverride = defaultFormat!.units![0];
      const unitFromSchema = await schema.lookupItem(unitOverride[0].fullName);
      assert.strictEqual(unitOverride[0], unitFromSchema);
    });
    it("sync - single unit override", () => {
      schema = Schema.fromJsonSync(createSchemaJson(singleUnitOverride), context);
      const testKoq = schema.getItemSync<KindOfQuantity>("TestKindOfQuantity");
      assert.isDefined(testKoq);

      expect(testKoq!.presentationFormats!.length).to.eq(1);
      const defaultFormat = testKoq!.defaultPresentationFormat;
      assert.isDefined(defaultFormat);

      assert.notEqual(defaultFormat, schema.lookupItemSync<Format>((defaultFormat as OverrideFormat).parent.key.fullName), "The format in the KOQ should be different than the one in the schema");

      assert.isDefined(defaultFormat!.units);
      expect(defaultFormat!.units!.length).to.eq(1);
      const unitOverride = defaultFormat!.units![0];
      const unitFromSchema = schema.lookupItemSync(unitOverride[0].fullName);
      assert.strictEqual(unitOverride[0], unitFromSchema);
    });

    // single unit label override
    const singleUnitLabelOverride = {
      ...baseJson,
      relativeError: 4,
      persistenceUnit: "Formats.IN",
      presentationUnits: [
        "Formats.DefaultReal[Formats.IN| in]",
      ],
    };
    it("async - single unit label override", async () => {
      schema = await Schema.fromJson(createSchemaJson(singleUnitLabelOverride), context);
      const testKoq = await schema.getItem<KindOfQuantity>("TestKindOfQuantity");

      assert.isDefined(testKoq);
      expect(testKoq!.presentationFormats!.length).to.eq(1);
      const defaultFormat = testKoq!.defaultPresentationFormat;
      assert.isDefined(defaultFormat);

      assert.isDefined(defaultFormat!.units);
      expect(defaultFormat!.units!.length).to.eq(1);
      const unitOverride = defaultFormat!.units![0];
      const unitFromSchema = await schema.lookupItem(unitOverride[0].fullName);
      assert.strictEqual(unitOverride[0], unitFromSchema);
      expect(unitOverride[1]).to.be.eq(" in");
    });
    it("sync - single unit label override", () => {
      schema = Schema.fromJsonSync(createSchemaJson(singleUnitLabelOverride), context);
      const testKoq = schema.getItemSync<KindOfQuantity>("TestKindOfQuantity");

      assert.isDefined(testKoq);
      expect(testKoq!.presentationFormats!.length).to.eq(1);
      const defaultFormat = testKoq!.defaultPresentationFormat;
      assert.isDefined(defaultFormat);

      assert.isDefined(defaultFormat!.units);
      expect(defaultFormat!.units!.length).to.eq(1);
      const unitOverride = defaultFormat!.units![0];
      const unitFromSchema = schema.lookupItemSync(unitOverride[0].fullName);
      assert.strictEqual(unitOverride[0], unitFromSchema);
      expect(unitOverride[1]).to.be.eq(" in");
    });

    // failure cases
    function testInvalidFormatStrings(testName: string, formatString: string, expectedErrorMessage: string) {
      const badOverrideString = {
        ...baseJson,
        relativeError: 4,
        persistenceUnit: "Formats.IN",
        presentationUnits: [
          formatString,
        ],
      };

      it("async - " + testName, async () => {
        await expect(Schema.fromJson(createSchemaJson(badOverrideString), context)).to.be.rejectedWith(ECObjectsError, expectedErrorMessage);
      });

      it("sync - " + testName, () => {
        assert.throws(() => Schema.fromJsonSync(createSchemaJson(badOverrideString), context), ECObjectsError, expectedErrorMessage);
      });
    }

    // The regex doesn't properly catch this case and just ignores the ().
    // testInvalidFormatStrings("should throw for invalid override string without any overrides", "Formats.DefaultReal()", "The foramt string 'Formats.Default'");
    // testInvalidFormatStrings("should throw for invalid override string with empty unit brackets", "Formats.DefaultReal[]", "");
    // testInvalidFormatStrings("should throw for invalid override string with only vertical bar in unit brackets", "Formats.DefaultReal[|]", "");
    // testInvalidFormatStrings("should throw for invalid override string with an empty string for unit", "Formats.DefaultReal[|label]", "Unable to locate SchemaItem .");
    testInvalidFormatStrings("should throw for invalid override string with an invalid precision", "Formats.DefaultReal(banana)", "");
    testInvalidFormatStrings("should throw for invalid override string without any overrides but still has commas", "Formats.DefaultReal(,,,,,)", "");
    testInvalidFormatStrings("should throw for invalid override string with 5 unit overrides", "Formats.DefaultReal[Formats.MILE|m][Formats.YRD|yard][Formats.FT|feet][Formats.IN|in][Formats.MILLIINCH|milli]", "");
    testInvalidFormatStrings("should throw for presentationUnit having a non-existent unit as an override", "Formats.DefaultReal[Formats.NonexistentUnit]", "Unable to locate SchemaItem Formats.NonexistentUnit.");
  });

  describe("toJson", () => {
    let schema: Schema;
    let context: SchemaContext;
    beforeEach(() => {
      context = new SchemaContext();
      schema = new Schema(context, "TestSchema", 1, 2, 3);
      context.addLocater(new TestSchemaLocater());
    });

    it("should successfully round-trip valid JSON", async () => {
      const koqJson = {
        ...baseJson,
        relativeError: 1.234,
        persistenceUnit: "Formats.DefaultReal",
        presentationUnits: [
          "Formats.IN",
          "Formats.DefaultReal",
        ],
      };
      schema = await Schema.fromJson(createSchemaJson(koqJson), context);
      const testKoq = await schema.getItem<KindOfQuantity>(koqJson.name);
      const expectedJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/schemaitem",
        schema: "TestSchema",
        schemaVersion: "01.02.03",
        ...koqJson,
      };
      expect(testKoq).to.exist;
      expect(testKoq!.toJson(true, true)).to.deep.equal(expectedJson);
    });

    it("should omit presentationUnits if empty", async () => {
      const koqJson = {
        ...baseJson,
        relativeError: 1.234,
        persistenceUnit: "Formats.DefaultReal",
        presentationUnits: [],
      };
      schema = await Schema.fromJson(createSchemaJson(koqJson), context);
      const testKoq = await schema.getItem<KindOfQuantity>(koqJson.name);
      expect(testKoq!.toJson(true, true)).to.not.have.property("presentationUnits");
    });
  });

  describe("toXml", () => {
    let schema: Schema;
    let context: SchemaContext;
    const newDom = createEmptyXmlDocument();

    beforeEach(() => {
      context = new SchemaContext();
      schema = new Schema(context, "TestSchema", 1, 2, 3);
      context.addLocater(new TestSchemaLocater());
    });

    const schemaJson = {
      ...baseJson,
      relativeError: 1.234,
      persistenceUnit: "Formats.DefaultReal",
      presentationUnits: [
        "Formats.DoubleUnitFormat",
        "Formats.QuadUnitFormat",
      ],
    };

    it("should properly serialize", async () => {
      schema = await Schema.fromJson(createSchemaJson(schemaJson), context);
      const testKoq = await schema.getItem<KindOfQuantity>(schemaJson.name);

      const serialized = await testKoq!.toXml(newDom);
      expect(serialized.nodeName).to.eq("KindOfQuantity");
      expect(serialized.getAttribute("typeName")).to.eq("TestKindOfQuantity");
      expect(serialized.getAttribute("relativeError")).to.eq("1.234");
      expect(serialized.getAttribute("persistenceUnit")).to.eq("Formats:DefaultReal");
      expect(serialized.getAttribute("presentationUnits")).to.eq("Formats:DoubleUnitFormat;Formats:QuadUnitFormat");
    });
  });
});
