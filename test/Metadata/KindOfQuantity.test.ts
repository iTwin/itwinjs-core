/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import Schema from "../../source/Metadata/Schema";
import { ECObjectsError } from "../../source/Exception";
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
  describe("Async deserialization", () => {
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
      const ecSchema = await Schema.fromJson(testSchema);
      assert.isDefined(ecSchema);
      const testItem = await ecSchema.getItem("testKoQ");
      assert.isDefined(testItem);
      assert.isTrue(testItem instanceof KindOfQuantity);
      const koQTest: KindOfQuantity = testItem as KindOfQuantity;
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
    it("should throw for persistenceUnit not a string", async () => testInvalidAttribute("persistenceUnit", "string", 0));

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
      const testKoQItem = await ecSchema.getItem<KindOfQuantity>("ExampleKoQ");
      const testUnitItem = await ecSchema.getItem<Unit>("MM");
      const testFormat = await ecSchema.getItem<Format>("DefaultReal");
      const testUnitSystem = await ecSchema.getItem<UnitSystem>("Metric");
      assert.isDefined(testKoQItem);
      assert.isDefined(testUnitItem);
      assert.isDefined(testFormat);
      assert.isDefined(testUnitSystem);
      assert.isTrue(testUnitSystem instanceof UnitSystem);
      assert.isTrue(testKoQItem instanceof KindOfQuantity);
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
      const testKoQItem = await ecSchema.getItem<KindOfQuantity>("ExampleKoQ");
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
      const testKoQItem = await ecSchema.getItem<KindOfQuantity>("ExampleKoQ");
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
      const testKoQItem = await ecSchema.getItem<KindOfQuantity>("ExampleKoQ");
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
      assert.isTrue(testItem instanceof KindOfQuantity);
      const koQTest: KindOfQuantity = testItem as KindOfQuantity;
      assert.isDefined(koQTest);
      expect(koQTest.precision).equal(5);
      assert.isDefined(koQTest.persistenceUnit);
      const persistenceUnit = koQTest.persistenceUnit;
      expect(persistenceUnit!.name).equal("M");
    });
  });

  describe("Sync fromJson", () => {
    const baseJson = { schemaItemType: "KindOfQuantity" };
    function testInvalidAttribute(attributeName: string, expectedType: string, value: any) {
      expect(testKoQ).to.exist;
      const json: any = {
        ...baseJson,
        precision: 5,
        [attributeName]: value,
      };
      assert.throws(() => testKoQ.fromJsonSync(json), ECObjectsError, `The KindOfQuantity TestKindOfQuantity has an invalid '${attributeName}' attribute. It should be of type '${expectedType}'.`);
    }

    it("should throw for invalid precision", () => testInvalidAttribute("precision", "number", false));
    it("should throw for persistenceUnit not a string",  () => testInvalidAttribute("persistenceUnit", "string", 0));

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
      const testKoQItem = ecSchema.getItemSync<KindOfQuantity>("ExampleKoQ");
      const testUnitItem = ecSchema.getItemSync<Unit>("MM");
      const testFormat = ecSchema.getItemSync<Format>("DefaultReal");
      const testUnitSystem = ecSchema.getItemSync<UnitSystem>("Metric");
      assert.isDefined(testKoQItem);
      assert.isDefined(testUnitItem);
      assert.isDefined(testFormat);
      assert.isDefined(testUnitSystem);
      assert.isTrue(testUnitSystem instanceof UnitSystem);
      assert.isTrue(testKoQItem instanceof KindOfQuantity);
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
      const testKoQItem = await ecSchema.getItem<KindOfQuantity>("ExampleKoQ");
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
      const testKoQItem = await ecSchema.getItem<KindOfQuantity>("ExampleKoQ");
      assert(testKoQItem!.presentationUnits!.length === 1);
      assert(testKoQItem!.precision === 3);
      const defaultPresForm = await testKoQItem!.defaultPresentationFormat;
      assert(defaultPresForm === await testKoQItem!.presentationUnits![0]);
      assert(defaultPresForm!.name === await testKoQItem!.presentationUnits![0].name);
    });
  });
});
