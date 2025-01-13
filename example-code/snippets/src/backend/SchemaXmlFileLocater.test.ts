/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ECVersion, ISchemaLocater, Schema, SchemaContext, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
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
    const context = new SchemaContext();
    const locater = new PublishedSchemaXmlFileLocater(KnownLocations.nativeAssetsDir);

    // The locater has been setup to use the default standard schemas released by core-backend package.
    context.addLocater(locater);

    const linearReferencingSchema = context.getSchemaSync(lrSchemaKey);
    testLocatedSchema(linearReferencingSchema, "LinearReferencing", "LinearLocationElement", true); // should be loaded

    const unitsSchema = context.getSchemaSync(unitsSchemaKey);
    testLocatedSchema(unitsSchema, "Units", "FAHRENHEIT", true); // should be loaded
  });

  it("PublishedSchemaXmlFileLocater - check search path precedence - async", async () => {
    const context = new SchemaContext();
    const locater = new PublishedSchemaXmlFileLocater(KnownLocations.nativeAssetsDir);

    // The locater has been setup to use the default standard schemas released by core-backend package.
    context.addLocater(locater);

    const linearReferencingSchema = await context.getSchema(lrSchemaKey);
    testLocatedSchema(linearReferencingSchema, "LinearReferencing", "LinearLocationElement", true); // should be loaded

    const unitsSchema = await context.getSchema(unitsSchemaKey);
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

describe("SchemaXmlFileLocater - Check fallback locater precedence in schema context", () => {
  let ecSchemas: string[];
  let context = new SchemaContext();

  before (() => {
    ecSchemas = [
      path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "V3Conversion"),
      path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "Standard"),
      path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "ECDb"),
      path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "Domain"),
      path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "Dgn"),
    ];
  });

  beforeEach (() => {
    context = new SchemaContext();
  });

  function createLocaterWithPath(searchPath: string, isFallbackLocater: boolean) {
    if (isFallbackLocater) {
      context.addFallbackLocater(new PublishedSchemaXmlFileLocater(searchPath));
    } else {
      const locater = new SchemaXmlFileLocater();
      locater.addSchemaSearchPath(searchPath);
      context.addLocater(locater);
    }
  }

  function assertLocaterPaths(expectedPaths: string[][], actualLocaterPaths: ISchemaLocater[], maxIndexToTest: number, checkFallback: boolean) {
    assert.equal(expectedPaths.length, actualLocaterPaths.length);

    for (let index = 1; index <= maxIndexToTest; ++index)
      assert.deepEqual(expectedPaths[index], (actualLocaterPaths[index] as SchemaXmlFileLocater).searchPaths);

    if (checkFallback) {
      const fallbackLocater = actualLocaterPaths[maxIndexToTest + 1] as PublishedSchemaXmlFileLocater;
      assert.equal(expectedPaths[maxIndexToTest + 1].length, fallbackLocater.searchPaths.length);

      const expectedFallbackPaths = expectedPaths[maxIndexToTest + 1].map(schemaPath => schemaPath.startsWith("\\\\?\\") ? schemaPath.substring(4) : schemaPath);
      assert.deepEqual(expectedFallbackPaths, fallbackLocater.searchPaths);
    }
  }

  it("check locater precedence with a fallback locater added midway", () => {

    // Add 2 xml file locaters
    createLocaterWithPath("FirstLocaterPath", false);
    createLocaterWithPath("SecondLocaterPath", false);

    // Locater at index 0 is the currently undefined SchemaCache
    assertLocaterPaths([[], ["FirstLocaterPath"], ["SecondLocaterPath"]], context.locaters, 2, false);

    // Add a fallback locater for the standard schemas
    createLocaterWithPath(KnownLocations.nativeAssetsDir, true);
    assertLocaterPaths([[], ["FirstLocaterPath"], ["SecondLocaterPath"], ecSchemas], context.locaters, 2, true);

    createLocaterWithPath("ThirdLocaterPath", false);
    assertLocaterPaths([[], ["FirstLocaterPath"], ["SecondLocaterPath"], ["ThirdLocaterPath"], ecSchemas], context.locaters, 3, true);

  });

  it("check locater precedence with a fallback locater added at first", () => {

    // Add a fallback locater for the standard schemas
    createLocaterWithPath(KnownLocations.nativeAssetsDir, true);
    assertLocaterPaths([[], ecSchemas], context.locaters, 0, true);

    // Add a locater
    createLocaterWithPath("FirstLocaterPath", false);
    assertLocaterPaths([[], ["FirstLocaterPath"], ecSchemas], context.locaters, 1, true);

    // Add another locater
    createLocaterWithPath("SecondLocaterPath", false);
    assertLocaterPaths([[], ["FirstLocaterPath"], ["SecondLocaterPath"], ecSchemas], context.locaters, 2, true);
  });


  it("check locater precedence while trying to add multiple fallback locaters", () => {

    // Add 2 xml file locaters
    createLocaterWithPath("FirstLocaterPath", false);
    createLocaterWithPath("SecondLocaterPath", false);

    // Locater at index 0 is the currently undefined SchemaCache
    assertLocaterPaths([[], ["FirstLocaterPath"], ["SecondLocaterPath"]], context.locaters, 2, false);

    // Add a fallback locater for the standard schemas
    createLocaterWithPath(KnownLocations.nativeAssetsDir, true);
    assertLocaterPaths([[], ["FirstLocaterPath"], ["SecondLocaterPath"], ecSchemas], context.locaters, 2, true);

    // Try to add another fallback locater for the standard schemas
    // This locater should be ignored as there is already a fallback locater for the standard schemas
    createLocaterWithPath(KnownLocations.nativeAssetsDir, true);
    assertLocaterPaths([[], ["FirstLocaterPath"], ["SecondLocaterPath"], ecSchemas], context.locaters, 2, true);
  });
});