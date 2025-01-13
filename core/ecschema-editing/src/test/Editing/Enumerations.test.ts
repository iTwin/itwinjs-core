/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { ECClassModifier, Enumeration, EnumerationProps, PrimitiveType, SchemaContext, SchemaItemKey, SchemaItemType, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "../../Editing/Editor";
import { ECEditingStatus } from "../../Editing/Exception";

const expect = chai.expect;
chai.use(chaiAsPromised);

describe("Enumerations tests", () => {
  let testEditor: SchemaContextEditor;
  let testKey: SchemaKey;
  let context: SchemaContext;
  beforeEach(async () => {
    context = new SchemaContext();
    testEditor = new SchemaContextEditor(context);
    testKey = await testEditor.createSchema("testSchema", "test", 1, 0, 0);
  });

  it("should create a new Enumeration class using a SchemaEditor", async () => {
    const enumerators = [
      { name: "enum1", value: 1 },
      { name: "enum2", value: 2 },
    ];
    await testEditor.enumerations.create(testKey, "testEnumeration", PrimitiveType.Integer, "label", true, enumerators);
    const schema = await testEditor.schemaContext.getCachedSchema(testKey);
    const testEnumeration = await schema?.getItem("testEnumeration") as Enumeration;
    expect(testEnumeration).to.not.be.undefined;
    expect(testEnumeration?.schemaItemType).to.eql(SchemaItemType.Enumeration);
    const enumerator1 = testEnumeration?.getEnumeratorByName("enum1");
    expect(enumerator1).to.not.be.undefined;
    expect(enumerator1?.value).to.equal(1);
    const enumerator2 = testEnumeration?.getEnumeratorByName("enum2");
    expect(enumerator2).to.not.be.undefined;
    expect(enumerator2?.value).to.equal(2);
  });

  it("should create a new Enumeration class using EnumerationProps", async () => {
    const enumerationProps: EnumerationProps = {
      name: "testEnumeration",
      type: "string",
      isStrict: true,
      enumerators: [
        {
          name: "testEnumerator",
          value: "test",
        },
      ],
    };

    const result = await testEditor.enumerations.createFromProps(testKey, enumerationProps);
    const testEnumeration = await testEditor.schemaContext.getSchemaItem<Enumeration>(result) as Enumeration;
    expect(testEnumeration.name).to.eql("testEnumeration");
    const enumerator = testEnumeration.getEnumeratorByName("testEnumerator");
    expect(enumerator).to.not.be.undefined;
    expect(enumerator?.value).to.equal("test");
  });

  it("should add Enumerator to existing Enumeration.", async () => {
    const enumerator = { name: "testEnum", value: 1 };
    const enumResult  = await testEditor.enumerations.create(testKey, "testEnumeration", PrimitiveType.Integer);
    await testEditor.enumerations.addEnumerator(enumResult, enumerator);
    const schema = await testEditor.schemaContext.getCachedSchema(testKey);
    const testEnumeration = await schema?.getItem("testEnumeration") as Enumeration;
    const testEnum = testEnumeration.getEnumeratorByName("testEnum");
    expect(testEnum).to.not.be.undefined;
    expect(testEnum?.value).to.equal(1);
  });

  it("add Enumerator to a type that is not an enumeration, throws.", async () => {
    const enumerator = { name: "testEnum", value: 1 };
    const result  = await testEditor.entities.create(testKey, "testEntity", ECClassModifier.None);
    await expect(testEditor.enumerations.addEnumerator(result, enumerator)).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.AddEnumerator);
      expect(error).to.have.nested.property("innerError.message", `Expected ${result.fullName} to be of type Enumeration.`);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.InvalidSchemaItemType);
    });
  });

  it("add string Enumerator to an enumeration of type number, throws.", async () => {
    const enumerator = { name: "testEnum", value: "one" };
    const result  = await testEditor.enumerations.create(testKey, "testEnumeration", PrimitiveType.Integer);
    await expect(testEditor.enumerations.addEnumerator(result, enumerator)).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.AddEnumerator);
      expect(error).to.have.nested.property("innerError.message", `The Enumeration ${result.fullName} has type int, while Enumerator testEnum has type string.`);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.InvalidEnumeratorType);
    });
  });

  it("add number Enumerator to an enumeration of type string, throws.", async () => {
    const enumerator = { name: "testEnum", value: 1 };
    const result  = await testEditor.enumerations.create(testKey, "testEnumeration", PrimitiveType.String);
    await expect(testEditor.enumerations.addEnumerator(result, enumerator)).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.AddEnumerator);
      expect(error).to.have.nested.property("innerError.message", `The Enumeration ${result.fullName} has type string, while Enumerator testEnum has type int.`);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.InvalidEnumeratorType);
    });
  });

  it("add string Enumerator to an enumeration that can't be found, throws.", async () => {
    const enumerator = { name: "testEnum", value: 1 };
    const badKey = new SchemaItemKey("badKey", testKey);
    await expect(testEditor.enumerations.addEnumerator(badKey, enumerator)).to.be.eventually.rejected.then(function (error) {
      expect(error).to.have.property("errorNumber", ECEditingStatus.AddEnumerator);
      expect(error).to.have.nested.property("innerError.message", `Enumeration ${badKey.fullName} could not be found in the schema context.`);
      expect(error).to.have.nested.property("innerError.errorNumber", ECEditingStatus.SchemaItemNotFoundInContext);
    });
  });
});
