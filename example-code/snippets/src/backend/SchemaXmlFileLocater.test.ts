/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ECVersion, Schema, SchemaContext, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { PublishedSchemaXmlFileLocater, SchemaXmlFileLocater } from "@itwin/ecschema-locaters";
import { KnownLocations } from "@itwin/core-backend";
import path from "path";
import { assert } from "chai";
import * as fs from "fs-extra";

describe("SchemaXmlFileLocater - locate standard schema", () => {
  it("Schema path is less than 260 character long", async () => {
    const cont = new SchemaContext();
    const loc = new SchemaXmlFileLocater();
    cont.addLocater(loc);
    const schemaPath: string = path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "Standard");
    loc.addSchemaSearchPath(schemaPath);

    assert.isTrue(schemaPath.length < 260);
    const schemaKey = new SchemaKey("Units", 1, 0, 0);
    const schema = await cont.getSchema(schemaKey, SchemaMatchType.Latest);

    assert.isDefined(schema);
    assert.strictEqual(schema?.name, "Units");
  });

  it("Schema path is between 260 and 1024 character long", async () => {
    const cont = new SchemaContext();
    const loc = new SchemaXmlFileLocater();
    cont.addLocater(loc);
    const oldSchemaPath: string = path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "Standard");
    let longSchemaPath: string = path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "StandardCopy");
    for (let i = 0; i < 20; i++) {
      longSchemaPath = path.join(longSchemaPath, "ThisIsA35CharacterLongSubFolderName");
    }
    if (!fs.existsSync(longSchemaPath)) {
      fs.mkdirSync(longSchemaPath, {recursive: true});
    }
    fs.copySync(oldSchemaPath, longSchemaPath, {recursive: true});
    assert.isTrue(longSchemaPath.length > 260);
    assert.isTrue(longSchemaPath.length < 1024);
    loc.addSchemaSearchPath(longSchemaPath);

    const schemaKey = new SchemaKey("Units", 1, 0, 0);
    const schema = await cont.getSchema(schemaKey, SchemaMatchType.Latest);

    assert.isDefined(schema);
    assert.strictEqual(schema?.name, "Units");
    if (fs.existsSync(path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "StandardCopy"))) {
      fs.rmSync(path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "StandardCopy"), {recursive: true});
    }
  });
});

describe("PublishedSchemaXmlFileLocater - locate standard schemas", () => {
  const lrSchemaKey = new SchemaKey("LinearReferencing");
  const unitsSchemaKey = new SchemaKey("Units");

  async function checkSchema(context: SchemaContext, schemaKey: SchemaKey) {
    const schema = await context.getSchema(schemaKey);
    assert.isDefined(schema);
    assert.strictEqual(schema?.name, schemaKey.name);
  }

  it("PublishedSchemaXmlFileLocater - check default schema paths", async () => {
    const context = new SchemaContext();
    context.addLocater(new PublishedSchemaXmlFileLocater(KnownLocations.nativeAssetsDir));

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

  it("PublishedSchemaXmlFileLocater - check search path precedence - sync", () => {
    let context = new SchemaContext();
    const locater = new PublishedSchemaXmlFileLocater(KnownLocations.nativeAssetsDir);

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
    const newLocater = new PublishedSchemaXmlFileLocater(KnownLocations.nativeAssetsDir);
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

  it("PublishedSchemaXmlFileLocater - check search path precedence - async", async () => {
    let context = new SchemaContext();
    const locater = new PublishedSchemaXmlFileLocater(KnownLocations.nativeAssetsDir);

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
    const newLocater = new PublishedSchemaXmlFileLocater(KnownLocations.nativeAssetsDir);
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

  it("PublishedSchemaXmlFileLocater - schema version check", () => {
    for (const schemaVersion of [new ECVersion(2, 0, 0), new ECVersion(2, 5, 0), new ECVersion(5, 0, 0)]) {
      const context = new SchemaContext();
      // The locater has been setup to use the default standard schemas released by core-backend package.
      context.addLocater(new PublishedSchemaXmlFileLocater(KnownLocations.nativeAssetsDir));

      const linearReferencingSchema = context.getSchemaSync(new SchemaKey("LinearReferencing", schemaVersion));
      assert.isDefined(linearReferencingSchema);
      assert.strictEqual(linearReferencingSchema?.name, "LinearReferencing");
      assert.strictEqual(linearReferencingSchema?.schemaKey.version.read, 2);
      assert.strictEqual(linearReferencingSchema?.schemaKey.version.write, 0);
      assert.isAbove(linearReferencingSchema?.schemaKey.version?.minor ?? -1, 0);
    }
  });
});
