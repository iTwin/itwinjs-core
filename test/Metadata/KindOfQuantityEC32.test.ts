/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as sinon from "sinon";

import { createSchemaJsonWithItems } from "../TestUtils/DeserializationHelpers";
import { TestSchemaLocater } from "../TestUtils/FormatTestHelper";

import { ECObjectsError } from "../../source/Exception";
import KindOfQuantityEC32 from "../../source/Metadata/KindOfQuantityEC32";
import Schema from "../../source/Metadata/Schema";

import Unit from "../../source/Metadata/Unit";
import Format from "../../source/Metadata/Format";
import { SchemaContext, DecimalPrecision } from "../../source";

describe("KindOfQuantity EC3.2", () => {
  before(() => {
    Schema.ec32 = true;
  });
  after(() => {
    Schema.ec32 = false;
  });

  describe("accept", () => {
    const schema = new Schema("TestSchema", 1, 0, 0);
    let testKoq: KindOfQuantityEC32;

    beforeEach(() => {
      testKoq = new KindOfQuantityEC32(schema, "TestKindOfQuantity");
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
    beforeEach(() => {
      context = new SchemaContext();

      // contains the Formats schema
      context.addLocater(new TestSchemaLocater());
    });

    function createSchemaJson(koq: any) {
      return createSchemaJsonWithItems({
        TestKoQ: {
          schemaItemType: "KindOfQuantity",
          ...koq,
        },
      }, true, {
        references: [
          {
            name: "Formats",
            version: "1.0.0",
          },
        ],
      });
    }

    const fullDefinedJson = createSchemaJson({
      precision: 5,
      persistenceUnit: "Formats.IN",
      presentationUnits: [
        "Formats.DefaultReal",
      ],
    });
    it("async - should succeed with fully defined", async () => {
      const ecSchema = await Schema.fromJson(fullDefinedJson, context);
      assert.isDefined(ecSchema);

      const testItem = await ecSchema.getItem("testKoQ");
      assert.isTrue(testItem instanceof KindOfQuantityEC32);
      const koq: KindOfQuantityEC32 = testItem as KindOfQuantityEC32;
      assert.isDefined(koq);

      expect(koq.precision).equal(5);

      assert.isDefined(koq.persistenceUnit);
      const schemaPersistenceUnit = await ecSchema.getItem<Unit>("Formats.IN", true);
      assert.equal(schemaPersistenceUnit, await koq.persistenceUnit);

      assert.isDefined(koq.presentationUnits);
      expect(koq.presentationUnits!.length).to.eql(1);
      for (const lazyFormat of koq.presentationUnits!) {
        const schemaFormat = await ecSchema.getItem<Format>("Formats.DefaultReal", true);
        const koqFormat = await lazyFormat;
        assert.isTrue(schemaFormat === koqFormat);
      }
    });
    it("sync - should succeed with fully defined", () => {
      const ecSchema = Schema.fromJsonSync(fullDefinedJson, context);
      assert.isDefined(ecSchema);

      const testItem = ecSchema.getItemSync("testKoQ");
      assert.isTrue(testItem instanceof KindOfQuantityEC32);
      const koq: KindOfQuantityEC32 = testItem as KindOfQuantityEC32;
      assert.isDefined(koq);

      expect(koq.precision).equal(5);

      assert.isDefined(koq.persistenceUnit);
      const schemaPersistenceUnit = ecSchema.getItemSync<Unit>("Formats.IN", true);
      assert.equal(schemaPersistenceUnit, ecSchema.getItemSync<Unit>(koq.persistenceUnit!.schemaName + "." + koq.persistenceUnit!.name, true));

      assert.isDefined(koq.presentationUnits);
      expect(koq.presentationUnits!.length).to.eql(1);
      // Can't do this portion of the test because need to wait to resolve the format....
      // for (const lazyFormat of koq.presentationUnits!) {
      //   const schemaFormat = ecSchema.getItemSync<Format>("Formats.DefaultReal", true);
      //   assert.equal(schemaFormat, ecSchema.getItemSync<Format>(lazyFormat.key.schemaName + "." + lazyFormat.name, true));
      // }
    });

    // should throw for missing persistenceUnit
    const missingPersistenceUnit = createSchemaJson({
      precision: 5,
    });
    it("async - should throw for missing persistenceUnit", async () => {
      await expect(Schema.fromJson(missingPersistenceUnit, context)).to.be.rejectedWith(ECObjectsError, `The KindOfQuantity TestKoQ is missing the required attribute 'persistenceUnit'.`);
    });
    it("sync - should throw for missing persistenceUnit", () => {
      assert.throws(() => Schema.fromJsonSync(missingPersistenceUnit, context), ECObjectsError, `The KindOfQuantity TestKoQ is missing the required attribute 'persistenceUnit'.`);
    });

    // shoudl throw for not found persistenceUnit
    const badPersistenceUnit = createSchemaJson({
      precision: 4,
      persistenceUnit: "TestSchema.BadUnit",
    });
    it("async - should throw when persistenceUnit not found", async () => {
      await expect(Schema.fromJson(badPersistenceUnit, context)).to.be.rejectedWith(ECObjectsError, `The SchemaItem BadUnit does not exist.`);
    });
    it("sync - should throw when persistenceUnit not found", () => {
      assert.throws(() => Schema.fromJsonSync(badPersistenceUnit, context), ECObjectsError, `The SchemaItem BadUnit does not exist.`);
    });

    // should throw for presentationUnits not an array or string
    const invalidPresentationUnits = createSchemaJson({
      precision: 5,
      persistenceUnit: "Formats.IN",
      presentationUnits: 5,
    });
    it("async - should throw for presentationUnits not an array or string", async () => {
      await expect(Schema.fromJson(invalidPresentationUnits, context)).to.be.rejectedWith(ECObjectsError, `The Kind Of Quantity TestKoQ has an invalid 'presentationUnits' attribute. It should be of type 'string' or 'string[]'.`);
    });
    it("sync - should throw for presentationUnits not an array or string", () => {
      assert.throws(() => Schema.fromJsonSync(invalidPresentationUnits, context), ECObjectsError,  `The Kind Of Quantity TestKoQ has an invalid 'presentationUnits' attribute. It should be of type 'string' or 'string[]'.`);
    });

    // invalid presentation format
    const formatNonExistent = createSchemaJson({
      precision: 4,
      persistenceUnit: "Formats.IN",
      presentationUnits: [
        "TestSchema.NonexistentFormat",
      ],
    });
    it("async - should throw for presentationUnit having a non-existent format", async () => {
      await expect(Schema.fromJson(formatNonExistent, context)).to.be.rejectedWith(ECObjectsError, `The SchemaItem NonexistentFormat does not exist.`);
    });
    it("sync - should throw for presentationUnit having a non-existent format", () => {
      assert.throws(() => Schema.fromJsonSync(formatNonExistent, context), ECObjectsError,  `The SchemaItem NonexistentFormat does not exist.`);
    });

    describe("format overrides", () => {
      // precision override
      const precisionOverride = createSchemaJson({
        precision: 4,
        persistenceUnit: "Formats.IN",
        presentationUnits: [
          "Formats.DefaultReal(2)",
          "Formats.DefaultReal(3,)",
          "Formats.DefaultReal(4,,)",
        ],
      });
      it("async - precision override", async () => {
        const schema = await Schema.fromJson(precisionOverride, context);
        const testKoQItem = await schema.getItem<KindOfQuantityEC32>("TestKoQ");

        assert.isDefined(testKoQItem);
        expect(testKoQItem!.presentationUnits!.length).to.eql(3);
        const defaultFormat = testKoQItem!.defaultPresentationFormat;
        assert.isDefined(defaultFormat);

        assert.notEqual(defaultFormat, await schema.getItem<Format>(defaultFormat!.key.schemaName + "." + defaultFormat!.name), "The format in the KOQ should be different than the one in the schema");

        expect(defaultFormat!.precision).eql(DecimalPrecision.Two);

        expect(testKoQItem!.presentationUnits![1].precision).eql(3);
        expect(testKoQItem!.presentationUnits![2].precision).eql(4);
      });
      it("sync - precision override", () => {
        const schema = Schema.fromJsonSync(precisionOverride, context);
        const testKoQItem = schema.getItemSync<KindOfQuantityEC32>("TestKoQ");

        assert.isDefined(testKoQItem);
        expect(testKoQItem!.presentationUnits!.length).to.eql(3);
        const defaultFormat = testKoQItem!.defaultPresentationFormat;
        assert.isDefined(defaultFormat);

        assert.notEqual(defaultFormat, schema.getItemSync<Format>(defaultFormat!.key.schemaName + "." + defaultFormat!.name), "The format in the KOQ should be different than the one in the schema");

        expect(defaultFormat!.precision).eql(DecimalPrecision.Two);

        expect(testKoQItem!.presentationUnits![1].precision).eql(3);
        expect(testKoQItem!.presentationUnits![2].precision).eql(4);
      });

      // single unit override
      const singleUnitOverride = createSchemaJson({
        precision: 4,
        persistenceUnit: "Formats.IN",
        presentationUnits: [
          "Formats.DefaultReal[Formats.IN]",
        ],
      });
      it("async - single unit override", async () => {
        const schema = await Schema.fromJson(singleUnitOverride, context);
        const testKoQItem = await schema.getItem<KindOfQuantityEC32>("TestKoQ");

        assert.isDefined(testKoQItem);
        expect(testKoQItem!.presentationUnits!.length).to.eql(1);
        const defaultFormat = await testKoQItem!.defaultPresentationFormat;
        assert.isDefined(defaultFormat);

        assert.notEqual(defaultFormat, await schema.getItem<Format>(defaultFormat!.key.schemaName + "." + defaultFormat!.name), "The format in the KOQ should be different than the one in the schema");

        assert.isDefined(defaultFormat!.composite);
        assert.isDefined(defaultFormat!.composite!.units);
        expect(defaultFormat!.composite!.units!.length).to.eql(1);
        const unitOverride = defaultFormat!.composite!.units![0];
        const unitFromSchema = await schema.getItem(unitOverride[0].key.schemaName + "." + unitOverride[0].name, true);
        assert.equal(await unitOverride[0], unitFromSchema);
        assert.isUndefined(unitOverride[1]);
      });
      it("sync - single unit override", () => {
        const schema = Schema.fromJsonSync(singleUnitOverride, context);
        const testKoQItem = schema.getItemSync<KindOfQuantityEC32>("TestKoQ");

        assert.isDefined(testKoQItem);
        expect(testKoQItem!.presentationUnits!.length).to.eql(1);
        const defaultFormat = testKoQItem!.defaultPresentationFormat;
        assert.isDefined(defaultFormat);

        assert.notEqual(defaultFormat, schema.getItemSync<Format>(defaultFormat!.key.schemaName + "." + defaultFormat!.name, true), "The format in the KOQ should be different than the one in the schema");

        assert.isDefined(defaultFormat!.composite);
        assert.isDefined(defaultFormat!.composite!.units);
        expect(defaultFormat!.composite!.units!.length).to.eql(1);
        const unitOverride = defaultFormat!.composite!.units![0];
        const unitFromSchema = schema.getItemSync(unitOverride[0].key.schemaName + "." + unitOverride[0].name, true);
        assert.equal(unitOverride[0], unitFromSchema);
        assert.isUndefined(unitOverride[1]);
      });

      // single unit label override
      const singleUnitLabelOverride = createSchemaJson({
        precision: 4,
        persistenceUnit: "Formats.IN",
        presentationUnits: [
          "Formats.DefaultReal[Formats.IN| in]",
        ],
      });
      it("async - single unit label override", async () => {
        const schema = await Schema.fromJson(singleUnitLabelOverride, context);
        const testKoQItem = await schema.getItem<KindOfQuantityEC32>("TestKoQ");

        assert.isDefined(testKoQItem);
        expect(testKoQItem!.presentationUnits!.length).to.eql(1);
        const defaultFormat = testKoQItem!.defaultPresentationFormat;
        assert.isDefined(defaultFormat);

        assert.isDefined(defaultFormat!.composite);
        assert.isDefined(defaultFormat!.composite!.units);
        expect(defaultFormat!.composite!.units!.length).to.eql(1);
        const unitOverride = defaultFormat!.composite!.units![0];
        const unitFromSchema = await schema.getItem(unitOverride[0].key.schemaName + "." + unitOverride[0].name, true);
        assert.equal(await unitOverride[0], unitFromSchema);
        expect(unitOverride[1]).to.be.eql(" in");
      });
      it("sync - single unit label override", () => {
        const schema = Schema.fromJsonSync(singleUnitLabelOverride, context);
        const testKoQItem = schema.getItemSync<KindOfQuantityEC32>("TestKoQ");

        assert.isDefined(testKoQItem);
        expect(testKoQItem!.presentationUnits!.length).to.eql(1);
        const defaultFormat = testKoQItem!.defaultPresentationFormat;
        assert.isDefined(defaultFormat);

        assert.isDefined(defaultFormat!.composite);
        assert.isDefined(defaultFormat!.composite!.units);
        expect(defaultFormat!.composite!.units!.length).to.eql(1);
        const unitOverride = defaultFormat!.composite!.units![0];
        const unitFromSchema = schema.getItemSync(unitOverride[0].key.schemaName + "." + unitOverride[0].name, true);
        assert.equal(unitOverride[0], unitFromSchema);
        expect(unitOverride[1]).to.be.eql(" in");
      });

      // TODO add tests for all # of overrides

      // failure cases
      function testInvalidFormatStrings(testName: string, formatString: string, expectedErrorMessage: string) {
        const badOverrideString = createSchemaJson({
          precision: 4,
          persistenceUnit: "Formats.IN",
          presentationUnits: [
            formatString,
          ],
        });

        it("async - " + testName, async () => {
          await expect(Schema.fromJson(badOverrideString, context)).to.be.rejectedWith(ECObjectsError, expectedErrorMessage);
        });

        it("sync - " + testName, () => {
          assert.throws(() => Schema.fromJsonSync(badOverrideString, context), ECObjectsError, expectedErrorMessage);
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

      // number of unit overrides does not match the number in the composite
      const incorrectNumUnit = createSchemaJson({
        precision: 4,
        persistenceUnit: "Formats.IN",
        presentationUnits: [
          "Formats.SingleUnitFormat",
        ],
      });
      it("async - should throw for format override with a different number of unit", async () => {
        await expect(Schema.fromJson(incorrectNumUnit, context)).to.be.rejectedWith(ECObjectsError, `Cannot add presetantion format to KindOfQuantity 'TestKoQ' because the number of unit overrides is inconsistent with the number in the Format 'SingleUnitFormat'.`);
      });
      it("sync - should throw for format override with a different number of unit", () => {
        assert.throws(() => Schema.fromJsonSync(incorrectNumUnit, context), ECObjectsError,  `Cannot add presetantion format to KindOfQuantity 'TestKoQ' because the number of unit overrides is inconsistent with the number in the Format 'SingleUnitFormat'.`);
      });
    });
  });
});
