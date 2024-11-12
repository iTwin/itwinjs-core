/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Schema, SchemaContext, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { BackendSchemasXmlFileLocater, SchemaXmlFileLocater } from "@itwin/ecschema-locaters";
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

describe("BackendSchemasXmlFileLocater - locate standard schemas", () => {
  it("BackendSchemasXmlFileLocater general use", async () => {
    const context = new SchemaContext();
    const loc = new BackendSchemasXmlFileLocater(KnownLocations.nativeAssetsDir);
    context.addLocater(loc);

    // Get a Dgn schema
    const dgnSchema = await context.getSchema(new SchemaKey("Generic", 1, 0, 5), SchemaMatchType.Latest);
    assert.isDefined(dgnSchema);
    assert.strictEqual(dgnSchema?.name, "Generic");

    // Get a Domain schema
    const domainSchema = await context.getSchema(new SchemaKey("LinearReferencing", 2, 0, 3), SchemaMatchType.Latest);
    assert.isDefined(domainSchema);
    assert.strictEqual(domainSchema?.name, "LinearReferencing");

    // Get a Standard schema
    const standardSchema = await context.getSchema(new SchemaKey("Units", 1, 0, 8), SchemaMatchType.Latest);
    assert.isDefined(standardSchema);
    assert.strictEqual(standardSchema?.name, "Units");
  });

  function testLocatedSchema(locatedSchema: Schema | undefined, schemaName: string, schemaItemName: string, isSchemaItemDefined: boolean) {
    assert.isDefined(locatedSchema);
    assert.strictEqual(locatedSchema?.name, schemaName);
    assert.equal(locatedSchema?.getItemSync(schemaItemName) !== undefined, isSchemaItemDefined);
  }

  it("BackendSchemasXmlFileLocater search path precedence check - sync", () => {
    let context = new SchemaContext();
    const locater = new BackendSchemasXmlFileLocater(KnownLocations.nativeAssetsDir);

    // The locater has been setup to use the default standard schemas released by core-backend package.
    context.addLocater(locater);

    let linearReferencingSchema = context.getSchemaSync(new SchemaKey("LinearReferencing", 2, 0, 3));
    testLocatedSchema(linearReferencingSchema, "LinearReferencing", "DummyTestClass", false); // should not be loaded
    testLocatedSchema(linearReferencingSchema, "LinearReferencing", "LinearLocationElement", true); // should be loaded

    let unitsSchema = context.getSchemaSync(new SchemaKey("Units", 1, 0, 8));
    testLocatedSchema(unitsSchema, "Units", "DummyUnit", false); // should not be loaded
    testLocatedSchema(unitsSchema, "Units", "FAHRENHEIT", true); // should be loaded

    // Test case 1: Register single search path at a time
    context = new SchemaContext();
    context.addLocater(locater);

    // Now give the locater specific search paths to the dummy "LinearReferencing" and "Units" schemas
    locater.addSchemaSearchPath(path.join(__dirname, "assets", "DummyTestSchemas", "Domain"));
    locater.addSchemaSearchPath(path.join(__dirname, "assets", "DummyTestSchemas", "Standard"));

    linearReferencingSchema = context.getSchemaSync(new SchemaKey("LinearReferencing", 2, 0, 3));
    testLocatedSchema(linearReferencingSchema, "LinearReferencing", "DummyTestClass", true); // should be loaded
    testLocatedSchema(linearReferencingSchema, "LinearReferencing", "LinearLocationElement", true); // should be loaded

    unitsSchema = context.getSchemaSync(new SchemaKey("Units", 1, 0, 8));
    testLocatedSchema(unitsSchema, "Units", "DummyUnit", true); // should be loaded
    testLocatedSchema(unitsSchema, "Units", "FAHRENHEIT", true); // should be loaded

    // Test case 2: Register multiple search path at a time
    context = new SchemaContext();
    const newLocater = new BackendSchemasXmlFileLocater(KnownLocations.nativeAssetsDir);
    context.addLocater(newLocater);

    // Now give the locater specific search paths to the dummy "LinearReferencing" and "Units" schemas
    newLocater.addSchemaSearchPaths([path.join(__dirname, "assets", "DummyTestSchemas", "Domain"), path.join(__dirname, "assets", "DummyTestSchemas", "Standard")]);

    linearReferencingSchema = context.getSchemaSync(new SchemaKey("LinearReferencing", 2, 0, 3));
    testLocatedSchema(linearReferencingSchema, "LinearReferencing", "DummyTestClass", true);  // should be loaded
    testLocatedSchema(linearReferencingSchema, "LinearReferencing", "LinearLocationElement", true); // should be loaded

    unitsSchema = context.getSchemaSync(new SchemaKey("Units", 1, 0, 8));
    testLocatedSchema(unitsSchema, "Units", "DummyUnit", true); // should be loaded
    testLocatedSchema(unitsSchema, "Units", "FAHRENHEIT", true); // should be loaded
  });

  it("BackendSchemasXmlFileLocater search path precedence check - async", async () => {
    let context = new SchemaContext();
    const locater = new BackendSchemasXmlFileLocater(KnownLocations.nativeAssetsDir);

    // The locater has been setup to use the default standard schemas released by core-backend package.
    context.addLocater(locater);

    let linearReferencingSchema = await context.getSchema(new SchemaKey("LinearReferencing", 2, 0, 3));
    testLocatedSchema(linearReferencingSchema, "LinearReferencing", "DummyTestClass", false); // should not be loaded
    testLocatedSchema(linearReferencingSchema, "LinearReferencing", "LinearLocationElement", true); // should be loaded

    let unitsSchema = await context.getSchema(new SchemaKey("Units", 1, 0, 8));
    testLocatedSchema(unitsSchema, "Units", "DummyUnit", false); // should not be loaded
    testLocatedSchema(unitsSchema, "Units", "FAHRENHEIT", true); // should be loaded

    // Test case 1: Register single search path at a time
    context = new SchemaContext();
    context.addLocater(locater);

    // Now give the locater specific search paths to the dummy "LinearReferencing" and "Units" schemas
    locater.addSchemaSearchPath(path.join(__dirname, "assets", "DummyTestSchemas", "Domain"));
    locater.addSchemaSearchPath(path.join(__dirname, "assets", "DummyTestSchemas", "Standard"));

    linearReferencingSchema = await context.getSchema(new SchemaKey("LinearReferencing", 2, 0, 3));
    testLocatedSchema(linearReferencingSchema, "LinearReferencing", "DummyTestClass", true); // should be loaded
    testLocatedSchema(linearReferencingSchema, "LinearReferencing", "LinearLocationElement", true); // should be loaded

    unitsSchema = await context.getSchema(new SchemaKey("Units", 1, 0, 8));
    testLocatedSchema(unitsSchema, "Units", "DummyUnit", true); // should be loaded
    testLocatedSchema(unitsSchema, "Units", "FAHRENHEIT", true); // should be loaded

    // Test case 2: Register multiple search path at a time
    context = new SchemaContext();
    const newLocater = new BackendSchemasXmlFileLocater(KnownLocations.nativeAssetsDir);
    context.addLocater(newLocater);

    // Now give the locater specific search paths to the dummy "LinearReferencing" and "Units" schemas
    newLocater.addSchemaSearchPaths([path.join(__dirname, "assets", "DummyTestSchemas", "Domain"), path.join(__dirname, "assets", "DummyTestSchemas", "Standard")]);

    linearReferencingSchema = await context.getSchema(new SchemaKey("LinearReferencing", 2, 0, 3));
    testLocatedSchema(linearReferencingSchema, "LinearReferencing", "DummyTestClass", true); // should be loaded
    testLocatedSchema(linearReferencingSchema, "LinearReferencing", "LinearLocationElement", true); // should be loaded

    unitsSchema = await context.getSchema(new SchemaKey("Units", 1, 0, 8));
    testLocatedSchema(unitsSchema, "Units", "DummyUnit", true); // should be loaded
    testLocatedSchema(unitsSchema, "Units", "FAHRENHEIT", true); // should be loaded
  });
});
