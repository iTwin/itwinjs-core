/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as path from "path";
import * as ec from "@itwin/ecschema-metadata";
import { FileSchemaKey } from "../SchemaFileLocater";
import { SchemaJsonFileLocater } from "../SchemaJsonFileLocater";

describe("SchemaJsonFileLocater tests: ", () => {
  let locater: SchemaJsonFileLocater;
  let context: ec.SchemaContext;

  beforeEach(() => {
    locater = new SchemaJsonFileLocater();

    locater.addSchemaSearchPath(path.join(__dirname, "assets"));
    context = new ec.SchemaContext();
    context.addLocater(locater);
  });

  it("locate valid schema with multiple references", async () => {
    const schemaKey = new ec.SchemaKey("SchemaA", 1, 1, 1);
    const schema = await context.getSchema(schemaKey, ec.SchemaMatchType.Exact);

    assert.isDefined(schema);
    assert.strictEqual(schema!.schemaKey.name, "SchemaA");
    assert.strictEqual(schema!.schemaKey.version.toString(), "01.01.01");
  });

  it("locate valid schema with multiple references synchronously", () => {
    const schemaKey = new ec.SchemaKey("SchemaA", 1, 1, 1);
    const schema = context.getSchemaSync(schemaKey, ec.SchemaMatchType.Exact);

    assert.isDefined(schema);
    assert.strictEqual(schema!.schemaKey.name, "SchemaA");
    assert.strictEqual(schema!.schemaKey.version.toString(), "01.01.01");
  });

  it("getSchema called multiple times for same schema", async () => {
    const schemaKey = new ec.SchemaKey("SchemaD", 4, 4, 4);

    const locater1 = await locater.getSchema(schemaKey, ec.SchemaMatchType.Exact, new ec.SchemaContext());
    const locater2 = await locater.getSchema(schemaKey, ec.SchemaMatchType.Exact, new ec.SchemaContext());
    const context1 = await context.getSchema(schemaKey, ec.SchemaMatchType.Exact);
    const context2 = await context.getSchema(schemaKey, ec.SchemaMatchType.Exact);

    // locater should not cache, but context should cache
    assert.notEqual(locater1, locater2);
    assert.notEqual(locater1, context1);
    assert.strictEqual(context1, context2);
  });

  it("getSchema called multiple times for same schema synchronously", () => {
    const schemaKey = new ec.SchemaKey("SchemaD", 4, 4, 4);

    const locater1 = locater.getSchemaSync(schemaKey, ec.SchemaMatchType.Exact, new ec.SchemaContext());
    const locater2 = locater.getSchemaSync(schemaKey, ec.SchemaMatchType.Exact, new ec.SchemaContext());
    const context1 = context.getSchemaSync(schemaKey, ec.SchemaMatchType.Exact);
    const context2 = context.getSchemaSync(schemaKey, ec.SchemaMatchType.Exact);

    // locater should not cache, but context should cache
    assert.notEqual(locater1, locater2);
    assert.notEqual(locater1, context1);
    assert.strictEqual(context1, context2);
  });

  it("getSchema which does not exist, returns undefined", async () => {
    const schemaKey = new ec.SchemaKey("DoesNotExist");
    const result = await locater.getSchema(schemaKey, ec.SchemaMatchType.Exact, context);
    assert.isUndefined(result);
  });

  it("loadSchema from file, bad schema name, throws", async () => {
    const schemaKey = new ec.SchemaKey("BadSchemaName");

    try {
      await locater.getSchema(schemaKey, ec.SchemaMatchType.Exact, context);
    } catch (e) {
      const error = e as ec.ECObjectsError;
      assert.strictEqual(error.errorNumber, ec.ECObjectsStatus.InvalidECJson);
      return;
    }

    assert.fail(0, 1, "Expected ECObjects exception");
  });

  it("loadSchema from file, bad schema version, throws", async () => {
    const schemaKey = new ec.SchemaKey("BadSchemaVersion");

    try {
      await locater.getSchema(schemaKey, ec.SchemaMatchType.Exact, context);
    } catch (e) {
      const error = e as ec.ECObjectsError;
      assert.strictEqual(error.errorNumber, ec.ECObjectsStatus.InvalidECJson);
      return;
    }

    assert.fail(0, 1, "Expected ECObjects exception");
  });

  it("getSchema, full version, succeeds", async () => {
    const stub = await locater.getSchema(new ec.SchemaKey("SchemaA", 1, 1, 1), ec.SchemaMatchType.Exact, context);

    assert.isDefined(stub);
    const key = stub!.schemaKey as FileSchemaKey;
    assert.strictEqual(key.name, "SchemaA");
    assert.strictEqual(key.version.toString(), "01.01.01");
  });

  it("getSchema, exact version, wrong minor, fails", async () => {
    assert.isUndefined(await locater.getSchema(new ec.SchemaKey("SchemaA", 1, 1, 2), ec.SchemaMatchType.Exact, context));
  });

  it("getSchema, latest, succeeds", async () => {
    const schema = await locater.getSchema(new ec.SchemaKey("SchemaA", 1, 1, 0), ec.SchemaMatchType.Latest, context);
    assert.isDefined(schema);
    assert.strictEqual(schema!.schemaKey.name, "SchemaA");
    assert.strictEqual(schema!.schemaKey.version.toString(), "02.00.02");
  });

  it("getSchema, latest write compatible, succeeds", async () => {
    const stub = await locater.getSchema(new ec.SchemaKey("SchemaA", 1, 1, 0), ec.SchemaMatchType.LatestWriteCompatible, context);

    assert.isDefined(stub);
    assert.strictEqual(stub!.schemaKey.name, "SchemaA");
    assert.strictEqual(stub!.schemaKey.version.toString(), "01.01.01");
  });

  it("getSchema, latest write compatible, write version wrong, fails", async () => {
    assert.isUndefined(await locater.getSchema(new ec.SchemaKey("SchemaA", 1, 2, 0), ec.SchemaMatchType.LatestWriteCompatible, context));
  });

  it("getSchema, latest read compatible, succeeds", async () => {
    const stub = await locater.getSchema(new ec.SchemaKey("SchemaA", 1, 0, 0), ec.SchemaMatchType.LatestReadCompatible, context);

    assert.isDefined(stub);
    assert.strictEqual(stub!.schemaKey.name, "SchemaA");
    assert.strictEqual(stub!.schemaKey.version.toString(), "01.01.01");
  });

  it("getSchema, latest read compatible, read version wrong, fails", async () => {
    assert.isUndefined(await locater.getSchema(new ec.SchemaKey("SchemaA", 2, 1, 1), ec.SchemaMatchType.LatestReadCompatible, context));
  });
});
