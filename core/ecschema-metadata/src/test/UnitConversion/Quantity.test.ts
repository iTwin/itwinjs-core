/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, describe, expect, it } from "vitest";
import { SchemaContext } from "../../Context";
import { SchemaItemFormatProps } from "../../Deserialization/JsonProps";
import { Format } from "../../Metadata/Format";
import { MutableSchema, Schema } from "../../Metadata/Schema";
import { Formatter, FormatterSpec, Parser, ParserSpec, Format as QFormat, Quantity, UnitProps } from "@itwin/core-quantity";
import { deserializeXmlSync } from "../TestUtils/DeserializationHelpers";
import { SchemaKey, SchemaMatchType, SchemaUnitProvider } from "../../ecschema-metadata";
import * as fs from "fs";
import * as path from "path";

describe("Quantity", () => {
  describe("Conversions", () => {
    let context: SchemaContext;
    let provider: SchemaUnitProvider;

    before(() => {
      context = new SchemaContext();

      const schemaFile = path.join(__dirname, "..", "..", "..", "..", "node_modules", "@bentley", "units-schema", "Units.ecschema.xml");
      const schemaXml = fs.readFileSync(schemaFile, "utf-8");
      deserializeXmlSync(schemaXml, context);
      provider = new SchemaUnitProvider(context);
    });

    it("Convert between inverted and base units", async () => {
      const invertedUnit = await provider.findUnitByName("Units.HORIZONTAL_PER_VERTICAL");
      assert.isTrue(invertedUnit.isValid);
      const baseUnit = await provider.findUnitByName("Units.VERTICAL_PER_HORIZONTAL");
      assert.isTrue(baseUnit.isValid);

      const invertedValue = 2.0;
      const baseValue = 0.5;

      const baseQuantity = new Quantity(baseUnit, baseValue);
      const invertedQuantity = new Quantity(invertedUnit, invertedValue);

      const toInvertedConversion = await provider.getConversion(baseUnit, invertedUnit);
      const invertedResult = baseQuantity.convertTo(invertedUnit, toInvertedConversion);
      expect(invertedResult).to.not.be.undefined;
      if (invertedResult) {
        expect(invertedResult.magnitude).to.equal(invertedValue);
        expect(invertedResult.unit.name).to.equal(invertedUnit.name);
      }

      const toBaseConversion = await provider.getConversion(invertedUnit, baseUnit);
      const baseResult = invertedQuantity.convertTo(baseUnit, toBaseConversion);
      expect(baseResult).to.not.be.undefined;
      if (baseResult) {
        expect(baseResult.magnitude).to.equal(baseValue);
        expect(baseResult.unit.name).to.equal(baseUnit.name);
      }
    });

    it("Convert between meters and feet", async () => {
      const metersUnit = await provider.findUnitByName("Units.M");
      assert.isTrue(metersUnit.isValid);
      const feetUnit = await provider.findUnitByName("Units.FT");
      assert.isTrue(feetUnit.isValid);

      const metersValue = 1.0;
      const feetValue = 3.28084;

      const metersQuantity = new Quantity(metersUnit, metersValue);
      const feetQuantity = new Quantity(feetUnit, feetValue);

      const toFeetConversion = await provider.getConversion(metersUnit, feetUnit);
      const feetResult = metersQuantity.convertTo(feetUnit, toFeetConversion);
      expect(feetResult).to.not.be.undefined;
      if (feetResult) {
        expect(feetResult.magnitude).to.be.closeTo(feetValue, 0.00001);
        expect(feetResult.unit.name).to.equal(feetUnit.name);
      }

      const toMetersConversion = await provider.getConversion(feetUnit, metersUnit);
      const metersResult = feetQuantity.convertTo(metersUnit, toMetersConversion);
      expect(metersResult).to.not.be.undefined;
      if (metersResult) {
        expect(metersResult.magnitude).to.be.closeTo(metersValue, 0.00001);
        expect(metersResult.unit.name).to.equal(metersUnit.name);
      }
    });
  });

  describe("Format and Parse Bearing", () => {
    let schema: Schema;
    let testFormat: Format;
    const formatProps: SchemaItemFormatProps = {
      schemaItemType: "Format",
      label: "MyCustomFormat",
      description: "Some description",
      minWidth: 2,
      precision: 0,
      type: "Bearing",
      revolutionUnit: "Units.REVOLUTION",
      formatTraits: ["showUnitLabel"],
      uomSeparator: "",
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          { name: "Units.ARC_DEG", label: "°" },
          { name: "Units.ARC_MINUTE", label: "'" },
          { name: "Units.ARC_SECOND", label: "\"" },
        ],
      },
    };

    it("Roundtrip radian value", async () => {
      const context = new SchemaContext();
      const schemaFile = path.join(__dirname, "..", "..", "..", "..", "node_modules", "@bentley", "units-schema", "Units.ecschema.xml");
      const schemaXml = fs.readFileSync(schemaFile, "utf-8");
      deserializeXmlSync(schemaXml, context);

      const schemaKey = new SchemaKey("Units", 1, 0, 5);
      const unitsSchema = context.getSchemaSync(schemaKey, SchemaMatchType.Latest);
      assert.isDefined(unitsSchema);
      schema = new Schema(context, "TestSchema", "ts", 1, 0, 0);
      schema.references.push(unitsSchema!);

      testFormat = (schema as MutableSchema).createFormatSync("TestFormat");
      testFormat.fromJSONSync(formatProps);
      // TODO: The FORMAT class from ecschema-metadata is not the same as the one from core-quantity, it has to be serialized...

      const unitsProvider = new SchemaUnitProvider(context);
      const rad: UnitProps = await unitsProvider.findUnitByName("Units.RAD");
      assert.isTrue(rad.isValid);

      const quantityFormat = new QFormat("BearingDMS");
      await quantityFormat.fromJSON(unitsProvider, formatProps);
      assert.isTrue(quantityFormat.hasUnits);
      const bearingDMSFormatter = await FormatterSpec.create("RadToBearingDMS", quantityFormat, unitsProvider, rad);
      const bearingDMSParser = await ParserSpec.create(quantityFormat, unitsProvider, rad);

      const inputString = "S30°10'30\"E";
      const parseResult = Parser.parseQuantityString(inputString, bearingDMSParser);
      if (!Parser.isParsedQuantity(parseResult)) {
        assert.fail(`Expected a parsed from bearing DMS input string ${inputString}`);
      }
      const value = parseResult.value;
      assert.equal(value, 2.6149395518005045);

      const formatterResult = Formatter.formatQuantity(value, bearingDMSFormatter);
      assert.equal(formatterResult, inputString);
    });

  });
});
