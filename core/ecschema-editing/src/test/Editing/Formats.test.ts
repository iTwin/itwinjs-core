/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ECClassModifier, ECVersion, Format, SchemaContext, SchemaKey } from "@itwin/ecschema-metadata";
import { FormatTraits, FormatType } from "@itwin/core-quantity";
import { SchemaContextEditor } from "../../Editing/Editor";
import { ECEditingStatus } from "../../Editing/Exception";
import { SchemaEditType } from "../../Editing/SchmaEditType";

describe("Formats tests", () => {
  let testEditor: SchemaContextEditor;
  let testKey: SchemaKey;
  let context: SchemaContext;

  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    testKey = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
  });

  it("should create a valid Format", async () => {
    const result = await testEditor.formats.create(testKey, "testFormat", FormatType.Decimal, "testLabel");
    const format = await testEditor.schemaContext.getSchemaItem(result) as Format;
    expect(format.fullName).to.eql("testSchema.testFormat");
    expect(format.label).to.eql("testLabel");
  });

  it("create Format with invalid type for units, throws", async () => {
    const entityResult = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None);
    await expect(testEditor.formats.create(testKey, "testFormat", FormatType.Decimal, "testLabel", [entityResult])).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("schemaEditType", SchemaEditType.CreateSchemaItemFailed);
      expect(error).to.have.nested.property("innerError.message", `The specified Format unit ${entityResult.fullName} is not of type Unit or InvertedUnit`);
      expect(error).to.have.nested.property("innerError.errorStatus", ECEditingStatus.InvalidFormatUnitsSpecified);
    });
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
    const format = await testEditor.schemaContext.getSchemaItem(result) as Format;
    expect(format?.fullName).to.eql("testSchema.testFormat");
    expect(format?.decimalSeparator).to.eql(",");
    expect(format?.stationOffsetSize).to.eql(4);
    expect(format?.formatTraits).to.eql(FormatTraits.KeepDecimalPoint);
  });

  it("try creating format in unknown schema, throws error", async () => {
    const badKey = new SchemaKey("unknownSchema", new ECVersion(1, 0, 0));
    await expect(testEditor.formats.create(badKey, "testFormat", FormatType.Decimal, "testLabel")).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("schemaEditType", SchemaEditType.CreateSchemaItemFailed);
      expect(error).to.have.nested.property("innerError.message", `Schema Key ${badKey.toString(true)} could not be found in the context.`);
      expect(error).to.have.nested.property("innerError.errorStatus", ECEditingStatus.SchemaNotFound);
    });
  });

  it("try creating format with existing name, throws error", async () => {
    await testEditor.formats.create(testKey, "testFormat", FormatType.Decimal, "testLabel");
    await expect(testEditor.formats.create(testKey, "testFormat", FormatType.Decimal, "testLabel")).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("schemaEditType", SchemaEditType.CreateSchemaItemFailed);
      expect(error).to.have.nested.property("innerError.message", `Format testSchema.testFormat already exists in the schema ${testKey.name}.`);
      expect(error).to.have.nested.property("innerError.errorStatus", ECEditingStatus.SchemaItemNameAlreadyExists);
    });
  });
  // TODO: Add test when units are given (needs the unit editing to be created.)
});
