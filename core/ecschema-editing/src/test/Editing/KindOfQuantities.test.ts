/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  ECVersion,
  KindOfQuantity, KindOfQuantityProps, SchemaContext, SchemaItemKey, SchemaKey,
} from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";

describe("KindOfQuantities tests", () => {
  // let testFormatKey: SchemaItemKey;
  let testEditor: SchemaContextEditor;
  let testKey: SchemaKey;
  let context: SchemaContext;
  let phenomenonKey: SchemaItemKey;
  let unitSystemKey: SchemaItemKey;
  let unitKey: SchemaItemKey;

  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    const result = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
    testKey = result.schemaKey!;

    const phenomRes = await testEditor.phenomenons.create(testKey, "testPhenomenon", "testDefinition");
    const unitSystemRes = await testEditor.unitSystems.create(testKey, "testUnitSystem");
    phenomenonKey = phenomRes.itemKey!;
    unitSystemKey = unitSystemRes.itemKey!;
    const unitRes = await testEditor.units.create(testKey, "testUnit", "testDefinition", phenomenonKey, unitSystemKey);
    unitKey = unitRes.itemKey!;
  });

  it("should create a valid KindOfQuantity from KindOfQuantityProps", async () => {
    // TODO: further develop presentationUnits tests
    const koqProps: KindOfQuantityProps = {
      name: "testKoQ",
      relativeError: 2,
      persistenceUnit: "testSchema.testUnit",
      // presentationUnits: [
      //   "Formats.IN",
      //   "Formats.DefaultReal",
      // ],
    };

    const result = await testEditor.kindOfQuantities.createFromProps(testKey, koqProps);
    const kindOfQuantity = await testEditor.schemaContext.getSchemaItem(result.itemKey!) as KindOfQuantity;
    expect(kindOfQuantity.fullName).to.eql("testSchema.testKoQ");
    expect(await kindOfQuantity.persistenceUnit).to.eql(await testEditor.schemaContext.getSchemaItem(unitKey));
  });

  it("try creating KindOfQuantity in unknown schema, throws error", async () => {
    const badKey = new SchemaKey("unknownSchema", new ECVersion(1,0,0));
    await expect(testEditor.kindOfQuantities.create(badKey, "testInvertedUnit", unitKey)).to.be.rejectedWith(Error, `Schema Key ${badKey.toString(true)} not found in context`);;
  });

  it("try creating KindOfQuantity with existing name, throws error", async () => {
    await testEditor.kindOfQuantities.create(testKey, "testKoq", unitKey);
    await expect(testEditor.kindOfQuantities.create(testKey, "testKoq", unitKey)).to.be.rejectedWith(Error, `KindOfQuantity testKoq already exists in the schema ${testKey.name}.`);
  });
});
