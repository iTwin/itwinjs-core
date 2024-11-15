/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import path from "path";
import { assert } from "chai";
import { ECVersion, Schema, SchemaContext, SchemaKey } from "@itwin/ecschema-metadata";
import { PublishedSchemaJsonFileLocater } from "@itwin/ecschema-locaters";

describe.only("PublishedSchemaJsonFileLocater - locate standard schemas", () => {
  const lrSchemaKey = new SchemaKey("LinearReferencing");
  const unitsSchemaKey = new SchemaKey("Units");

  async function checkSchema(context: SchemaContext, schemaKey: SchemaKey) {
    const schema = await context.getSchema(schemaKey);
    assert.isDefined(schema);
    assert.strictEqual(schema?.name, schemaKey.name);
  }

  it("PublishedSchemaJsonFileLocater - check default schema paths", async () => {
    const context = new SchemaContext();
    context.addLocater(new PublishedSchemaJsonFileLocater());

    await checkSchema(context, new SchemaKey("BisCore")); // Get BisCore
    await checkSchema(context, new SchemaKey("Generic")); // Get a Dgn schema
    await checkSchema(context, lrSchemaKey); // Get a Domain schema
    await checkSchema(context, unitsSchemaKey); // Get a Standard schema
  });

  function testLocatedSchema(locatedSchema: Schema | undefined, schemaName: string, schemaItemName: string, isSchemaItemDefined: boolean) {
    assert.isDefined(locatedSchema);
    assert.strictEqual(locatedSchema?.name, schemaName);
    assert.equal(locatedSchema?.getItemSync(schemaItemName) !== undefined, isSchemaItemDefined);
  }

  it("PublishedSchemaJsonFileLocater - check search path precedence - sync", () => {
    let context = new SchemaContext();
    const locater = new PublishedSchemaJsonFileLocater();

    // The locater has been setup to use the default standard schemas released by core-backend package.
    context.addLocater(locater);

    let linearReferencingSchema = context.getSchemaSync(lrSchemaKey);
    testLocatedSchema(linearReferencingSchema, "LinearReferencing", "DummyTestClass", false); // should not be loaded
    testLocatedSchema(linearReferencingSchema, "LinearReferencing", "LinearLocationElement", true); // should be loaded

    let unitsSchema = context.getSchemaSync(unitsSchemaKey);
    testLocatedSchema(unitsSchema, "Units", "DummyUnit", false); // should not be loaded
    testLocatedSchema(unitsSchema, "Units", "FAHRENHEIT", true); // should be loaded

    // Test case 1: Register single search path at a time
    context = new SchemaContext();
    context.addLocater(locater);

    // Now give the locater specific search paths to the dummy "LinearReferencing" and "Units" schemas
    locater.addSchemaSearchPath(path.join(__dirname, "assets", "DummyTestSchemas", "Dgn"));
    locater.addSchemaSearchPath(path.join(__dirname, "assets", "DummyTestSchemas", "Domain"));
    locater.addSchemaSearchPath(path.join(__dirname, "assets", "DummyTestSchemas", "Standard"));

    linearReferencingSchema = context.getSchemaSync(lrSchemaKey);
    testLocatedSchema(linearReferencingSchema, "LinearReferencing", "DummyTestClass", true); // should be loaded
    testLocatedSchema(linearReferencingSchema, "LinearReferencing", "LinearLocationElement", true); // should be loaded

    unitsSchema = context.getSchemaSync(unitsSchemaKey);
    testLocatedSchema(unitsSchema, "Units", "DummyUnit", true); // should be loaded
    testLocatedSchema(unitsSchema, "Units", "FAHRENHEIT", true); // should be loaded

    // Test case 2: Register multiple search paths at a time
    context = new SchemaContext();
    const newLocater = new PublishedSchemaJsonFileLocater();
    context.addLocater(newLocater);

    // Now give the locater specific search paths to the dummy "LinearReferencing" and "Units" schemas
    newLocater.addSchemaSearchPaths([path.join(__dirname, "assets", "DummyTestSchemas", "Dgn"), path.join(__dirname, "assets", "DummyTestSchemas", "Domain"), path.join(__dirname, "assets", "DummyTestSchemas", "Standard")]);

    linearReferencingSchema = context.getSchemaSync(lrSchemaKey);
    testLocatedSchema(linearReferencingSchema, "LinearReferencing", "DummyTestClass", true);  // should be loaded
    testLocatedSchema(linearReferencingSchema, "LinearReferencing", "LinearLocationElement", true); // should be loaded

    unitsSchema = context.getSchemaSync(unitsSchemaKey);
    testLocatedSchema(unitsSchema, "Units", "DummyUnit", true); // should be loaded
    testLocatedSchema(unitsSchema, "Units", "FAHRENHEIT", true); // should be loaded
  });

  it("PublishedSchemaJsonFileLocater - check search path precedence - async", async () => {
    let context = new SchemaContext();
    const locater = new PublishedSchemaJsonFileLocater();

    // The locater has been setup to use the default standard schemas released by core-backend package.
    context.addLocater(locater);

    let linearReferencingSchema = await context.getSchema(lrSchemaKey);
    testLocatedSchema(linearReferencingSchema, "LinearReferencing", "DummyTestClass", false); // should not be loaded
    testLocatedSchema(linearReferencingSchema, "LinearReferencing", "LinearLocationElement", true); // should be loaded

    let unitsSchema = await context.getSchema(unitsSchemaKey);
    testLocatedSchema(unitsSchema, "Units", "DummyUnit", false); // should not be loaded
    testLocatedSchema(unitsSchema, "Units", "FAHRENHEIT", true); // should be loaded

    // Test case 1: Register single search path at a time
    context = new SchemaContext();
    context.addLocater(locater);

    // Now give the locater specific search paths to the dummy "LinearReferencing" and "Units" schemas
    locater.addSchemaSearchPath(path.join(__dirname, "assets", "DummyTestSchemas", "Dgn"));
    locater.addSchemaSearchPath(path.join(__dirname, "assets", "DummyTestSchemas", "Domain"));
    locater.addSchemaSearchPath(path.join(__dirname, "assets", "DummyTestSchemas", "Standard"));

    linearReferencingSchema = await context.getSchema(lrSchemaKey);
    testLocatedSchema(linearReferencingSchema, "LinearReferencing", "DummyTestClass", true); // should be loaded
    testLocatedSchema(linearReferencingSchema, "LinearReferencing", "LinearLocationElement", true); // should be loaded

    unitsSchema = await context.getSchema(unitsSchemaKey);
    testLocatedSchema(unitsSchema, "Units", "DummyUnit", true); // should be loaded
    testLocatedSchema(unitsSchema, "Units", "FAHRENHEIT", true); // should be loaded

    // Test case 2: Register multiple search paths at a time
    context = new SchemaContext();
    const newLocater = new PublishedSchemaJsonFileLocater();
    context.addLocater(newLocater);

    // Now give the locater specific search paths to the dummy "LinearReferencing" and "Units" schemas
    newLocater.addSchemaSearchPaths([path.join(__dirname, "assets", "DummyTestSchemas", "Dgn"), path.join(__dirname, "assets", "DummyTestSchemas", "Domain"), path.join(__dirname, "assets", "DummyTestSchemas", "Standard")]);

    linearReferencingSchema = await context.getSchema(lrSchemaKey);
    testLocatedSchema(linearReferencingSchema, "LinearReferencing", "DummyTestClass", true); // should be loaded
    testLocatedSchema(linearReferencingSchema, "LinearReferencing", "LinearLocationElement", true); // should be loaded

    unitsSchema = await context.getSchema(unitsSchemaKey);
    testLocatedSchema(unitsSchema, "Units", "DummyUnit", true); // should be loaded
    testLocatedSchema(unitsSchema, "Units", "FAHRENHEIT", true); // should be loaded
  });

  it("PublishedSchemaJsonFileLocater - schema version check", () => {
    for (const schemaVersion of [new ECVersion(2, 0, 0), new ECVersion(2, 5, 0), new ECVersion(5, 0, 0)]) {
      const context = new SchemaContext();
      // The locater has been setup to use the default standard schemas released by core-backend package.
      context.addLocater(new PublishedSchemaJsonFileLocater());

      const linearReferencingSchema = context.getSchemaSync(new SchemaKey("LinearReferencing", schemaVersion));
      assert.isDefined(linearReferencingSchema);
      assert.strictEqual(linearReferencingSchema?.name, "LinearReferencing");
      assert.strictEqual(linearReferencingSchema?.schemaKey.version.read, 2);
      assert.strictEqual(linearReferencingSchema?.schemaKey.version.write, 0);
      assert.isAbove(linearReferencingSchema?.schemaKey.version?.minor ?? -1, 0);
    }
  });
});
