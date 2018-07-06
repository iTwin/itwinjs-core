/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import Schema from "../../source/Metadata/Schema";
import { ECObjectsError } from "../../source/Exception";
import KindOfQuantityEC32 from "../../source/Metadata/KindOfQuantityEC32";
import KindOfQuantity from "../../source/Metadata/KindOfQuantity";
import * as sinon from "sinon";
import Unit from "../../source/Metadata/Unit";
import Phenomenon from "../../source/Metadata/Phenomenon";
import UnitSystem from "../../source/Metadata/UnitSystem";
import Format from "../../source/Metadata/Format";

describe("KindOfQuantity", () => {
  let testKoQ: KindOfQuantity;
  const schema = new Schema("TestSchema", 1, 0, 0);
  testKoQ = new KindOfQuantity(schema, "TestKindOfQuantity");
  describe("fromJson", () => {
    const baseJson = { schemaItemType: "KindOfQuantity" };
    it("should successfully deserialize valid JSON", async () => {
      const koqJson = {
        ...baseJson,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        precision: 1.234,
        persistenceUnit: { unit: "in", format: "DEFAULTREAL" },
        presentationUnits: [
          { unit: "cm" },
          { unit: "in", format: "anotherFormat" },
        ],
      };
      await testKoQ.fromJson(koqJson);

      expect(testKoQ.name).to.eql("TestKindOfQuantity");
      expect(testKoQ.label).to.eql("SomeDisplayLabel");
      expect(testKoQ.description).to.eql("A really long description...");
      expect(testKoQ.precision).to.eql(1.234);
      expect(testKoQ.presentationUnits).to.exist;
      expect(testKoQ.presentationUnits.length).to.eql(2);
      expect(testKoQ.defaultPresentationUnit).to.eql({ unit: "cm" });
      expect(testKoQ.presentationUnits[0]).to.eql({ unit: "cm" });
      expect(testKoQ.presentationUnits[1]).to.eql({ unit: "in", format: "anotherFormat" });
      expect(testKoQ.persistenceUnit).to.eql({ unit: "in", format: "DEFAULTREAL" });
    });

    it("should successfully deserialize valid JSON (without units)", async () => {
      testKoQ = new KindOfQuantity(schema, "TestKindOfQuantity");
      const koqJson = {
        ...baseJson,
        label: "SomeDisplayLabel",
        description: "A really long description...",
        precision: 1.234,
      };
      await testKoQ.fromJson(koqJson);

      expect(testKoQ.name).to.eql("TestKindOfQuantity");
      expect(testKoQ.label).to.eql("SomeDisplayLabel");
      expect(testKoQ.description).to.eql("A really long description...");
      expect(testKoQ.precision).to.eql(1.234);
      expect(testKoQ.presentationUnits).to.exist;
      expect(testKoQ.presentationUnits.length).to.eql(0);
      expect(testKoQ.defaultPresentationUnit).to.not.exist;
      expect(testKoQ.persistenceUnit).to.not.exist;
    });
    async function testInvalidAttribute(attributeName: string, expectedType: string, value: any) {
      expect(testKoQ).to.exist;
      const json: any = {
        ...baseJson,
        [attributeName]: value,
      };
      await expect(testKoQ.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The KindOfQuantity TestKindOfQuantity has an invalid '${attributeName}' attribute. It should be of type '${expectedType}'.`);
    }

    it("should throw for invalid precision", async () => testInvalidAttribute("precision", "number", false));
    it("should throw for presentationUnits not an array", async () => testInvalidAttribute("presentationUnits", "object[]", 0));
    it("should throw for presentationUnits not an array of objects", async () => testInvalidAttribute("presentationUnits", "object[]", [0]));

    it("should throw for presentationUnit with missing unit", async () => {
      expect(testKoQ).to.exist;
      const json: any = {
        ...baseJson,
        presentationUnits: [{}],
      };
      await expect(testKoQ.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The KindOfQuantity TestKindOfQuantity has a presentationUnit that is missing the required attribute 'unit'.`);
    });

    it("should throw for presentationUnit with invalid unit", async () => {
      expect(testKoQ).to.exist;
      const json: any = {
        ...baseJson,
        presentationUnits: [{ unit: 0 }],
      };
      await expect(testKoQ.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The KindOfQuantity TestKindOfQuantity has a presentationUnit with an invalid 'unit' attribute. It should be of type 'string'.`);
    });

    it("should throw for presentationUnit with invalid format", async () => {
      expect(testKoQ).to.exist;
      const json: any = {
        ...baseJson,
        presentationUnits: [{ unit: "valid", format: false }],
      };
      await expect(testKoQ.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The KindOfQuantity TestKindOfQuantity has a presentationUnit with an invalid 'format' attribute. It should be of type 'string'.`);
    });

    it("should throw for persistenceUnit not an object", async () => testInvalidAttribute("persistenceUnit", "object", 0));

    it("should throw for persistenceUnit with missing unit", async () => {
      expect(testKoQ).to.exist;
      const json: any = {
        ...baseJson,
        persistenceUnit: {},
      };
      await expect(testKoQ.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The KindOfQuantity TestKindOfQuantity has a persistenceUnit that is missing the required attribute 'unit'.`);
    });

    it("should throw for persistenceUnit with invalid unit", async () => {
      expect(testKoQ).to.exist;
      const json: any = {
        ...baseJson,
        persistenceUnit: { unit: 0 },
      };
      await expect(testKoQ.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The KindOfQuantity TestKindOfQuantity has a persistenceUnit with an invalid 'unit' attribute. It should be of type 'string'.`);
    });

    it("should throw for persistenceUnit with invalid format", async () => {
      expect(testKoQ).to.exist;
      const json: any = {
        ...baseJson,
        persistenceUnit: { unit: "valid", format: false },
      };
      await expect(testKoQ.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The KindOfQuantity TestKindOfQuantity has a persistenceUnit with an invalid 'format' attribute. It should be of type 'string'.`);
    });
  });

  describe("Async deserialization", () => {
    it("No presentationFormats", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          M: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*M",
          },
          testKoQ: {
            schemaItemType: "KindOfQuantity",
            precision: 5,
            persistenceUnit: "TestSchema.M",
          },
        },
      };
      Schema.ec32 = true;
      const ecSchema = await Schema.fromJson(testSchema);
      assert.isDefined(ecSchema);
      const testItem = await ecSchema.getItem("testKoQ");
      assert.isDefined(testItem);
      assert.isTrue(testItem instanceof KindOfQuantityEC32);
      const koQTest: KindOfQuantityEC32 = testItem as KindOfQuantityEC32;
      assert.isDefined(koQTest);
      expect(koQTest.precision).equal(5);
      assert.isDefined(koQTest.persistenceUnit);
      const persistenceUnit = koQTest.persistenceUnit;
      expect(persistenceUnit!.name).equal("M");
    });
  });

  describe("Async fromJson", () => {
    const baseJson = { schemaItemType: "KindOfQuantity" };
    async function testInvalidAttribute(attributeName: string, expectedType: string, value: any) {
      expect(testKoQ).to.exist;
      const json: any = {
        ...baseJson,
        precision: 5,
        [attributeName]: value,
      };
      await expect(testKoQ.fromJson(json)).to.be.rejectedWith(ECObjectsError, `The KindOfQuantity TestKindOfQuantity has an invalid '${attributeName}' attribute. It should be of type '${expectedType}'.`);
    }

    it("should throw for invalid precision", async () => testInvalidAttribute("precision", "number", false));
    it("should throw for persistenceUnit not a string", async () => testInvalidAttribute("persistenceUnit", "object", 0));

    it("should throw for presentationUnits not an array or string", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          M: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*M",
          },
          testKoQ: {
            schemaItemType: "KindOfQuantity",
            precision: 5,
            persistenceUnit: "TestSchema.M",
            presentationUnits: 5,
          },
        },
      };
      await expect(Schema.fromJson(testSchema)).to.be.rejectedWith(ECObjectsError, `The Kind Of Quantity testKoQ has an invalid 'presentationUnits' attribute. It should be of type 'string' or 'string[]'.`);
    });

    it("should throw for missing persistenceUnit", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          M: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*M",
          },
          testKoQ: {
            schemaItemType: "KindOfQuantity",
            precision: 5,
          },
        },
      };
      await expect(Schema.fromJson(testSchema)).to.be.rejectedWith(ECObjectsError, `The KindOfQuantity testKoQ is missing the required attribute 'persistenceUnit'.`);
    });
  });

  describe("accept", () => {
    let testKoq: KindOfQuantity;

    beforeEach(() => {
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
  describe("Async DelayedPromise Tests", () => {
    it("should successfully deserialize valid JSON I", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          M: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*M",
          },
        },
      };
      const ecSchema = await Schema.fromJson(json);
      assert.isDefined(ecSchema);
      const testPhenomenonItem = await ecSchema.getItem<Phenomenon>("Length");
      const testUnitSystemItem = await ecSchema.getItem<UnitSystem>("Metric");
      const testUnitItem = await ecSchema.getItem<Unit>("M");
      assert.isDefined(testPhenomenonItem);
      assert.isDefined(testUnitSystemItem);
      assert.isDefined(testUnitItem);
      assert.isTrue(testPhenomenonItem instanceof Phenomenon);
      assert.isTrue(testUnitSystemItem instanceof UnitSystem);
      assert.isTrue(testUnitItem instanceof Unit);
      assert(testPhenomenonItem!.definition === "LENGTH(1)");
      assert(testUnitItem!.phenomenon!.name, testPhenomenonItem!.name);
      assert(testUnitItem!.unitSystem!.name, testUnitSystemItem!.name);
    });
    it("should successfully deserialize valid JSON II", async () => {
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
              "TestSchema.DefaultReal[TestSchema.IN]",
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
      const testUnitItem = await ecSchema.getItem<Unit>("MM");
      const testFormat = await ecSchema.getItem<Format>("DefaultReal");
      const testUnitSystem = await ecSchema.getItem<UnitSystem>("Metric");
      assert.isDefined(testKoQItem);
      assert.isDefined(testUnitItem);
      assert.isDefined(testFormat);
      assert.isDefined(testUnitSystem);
      assert.isTrue(testUnitSystem instanceof UnitSystem);
      assert.isTrue(testKoQItem instanceof KindOfQuantityEC32);
      assert.isTrue(testUnitItem instanceof Unit);
      assert.isTrue(testFormat instanceof Format);
      const testPersistenceUnit = await ecSchema.getItem<Unit>(testKoQItem!.persistenceUnit!.name);
      assert(testPersistenceUnit!.definition, "[MILLI]*M");
      const testUnitSystemItem = await ecSchema.getItem<UnitSystem>(testUnitSystem!.name);
      assert(testUnitSystemItem!.name, testUnitSystem!.name);
    });
  });
  describe("Async FormatString Tests", () => {
    it("One unit override", async () => {
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
              "TestSchema.DefaultReal(3)[TestSchema.IN| in]",
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
      const ecSchema = await Schema.fromJson(json);
      assert.isDefined(ecSchema);
      const testKoQItem = await ecSchema.getItem<KindOfQuantityEC32>("ExampleKoQ");
      const testFormatItem = await ecSchema.getItem<Format>("DefaultReal");
      assert(testKoQItem!.presentationUnits!.length === 1);
      assert(testFormatItem!.composite!.units!![0]["1"] === " in");
      const testFormatFromKoQ = await testKoQItem!.presentationUnits![0];
      assert(testFormatFromKoQ!.precision === 3);
    });
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

  // Sync tests
  describe("Sync deserialization", () => {
    it("No persistenceUnits", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          M: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*M",
          },
          testKoQ: {
            schemaItemType: "KindOfQuantity",
            precision: 5,
            persistenceUnit: "TestSchema.M",
          },
        },
      };
      const ecSchema = Schema.fromJsonSync(testSchema);
      assert.isDefined(ecSchema);
      const testItem = ecSchema.getItemSync("testKoQ");
      assert.isDefined(testItem);
      assert.isTrue(testItem instanceof KindOfQuantityEC32);
      const koQTest: KindOfQuantityEC32 = testItem as KindOfQuantityEC32;
      assert.isDefined(koQTest);
      expect(koQTest.precision).equal(5);
      assert.isDefined(koQTest.persistenceUnit);
      const persistenceUnit = koQTest.persistenceUnit;
      expect(persistenceUnit!.name).equal("M");
    });
  });

  describe("Sync fromJson", () => {
    testKoQ = new KindOfQuantity(schema, "TestKindOfQuantity");

    it("should throw for presentationUnits not an array or string", () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          M: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*M",
          },
          testKoQ: {
            schemaItemType: "KindOfQuantity",
            precision: 5,
            persistenceUnit: "TestSchema.M",
            presentationUnits: 5,
          },
        },
      };
      assert.throws(() => Schema.fromJsonSync(testSchema), ECObjectsError,  `The Kind Of Quantity testKoQ has an invalid 'presentationUnits' attribute. It should be of type 'string' or 'string[]'.`);
    });

    it("should throw for missing persistenceUnit",  () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          M: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*M",
          },
          testKoQ: {
            schemaItemType: "KindOfQuantity",
            precision: 5,
          },
        },
      };
      assert.throws(() => Schema.fromJsonSync(testSchema), ECObjectsError, `The KindOfQuantity testKoQ is missing the required attribute 'persistenceUnit'.`);
    });
  });

  describe("Sync DelayedPromise Tests", () => {
    it("should successfully deserialize valid JSON I", () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
        version: "1.0.0",
        name: "TestSchema",
        items: {
          Length: {
            schemaItemType: "Phenomenon",
            definition: "LENGTH(1)",
          },
          Metric: {
            schemaItemType: "UnitSystem",
          },
          M: {
            schemaItemType: "Unit",
            phenomenon: "TestSchema.Length",
            unitSystem: "TestSchema.Metric",
            definition: "[MILLI]*M",
          },
        },
      };
      const ecSchema = Schema.fromJsonSync(json);
      assert.isDefined(ecSchema);
      const testPhenomenonItem = ecSchema.getItemSync<Phenomenon>("Length");
      const testUnitSystemItem = ecSchema.getItemSync<UnitSystem>("Metric");
      const testUnitItem = ecSchema.getItemSync<Unit>("M");
      assert.isDefined(testPhenomenonItem);
      assert.isDefined(testUnitSystemItem);
      assert.isDefined(testUnitItem);
      assert.isTrue(testPhenomenonItem instanceof Phenomenon);
      assert.isTrue(testUnitSystemItem instanceof UnitSystem);
      assert.isTrue(testUnitItem instanceof Unit);
      assert(testPhenomenonItem!.definition === "LENGTH(1)");
      assert(testUnitItem!.phenomenon!.name, testPhenomenonItem!.name);
      assert(testUnitItem!.unitSystem!.name, testUnitSystemItem!.name);
    });
    it("should successfully deserialize valid JSON II", () => {
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
              "TestSchema.DefaultReal[TestSchema.IN]",
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
      const ecSchema = Schema.fromJsonSync(json);
      assert.isDefined(ecSchema);
      const testKoQItem = ecSchema.getItemSync<KindOfQuantityEC32>("ExampleKoQ");
      const testUnitItem = ecSchema.getItemSync<Unit>("MM");
      const testFormat = ecSchema.getItemSync<Format>("DefaultReal");
      const testUnitSystem = ecSchema.getItemSync<UnitSystem>("Metric");
      assert.isDefined(testKoQItem);
      assert.isDefined(testUnitItem);
      assert.isDefined(testFormat);
      assert.isDefined(testUnitSystem);
      assert.isTrue(testUnitSystem instanceof UnitSystem);
      assert.isTrue(testKoQItem instanceof KindOfQuantityEC32);
      assert.isTrue(testUnitItem instanceof Unit);
      assert.isTrue(testFormat instanceof Format);
      const testPersistenceUnit = ecSchema.getItemSync<Unit>(testKoQItem!.persistenceUnit!.name);
      assert(testPersistenceUnit!.definition, "[MILLI]*M");
      const testUnitSystemItem = ecSchema.getItemSync<UnitSystem>(testUnitSystem!.name);
      assert(testUnitSystemItem!.name, testUnitSystem!.name);
    });
  });
  describe("Sync FormatString Tests", () => {
    it("One unit override", async () => {
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
              "TestSchema.DefaultReal(3)[TestSchema.IN| in]",
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
      const ecSchema = Schema.fromJsonSync(json);
      assert.isDefined(ecSchema);
      const testFormatItem = ecSchema.getItemSync<Format>("DefaultReal");
      assert(testFormatItem!.composite!.units!![0]["1"] === " in");
    });
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
