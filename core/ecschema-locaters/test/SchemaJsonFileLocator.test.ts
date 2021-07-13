/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as path from "path";
import * as EC from "@bentley/ecschema-metadata";
import { FileSchemaKey, ReadSchemaText } from "../src/SchemaFileLocater";
import { SchemaJsonFileLocater } from "../src/SchemaJsonFileLocater";

describe("SchemaJsonFileLocater tests: ", () => {
  let locater: SchemaJsonFileLocater;
  let context: EC.SchemaContext;

  beforeEach(() => {
    locater = new SchemaJsonFileLocater();

    locater.addSchemaSearchPath(path.join(__dirname, "assets"));
    context = new EC.SchemaContext();
    context.addLocater(locater);
  });

  it("locate valid schema with multiple references", async () => {
    const schemaKey = new EC.SchemaKey("SchemaA", 1, 1, 1);
    let schema = await context.getSchema(schemaKey, EC.SchemaMatchType.Exact);

    assert.isDefined(schema);
    assert.strictEqual(schema!.schemaKey.name, "SchemaA");
    assert.strictEqual(schema!.schemaKey.version.toString(), "01.01.01");

    schema = await context.getLoadingSchema(schemaKey, EC.SchemaMatchType.Exact);

    assert.isDefined(schema);
    assert.strictEqual(schema!.schemaKey.name, "SchemaA");
    assert.strictEqual(schema!.schemaKey.version.toString(), "01.01.01");
  });

  it("locate valid schema with multiple references synchronously", () => {
    const schemaKey = new EC.SchemaKey("SchemaA", 1, 1, 1);
    let schema = context.getSchemaSync(schemaKey, EC.SchemaMatchType.Exact);

    assert.isDefined(schema);
    assert.strictEqual(schema!.schemaKey.name, "SchemaA");
    assert.strictEqual(schema!.schemaKey.version.toString(), "01.01.01");

    schema = context.getLoadingSchemaSync(schemaKey, EC.SchemaMatchType.Exact);

    assert.isDefined(schema);
    assert.strictEqual(schema!.schemaKey.name, "SchemaA");
    assert.strictEqual(schema!.schemaKey.version.toString(), "01.01.01");
  });

  it("getSchema called multiple times for same schema", async () => {
    const schemaKey = new EC.SchemaKey("SchemaD", 4, 4, 4);

    let locater1 = await locater.getSchema(schemaKey, EC.SchemaMatchType.Exact, new EC.SchemaContext());
    let locater2 = await locater.getSchema(schemaKey, EC.SchemaMatchType.Exact, new EC.SchemaContext());
    let context1 = await context.getSchema(schemaKey, EC.SchemaMatchType.Exact);
    let context2 = await context.getSchema(schemaKey, EC.SchemaMatchType.Exact);

    // locater should not cache, but context should cache
    assert.notEqual(locater1, locater2);
    assert.notEqual(locater1, context1);
    assert.strictEqual(context1, context2);

    locater1 = await locater.getLoadingSchema(schemaKey, EC.SchemaMatchType.Exact, new EC.SchemaContext());
    locater2 = await locater.getLoadingSchema(schemaKey, EC.SchemaMatchType.Exact, new EC.SchemaContext());
    context1 = await context.getLoadingSchema(schemaKey, EC.SchemaMatchType.Exact);
    context2 = await context.getLoadingSchema(schemaKey, EC.SchemaMatchType.Exact);

    // locater should not cache, but context should cache
    assert.notEqual(locater1, locater2);
    assert.notEqual(locater1, context1);
    assert.strictEqual(context1, context2);
  });

  it("getSchema called multiple times for same schema synchronously", () => {
    const schemaKey = new EC.SchemaKey("SchemaD", 4, 4, 4);

    let locater1 = locater.getSchemaSync(schemaKey, EC.SchemaMatchType.Exact, new EC.SchemaContext());
    let locater2 = locater.getSchemaSync(schemaKey, EC.SchemaMatchType.Exact, new EC.SchemaContext());
    let context1 = context.getSchemaSync(schemaKey, EC.SchemaMatchType.Exact);
    let context2 = context.getSchemaSync(schemaKey, EC.SchemaMatchType.Exact);

    // locater should not cache, but context should cache
    assert.notEqual(locater1, locater2);
    assert.notEqual(locater1, context1);
    assert.strictEqual(context1, context2);

    locater1 = locater.getLoadingSchemaSync(schemaKey, EC.SchemaMatchType.Exact, new EC.SchemaContext());
    locater2 = locater.getLoadingSchemaSync(schemaKey, EC.SchemaMatchType.Exact, new EC.SchemaContext());
    context1 = context.getLoadingSchemaSync(schemaKey, EC.SchemaMatchType.Exact);
    context2 = context.getLoadingSchemaSync(schemaKey, EC.SchemaMatchType.Exact);

    // locater should not cache, but context should cache
    assert.notEqual(locater1, locater2);
    assert.notEqual(locater1, context1);
    assert.strictEqual(context1, context2);
  });

  it("getSchema which does not exist, returns undefined", async () => {
    const schemaKey = new EC.SchemaKey("DoesNotExist");
    let result = await locater.getSchema(schemaKey, EC.SchemaMatchType.Exact, context);
    assert.isUndefined(result);

    result = await locater.getLoadingSchema(schemaKey, EC.SchemaMatchType.Exact, context);
    assert.isUndefined(result);
  });

  it("loadSchema from file, bad schema name, throws", async () => {
    const schemaKey = new EC.SchemaKey("BadSchemaName");

    try {
      await locater.getSchema(schemaKey, EC.SchemaMatchType.Exact, context);
    } catch (e) {
      const error = e as EC.ECObjectsError;
      assert.strictEqual(error.errorNumber, EC.ECObjectsStatus.InvalidECJson);
      return;
    }

    try {
      await locater.getLoadingSchema(schemaKey, EC.SchemaMatchType.Exact, context);
    } catch (e) {
      const error = e as EC.ECObjectsError;
      assert.strictEqual(error.errorNumber, EC.ECObjectsStatus.InvalidECJson);
      return;
    }

    assert.fail(0, 2, "Expected ECObjects exception");
  });

  it("loadSchema from file, bad schema version, throws", async () => {
    const schemaKey = new EC.SchemaKey("BadSchemaVersion");

    try {
      await locater.getSchema(schemaKey, EC.SchemaMatchType.Exact, context);
    } catch (e) {
      const error = e as EC.ECObjectsError;
      assert.strictEqual(error.errorNumber, EC.ECObjectsStatus.InvalidECJson);
      return;
    }

    try {
      await locater.getLoadingSchema(schemaKey, EC.SchemaMatchType.Exact, context);
    } catch (e) {
      const error = e as EC.ECObjectsError;
      assert.strictEqual(error.errorNumber, EC.ECObjectsStatus.InvalidECJson);
      return;
    }

    assert.fail(0, 2, "Expected ECObjects exception");
  });

  it("getSchema, full version, succeeds", async () => {
    let stub = await locater.getSchema(new EC.SchemaKey("SchemaA", 1, 1, 1), EC.SchemaMatchType.Exact, context);

    assert.isDefined(stub);
    let key = stub!.schemaKey as FileSchemaKey;
    assert.strictEqual(key.name, "SchemaA");
    assert.strictEqual(key.version.toString(), "01.01.01");

    stub = await locater.getLoadingSchema(new EC.SchemaKey("SchemaA", 1, 1, 1), EC.SchemaMatchType.Exact, context);

    assert.isDefined(stub);
    key = stub!.schemaKey as FileSchemaKey;
    assert.strictEqual(key.name, "SchemaA");
    assert.strictEqual(key.version.toString(), "01.01.01");
  });

  it("getSchema, exact version, wrong minor, fails", async () => {
    assert.isUndefined(await locater.getSchema(new EC.SchemaKey("SchemaA", 1, 1, 2), EC.SchemaMatchType.Exact, context));
    assert.isUndefined(await locater.getLoadingSchema(new EC.SchemaKey("SchemaA", 1, 1, 2), EC.SchemaMatchType.Exact, context));
  });

  it("getSchema, latest, succeeds", async () => {
    let schema = await locater.getSchema(new EC.SchemaKey("SchemaA", 1, 1, 0), EC.SchemaMatchType.Latest, context);
    assert.isDefined(schema);
    assert.strictEqual(schema!.schemaKey.name, "SchemaA");
    assert.strictEqual(schema!.schemaKey.version.toString(), "02.00.02");

    schema = await locater.getLoadingSchema(new EC.SchemaKey("SchemaA", 1, 1, 0), EC.SchemaMatchType.Latest, context);
    assert.isDefined(schema);
    assert.strictEqual(schema!.schemaKey.name, "SchemaA");
    assert.strictEqual(schema!.schemaKey.version.toString(), "02.00.02");
  });

  it("getSchema, latest write compatible, succeeds", async () => {
    let stub = await locater.getSchema(new EC.SchemaKey("SchemaA", 1, 1, 0), EC.SchemaMatchType.LatestWriteCompatible, context);

    assert.isDefined(stub);
    assert.strictEqual(stub!.schemaKey.name, "SchemaA");
    assert.strictEqual(stub!.schemaKey.version.toString(), "01.01.01");

    stub = await locater.getLoadingSchema(new EC.SchemaKey("SchemaA", 1, 1, 0), EC.SchemaMatchType.LatestWriteCompatible, context);

    assert.isDefined(stub);
    assert.strictEqual(stub!.schemaKey.name, "SchemaA");
    assert.strictEqual(stub!.schemaKey.version.toString(), "01.01.01");
  });

  it("getSchema, latest write compatible, write version wrong, fails", async () => {
    assert.isUndefined(await locater.getSchema(new EC.SchemaKey("SchemaA", 1, 2, 0), EC.SchemaMatchType.LatestWriteCompatible, context));
    assert.isUndefined(await locater.getLoadingSchema(new EC.SchemaKey("SchemaA", 1, 2, 0), EC.SchemaMatchType.LatestWriteCompatible, context));
  });

  it("getSchema, latest read compatible, succeeds", async () => {
    let stub = await locater.getSchema(new EC.SchemaKey("SchemaA", 1, 0, 0), EC.SchemaMatchType.LatestReadCompatible, context);

    assert.isDefined(stub);
    assert.strictEqual(stub!.schemaKey.name, "SchemaA");
    assert.strictEqual(stub!.schemaKey.version.toString(), "01.01.01");

    stub = await locater.getLoadingSchema(new EC.SchemaKey("SchemaA", 1, 0, 0), EC.SchemaMatchType.LatestReadCompatible, context);

    assert.isDefined(stub);
    assert.strictEqual(stub!.schemaKey.name, "SchemaA");
    assert.strictEqual(stub!.schemaKey.version.toString(), "01.01.01");
  });

  it("getSchema, latest read compatible, read version wrong, fails", async () => {
    assert.isUndefined(await locater.getSchema(new EC.SchemaKey("SchemaA", 2, 1, 1), EC.SchemaMatchType.LatestReadCompatible, context));
    assert.isUndefined(await locater.getLoadingSchema(new EC.SchemaKey("SchemaA", 2, 1, 1), EC.SchemaMatchType.LatestReadCompatible, context));
  });

  it("add schema text to cache", async () => {
    let schemaPath = path.join(__dirname, "assets", "SchemaA.ecschema.json");
    const mockPromise = new Promise<string | undefined>((resolve) => {
       resolve("");
    });
    await locater.addSchemaText(schemaPath, new ReadSchemaText(async () => mockPromise));
    assert.strictEqual(locater.schemaTextsCount, 1);

    // Re-adding exact schema path does nothing
    await locater.addSchemaText(schemaPath, new ReadSchemaText(async () => mockPromise));
    assert.strictEqual(locater.schemaTextsCount, 1);

    schemaPath = path.join(__dirname, "assets", "SchemaD.ecschema.json");
    await locater.addSchemaText(schemaPath, new ReadSchemaText(async () => mockPromise));
    assert.strictEqual(locater.schemaTextsCount, 2);
  });

  it("get schema text from cache", async () => {
    let counter = 0;
    // Counter should increment whenever a new promise is executed
    const readSchemaText = async (schemaPath: string): Promise<string | undefined> => {
      counter++;
      if (!await locater.fileExists(schemaPath))
        return undefined;

      const schemaText = await locater.readUtf8FileToString(schemaPath);
      if (!schemaText)
        return undefined;

      locater.addSchemaSearchPaths([path.dirname(schemaPath)]);
      return schemaText;
    }

    // Should not have any schemaText in locater
    let schemaPath = path.join(__dirname, "assets", "SchemaA.ecschema.json");
    let schemaText = await locater.getSchemaText(schemaPath);
    assert.isUndefined(schemaText);

    await locater.addSchemaText(schemaPath, new ReadSchemaText(async () => readSchemaText(schemaPath)));
    schemaText = await locater.getSchemaText(schemaPath);
    let schemaTextCompareTo = await locater.readUtf8FileToString(schemaPath);
    assert.strictEqual(schemaText, schemaTextCompareTo);
    assert.strictEqual(counter, 1);

    // Should be the same resolved promise for SchemaA, so counter should stay at 1
    schemaText = await locater.getSchemaText(schemaPath);
    assert.strictEqual(schemaText, schemaTextCompareTo);
    assert.strictEqual(counter, 1);

    schemaPath = path.join(__dirname, "assets", "SchemaD.ecschema.json");
    schemaText = await locater.getSchemaText(schemaPath);
    assert.isUndefined(schemaText);

    await locater.addSchemaText(schemaPath, new ReadSchemaText(async () => readSchemaText(schemaPath)));
    schemaText = await locater.getSchemaText(schemaPath);
    schemaTextCompareTo = await locater.readUtf8FileToString(schemaPath);
    assert.strictEqual(schemaText, schemaTextCompareTo);
    assert.strictEqual(counter, 2);

     // Should be the same resolved promise for SchemaD, so counter should stay at 1
    schemaText = await locater.getSchemaText(schemaPath);
    assert.strictEqual(schemaText, schemaTextCompareTo);
    assert.strictEqual(counter, 2);
  });

  it("should get undefined if schema text has not been added or reading it fails", async () => {
    const readSchemaText = async (schemaPath: string): Promise<string | undefined> => {
      if (!await locater.fileExists(schemaPath))
        return undefined;

      const schemaText = await locater.readUtf8FileToString(schemaPath);
      if (!schemaText)
        return undefined;

      locater.addSchemaSearchPaths([path.dirname(schemaPath)]);
      return schemaText;
    }

    const schemaPath = path.join(__dirname, "assets", "DoesNotExist.json");
    let schemaText = await locater.getSchemaText(schemaPath);
    // schemaText is not added in locater so it is not found
    assert.isUndefined(schemaText);

    await locater.addSchemaText(schemaPath, new ReadSchemaText(async () => readSchemaText(schemaPath)));
    schemaText = await locater.getSchemaText(schemaPath);
    // Promise to readSchemaText returns undefined bc path does not exist
    assert.isUndefined(schemaText);
  });
});
