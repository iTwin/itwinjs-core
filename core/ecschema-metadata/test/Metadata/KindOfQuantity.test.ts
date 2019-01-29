/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as sinon from "sinon";

import { ECObjectsError } from "../../src/Exception";
import { KindOfQuantity } from "../../src/Metadata/KindOfQuantity";
import { OverrideFormat } from "../../src/Metadata/OverrideFormat";
import { Schema } from "../../src/Metadata/Schema";

import { Format } from "../../src/Metadata/Format";
import { SchemaContext } from "../../src/Context";
import { DecimalPrecision } from "../../src/utils/FormatEnums";
import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";
import { TestSchemaLocater } from "../TestUtils/FormatTestHelper";

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

  describe("accept", () => {
    let testKoq: KindOfQuantity;
    let schema: Schema;
    beforeEach(() => {
      schema = new Schema(new SchemaContext(), "TestSchema", 1, 2, 3);
      testKoq = new KindOfQuantity(schema, "TestKindOfQuantity");
    });

    it("should call visitKindOfQuantity on a SchemaItemVisitor object", async () => {
      expect(testKoq).to.exist;
      const mockVisitor = { visitKindOfQuantity: sinon.spy() };
      await testKoq.accept(mockVisitor);
      expect(mockVisitor.visitKindOfQuantity.calledOnce).to.be.true;
      expect(mockVisitor.visitKindOfQuantity.calledWithExactly(testKoq)).to.be.true;
    });

    it("should safely handle a SchemaItemVisitor without visitKindOfQuantity defined", async () => {
      expect(testKoq).to.exist;
      await testKoq.accept({});
    });
  });

  describe("deserialization", () => {
    let context: SchemaContext;
    let schema: Schema;
    beforeEach(() => {
      context = new SchemaContext();
      schema = new Schema(new SchemaContext(), "TestSchema", 1, 2, 3);
      context.addLocater(new TestSchemaLocater());
    });
    it("should successfully deserialize valid JSON", async () => {
      const koqProps = {
        ...baseJson,
        relativeError: 1.234,
        persistenceUnit: "Formats.DefaultReal",
        presentationUnits: [
          "Formats.IN",
          "Formats.DefaultReal",
        ],
      };
      schema = await Schema.fromJson(createSchemaJson(koqProps), context);
      const testKoq = await schema.getItem<KindOfQuantity>(koqProps.name);

      expect(testKoq!).to.exist;
      expect(testKoq!.name).to.eql("TestKindOfQuantity");
      expect(testKoq!.label).to.eql("SomeDisplayLabel");
      expect(testKoq!.description).to.eql("A really long description...");
      expect(testKoq!.relativeError).to.eql(1.234);
      expect(testKoq!.presentationUnits).to.exist;
      expect(testKoq!.presentationUnits!.length).to.eql(2);

      expect(testKoq!.defaultPresentationFormat!.name).to.equal("IN");
      expect(testKoq!.presentationUnits![0].name).to.equal("IN");
      expect(testKoq!.presentationUnits![1].name).to.equal("DefaultReal");
      expect(testKoq!.persistenceUnit!.name).to.equal("DefaultReal");
    });

    it("should successfully deserialize valid JSON (without presentationUnits)", async () => {
      const koqJson = {
        ...baseJson,
        persistenceUnit: "Formats.IN",
        relativeError: 1.234,
      };
      schema = await Schema.fromJson(createSchemaJson(koqJson), context);
      const testKoq = await schema.getItem<KindOfQuantity>(koqJson.name);

      expect(testKoq!.name).to.eql("TestKindOfQuantity");
      expect(testKoq!.label).to.eql("SomeDisplayLabel");
      expect(testKoq!.description).to.eql("A really long description...");
      expect(testKoq!.relativeError).to.eql(1.234);
      expect(testKoq!.presentationUnits).to.exist;
      expect(testKoq!.presentationUnits!.length).to.eql(0);
      expect(testKoq!.defaultPresentationFormat).to.not.exist;

      const testUnit = await schema.lookupItem(koqJson.persistenceUnit);
      expect(testUnit).to.exist;
      expect(testKoq!.persistenceUnit!.fullName).to.eql(testUnit!.key.fullName); // Formats.IN === Formats.IN
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

    // relativeError override
    const relativeErrorOverride = {
      ...baseJson,
      relativeError: 4,
      persistenceUnit: "Formats.IN",
      presentationUnits: [
        "Formats.DefaultReal(2)",
        "Formats.DefaultReal(3,)",
        "Formats.DefaultReal(4,,)",
      ],
    };
    it("async - relativeError override", async () => {
      schema = await Schema.fromJson(createSchemaJson(relativeErrorOverride), context);
      const testKoq = await schema.getItem<KindOfQuantity>("TestKindOfQuantity");

      assert.isDefined(testKoq);
      expect(testKoq!.presentationUnits!.length).to.eql(3);
      const defaultFormat = testKoq!.defaultPresentationFormat;
      assert.isDefined(defaultFormat);
      assert.isTrue(defaultFormat instanceof OverrideFormat);

      assert.notEqual(defaultFormat, await schema.lookupItem<Format>((defaultFormat as OverrideFormat).parent.key.fullName), "The format in the KOQ should be different than the one in the schema");

      expect(defaultFormat!.precision).eql(DecimalPrecision.Two);

      expect(testKoq!.presentationUnits![1].precision).eql(3);
      expect(testKoq!.presentationUnits![2].precision).eql(4);
    });
    it("sync - relativeError override", () => {
      schema = Schema.fromJsonSync(createSchemaJson(relativeErrorOverride), context);
      const testKoq = schema.getItemSync<KindOfQuantity>("TestKindOfQuantity");

      assert.isDefined(testKoq);
      expect(testKoq!.presentationUnits!.length).to.eql(3);
      const defaultFormat = testKoq!.defaultPresentationFormat;
      assert.isDefined(defaultFormat);

      assert.notEqual(defaultFormat, schema.lookupItemSync<Format>((defaultFormat as OverrideFormat).parent.key.fullName), "The format in the KOQ should be different than the one in the schema");

      expect(defaultFormat!.precision).eql(DecimalPrecision.Two);

      expect(testKoq!.presentationUnits![1].precision).eql(3);
      expect(testKoq!.presentationUnits![2].precision).eql(4);
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
      expect(testKoq!.presentationUnits!.length).to.eql(1);
      const defaultFormat = await testKoq!.defaultPresentationFormat;
      const defaultOverrideFormat: OverrideFormat = defaultFormat as OverrideFormat;
      assert.isDefined(defaultFormat);

      const testFormat = await schema.lookupItem<Format>(defaultOverrideFormat.parent.key.fullName);
      assert.notEqual(defaultFormat, testFormat, "The format in the KOQ should be different than the one in the schema");

      assert.isDefined(defaultFormat!.units);
      expect(defaultFormat!.units!.length).to.eql(1);
      const unitOverride = defaultFormat!.units![0];
      const unitFromSchema = await schema.lookupItem(unitOverride[0].key.schemaName + "." + unitOverride[0].name);
      assert.equal(await unitOverride[0], unitFromSchema);
      assert.isUndefined(unitOverride[1]);
    });
    it("sync - single unit override", () => {
      schema = Schema.fromJsonSync(createSchemaJson(singleUnitOverride), context);
      const testKoq = schema.getItemSync<KindOfQuantity>("TestKindOfQuantity");

      assert.isDefined(testKoq);
      expect(testKoq!.presentationUnits!.length).to.eql(1);
      const defaultFormat = testKoq!.defaultPresentationFormat;
      assert.isDefined(defaultFormat);

      assert.notEqual(defaultFormat, schema.lookupItemSync<Format>((defaultFormat as OverrideFormat).parent.key.fullName), "The format in the KOQ should be different than the one in the schema");

      assert.isDefined(defaultFormat!.units);
      expect(defaultFormat!.units!.length).to.eql(1);
      const unitOverride = defaultFormat!.units![0];
      const unitFromSchema = schema.lookupItemSync(unitOverride[0].key.schemaName + "." + unitOverride[0].name);
      assert.equal(unitOverride[0], unitFromSchema);
      assert.isUndefined(unitOverride[1]);
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
      expect(testKoq!.presentationUnits!.length).to.eql(1);
      const defaultFormat = testKoq!.defaultPresentationFormat;
      assert.isDefined(defaultFormat);

      assert.isDefined(defaultFormat!.units);
      expect(defaultFormat!.units!.length).to.eql(1);
      const unitOverride = defaultFormat!.units![0];
      const unitFromSchema = await schema.lookupItem(unitOverride[0].key.schemaName + "." + unitOverride[0].name);
      assert.equal(await unitOverride[0], unitFromSchema);
      expect(unitOverride[1]).to.be.eql(" in");
    });
    it("sync - single unit label override", () => {
      schema = Schema.fromJsonSync(createSchemaJson(singleUnitLabelOverride), context);
      const testKoq = schema.getItemSync<KindOfQuantity>("TestKindOfQuantity");

      assert.isDefined(testKoq);
      expect(testKoq!.presentationUnits!.length).to.eql(1);
      const defaultFormat = testKoq!.defaultPresentationFormat;
      assert.isDefined(defaultFormat);

      assert.isDefined(defaultFormat!.units);
      expect(defaultFormat!.units!.length).to.eql(1);
      const unitOverride = defaultFormat!.units![0];
      const unitFromSchema = schema.lookupItemSync(unitOverride[0].key.schemaName + "." + unitOverride[0].name);
      assert.equal(unitOverride[0], unitFromSchema);
      expect(unitOverride[1]).to.be.eql(" in");
    });

    // TODO add tests for all # of overrides

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
    // testInvalidFormatStrings("should throw for invalid override string without any overrides", "Formats.DefaultReal()", "");
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

    it("should successfully deserialize valid JSON", async () => {
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

      const koqSerialization = testKoq!.toJson(true, true);
      assert.isDefined(koqSerialization);
      expect(koqSerialization.name).to.eql("TestKindOfQuantity");
      expect(koqSerialization.label).to.eql("SomeDisplayLabel");
      expect(koqSerialization.description).to.eql("A really long description...");
      expect(koqSerialization.relativeError).to.eql(1.234);
      expect(koqSerialization.presentationUnits).to.exist;
      expect(koqSerialization.presentationUnits.length).to.eql(2);
      expect(koqSerialization.presentationUnits[0]).to.eql("IN");
      expect(koqSerialization.presentationUnits[1]).to.eql("DefaultReal");
      expect(koqSerialization.persistenceUnit).to.eql("Formats.DefaultReal");
    });
  });
});
