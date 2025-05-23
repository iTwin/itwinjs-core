/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import { SchemaContext } from "../../Context";
import { ECSchemaError } from "../../Exception";
import { Format } from "../../Metadata/Format";
import { KindOfQuantity } from "../../Metadata/KindOfQuantity";
import { OverrideFormat } from "../../Metadata/OverrideFormat";
import { Schema } from "../../Metadata/Schema";
import { Unit } from "../../Metadata/Unit";
import { DecimalPrecision } from "@itwin/core-quantity";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";
import { TestSchemaLocater } from "../TestUtils/FormatTestHelper";
import { createEmptyXmlDocument } from "../TestUtils/SerializationHelper";
import { ECSchemaNamespaceUris } from "../../Constants";

/* eslint-disable @typescript-eslint/naming-convention */

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
        alias: "f",
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

  describe("type safety checks", () => {
    const typeCheckJson = createSchemaJsonWithItems({
      TestKindOfQuantity: {
        schemaItemType: "KindOfQuantity",
        label: "Test Kind Of Quantity",
        description: "Used for testing",
        relativeError: 0.1,
        persistenceUnit: "TestSchema.M",
        presentationUnits: ["TestSchema.TestFormat"],
      },
      TestFormat: {
        schemaItemType: "Format",
        type: "Decimal",
      },
      TestPhenomenon: {
        schemaItemType: "Phenomenon",
        definition: "LENGTH(1)",
      },
      M: {
        schemaItemType: "Unit",
        phenomenon: "TestSchema.TestPhenomenon",
        unitSystem: "TestSchema.TestUnitSystem",
        definition: "M",
      },
      TestUnitSystem: {
        schemaItemType: "UnitSystem",
        label: "Metric",
        description: "Metric system",
      },
    });

    let ecSchema: Schema;

    before(async () => {
      ecSchema = await Schema.fromJson(typeCheckJson, new SchemaContext());
      assert.isDefined(ecSchema);
    });

    it("typeguard and type assertion should work on KindOfQuantity", async () => {
      const testKindOfQuantity = await ecSchema.getItem("TestKindOfQuantity");
      assert.isDefined(testKindOfQuantity);
      expect(KindOfQuantity.isKindOfQuantity(testKindOfQuantity)).to.be.true;
      expect(() => KindOfQuantity.assertIsKindOfQuantity(testKindOfQuantity)).not.to.throw();
      // verify against other schema item type
      const testPhenomenon = await ecSchema.getItem("TestPhenomenon");
      assert.isDefined(testPhenomenon);
      expect(KindOfQuantity.isKindOfQuantity(testPhenomenon)).to.be.false;
      expect(() => KindOfQuantity.assertIsKindOfQuantity(testPhenomenon)).to.throw();
    });

    it("KindOfQuantity type should work with getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestKindOfQuantity", KindOfQuantity)).to.be.instanceof(KindOfQuantity);
      expect(ecSchema.getItemSync("TestKindOfQuantity", KindOfQuantity)).to.be.instanceof(KindOfQuantity);
    });

    it("KindOfQuantity type should reject for other item types on getItem/Sync", async () => {
      expect(await ecSchema.getItem("TestPhenomenon", KindOfQuantity)).to.be.undefined;
      expect(ecSchema.getItemSync("TestPhenomenon", KindOfQuantity)).to.be.undefined;
    });
  });

  describe("deserialization", () => {
    let context: SchemaContext;
    let schema: Schema;
    beforeEach(() => {
      context = new SchemaContext();
      schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 2, 3);
      context.addLocater(new TestSchemaLocater());
    });

    const validFullKOQProps = {
      ...baseJson,
      relativeError: 1.234,
      persistenceUnit: "Formats.IN",
      presentationUnits: [
        "Formats.DefaultReal[Formats.IN]",
      ],
    };
    it("async - should successfully deserialize", async () => {
      schema = await Schema.fromJson(createSchemaJson(validFullKOQProps), context);
      const testKoq = await schema.getItem(validFullKOQProps.name, KindOfQuantity);
      assert.isDefined(testKoq);
      expect(testKoq!.name).eq("TestKindOfQuantity");
      expect(testKoq!.fullName).eq("TestSchema.TestKindOfQuantity");
      expect(testKoq!.label).eq("SomeDisplayLabel");
      expect(testKoq!.description).eq("A really long description...");
      expect(testKoq!.relativeError).eq(1.234);
      expect(testKoq!.persistenceUnit!.name).eq("IN");

      expect(testKoq!.presentationFormats).exist;
      expect(testKoq!.presentationFormats.length).eq(1);

      expect(testKoq!.defaultPresentationFormat!.name).eq("Formats.DefaultReal[Formats.IN]");
      expect(testKoq!.presentationFormats[0].name).eq("Formats.DefaultReal[Formats.IN]");
    });

    const koqNoPresUnits = {
      ...baseJson,
      persistenceUnit: "Formats.IN",
      relativeError: 1.234,
    };
    it("async - should successfully deserialize without presentationUnits", async () => {
      schema = await Schema.fromJson(createSchemaJson(koqNoPresUnits), context);
      const testKoq = await schema.getItem(koqNoPresUnits.name, KindOfQuantity);
      assert.isDefined(testKoq);

      expect(testKoq!.relativeError).eq(1.234);
      expect(testKoq!.presentationFormats.length).eq(0);
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
      await expect(Schema.fromJson(createSchemaJson(presentationUnitsNonExistentFormat), context)).to.be.rejectedWith(ECSchemaError, `Unable to locate SchemaItem TestSchema.NonexistentFormat.`);
    });
    it("sync - should throw for presentationUnit having a non-existent format", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(presentationUnitsNonExistentFormat), context), ECSchemaError, `Unable to locate SchemaItem TestSchema.NonexistentFormat.`);
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
      await expect(Schema.fromJson(createSchemaJson(persistenceUnitNonExistentFormat), context)).to.be.rejectedWith(ECSchemaError, `Unable to locate SchemaItem TestSchema.NonexistentFormat.`);
    });
    it("sync - should throw for persistenceUnit having a non-existent format", () => {
      assert.throws(() => Schema.fromJsonSync(createSchemaJson(persistenceUnitNonExistentFormat), context), ECSchemaError, `Unable to locate SchemaItem TestSchema.NonexistentFormat.`);
    });

    // should deserialize for persistenceUnit with InvertedUnit
    const persistenceUnitInvertedUnit = {
      ...baseJson,
      relativeError: 4,
      persistenceUnit: "Formats.HORIZONTAL_PER_VERTICAL",
    };
    it("async - should successfully deserialize with persistenceUnit having an InvertedUnit", async () => {
      schema = await Schema.fromJson(createSchemaJson(persistenceUnitInvertedUnit), context);
      const testKoq = await schema.getItem(persistenceUnitInvertedUnit.name, KindOfQuantity);
      assert.isDefined(testKoq);

      expect(testKoq!.persistenceUnit).exist;
      expect(testKoq!.persistenceUnit!.name).eq("HORIZONTAL_PER_VERTICAL");
    });

    it("sync - should successfully deserialize with persistenceUnit having an InvertedUnit", () => {
      schema = Schema.fromJsonSync(createSchemaJson(persistenceUnitInvertedUnit), context);
      const testKoq = schema.getItemSync(persistenceUnitInvertedUnit.name, KindOfQuantity);
      assert.isDefined(testKoq);

      expect(testKoq!.persistenceUnit).exist;
      expect(testKoq!.persistenceUnit!.name).eq("HORIZONTAL_PER_VERTICAL");
    });
  });

  describe("format overrides", () => {
    let schema: Schema;
    let context: SchemaContext;
    beforeEach(() => {
      context = new SchemaContext();
      schema = new Schema(context, "TestSchema", "ts", 1, 2, 3);
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
      const testKoq = await schema.getItem("TestKindOfQuantity", KindOfQuantity);
      assert.isDefined(testKoq);

      expect(testKoq!.presentationFormats.length).eq(3);
      const defaultFormat = await testKoq!.defaultPresentationFormat;
      assert.isDefined(defaultFormat);
      assert.isTrue(OverrideFormat.isOverrideFormat(defaultFormat));

      assert.notEqual(defaultFormat, await schema.lookupItem((defaultFormat as OverrideFormat).parent.key.fullName, Format), "The format in the KOQ should be different than the one in the schema");

      expect(defaultFormat!.precision).eq(DecimalPrecision.Two);

      const expectedJson = {
        parent: "Formats.DefaultReal",
        schemaItemType: "Format",
        type: "Decimal",
        precision: 2,
      };
      expect(JSON.parse(JSON.stringify((defaultFormat as OverrideFormat)?.getFormatProps()))).to.be.deep.equal({name: "Formats.DefaultReal(2)", ...expectedJson});

      expect((await testKoq!.presentationFormats[0]).precision).eq(DecimalPrecision.Two);
      expect(JSON.parse(JSON.stringify((testKoq!.presentationFormats[0] as OverrideFormat).getFormatProps()))).to.be.deep.equal({name: "Formats.DefaultReal(2)", ...expectedJson});

      expect((await testKoq!.presentationFormats[1]).precision).eq(DecimalPrecision.Three);
      expectedJson.precision = 3;
      expect(JSON.parse(JSON.stringify((testKoq!.presentationFormats[1] as OverrideFormat).getFormatProps()))).to.be.deep.equal({name: "Formats.DefaultReal(3)", ...expectedJson});

      expect((await testKoq!.presentationFormats[2]).precision).eq(DecimalPrecision.Four);
      expectedJson.precision = 4;
      expect(JSON.parse(JSON.stringify((testKoq!.presentationFormats[2] as OverrideFormat).getFormatProps()))).to.be.deep.equal({name: "Formats.DefaultReal(4)", ...expectedJson});

      expect(testKoq!.presentationFormats[0].name).eq("Formats.DefaultReal(2)");
      expect(testKoq!.presentationFormats[0].fullName).eq("Formats.DefaultReal(2)");
      expect(testKoq!.presentationFormats[1].name).eq("Formats.DefaultReal(3)");
      expect(testKoq!.presentationFormats[1].fullName).eq("Formats.DefaultReal(3)");
      expect(testKoq!.presentationFormats[2].name).eq("Formats.DefaultReal(4)");
      expect(testKoq!.presentationFormats[2].fullName).eq("Formats.DefaultReal(4)");
    });
    it("sync - precision override", async () => {
      schema = Schema.fromJsonSync(createSchemaJson(precisionOverride), context);
      const testKoq = schema.getItemSync("TestKindOfQuantity", KindOfQuantity);
      assert.isDefined(testKoq);

      expect(testKoq!.presentationFormats.length).to.eq(3);
      const defaultFormat = await testKoq!.defaultPresentationFormat;
      assert.isDefined(defaultFormat);
      assert.isTrue(OverrideFormat.isOverrideFormat(defaultFormat));

      assert.notEqual(defaultFormat, schema.lookupItemSync((defaultFormat as OverrideFormat).parent.fullName, Format), "The format in the KOQ should be different than the one in the schema");

      expect(defaultFormat!.precision).eq(DecimalPrecision.Two);

      const expectedJson = {
        parent: "Formats.DefaultReal",
        schemaItemType: "Format",
        type: "Decimal",
        precision: 2,
      };
      expect(JSON.parse(JSON.stringify((defaultFormat as OverrideFormat)?.getFormatProps()))).to.be.deep.equal({name: "Formats.DefaultReal(2)", ...expectedJson});

      expect((await testKoq!.presentationFormats[0]).precision).eq(DecimalPrecision.Two);
      expect(JSON.parse(JSON.stringify((testKoq!.presentationFormats[0] as OverrideFormat).getFormatProps()))).to.be.deep.equal({name: "Formats.DefaultReal(2)", ...expectedJson});

      expect((await testKoq!.presentationFormats[1]).precision).eq(DecimalPrecision.Three);
      expectedJson.precision = 3;
      expect(JSON.parse(JSON.stringify((testKoq!.presentationFormats[1] as OverrideFormat).getFormatProps()))).to.be.deep.equal({name: "Formats.DefaultReal(3)", ...expectedJson});

      expect((await testKoq!.presentationFormats[2]).precision).eq(DecimalPrecision.Four);
      expectedJson.precision = 4;
      expect(JSON.parse(JSON.stringify((testKoq!.presentationFormats[2] as OverrideFormat).getFormatProps()))).to.be.deep.equal({name: "Formats.DefaultReal(4)", ...expectedJson});

      expect(testKoq!.presentationFormats[0].name).eq("Formats.DefaultReal(2)");
      expect(testKoq!.presentationFormats[0].fullName).eq("Formats.DefaultReal(2)");
      expect(testKoq!.presentationFormats[1].name).eq("Formats.DefaultReal(3)");
      expect(testKoq!.presentationFormats[1].fullName).eq("Formats.DefaultReal(3)");
      expect(testKoq!.presentationFormats[2].name).eq("Formats.DefaultReal(4)");
      expect(testKoq!.presentationFormats[2].fullName).eq("Formats.DefaultReal(4)");
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
      const testKoq = await schema.getItem("TestKindOfQuantity", KindOfQuantity);
      assert.isDefined(testKoq);

      expect(testKoq!.presentationFormats.length).to.eq(1);
      const defaultFormat = await testKoq!.defaultPresentationFormat;
      const defaultOverrideFormat: OverrideFormat = defaultFormat as OverrideFormat;
      assert.isDefined(defaultFormat);

      const testFormat = await schema.lookupItem(defaultOverrideFormat.parent.fullName, Format);
      assert.notEqual(defaultFormat, testFormat, "The format in the KOQ should be different than the one in the schema");

      assert.isDefined(defaultFormat!.units);
      expect(defaultFormat!.units!.length).to.eq(1);
      const unitOverride = defaultFormat!.units![0];
      const unitFromSchema = await schema.lookupItem(unitOverride[0].fullName) as Unit;
      assert.strictEqual(await unitOverride[0], unitFromSchema);

      expect(defaultOverrideFormat.precision).to.be.equal(defaultOverrideFormat.parent.precision);

      const expectedJson = {
        name: "Formats.DefaultReal[Formats.IN]",
        parent: "Formats.DefaultReal",
        schemaItemType: "Format",
        type: "Decimal",
        precision: 6,
        composite: {
          units: [{ name: "Formats.IN" }],
        },
      };
      expect(JSON.parse(JSON.stringify((defaultFormat as OverrideFormat)?.getFormatProps()))).to.be.deep.equal(expectedJson);
    });
    it("sync - single unit override", async () => {
      schema = Schema.fromJsonSync(createSchemaJson(singleUnitOverride), context);
      const testKoq = schema.getItemSync("TestKindOfQuantity", KindOfQuantity);
      assert.isDefined(testKoq);

      expect(testKoq!.presentationFormats.length).to.eq(1);
      const defaultFormat = await testKoq!.defaultPresentationFormat;
      assert.isDefined(defaultFormat);

      assert.notEqual(defaultFormat, schema.lookupItemSync((defaultFormat as OverrideFormat).parent.key.fullName, Format), "The format in the KOQ should be different than the one in the schema");

      assert.isDefined(defaultFormat!.units);
      expect(defaultFormat!.units!.length).to.eq(1);
      const unitOverride = defaultFormat!.units![0];
      const unitFromSchema = schema.lookupItemSync(unitOverride[0].fullName) as Unit;
      assert.strictEqual(await unitOverride[0], unitFromSchema);

      const expectedJson = {
        name: "Formats.DefaultReal[Formats.IN]",
        parent: "Formats.DefaultReal",
        schemaItemType: "Format",
        type: "Decimal",
        precision: 6,
        composite: {
          units: [{ name: "Formats.IN" }],
        },
      };
      expect(JSON.parse(JSON.stringify((defaultFormat as OverrideFormat)?.getFormatProps()))).to.be.deep.equal(expectedJson);
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
      const testKoq = await schema.getItem("TestKindOfQuantity", KindOfQuantity);

      assert.isDefined(testKoq);
      expect(testKoq!.presentationFormats.length).to.eq(1);
      const defaultFormat = await testKoq!.defaultPresentationFormat;
      assert.isDefined(defaultFormat);

      assert.isDefined(defaultFormat!.units);
      expect(defaultFormat!.units!.length).to.eq(1);
      const unitOverride = defaultFormat!.units![0];
      const unitFromSchema = await schema.lookupItem(unitOverride[0].fullName) as Unit;
      assert.strictEqual(await unitOverride[0], unitFromSchema);
      expect(unitOverride[1]).to.be.eq(" in");

      const expectedJson = {
        name: "Formats.DefaultReal[Formats.IN| in]",
        parent: "Formats.DefaultReal",
        schemaItemType: "Format",
        type: "Decimal",
        precision: 6,
        composite: {
          units: [{ name: "Formats.IN", label: " in" }],
        },
      };
      expect(JSON.parse(JSON.stringify((defaultFormat as OverrideFormat)?.getFormatProps()))).to.be.deep.equal(expectedJson);
    });
    it("sync - single unit label override", async () => {
      schema = Schema.fromJsonSync(createSchemaJson(singleUnitLabelOverride), context);
      const testKoq = schema.getItemSync("TestKindOfQuantity", KindOfQuantity);

      assert.isDefined(testKoq);
      expect(testKoq!.presentationFormats.length).to.eq(1);
      const defaultFormat = await testKoq!.defaultPresentationFormat;
      assert.isDefined(defaultFormat);

      assert.isDefined(defaultFormat!.units);
      expect(defaultFormat!.units!.length).to.eq(1);
      const unitOverride = defaultFormat!.units![0];
      const unitFromSchema = schema.lookupItemSync(unitOverride[0].fullName) as Unit;
      assert.strictEqual(await unitOverride[0], unitFromSchema);
      expect(unitOverride[1]).to.be.eq(" in");

      const expectedJson = {
        name: "Formats.DefaultReal[Formats.IN| in]",
        parent: "Formats.DefaultReal",
        schemaItemType: "Format",
        type: "Decimal",
        precision: 6,
        composite: {
          units: [{ name: "Formats.IN", label: " in" }],
        },
      };
      expect(JSON.parse(JSON.stringify((defaultFormat as OverrideFormat)?.getFormatProps()))).to.be.deep.equal(expectedJson);

    });
    const nullOrEmptyUnitLabelOverride = {
      ...baseJson,
      relativeError: 4,
      persistenceUnit: "Formats.IN",
      presentationUnits: ["Formats.QuadUnitFormat[Formats.MILE][Formats.YRD|][Formats.FT|'][Formats.IN|in]"],
    };

    const expectedOutputJson = {
      schemaItemType:"Format",
      name:"Formats.QuadUnitFormat[Formats.MILE][Formats.YRD|][Formats.FT|'][Formats.IN|in]",
      parent:"Formats.QuadUnitFormat",
      type:"Decimal",
      precision:6,
      composite: {
        spacer: "-",
        includeZero: false,
        units: [{ name: "Formats.MILE"},{ name: "Formats.YRD", label: "" },{ name: "Formats.FT", label: "'" },{ name: "Formats.IN", label: "in" }],
      },
    };
    it("async - null or empty unit label override", async () => {
      schema = await Schema.fromJson(createSchemaJson(nullOrEmptyUnitLabelOverride), context);
      const testKoq = await schema.getItem("TestKindOfQuantity", KindOfQuantity);

      assert.isDefined(testKoq);
      expect(testKoq!.presentationFormats.length).to.eq(1);
      const defaultFormat = await testKoq!.defaultPresentationFormat;
      assert.isDefined(defaultFormat);

      assert.isDefined(defaultFormat!.units);
      expect(defaultFormat!.units!.length).to.eq(4);

      const expectedOverrides = [undefined, "", "'", "in"];
      let index = 0;
      while (index < 4) {
        const unitOverride = defaultFormat!.units![index];
        const unitFromSchema = await schema.lookupItem(unitOverride[0].fullName) as Unit;
        assert.strictEqual(await unitOverride[0], unitFromSchema);
        expect(unitOverride[1]).to.be.eq(expectedOverrides[index]);
        ++index;
      }
      expect(JSON.parse(JSON.stringify((defaultFormat as OverrideFormat)?.getFormatProps()))).to.be.deep.equal(expectedOutputJson);
    });

    it("sync - null or empty unit label override", async () => {
      schema = Schema.fromJsonSync(createSchemaJson(nullOrEmptyUnitLabelOverride), context);
      const testKoq = await schema.getItem("TestKindOfQuantity", KindOfQuantity);

      assert.isDefined(testKoq);
      expect(testKoq!.presentationFormats.length).to.eq(1);
      const defaultFormat = await testKoq!.defaultPresentationFormat;
      assert.isDefined(defaultFormat);

      assert.isDefined(defaultFormat!.units);
      expect(defaultFormat!.units!.length).to.eq(4);

      const expectedOverrides = [undefined, "", "'", "in"];
      let index = 0;
      while (index < 4) {
        const unitOverride = defaultFormat!.units![index];
        const unitFromSchema = await schema.lookupItem(unitOverride[0].fullName) as Unit;
        assert.strictEqual(await unitOverride[0], unitFromSchema);
        expect(unitOverride[1]).to.be.eq(expectedOverrides[index]);
        ++index;
      }
      expect(JSON.parse(JSON.stringify((defaultFormat as OverrideFormat)?.getFormatProps()))).to.be.deep.equal(expectedOutputJson);
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

      it(`async - ${testName}`, async () => {
        await expect(Schema.fromJson(createSchemaJson(badOverrideString), context)).to.be.rejectedWith(ECSchemaError, expectedErrorMessage);
      });

      it(`sync - ${testName}`, () => {
        assert.throws(() => Schema.fromJsonSync(createSchemaJson(badOverrideString), context), ECSchemaError, expectedErrorMessage);
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

  describe("toJSON", () => {
    let schema: Schema;
    let context: SchemaContext;
    beforeEach(() => {
      context = new SchemaContext();
      schema = new Schema(context, "TestSchema", "ts", 1, 2, 3);
      context.addLocater(new TestSchemaLocater());
    });

    it("should successfully round-trip valid JSON", async () => {
      const koqJson = {
        ...baseJson,
        relativeError: 1.234,
        persistenceUnit: "Formats.IN",
        presentationUnits: [
          "Formats.DefaultReal[Formats.IN]",
        ],
      };
      schema = await Schema.fromJson(createSchemaJson(koqJson), context);
      const testKoq = await schema.getItem(koqJson.name, KindOfQuantity);
      const expectedJson = {
        $schema: ECSchemaNamespaceUris.SCHEMAITEMURL3_2,
        schema: "TestSchema",
        schemaVersion: "01.02.03",
        ...koqJson,
      };
      expect(testKoq).to.exist;
      expect(testKoq!.toJSON(true, true)).to.deep.equal(expectedJson);
    });

    it("should successfully serialize with JSON stringify", async () => {
      const koqJson = {
        ...baseJson,
        relativeError: 1.234,
        persistenceUnit: "Formats.IN",
        presentationUnits: [
          "Formats.DefaultReal[Formats.IN]",
        ],
      };
      schema = await Schema.fromJson(createSchemaJson(koqJson), context);
      const testKoq = await schema.getItem(koqJson.name, KindOfQuantity);
      const expectedJson = {
        schemaItemType: "KindOfQuantity",
        label: "SomeDisplayLabel",
        description: "A really long description...",
        relativeError: 1.234,
        persistenceUnit: "Formats.IN",
        presentationUnits: [
          "Formats.DefaultReal[Formats.IN]",
        ],
      };
      expect(testKoq).to.exist;
      const json = JSON.stringify(testKoq);
      const serialized = JSON.parse(json);
      expect(serialized).to.deep.equal(expectedJson);
    });

    it("should omit presentationUnits if empty", async () => {
      const koqJson = {
        ...baseJson,
        relativeError: 1.234,
        persistenceUnit: "Formats.IN",
        presentationUnits: [],
      };
      schema = await Schema.fromJson(createSchemaJson(koqJson), context);
      const testKoq = await schema.getItem(koqJson.name, KindOfQuantity);
      expect(testKoq!.toJSON(true, true)).to.not.have.property("presentationUnits");
    });
  });

  describe("toXml", () => {
    let schema: Schema;
    let context: SchemaContext;
    const newDom = createEmptyXmlDocument();

    beforeEach(() => {
      context = new SchemaContext();
      schema = new Schema(context, "TestSchema", "ts", 1, 2, 3);
      context.addLocater(new TestSchemaLocater());
    });

    const schemaJson = {
      ...baseJson,
      relativeError: 1.234,
      persistenceUnit: "Formats.IN",
      presentationUnits: [
        "Formats.DoubleUnitFormat",
        "Formats.QuadUnitFormat",
      ],
    };

    it("should properly serialize", async () => {
      schema = await Schema.fromJson(createSchemaJson(schemaJson), context);
      const testKoq = await schema.getItem(schemaJson.name, KindOfQuantity);

      const serialized = await testKoq!.toXml(newDom);
      expect(serialized.nodeName).to.eq("KindOfQuantity");
      expect(serialized.getAttribute("typeName")).to.eq("TestKindOfQuantity");
      expect(serialized.getAttribute("relativeError")).to.eq("1.234");
      expect(serialized.getAttribute("persistenceUnit")).to.eq("f:IN");
      expect(serialized.getAttribute("presentationUnits")).to.eq("f:DoubleUnitFormat;f:QuadUnitFormat");
    });
  });
});
