/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Format, Schema, SchemaContext, SchemaItemType } from "@itwin/ecschema-metadata";
import { getSchemaDifferences, SchemaOtherTypes } from "../../Differencing/SchemaDifference";
import { AnySchemaDifferenceConflict, ConflictCode } from "../../Differencing/SchemaConflicts";
import { SchemaMerger } from "../../Merging/SchemaMerger";
import { SchemaEdits } from "../../Merging/Edits/SchemaEdits";
import { BisTestHelper } from "../TestUtils/BisTestHelper";
import { expect } from "chai";
import { DecimalPrecision, FormatTraits, FormatType, FractionalPrecision, ScientificType, ShowSignOption } from "@itwin/core-quantity";

describe("Format merge tests", () => {
  let targetContext: SchemaContext;

  const targetJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "TargetSchema",
    version: "01.00.00",
    alias: "target",
    references: [
      { name: "CoreCustomAttributes", version: "01.00.01" },
    ],
    customAttributes: [
      { className: "CoreCustomAttributes.DynamicSchema" },
    ],
  };

  const sourceJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "SourceSchema",
    version: "01.00.00",
    alias: "source",
    references: [
      { name: "CoreCustomAttributes", version: "01.00.01" },
    ],
    customAttributes: [
      { className: "CoreCustomAttributes.DynamicSchema" },
    ],
  };

  const referenceJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "ReferenceSchema",
    version: "01.02.00",
    alias: "reference",
    items: {
      international: {
        schemaItemType: "UnitSystem",
      },
      time: {
        schemaItemType: "Phenomenon",
        definition: "TIME",
      },
      length: {
        schemaItemType: "Phenomenon",
        definition: "LENGTH",
      },
      h: {
        schemaItemType: "Unit",
        label: "h",
        unitSystem: "ReferenceSchema.international",
        phenomenon: "ReferenceSchema.time",
        definition: "H",
      },
      min: {
        schemaItemType: "Unit",
        label: "min",
        unitSystem: "ReferenceSchema.international",
        phenomenon: "ReferenceSchema.time",
        definition: "MIN",
      },
      km: {
        schemaItemType: "Unit",
        label: "km",
        phenomenon: "ReferenceSchema.length",
        unitSystem: "ReferenceSchema.international",
        definition: "KM",
      },
      kmPerH: {
        schemaItemType: "Unit",
        label: "km/h",
        unitSystem: "ReferenceSchema.international",
        phenomenon: "ReferenceSchema.time",
        definition: "KM*H(-1)",
      },
    },
  };

  beforeEach(async () => {
    targetContext = await BisTestHelper.getNewContext();
    await Schema.fromJson(referenceJson, targetContext);
  });

  it("should merge missing decimal format", async () => {
    await Schema.fromJson(targetJson, targetContext);
    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.Format,
          itemName: "testFormat",
          difference: {
            label: "Test",
            type: "Decimal",
            precision: 6,
            showSignOption: "OnlyNegative",
            formatTraits: [
              "KeepSingleZero",
              "KeepDecimalPoint",
            ],
            decimalSeparator: ",",
            thousandSeparator: " ",
            uomSeparator: "",
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("testFormat")).to.be.eventually.not.undefined
    .then((format: Format) => {
      expect(format).to.have.a.property("schemaItemType", SchemaItemType.Format);
      expect(format).to.have.a.property("label").to.equal("Test");
      expect(format).to.have.a.property("type").to.equal(FormatType.Decimal);
      expect(format).to.have.a.property("precision").to.equal(DecimalPrecision.Six);
      expect(format).to.have.a.property("showSignOption").to.equal(ShowSignOption.OnlyNegative);
      expect(format).to.have.a.property("formatTraits").to.equal(FormatTraits.KeepSingleZero | FormatTraits.KeepDecimalPoint);
      expect(format).to.have.a.property("decimalSeparator").to.equal(",");
      expect(format).to.have.a.property("thousandSeparator").to.equal(" ");
      expect(format).to.have.a.property("uomSeparator").to.equal("");
    });
  });

  it("should merge missing fractional format with referenced unit", async () => {
    await Schema.fromJson(targetJson, targetContext);
    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.SchemaReference,
          difference: {
            name: "ReferenceSchema",
            version: "01.02.00",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.Format,
          itemName: "testFormat",
          difference: {
            label: "Test",
            description: "Test Fractional",
            type: "Fractional",
            precision: 8,
            roundFactor: 0.01,
            showSignOption: "SignAlways",
            formatTraits: [
              "FractionDash",
              "ShowUnitLabel",
              "TrailZeroes",
            ],
            decimalSeparator: ".",
            thousandSeparator: ",",
            uomSeparator: " ",
            composite: {
              spacer: "",
              units: [
                {
                  name: "ReferenceSchema.h",
                  label: "hour(s)"
                },
              ],
            },
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("testFormat")).to.be.eventually.not.undefined
    .then((format: Format) => {
      expect(format).to.have.a.property("schemaItemType", SchemaItemType.Format);
      expect(format).to.have.a.property("label").to.equal("Test");
      expect(format).to.have.a.property("description").to.equal("Test Fractional");
      expect(format).to.have.a.property("type").to.equal(FormatType.Fractional);
      expect(format).to.have.a.property("precision").to.equal(FractionalPrecision.Eight);
      expect(format).to.have.a.property("roundFactor").to.equal(0.01);
      expect(format).to.have.a.property("showSignOption").to.equal(ShowSignOption.SignAlways);
      expect(format).to.have.a.property("formatTraits").to.equal(FormatTraits.FractionDash | FormatTraits.ShowUnitLabel | FormatTraits.TrailZeroes);
      expect(format).to.have.a.property("decimalSeparator").to.equal(".");
      expect(format).to.have.a.property("thousandSeparator").to.equal(",");
      expect(format).to.have.a.property("uomSeparator").to.equal(" ");
      expect(format).to.have.a.property("spacer").to.equal("");
      expect(format).to.have.a.nested.property("units[0][0].fullName").to.equal("ReferenceSchema.h");
      expect(format).to.have.a.nested.property("units[0][1]").to.equal("hour(s)");
    });
  });

  it("should merge missing scientific format with missing inverted unit", async () => {
    await Schema.fromJson(targetJson, targetContext);
    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaOtherTypes.SchemaReference,
          difference: {
            name: "ReferenceSchema",
            version: "01.02.00",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.InvertedUnit,
          itemName: "hPerKM",
          difference: {
            unitSystem: "ReferenceSchema.international",
            invertsUnit: "ReferenceSchema.kmPerH",
          },
        },
        {
          changeType: "add",
          schemaType: SchemaItemType.Format,
          itemName: "testFormat",
          difference: {
            label: "Test",
            description: "Test Scientific",
            type: "Scientific",
            scientificType: "ZeroNormalized",
            precision: 12,
            minWidth: 16,
            showSignOption: "NegativeParentheses",
            formatTraits: "ExponentOnlyNegative",
            uomSeparator: "",
            composite: {
              spacer: " ",
              includeZero: true,
              units: [
                {
                  name: "SourceSchema.hPerKM",
                },
              ],
            },
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("testFormat")).to.be.eventually.not.undefined
    .then((format: Format) => {
      expect(format).to.have.a.property("schemaItemType", SchemaItemType.Format);
      expect(format).to.have.a.property("label").to.equal("Test");
      expect(format).to.have.a.property("description").to.equal("Test Scientific");
      expect(format).to.have.a.property("type").to.equal(FormatType.Scientific);
      expect(format).to.have.a.property("scientificType").to.equal(ScientificType.ZeroNormalized);
      expect(format).to.have.a.property("precision").to.equal(DecimalPrecision.Twelve);
      expect(format).to.have.a.property("minWidth").to.equal(16);
      expect(format).to.have.a.property("showSignOption").to.equal(ShowSignOption.NegativeParentheses);
      expect(format).to.have.a.property("formatTraits").to.equal(FormatTraits.ExponentOnlyNegative);
      expect(format).to.have.a.property("uomSeparator").to.equal("");
      expect(format).to.have.a.property("spacer").to.equal(" ");
      expect(format).to.have.a.property("includeZero").to.equal(true);
      expect(format).to.have.a.nested.property("units[0][0].fullName").to.equal("TargetSchema.hPerKM");
      expect(format).to.have.a.nested.property("units[0][1]").to.equal(undefined);
    });
  });

  it("should merge station format changes", async () => {
    await Schema.fromJson({
      ...targetJson,
      items: {
        testFormat: {
          schemaItemType: SchemaItemType.Format,
          itemName: "testFormat",
          label: "Test",
          type: "Station",
          precision: 3,
          formatTraits: [
            "TrailZeroes",
            "KeepSingleZero",
            "KeepDecimalPoint",
          ],
          decimalSeparator: ",",
          thousandSeparator: " ",
          minWidth: 4,
          stationOffsetSize: 4,
          stationSeparator: "+",
        },
      },
    }, targetContext);

    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaItemType.Format,
          itemName: "testFormat",
          difference: {
            label: "Changed",
            description: "Changed Station",
            precision: 4,
            showSignOption: "SignAlways",
            formatTraits: "TrailZeroes",
            decimalSeparator: ".",
            thousandSeparator: ",",
            minWidth: 6,
            stationOffsetSize: 6,
            stationSeparator: "-",
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("testFormat")).to.be.eventually.not.undefined
    .then((format: Format) => {
      expect(format).to.have.a.property("schemaItemType", SchemaItemType.Format);
      expect(format).to.have.a.property("type").to.equal(FormatType.Station);
      expect(format).to.have.a.property("label").to.equal("Changed");
      expect(format).to.have.a.property("description").to.equal("Changed Station");
      expect(format).to.have.a.property("precision").to.equal(DecimalPrecision.Four);
      expect(format).to.have.a.property("showSignOption").to.equal(ShowSignOption.SignAlways);
      expect(format).to.have.a.property("formatTraits").to.equal(FormatTraits.TrailZeroes);
      expect(format).to.have.a.property("decimalSeparator").to.equal(".");
      expect(format).to.have.a.property("thousandSeparator").to.equal(",");
      expect(format).to.have.a.property("minWidth").to.equal(6);
      expect(format).to.have.a.property("stationOffsetSize").to.equal(6);
      expect(format).to.have.a.property("stationSeparator").to.equal("-");
    });
  });

  it("should merge decimal format unit changes replacing with referenced unit", async () => {
    await Schema.fromJson({
      ...targetJson,
      references: [
        ...targetJson.references,
        {
          name: "ReferenceSchema",
          version: "1.2.0",
        },
      ],
      items: {
        testFormat: {
          schemaItemType: "Format",
          label: "Test",
          type: "Decimal",
          precision: 2,
          formatTraits: [
            "KeepSingleZero",
            "KeepDecimalPoint",
            "ShowUnitLabel",
          ],
          decimalSeparator: ",",
          thousandSeparator: " ",
          composite: {
            units: [
              {
                name: "ReferenceSchema.h",
                label: "H",
              },
            ],
          },
        },
      },
    }, targetContext);

    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaItemType.Format,
          itemName: "testFormat",
          difference: {
            label: "HoursMinutes",
            description: "Hours Minutes",
          },
        },
        {
          changeType: "modify",
          schemaType: SchemaOtherTypes.FormatUnit,
          itemName: "testFormat",
          difference: [{
            name: "ReferenceSchema.h",
            label: "H",
          },
          {
            name: "ReferenceSchema.min",
            label: "MIN",
          }],
        },
      ],
    });

    await expect(mergedSchema.getItem("testFormat")).to.be.eventually.not.undefined
    .then((format: Format) => {
      expect(format).to.have.a.property("schemaItemType", SchemaItemType.Format);
      expect(format).to.have.a.property("type").to.equal(FormatType.Decimal);
      expect(format).to.have.a.property("label").to.equal("HoursMinutes");
      expect(format).to.have.a.property("description").to.equal("Hours Minutes");
      expect(format).to.have.a.nested.property("units[0][0].fullName").to.equal("ReferenceSchema.h");
      expect(format).to.have.a.nested.property("units[0][1]").to.equal("H");
      expect(format).to.have.a.nested.property("units[1][0].fullName").to.equal("ReferenceSchema.min");
      expect(format).to.have.a.nested.property("units[1][1]").to.equal("MIN");
    });
  });

  it("should merge fractional format unit changes replacing with missing invertedUnit", async () => {
    await Schema.fromJson({
      ...targetJson,
      references: [
        ...targetJson.references,
        {
          name: "ReferenceSchema",
          version: "1.2.0",
        },
      ],
      items: {
        testFormat: {
          schemaItemType: "Format",
          label: "Fractional",
          type: "Fractional",
          precision: 8,
          formatTraits: [
            "KeepSingleZero",
            "KeepDecimalPoint",
            "ShowUnitLabel",
          ],
          decimalSeparator: ",",
          thousandSeparator: " ",
          uomSeparator: "",
          composite: {
            spacer: "",
            units: [
              {
                name: "ReferenceSchema.km",
                label: "KM",
              },
            ],
          },
        },
      },
    }, targetContext);

    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "add",
          schemaType: SchemaItemType.InvertedUnit,
          itemName: "miles_per_km",
          difference: {
            unitSystem: "ReferenceSchema.international",
            invertsUnit: "ReferenceSchema.km",
          },
        },
        {
          changeType: "modify",
          schemaType: SchemaOtherTypes.FormatUnit,
          itemName: "testFormat",
          difference: [{
            name: "SourceSchema.miles_per_km",
            label: "MILES/KM",
          }],
        },
      ],
    });

    await expect(mergedSchema.getItem("testFormat")).to.be.eventually.not.undefined
    .then((format: Format) => {
      expect(format).to.have.a.property("schemaItemType", SchemaItemType.Format);
      expect(format).to.have.a.property("type").to.equal(FormatType.Fractional);
      expect(format).to.have.a.nested.property("units[0][0].fullName").to.equal("TargetSchema.miles_per_km");
      expect(format).to.have.a.nested.property("units[0][1]").to.equal("MILES/KM");
    });
  });

  it("should override decimal format unit labels", async () => {
    await Schema.fromJson({
      ...targetJson,
      references: [
        ...targetJson.references,
        {
          name: "ReferenceSchema",
          version: "1.2.0",
        },
      ],
      items: {
        testUnit: {
          schemaItemType: "Unit",
          label: "s",
          unitSystem: "ReferenceSchema.international",
          phenomenon: "ReferenceSchema.time",
          definition: "S",
        },
        testFormat: {
          schemaItemType: "Format",
          label: "Test",
          type: "Decimal",
          precision: 2,
          formatTraits: [
            "KeepSingleZero",
            "KeepDecimalPoint",
            "ShowUnitLabel",
          ],
          decimalSeparator: ",",
          thousandSeparator: " ",
          composite: {
            units: [
              {
                name: "ReferenceSchema.h",
                label: "H",
              },
              {
                name: "ReferenceSchema.min",
                label: "MIN",
              },
              {
                name: "TargetSchema.testUnit",
                label: "S",
              },
            ],
          },
        },
      },
    }, targetContext);

    const merger = new SchemaMerger(targetContext);
    const mergedSchema = await merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaOtherTypes.FormatUnitLabel,
          itemName: "testFormat",
          path: "ReferenceSchema.h",
          difference: {
            label: "hour(s)",
          },
        },
        {
          changeType: "modify",
          schemaType: SchemaOtherTypes.FormatUnitLabel,
          itemName: "testFormat",
          path: "ReferenceSchema.min",
          difference: {
            label: undefined,
          },
        },
        {
          changeType: "modify",
          schemaType: SchemaOtherTypes.FormatUnitLabel,
          itemName: "testFormat",
          path: "SourceSchema.testUnit",
          difference: {
            label: "second(s)",
          },
        },
      ],
    });

    await expect(mergedSchema.getItem("testFormat")).to.be.eventually.not.undefined
    .then((format: Format) => {
      expect(format).to.have.a.nested.property("units[0][0].fullName").to.equal("ReferenceSchema.h");
      expect(format).to.have.a.nested.property("units[0][1]").to.equal("hour(s)");
      expect(format).to.have.a.nested.property("units[1][0].fullName").to.equal("ReferenceSchema.min");
      expect(format).to.have.a.nested.property("units[1][1]").to.equal(undefined);
      expect(format).to.have.a.nested.property("units[2][0].fullName").to.equal("TargetSchema.testUnit");
      expect(format).to.have.a.nested.property("units[2][1]").to.equal("second(s)");
    });
  });

  it("should throw an error when merging format with a changed type", async () => {
    await Schema.fromJson({
      ...targetJson,
      items: {
        testFormat: {
          schemaItemType: "Format",
          label: "Decimal",
          type: "Decimal",
          precision: 2,
          formatTraits: [
            "KeepSingleZero",
            "KeepDecimalPoint",
            "ShowUnitLabel",
          ],
          decimalSeparator: ",",
          thousandSeparator: " ",
        },
      },
    }, targetContext);

    const merger = new SchemaMerger(targetContext);
    const merge = merger.merge({
      sourceSchemaName: "SourceSchema.01.02.03",
      targetSchemaName: "TargetSchema.01.00.00",
      differences: [
        {
          changeType: "modify",
          schemaType: SchemaItemType.Format,
          itemName: "testFormat",
          difference: {
            type: "Fractional",
            precision: 8,
          },
        },
      ],
    });

    await expect(merge).to.be.rejectedWith("Changing the format 'testFormat' type is not supported.");
  });

  describe("iterative tests", () => {
    let sourceContext: SchemaContext;

    beforeEach(async () => {
      sourceContext = await BisTestHelper.getNewContext();
      await Schema.fromJson(referenceJson, sourceContext);
    });

    it("should merge missing re-mapped format class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testItem: {
            schemaItemType: "Format",
            label: "Test",
            type: "Decimal",
            precision: 4,
            formatTraits: [
              "KeepSingleZero",
              "ShowUnitLabel",
            ],
            decimalSeparator: ",",
            thousandSeparator: " ",
          },
        },
      }, sourceContext);
  
      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          testItem: {
            schemaItemType: "EntityClass",
          },
        },
      }, targetContext);

      const result = await getSchemaDifferences(targetSchema, sourceSchema);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingItemName);
        expect(conflict).to.have.a.property("source", "Format");
        expect(conflict).to.have.a.property("target", "EntityClass");
        return true;
      });

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as Format;
      schemaEdits.items.rename(sourceItem, "mergedFormat");
  
      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.merge(result, schemaEdits);
  
      await expect(mergedSchema.getItem("mergedFormat")).to.be.eventually.fulfilled.then(async (schemaItem) => {
        expect(schemaItem).to.exist;
        expect(schemaItem).to.have.property("schemaItemType").equals(SchemaItemType.Format);
      });
      await expect(mergedSchema.getItem("testItem")).to.be.eventually.fulfilled.then(async (schemaItem) => {
        expect(schemaItem).to.exist;
        expect(schemaItem).to.have.property("schemaItemType").equals(SchemaItemType.EntityClass);
      });
    });

    it("should merge changes to re-mapped format class", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        items: {
          testItem: {
            schemaItemType: "Format",
            type: "Station",
            label: "Changed",
            description: "Changed Station",
            precision: 4,
            formatTraits: [
              "TrailZeroes",
            ],
            decimalSeparator: ",",
            thousandSeparator: ".",
            minWidth: 4,
            stationOffsetSize: 6,
            stationSeparator: "-",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          mergedFormat: {
            schemaItemType: "Format",
            type: "Station",
            precision: 2,
            formatTraits: [
              "TrailZeroes",
              "KeepSingleZero",
              "KeepDecimalPoint"
            ],
            decimalSeparator: ",",
            thousandSeparator: " ",
            minWidth: 2,
            stationOffsetSize: 2,
            stationSeparator: "+",
          },
          testItem: {
            schemaItemType: "StructClass",
          },
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as Format;
      schemaEdits.items.rename(sourceItem, "mergedFormat");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.mergeSchemas(targetSchema, sourceSchema, schemaEdits);
 
      await expect(mergedSchema.getItem("mergedFormat")).to.be.eventually.not.undefined
        .then((format: Format) => {
          expect(format).to.have.a.property("label").to.equal("Changed");
          expect(format).to.have.a.property("description").to.equal("Changed Station");
          expect(format).to.have.a.property("precision").to.equal(DecimalPrecision.Four);
          expect(format).to.have.a.property("formatTraits").to.equal(FormatTraits.TrailZeroes);
          expect(format).to.have.a.property("decimalSeparator").to.equal(",");
          expect(format).to.have.a.property("thousandSeparator").to.equal(".");
          expect(format).to.have.a.property("minWidth").to.equal(4);
          expect(format).to.have.a.property("stationOffsetSize").to.equal(6);
          expect(format).to.have.a.property("stationSeparator").to.equal("-");
        });
    });

    it("should merge missing kindOfQuantity class with re-mapped presentation format", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          ...sourceJson.references,
          { name: "ReferenceSchema", version: "1.2.0" },
        ],
        items: {
          testKoq: {
            schemaItemType: "KindOfQuantity",
            relativeError: 0.0001,
            persistenceUnit: "ReferenceSchema.h",
            presentationUnits: [
              "SourceSchema.testItem(4)",
            ],
          },
          testItem: {
            schemaItemType: "Format",
            type: "Decimal",
            precision: 6,
            formatTraits: [
              "KeepSingleZero",
              "KeepDecimalPoint"
            ],
            decimalSeparator: ",",
            thousandSeparator: " ",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        items: {
          mergedFormat: {
            schemaItemType: "Format",
            type: "Decimal",
            precision: 6,
            formatTraits: [
              "KeepSingleZero",
              "KeepDecimalPoint"
            ],
            decimalSeparator: ",",
            thousandSeparator: " ",
          },
          testItem: {
            schemaItemType: "EntityClass",
          },          
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as Format;      
      schemaEdits.items.rename(sourceItem, "mergedFormat");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.mergeSchemas(targetSchema, sourceSchema, schemaEdits);

      await expect(mergedSchema.getItem("testKoq")).to.be.eventually.fulfilled.then(async (koq) => {
        expect(koq).to.exist;
        expect(koq).to.have.a.nested.property("presentationFormats[0].name").equals("TargetSchema.mergedFormat(4)");
      });
    });

    it("should merge missing re-mapped presentation format to existing kindOfQuantity", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          ...sourceJson.references,
          { name: "ReferenceSchema", version: "1.2.0" },
        ],
        items: {
          testKoq: {
            schemaItemType: "KindOfQuantity",
            relativeError: 0.0001,
            persistenceUnit: "ReferenceSchema.h",
            presentationUnits: [
              "SourceSchema.testItem(6)",
            ],
          },
          testItem: {
            schemaItemType: "Format",
            type: "Decimal",
            precision: 6,
            formatTraits: [
              "KeepSingleZero",
              "KeepDecimalPoint"
            ],
            decimalSeparator: ",",
            thousandSeparator: " ",
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        references: [
          ...targetJson.references,
          { name: "ReferenceSchema", version: "1.2.0" },
        ],
        items: {
          testKoq: {
            schemaItemType: "KindOfQuantity",
            relativeError: 0.0001,
            persistenceUnit: "ReferenceSchema.h",
            presentationUnits: [
              "targetSchema.mergedFormat(4)",
            ],
          },
          mergedFormat: {
            schemaItemType: "Format",
            type: "Decimal",
            precision: 6,
            formatTraits: [
              "KeepSingleZero",
              "KeepDecimalPoint"
            ],
            decimalSeparator: ",",
            thousandSeparator: " ",
          },
          testItem: {
            schemaItemType: "StructClass",
          },          
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as Format;      
      schemaEdits.items.rename(sourceItem, "mergedFormat");

      const merger = new SchemaMerger(targetContext);
      const mergedSchema = await merger.mergeSchemas(targetSchema, sourceSchema, schemaEdits);

      await expect(mergedSchema.getItem("testKoq")).to.be.eventually.fulfilled.then(async (koq) => {
        expect(koq).to.exist;
        expect(koq).to.have.a.nested.property("presentationFormats[0].name").equals("TargetSchema.mergedFormat(4)");
        expect(koq).to.have.a.nested.property("presentationFormats[1].name").equals("TargetSchema.mergedFormat(6)");
      });
    });

    it("should return a conflict when re-mapped format phenomenon differs", async() => {
      const sourceSchema = await Schema.fromJson({
        ...sourceJson,
        references: [
          ...sourceJson.references,
          { name: "ReferenceSchema", version: "1.2.0" },
        ],
        items: {
          testItem: {
            schemaItemType: "Format",
            type: "Fractional",
            precision: 64,
            formatTraits: [
              "KeepSingleZero",
              "KeepDecimalPoint"
            ],
            decimalSeparator: ",",
            thousandSeparator: " ",
            composite: {
              units: [
                {
                  name: "ReferenceSchema.h",
                  label: "H",
                },
              ],
            },
          },
        },
      }, sourceContext);

      const targetSchema = await Schema.fromJson({
        ...targetJson,
        references: [
          ...targetJson.references,
          { name: "ReferenceSchema", version: "1.2.0" },
        ],
        items: {
          mergedFormat: {
            schemaItemType: "Format",
            type: "Fractional",
            precision: 64,
            formatTraits: [
              "KeepSingleZero",
              "KeepDecimalPoint"
            ],
            decimalSeparator: ",",
            thousandSeparator: " ",
            composite: {
              units: [
                {
                  name: "ReferenceSchema.km",
                  label: "KM",
                },
              ],
            },
          },
          testItem: {
            schemaItemType: "EntityClass",
          },          
        },
      }, targetContext);

      const schemaEdits = new SchemaEdits();
      const sourceItem = await sourceSchema.getItem("testItem") as Format;      
      schemaEdits.items.rename(sourceItem, "mergedFormat");

      const result = await getSchemaDifferences(targetSchema, sourceSchema, schemaEdits);
      expect(result.conflicts).to.have.lengthOf(1, "Unexpected length of conflicts");
      expect(result.conflicts).to.satisfy(([conflict]: AnySchemaDifferenceConflict[]) => {
        expect(conflict).to.exist;
        expect(conflict).to.have.a.property("code", ConflictCode.ConflictingFormatUnitPhenomenon);
        expect(conflict).to.have.a.property("source", "ReferenceSchema.h");
        expect(conflict).to.have.a.property("target", "ReferenceSchema.km");
        expect(conflict).to.have.a.property("description", "Format units has a different phenomenon.");
        expect(conflict).to.have.a.nested.property("difference.schemaType", "FormatUnit");
        expect(conflict).to.have.a.nested.property("difference.itemName", "testItem");
        return true;
      });
    });
  });
});
