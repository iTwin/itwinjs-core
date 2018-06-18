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

describe("KindOfQuantity", () => {
  describe("deserialization", () => {
    it("No persistenceUnits", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
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
      const testKoQ: KindOfQuantity = testItem as KindOfQuantity;
      assert.isDefined(testKoQ);
      expect(testKoQ.precision).equal(5);
      assert.isDefined(testKoQ.persistenceUnit);
      const persistenceUnit = testKoQ.persistenceUnit;
      expect(persistenceUnit!.name).equal("M");
    });
  });

  describe("fromJson", () => {
    let testKoQ: KindOfQuantity;
    const baseJson = { schemaItemType: "KindOfQuantity" };

    beforeEach(() => {
      const schema = new Schema("TestSchema", 1, 0, 0);
      testKoQ = new KindOfQuantity(schema, "TestKindOfQuantity");
    });

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
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
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
      await expect(Schema.fromJson(testSchema)).to.be.rejectedWith(ECObjectsError, `The KindOfQuantity testKoQ has an invalid 'presentationUnits' attribute. It should be either type 'string[]' or type 'string'.`);
    });

    it("should throw for missing persistenceUnit", async () => {
      const testSchema = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
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
      const schema = new Schema("TestSchema", 1, 0, 0);
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
  describe("DelayedPromise Tests", () => {
    it("should successfully deserialize valid JSON I", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
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
  });
  describe("FormatString Tests", () => {
    it("Basic test with one unit override", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
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
          DefaultReal: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "-",
              units: [
                {
                  name: "M",
                  label: "meters",
                },
              ],
            },
          },
        },
      };
      const ecSchema = await Schema.fromJson(json);
      assert.isDefined(ecSchema);
      const parsedString = await KindOfQuantity.parseFormatString(ecSchema, "DefaultReal", "DefaultReal(4)[u:M|meter]");
      expect(parsedString).to.eql({FormatName: "DefaultReal", Precision: 4, Units: [["M", "meter"]]});
    });
    it("Basic test with four unit overrides", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
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
          DefaultReal: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "-",
              units: [
                {
                  name: "M",
                  label: "meters",
                },
                {
                  name: "MILE",
                  label: "mile(s)",
                },
                {
                  name: "YRD",
                  label: "yard(s)",
                },
                {
                  name: "FT",
                  label: "feet",
                },
              ],
            },
          },
        },
      };
      const ecSchema = await Schema.fromJson(json);
      assert.isDefined(ecSchema);
      const parsedString = await KindOfQuantity.parseFormatString(ecSchema, "DefaultReal", "DefaultReal[u:M|meter][MILE|miles][u:YRD|yards][u:FT|\']");
      expect(parsedString).to.eql({FormatName: "DefaultReal", Precision: null, Units: [["M", "meter"], ["MILE", "miles"], ["YRD", "yards"], ["FT", "'"]]});
    });
    it.only("No units defined in format; units in format string should be used", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
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
          DefaultReal: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
          },
        },
      };
      const ecSchema = await Schema.fromJson(json);
      assert.isDefined(ecSchema);
      const parsedString = await KindOfQuantity.parseFormatString(ecSchema, "DefaultReal", "DefaultReal[u:M|meter][MILE|miles][u:YRD|yards][u:FT|\']");
      expect(parsedString).to.eql({FormatName: "DefaultReal", Precision: null, Units: [["M", "meter"], ["MILE", "miles"], ["YRD", "yards"], ["FT", "'"]]});
    });
    it("Fail if unit name doesnt exist", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
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
          DefaultReal: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "-",
              units: [
                {
                  name: "M",
                  label: "meters",
                },
              ],
            },
          },
        },
      };
      const ecSchema = await Schema.fromJson(json);
      assert.isDefined(ecSchema);
      await expect(KindOfQuantity.parseFormatString(ecSchema, "DefaultReal", "DefaultReal(4)[u:METER|meter]")).to.be.rejectedWith(ECObjectsError, `Cannot find unit name METER.`);
    });
    it("Unit label override wasnt provided - use empty string", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
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
          DefaultReal: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "-",
              units: [
                {
                  name: "M",
                  label: "meters",
                },
              ],
            },
          },
        },
      };
      const ecSchema = await Schema.fromJson(json);
      assert.isDefined(ecSchema);
      const parsedStringWithBar = await KindOfQuantity.parseFormatString(ecSchema, "DefaultReal", "DefaultReal(4)[u:M|]");
      const parsedStringWithoutBar = await KindOfQuantity.parseFormatString(ecSchema, "DefaultReal", "DefaultReal(4)[u:M]");
      expect(parsedStringWithBar).to.eql({FormatName: "DefaultReal", Precision: 4, Units: [["M", ""]]});
      expect(parsedStringWithoutBar).to.eql({FormatName: "DefaultReal", Precision: 4, Units: [["M", ""]]});
    });
    it("Number of unit overrides must match number of units in format.", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
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
          DefaultReal: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "-",
              units: [
                {
                  name: "M",
                  label: "meters",
                },
                {
                  name: "MILE",
                  label: "mile(s)",
                },
              ],
            },
          },
        },
      };
      const ecSchema = await Schema.fromJson(json);
      assert.isDefined(ecSchema);
      await expect(KindOfQuantity.parseFormatString(ecSchema, "DefaultReal", "DefaultReal(4)[u:M|meter][u:MILE|miles][u:YRD|yards][u:FT|\']")).to.be.rejectedWith(ECObjectsError, `Incorrect number of unit overrides.`);
    });
    it("No unit overrides provided", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
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
          DefaultReal: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "-",
              units: [
                {
                  name: "M",
                  label: "meters",
                },
              ],
            },
          },
        },
      };
      const ecSchema = await Schema.fromJson(json);
      assert.isDefined(ecSchema);
      const parsedString = await KindOfQuantity.parseFormatString(ecSchema, "DefaultReal", "DefaultReal(4)");
      expect(parsedString).to.eql({FormatName: "DefaultReal", Precision: 4, Units: []});
    });
    it("If Format has 0 units, FormatString must have at least 1 unit.", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
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
          DefaultReal: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
          },
        },
      };
      const ecSchema = await Schema.fromJson(json);
      assert.isDefined(ecSchema);
      await expect(KindOfQuantity.parseFormatString(ecSchema, "DefaultReal", "DefaultReal(4)")).to.be.rejectedWith(ECObjectsError, `Format string requires unit overrides if the format does not have any.`);

    });
    it("Format string doesn't match format name", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
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
          DefaultReal: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "-",
              units: [
                {
                  name: "M",
                  label: "meters",
                },
              ],
            },
          },
        },
      };
      const ecSchema = await Schema.fromJson(json);
      assert.isDefined(ecSchema);
      await expect(KindOfQuantity.parseFormatString(ecSchema, "DefaultReal", "DefaultReals(4)[u:M|meter]")).to.be.rejectedWith(ECObjectsError, `Format names do not match.`);
    });
    it("Precision is not an integer", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
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
          DefaultReal: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "-",
              units: [
                {
                  name: "M",
                  label: "meters",
                },
              ],
            },
          },
        },
      };
      const ecSchema = await Schema.fromJson(json);
      assert.isDefined(ecSchema);
      await expect(KindOfQuantity.parseFormatString(ecSchema, "DefaultReal", "DefaultReal(4.8)[u:M|meter]")).to.be.rejectedWith(ECObjectsError, `Precision must be an integer.`);
    });
    it("Precision is list of options", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
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
          DefaultReal: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "-",
              units: [
                {
                  name: "M",
                  label: "meters",
                },
              ],
            },
          },
        },
      };
      const ecSchema = await Schema.fromJson(json);
      assert.isDefined(ecSchema);
      const parsedString = await KindOfQuantity.parseFormatString(ecSchema, "DefaultReal", "DefaultReal(4, FOO, BAR)[u:M|meter]");
      expect(parsedString).to.eql({FormatName: "DefaultReal", Precision: 4, Units: [["M", "meter"]]});
    });
    it("Precision is not provided", async () => {
      const json = {
        $schema: "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema",
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
          DefaultReal: {
            schemaItemType: "Format",
            type: "fractional",
            precision: 4,
            composite: {
              includeZero: false,
              spacer: "-",
              units: [
                {
                  name: "M",
                  label: "meters",
                },
              ],
            },
          },
        },
      };
      const ecSchema = await Schema.fromJson(json);
      assert.isDefined(ecSchema);
      const parsedString = await KindOfQuantity.parseFormatString(ecSchema, "DefaultReal", "DefaultReal[u:M|meter]");
      expect(parsedString).to.eql({FormatName: "DefaultReal", Precision: null, Units: [["M", "meter"]]});
    });
  });
});
