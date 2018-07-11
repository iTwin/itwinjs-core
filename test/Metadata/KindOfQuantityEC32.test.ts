/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as sinon from "sinon";

import { ECObjectsError } from "../../source/Exception";
import KindOfQuantityEC32 from "../../source/Metadata/KindOfQuantityEC32";
import Schema from "../../source/Metadata/Schema";

import Unit from "../../source/Metadata/Unit";
import Phenomenon from "../../source/Metadata/Phenomenon";
import UnitSystem from "../../source/Metadata/UnitSystem";
import Format from "../../source/Metadata/Format";

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

    // should throw for presentationUnits not an array or string
    const invalidPresentationUnits = {
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
    it("async - should throw for presentationUnits not an array or string", async () => {
      await expect(Schema.fromJson(invalidPresentationUnits)).to.be.rejectedWith(ECObjectsError, `The Kind Of Quantity testKoQ has an invalid 'presentationUnits' attribute. It should be of type 'string' or 'string[]'.`);
    });

    it("sync - should throw for presentationUnits not an array or string", () => {
      assert.throws(() => Schema.fromJsonSync(invalidPresentationUnits), ECObjectsError,  `The Kind Of Quantity testKoQ has an invalid 'presentationUnits' attribute. It should be of type 'string' or 'string[]'.`);
    });

    // should throw for missing persistenceUnit
    const missingPersistenceUnit = {
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
    it("async - should throw for missing persistenceUnit", async () => {
      await expect(Schema.fromJson(missingPersistenceUnit)).to.be.rejectedWith(ECObjectsError, `The KindOfQuantity testKoQ is missing the required attribute 'persistenceUnit'.`);
    });

    it("sync - should throw for missing persistenceUnit", () => {
      assert.throws(() => Schema.fromJsonSync(missingPersistenceUnit), ECObjectsError, `The KindOfQuantity testKoQ is missing the required attribute 'persistenceUnit'.`);
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

});
