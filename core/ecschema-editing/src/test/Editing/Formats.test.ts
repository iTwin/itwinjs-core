/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Format, FormatTraits, FormatType, SchemaContext, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";

describe("Formats tests", () => {
  let testEditor: SchemaContextEditor;
  let testKey: SchemaKey;
  let context: SchemaContext;

  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    const result = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
    testKey = result.schemaKey!;
  });

  it("should create a valid Format", async () => {
    const result = await testEditor.formats.create(testKey, "testFormat", FormatType.Decimal, "testLabel");
    const format = await testEditor.schemaContext.getSchemaItem(result.itemKey!) as Format;
    expect(format.fullName).to.eql("testSchema.testFormat");
    expect(format.label).to.eql("testLabel");
  });

  it("should create a valid Format from FormatProps", async () => {
    const formatProps = {
      name: "testFormat",
      type: "Station",
      precision: 5,
      roundFactor: 5,
      minWidth: 5,
      showSignOption: "noSign",
      formatTraits: "KeepDecimalPoint",
      decimalSeparator: ",",
      thousandSeparator: ",",
      uomSeparator: "",
      scientificType: "",
      stationOffsetSize: 4,
      stationSeparator: "",
    };

    const result = await testEditor.formats.createFromProps(testKey, formatProps);
    const format = await testEditor.schemaContext.getSchemaItem(result.itemKey!) as Format;
    expect(format?.fullName).to.eql("testSchema.testFormat");
    expect(format?.decimalSeparator).to.eql(",");
    expect(format?.stationOffsetSize).to.eql(4);
    expect(format?.formatTraits).to.eql(FormatTraits.KeepDecimalPoint);
  });
  // TODO: Add test when units are given (needs the unit editing to be created.)
});
