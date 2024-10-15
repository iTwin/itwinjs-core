/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Format as QFormat, Formatter, FormatterSpec, Parser, ParserSpec, UnitProps } from "@itwin/core-quantity";
import { assert } from "chai";
import * as fs from "fs";
import * as path from "path";
import { SchemaContext } from "../../Context";
import { SchemaItemFormatProps } from "../../Deserialization/JsonProps";
import { SchemaKey, SchemaMatchType, SchemaUnitProvider } from "../../ecschema-metadata";
import { Format } from "../../Metadata/Format";
import { MutableSchema, Schema } from "../../Metadata/Schema";
import { deserializeXmlSync } from "../TestUtils/DeserializationHelpers";

describe("Quantity", () => {
  let schema: Schema;
  let testFormat: Format;

  describe("Format and Parse Bearing", () => {
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
          { name: "Units.ARC_SECOND", label: '"' },
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
