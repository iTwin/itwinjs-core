/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { SchemaContext, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { SchemaXmlFileLocater } from "@itwin/ecschema-locaters";
import { IModelHost, KnownLocations } from "@itwin/core-backend";
import path from "path";
import { assert } from "chai";
import * as fs from "fs-extra";

describe("SchemaXmlFileLocater - locate standard schema", () => {
  it("Schema path is less than 260 character long", async () => {
    await IModelHost.startup();
    const cont = new SchemaContext();
    const loc = new SchemaXmlFileLocater();
    cont.addLocater(loc);
    const schemaPath: string = path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "Standard");
    loc.addSchemaSearchPath(schemaPath);

    const schemaKey = new SchemaKey("Units", 1, 0, 0);
    const schema = await cont.getSchema(schemaKey, SchemaMatchType.Latest);

    assert.isDefined(schema);
    assert.strictEqual(schema?.name, "Units");
    await IModelHost.shutdown();
  });

  it("Schema path is more than 1k character long", async () => {
    await IModelHost.startup();
    const cont = new SchemaContext();
    const loc = new SchemaXmlFileLocater();
    cont.addLocater(loc);
    const oldSchemaPath: string = path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "Standard");
    let longSchemaPath: string = path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "StandardCopy");
    for (let i = 0; i < 30; i++) {
      longSchemaPath = path.join(longSchemaPath, "ThisIsA35CharacterLongSubFolderName");
    }
    if (!fs.existsSync(longSchemaPath)) {
      fs.mkdirSync(longSchemaPath, {recursive: true});
    }
    fs.copySync(oldSchemaPath, longSchemaPath, {recursive: true});
    assert.isTrue(longSchemaPath.length > 1000);
    loc.addSchemaSearchPath(longSchemaPath);

    const schemaKey = new SchemaKey("Units", 1, 0, 0);
    const schema = await cont.getSchema(schemaKey, SchemaMatchType.Latest);

    assert.isDefined(schema);
    assert.strictEqual(schema?.name, "Units");
    await IModelHost.shutdown();
    if (fs.existsSync(path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "StandardCopy"))) {
      fs.rmSync(path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "StandardCopy"), {recursive: true});
    }
  });

  it("Schema path is more than 10k character long", async () => {
    await IModelHost.startup();
    const cont = new SchemaContext();
    const loc = new SchemaXmlFileLocater();
    cont.addLocater(loc);
    const oldSchemaPath: string = path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "Standard");
    let longSchemaPath: string = path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "StandardCopy");
    for (let i = 0; i < 300; i++) {
      longSchemaPath = path.join(longSchemaPath, "ThisIsA35CharacterLongSubFolderName");
    }
    if (!fs.existsSync(longSchemaPath)) {
      fs.mkdirSync(longSchemaPath, {recursive: true});
    }
    fs.copySync(oldSchemaPath, longSchemaPath, {recursive: true});
    assert.isTrue(longSchemaPath.length > 10000);
    loc.addSchemaSearchPath(longSchemaPath);

    const schemaKey = new SchemaKey("Units", 1, 0, 0);
    const schema = await cont.getSchema(schemaKey, SchemaMatchType.Latest);

    assert.isDefined(schema);
    assert.strictEqual(schema?.name, "Units");
    await IModelHost.shutdown();
    if (fs.existsSync(path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "StandardCopy"))) {
      fs.rmSync(path.join(KnownLocations.nativeAssetsDir, "ECSchemas", "StandardCopy"), {recursive: true});
    }
  });
});
