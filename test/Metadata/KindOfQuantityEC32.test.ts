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
import { SchemaContext } from "../../source";

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

    describe("format overrides", () => {

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

      // single unit override
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
        const defaultFormat = await testKoQItem!.defaultPresentationFormat;
        assert.isDefined(defaultFormat);

        assert.isDefined(defaultFormat!.composite);
        assert.isDefined(defaultFormat!.composite!.units);
        expect(defaultFormat!.composite!.units!.length).to.eql(1);
        const unitOverride = defaultFormat!.composite!.units![0];
        const unitFromSchema = await schema.getItem(unitOverride[0].key.schemaName + "." + unitOverride[0].name, true);
        assert.equal(await unitOverride[0], unitFromSchema);
        expect(unitOverride[1]).to.be.eql(" in");
      });

    });
  });

  describe("Async FormatString Tests", () => {
    it("Three overrides", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          ExampleKoQ: {
            schemaItemType: "KindOfQuantity",
            precision: 3,
            persistenceUnit: "TestSchema.MM",
            presentationUnits: [
              "TestSchema.DefaultReal[TestSchema.IN| in][TestSchema.CM| centi][TestSchema.KM| kilo]",
            ],
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          Imperial: {
            schemaItemType: "UnitSystem",
          },
          MM: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*M",
          },
          CM: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[CENTI]*M",
          },
          KM: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[KILO]*M",
          },
          IN: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Imperial",
            definition: "inch(es)",
          },
          DefaultReal: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "-",
              units: [
                {
                  name: "TestSchema.IN",
                  label: "inch(es)",
                },
                {
                  name: "TestSchema.CM",
                  label: "cm",
                },
                {
                  name: "TestSchema.KM",
                  label: "km",
                },
              ],
            },
          },
        },
      };
      const ecSchema = await Schema.fromJson(json);
      assert.isDefined(ecSchema);
      const testKoQItem = await ecSchema.getItem<KindOfQuantityEC32>("ExampleKoQ");
      const testFormatItem = await ecSchema.getItem<Format>("DefaultReal");
      assert(testKoQItem!.presentationUnits!.length === 1);
      assert(testFormatItem!.precision === 4);
      assert(testFormatItem!.composite!.units!![0]["1"] === " in");
      assert(testFormatItem!.composite!.units!![1]["1"] === " centi");
      assert(testFormatItem!.composite!.units!![2]["1"] === " kilo");
    });
    it("Format name does not exist", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          ExampleKoQ: {
            schemaItemType: "KindOfQuantity",
            precision: 3,
            persistenceUnit: "TestSchema.MM",
            presentationUnits: [
              "TestSchema.DoesNotExist(3)[TestSchema.IN| in]",
            ],
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          Imperial: {
            schemaItemType: "UnitSystem",
          },
          MM: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*M",
          },
          IN: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Imperial",
            definition: "inch(es)",
          },
          DefaultReal: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "-",
              units: [
                {
                  name: "TestSchema.IN",
                  label: "inch(es)",
                },
              ],
            },
          },
        },
      };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(TypeError, `Cannot read property 'schemaItemType' of undefined`);
    });
    it("# Composite Units does not equal # unit overrides in format string", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          ExampleKoQ: {
            schemaItemType: "KindOfQuantity",
            precision: 3,
            persistenceUnit: "TestSchema.MM",
            presentationUnits: "TestSchema.DefaultReal(3)",
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          Imperial: {
            schemaItemType: "UnitSystem",
          },
          MM: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*M",
          },
          IN: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Imperial",
            definition: "inch(es)",
          },
          DefaultReal: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "-",
              units: [
                {
                  name: "TestSchema.IN",
                  label: "inch(es)",
                },
              ],
            },
          },
        },
      };
      expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `Number of unit overrides must match number of units present in Format.`);
    });
    it("Cannot find unit name for override", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          ExampleKoQ: {
            schemaItemType: "KindOfQuantity",
            precision: 3,
            persistenceUnit: "TestSchema.MM",
            presentationUnits: [
              "TestSchema.DefaultReal(3)[TestSchema.INCHES| in]",
            ],
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          Imperial: {
            schemaItemType: "UnitSystem",
          },
          MM: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*M",
          },
          IN: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Imperial",
            definition: "inch(es)",
          },
          DefaultReal: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "-",
              units: [
                {
                  name: "TestSchema.IN",
                  label: "inch(es)",
                },
              ],
            },
          },
        },
      };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(TypeError, "Cannot read property 'schemaItemType' of undefined");
    });
    it("No composite; No precision or unit override", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          ExampleKoQ: {
            schemaItemType: "KindOfQuantity",
            precision: 3,
            persistenceUnit: "TestSchema.MM",
            presentationUnits: [
              "TestSchema.DefaultReal",
            ],
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          Imperial: {
            schemaItemType: "UnitSystem",
          },
          MM: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*M",
          },
          IN: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Imperial",
            definition: "inch(es)",
          },
          DefaultReal: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
          },
        },
      };
      const ecSchema = await Schema.fromJson(json);
      assert.isDefined(ecSchema);
      const testKoQItem = await ecSchema.getItem<KindOfQuantityEC32>("ExampleKoQ");
      assert(testKoQItem!.presentationUnits!.length === 1);
      assert(testKoQItem!.precision === 3);
      const defaultPresForm = await testKoQItem!.defaultPresentationFormat;
      assert(defaultPresForm === await testKoQItem!.presentationUnits![0]);
      assert(defaultPresForm!.name === await testKoQItem!.presentationUnits![0].name);
    });
  });

  describe("Sync FormatString Tests", () => {
    it("Three overrides", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          ExampleKoQ: {
            schemaItemType: "KindOfQuantity",
            precision: 3,
            persistenceUnit: "TestSchema.MM",
            presentationUnits: [
              "TestSchema.DefaultReal[TestSchema.IN| in][TestSchema.CM| centi][TestSchema.KM| kilo]",
            ],
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          Imperial: {
            schemaItemType: "UnitSystem",
          },
          MM: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*M",
          },
          CM: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[CENTI]*M",
          },
          KM: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[KILO]*M",
          },
          IN: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Imperial",
            definition: "inch(es)",
          },
          DefaultReal: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "-",
              units: [
                {
                  name: "TestSchema.IN",
                  label: "inch(es)",
                },
                {
                  name: "TestSchema.CM",
                  label: "cm",
                },
                {
                  name: "TestSchema.KM",
                  label: "km",
                },
              ],
            },
          },
        },
      };
      const ecSchema = await Schema.fromJson(json);
      assert.isDefined(ecSchema);
      const testKoQItem = await ecSchema.getItem<KindOfQuantityEC32>("ExampleKoQ");
      const testFormatItem = await ecSchema.getItem<Format>("DefaultReal");
      assert(testKoQItem!.presentationUnits!.length === 1);
      assert(testFormatItem!.precision === 4);
      assert(testFormatItem!.composite!.units!![0]["1"] === " in");
      assert(testFormatItem!.composite!.units!![1]["1"] === " centi");
      assert(testFormatItem!.composite!.units!![2]["1"] === " kilo");
    });
    it("Format name does not exist", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          ExampleKoQ: {
            schemaItemType: "KindOfQuantity",
            precision: 3,
            persistenceUnit: "TestSchema.MM",
            presentationUnits: [
              "TestSchema.DoesNotExist(3)[TestSchema.IN| in]",
            ],
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          Imperial: {
            schemaItemType: "UnitSystem",
          },
          MM: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*M",
          },
          IN: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Imperial",
            definition: "inch(es)",
          },
          DefaultReal: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "-",
              units: [
                {
                  name: "TestSchema.IN",
                  label: "inch(es)",
                },
              ],
            },
          },
        },
      };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(TypeError, `Cannot read property 'schemaItemType' of undefined`);
    });
    it("# Composite Units does not equal # unit overrides in format string", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          ExampleKoQ: {
            schemaItemType: "KindOfQuantity",
            precision: 3,
            persistenceUnit: "TestSchema.MM",
            presentationUnits: "TestSchema.DefaultReal(3)",
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          Imperial: {
            schemaItemType: "UnitSystem",
          },
          MM: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*M",
          },
          IN: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Imperial",
            definition: "inch(es)",
          },
          DefaultReal: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "-",
              units: [
                {
                  name: "TestSchema.IN",
                  label: "inch(es)",
                },
              ],
            },
          },
        },
      };
      expect(Schema.fromJson(json)).to.be.rejectedWith(ECObjectsError, `Number of unit overrides must match number of units present in Format.`);
    });
    it("Cannot find unit name for override", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          ExampleKoQ: {
            schemaItemType: "KindOfQuantity",
            precision: 3,
            persistenceUnit: "TestSchema.MM",
            presentationUnits: [
              "TestSchema.DefaultReal(3)[TestSchema.INCHES| in]",
            ],
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          Imperial: {
            schemaItemType: "UnitSystem",
          },
          MM: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*M",
          },
          IN: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Imperial",
            definition: "inch(es)",
          },
          DefaultReal: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "-",
              units: [
                {
                  name: "TestSchema.IN",
                  label: "inch(es)",
                },
              ],
            },
          },
        },
      };
      await expect(Schema.fromJson(json)).to.be.rejectedWith(TypeError, "Cannot read property 'schemaItemType' of undefined");
    });
    it("No composite; No precision or unit override", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          ExampleKoQ: {
            schemaItemType: "KindOfQuantity",
            precision: 3,
            persistenceUnit: "TestSchema.MM",
            presentationUnits: [
              "TestSchema.DefaultReal",
            ],
          },
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          Imperial: {
            schemaItemType: "UnitSystem",
          },
          MM: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*M",
          },
          IN: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Imperial",
            definition: "inch(es)",
          },
          DefaultReal: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
          },
        },
      };
      const ecSchema = await Schema.fromJson(json);
      assert.isDefined(ecSchema);
      const testKoQItem = await ecSchema.getItem<KindOfQuantityEC32>("ExampleKoQ");
      assert(testKoQItem!.presentationUnits!.length === 1);
      assert(testKoQItem!.precision === 3);
      const defaultPresForm = await testKoQItem!.defaultPresentationFormat;
      assert(defaultPresForm === await testKoQItem!.presentationUnits![0]);
      assert(defaultPresForm!.name === await testKoQItem!.presentationUnits![0].name);
    });
  });
});
