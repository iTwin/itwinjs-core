/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, expect } from "chai";
import * as path from "path";
import * as fs from "fs";
import * as glob from "glob";
import { ECObjectsError, ECObjectsStatus, ECVersion, SchemaContext, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { SchemaXmlStringLocater } from "../SchemaXmlStringLocater";
import { StringSchemaKey } from "../SchemaStringLocater";

describe("SchemaXmlStringLocater tests:", () => {
  let locater: SchemaXmlStringLocater;
  let context: SchemaContext;
  let schemaStrings: string [];

  const loadSchemaString = (schemaName: string) => {
    const searchPath = path.join(__dirname, "assets", `${schemaName}.ecschema.xml`);
    const file = fs.readFileSync(searchPath);
    return file.toString();
  };

  const loadSchemaStrings = () => {
    const schemas: string [] = [];
    const searchPath = path.join(__dirname, "assets", "Schema*.ecschema.xml");
    const result = new glob.GlobSync(searchPath, { sync: true });
    for (const match of result.found) {
      const file = fs.readFileSync(match);
      if (!file)
        continue;
      schemas.push(file.toString());
    }
    return schemas;
  };

  beforeEach(() => {
    schemaStrings = loadSchemaStrings();
    locater = new SchemaXmlStringLocater();
    context = new SchemaContext();
    context.addLocater(locater);
  });

  it("locate valid schema with multiple references", async () => {
    locater.addSchemaStrings(schemaStrings);
    const schemaKey = new SchemaKey("SchemaA", 1, 1, 1);
    const schema = await context.getSchema(schemaKey, SchemaMatchType.Exact);

    assert.isDefined(schema);
    assert.strictEqual(schema!.schemaKey.name, "SchemaA");
    assert.strictEqual(schema!.schemaKey.version.toString(), "01.01.01");
  });

  it("locate valid schema with multiple references synchronously", () => {
    locater.addSchemaStrings(schemaStrings);
    const schemaKey = new SchemaKey("SchemaA", 1, 1, 1);
    const schema = context.getSchemaSync(schemaKey, SchemaMatchType.Exact);

    assert.isDefined(schema);
    assert.strictEqual(schema!.schemaKey.name, "SchemaA");
    assert.strictEqual(schema!.schemaKey.version.toString(), "01.01.01");
  });

  it("getSchema called multiple times for same schema", async () => {
    locater.addSchemaStrings(schemaStrings);
    const schemaKey = new SchemaKey("SchemaD", 4, 4, 4);

    const locater1 = await locater.getSchema(schemaKey, SchemaMatchType.Exact, new SchemaContext());
    const locater2 = await locater.getSchema(schemaKey, SchemaMatchType.Exact, new SchemaContext());
    const context1 = await context.getSchema(schemaKey, SchemaMatchType.Exact);
    const context2 = await context.getSchema(schemaKey, SchemaMatchType.Exact);

    // locater should not cache, but context should cache
    assert.notEqual(locater1, locater2);
    assert.notEqual(locater1, context1);
    assert.strictEqual(context1, context2);
  });

  it("getSchema which does not exist, returns undefined", async () => {
    locater.addSchemaStrings(schemaStrings);
    const schemaKey = new SchemaKey("DoesNotExist");

    assert.isUndefined(await locater.getSchema(schemaKey, SchemaMatchType.Exact, context));
  });

  it("addSchemaString, bad schema tag, throws", async () => {
    const schemaString = loadSchemaString("BadSchemaTag");
    try {
      locater.addSchemaString(schemaString);
    } catch (e) {
      const error = e as ECObjectsError;
      assert.strictEqual(error.errorNumber, ECObjectsStatus.InvalidSchemaXML);
      return;
    }

    assert.fail(0, 1, "Expected ECObjects exception");
  });

  it("addSchemaString, bad schema name tag, throws", async () => {
    const schemaString = loadSchemaString("BadSchemaNameTag");
    try {
      locater.addSchemaString(schemaString);
    } catch (e) {
      const error = e as ECObjectsError;
      assert.strictEqual(error.errorNumber, ECObjectsStatus.InvalidSchemaXML);
      return;
    }

    assert.fail(0, 1, "Expected ECObjects exception");
  });

  it("addSchemaString, bad schema version tag, throws", async () => {
    const schemaString = loadSchemaString("BadSchemaVersionTag");
    try {
      locater.addSchemaString(schemaString);
    } catch (e) {
      const error = e as ECObjectsError;
      assert.strictEqual(error.errorNumber, ECObjectsStatus.InvalidSchemaXML);
      return;
    }

    assert.fail(0, 1, "Expected ECObjects exception");
  });

  it("getSchema, full version, succeeds", async () => {
    locater.addSchemaStrings(schemaStrings);
    const stub = await locater.getSchema(new SchemaKey("SchemaA", 1, 1, 1), SchemaMatchType.Exact, context);
    assert.isDefined(stub);
    const key = stub!.schemaKey as StringSchemaKey;
    assert.strictEqual(key.name, "SchemaA");
    assert.strictEqual(key.version.toString(), "01.01.01");
  });

  it("getSchema, reference does not exist, throws.", async () => {
    const schemaString = loadSchemaString("RefDoesNotExist");
    locater.addSchemaString(schemaString);
    try {
      await locater.getSchema(new SchemaKey("RefDoesNotExist", 1, 1, 1), SchemaMatchType.Exact, context);
    } catch (e) {
      const error = e as ECObjectsError;
      assert.strictEqual(error.errorNumber, ECObjectsStatus.UnableToLocateSchema);
      return;
    }

    assert.fail();
  });

  it("getSchema, references set", async () => {
    locater.addSchemaStrings(schemaStrings);

    const schemaA = await context.getSchema(new SchemaKey("SchemaA", 1, 1, 1), SchemaMatchType.Exact);
    const schemaB = await context.getSchema(new SchemaKey("SchemaB", 2, 2, 2), SchemaMatchType.Exact);
    const schemaC = await context.getSchema(new SchemaKey("SchemaC", 3, 3, 3), SchemaMatchType.Exact);
    const schemaD = await context.getSchema(new SchemaKey("SchemaD", 4, 4, 4), SchemaMatchType.Exact);

    assert.isDefined(schemaA);
    assert.strictEqual(schemaA!.references.length, 2);
    assert.deepEqual(schemaA!.references[0], schemaC);
    assert.deepEqual(schemaA!.references[1], schemaB);
    assert.deepEqual(schemaA!.references[0].references[0], schemaD);
    assert.deepEqual(schemaA!.references[1].references[0], schemaC);
    assert.deepEqual(schemaA!.references[1].references[1], schemaD);
  });

  it("getSchema, exact version, wrong minor, fails", async () => {
    locater.addSchemaStrings(schemaStrings);
    assert.isUndefined(await context.getSchema(new SchemaKey("SchemaA", 1, 1, 2), SchemaMatchType.Exact));
  });

  it("getSchema, latest, succeeds", async () => {
    locater.addSchemaStrings(schemaStrings);
    const stub = await locater.getSchema(new SchemaKey("SchemaA", 1, 1, 0), SchemaMatchType.Latest, context);

    assert.isDefined(stub);
    assert.strictEqual(stub!.schemaKey.name, "SchemaA");
    assert.strictEqual(stub!.schemaKey.version.toString(), "02.00.02");
  });

  it("getSchema, latest write compatible, succeeds", async () => {
    locater.addSchemaStrings(schemaStrings);
    const stub = await context.getSchema(new SchemaKey("SchemaA", 1, 1, 0), SchemaMatchType.LatestWriteCompatible);

    assert.isDefined(stub);
    assert.strictEqual(stub!.schemaKey.name, "SchemaA");
    assert.strictEqual(stub!.schemaKey.version.toString(), "01.01.01");
  });

  it("getSchema, latest write compatible, write version wrong, fails", async () => {
    locater.addSchemaStrings(schemaStrings);
    assert.isUndefined(await context.getSchema(new SchemaKey("SchemaA", 1, 2, 0), SchemaMatchType.LatestWriteCompatible));
  });

  it("getSchema, latest read compatible, succeeds", async () => {
    locater.addSchemaStrings(schemaStrings);
    const stub = await context.getSchema(new SchemaKey("SchemaA", 1, 0, 0), SchemaMatchType.LatestReadCompatible);

    assert.isDefined(stub);
    assert.strictEqual(stub!.schemaKey.name, "SchemaA");
    assert.strictEqual(stub!.schemaKey.version.toString(), "01.01.01");
  });

  it("getSchema, latest read compatible, read version wrong, fails", async () => {
    locater.addSchemaStrings(schemaStrings);
    assert.isUndefined(await context.getSchema(new SchemaKey("SchemaA", 2, 1, 1), SchemaMatchType.LatestReadCompatible));
  });

  it("sync - should ignore commented out schema references", () => {
    locater.addSchemaStrings(schemaStrings);
    const schemaString = loadSchemaString("RefCommentedOut");
    locater.addSchemaString(schemaString);

    const stub = context.getSchemaSync(new SchemaKey("RefCommentedOut", 1, 1, 1), SchemaMatchType.LatestReadCompatible);

    assert.isDefined(stub);
    assert.strictEqual(stub!.schemaKey.name, "RefCommentedOut");
    assert.strictEqual(stub!.schemaKey.version.toString(), "01.01.01");
  });

  it("async - should ignore commented out schema references", async () => {
    locater.addSchemaStrings(schemaStrings);
    const schemaString = loadSchemaString("RefCommentedOut");
    locater.addSchemaString(schemaString);

    const stub = await context.getSchema(new SchemaKey("RefCommentedOut", 1, 1, 1), SchemaMatchType.LatestReadCompatible);

    assert.isDefined(stub);
    assert.strictEqual(stub!.schemaKey.name, "RefCommentedOut");
    assert.strictEqual(stub!.schemaKey.version.toString(), "01.01.01");
  });

  it("getSchemaKey, valid version and name, succeeds", () => {
    const schemaXml = `<ECSchema schemaName="SchemaA" version="1.1.1"> </ECSchema>`;
    const key = locater.getSchemaKey(schemaXml);
    assert.deepEqual(key, new SchemaKey("SchemaA", new ECVersion(1, 1, 1)));
  });

  it("getSchemaKey, invalid xml, throws", () => {
    const schemaXml = `<ECSchemaBad schemaName="SchemaA" version="1.1.1"> </ECSchemaBad>`;
    expect(() => locater.getSchemaKey(schemaXml)).to.throw(ECObjectsError, `Could not find '<ECSchema>' tag in the given string`);
  });

  it("getSchemaKey, invalid schemaName attribute, throws", () => {
    const schemaXml = `<ECSchema schemaNameBad="SchemaA" version="1.1.1"> </ECSchema>`;
    expect(() => locater.getSchemaKey(schemaXml)).to.throw(ECObjectsError, `Could not find the ECSchema 'schemaName' or 'version' tag in the given string`);
  });

  it("getSchemaKey, invalid schemaName, throws", () => {
    const schemaXml = `<ECSchema version="1.1.1" schemaName=""> </ECSchema>`;
    expect(() => locater.getSchemaKey(schemaXml)).to.throw(ECObjectsError, `Could not find the ECSchema 'schemaName' or 'version' tag in the given string`);
  });

  it("getSchemaKey, invalid version attribute, throws", () => {
    const schemaXml = `<ECSchema schemaName="SchemaA" versionBad="1.1.1"> </ECSchema>`;
    expect(() => locater.getSchemaKey(schemaXml)).to.throw(ECObjectsError, `Could not find the ECSchema 'schemaName' or 'version' tag in the given string`);
  });

  it("getSchemaKey, invalid version, throws", () => {
    const schemaXml = `<ECSchema schemaName="SchemaA" version=""> </ECSchema>`;
    expect(() => locater.getSchemaKey(schemaXml)).to.throw(ECObjectsError, `Could not find the ECSchema 'schemaName' or 'version' tag in the given string`);
  });
});

