/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import { IModelDb, IModelJsNative, PhysicalElement, SnapshotDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { IModelStatus, Logger, LogLevel } from "@itwin/core-bentley";
import { KnownTestLocations } from "../KnownTestLocations";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { ISchemaLocater, Schema, SchemaContext, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { SchemaXmlFileLocater } from "@itwin/ecschema-locaters";
import { IModelError } from "@itwin/core-common";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";

const assert = chai.assert;
const expect = chai.expect;
chai.use(chaiAsPromised);

describe("Schema XML Import Tests", () => {
  let imodel: SnapshotDb;

  before(() => {
    // initialize logging
    if (false) {
      Logger.initializeToConsole();
      Logger.setLevelDefault(LogLevel.Error);
    }
    const testFileName = IModelTestUtils.prepareOutputFile("SchemaXMLImport", "SchemaXMLImport.bim");
    imodel = SnapshotDb.createEmpty(testFileName, { rootSubject: { name: "SchemaXMLImportTest" } }); // IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
    assert.exists(imodel);
  });

  after(() => {
    if (imodel)
      imodel.close();
  });

  it("should import schema XML", async () => {
    const schemaFilePath = path.join(KnownTestLocations.assetsDir, "Test3.ecschema.xml");
    const schemaString = fs.readFileSync(schemaFilePath, "utf8");

    await imodel.importSchemaStrings([schemaString]); // will throw an exception if import fails

    const testDomainClass = imodel.getMetaData("Test3:Test3Element"); // will throw on failure

    assert.equal(testDomainClass.baseClasses.length, 1);
    assert.equal(testDomainClass.baseClasses[0], PhysicalElement.classFullName);
  });
});


/** An ISchemaLocater implementation for locating and retrieving EC Schema objects from an iModel */
class IModelSchemaLocater implements ISchemaLocater {
  public constructor(private _iModel: IModelDb) { }

  public async getSchema<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType, context?: SchemaContext | undefined): Promise<T | undefined> {
    return this.getSchemaSync(schemaKey, matchType, context) as T;
  }

  public getSchemaSync<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType, context?: SchemaContext | undefined): T | undefined {
    if (context !== undefined) {
      let stored = context.getCachedSchemaSync(schemaKey, matchType);
      if (stored !== undefined)
        return stored as T;

      stored = context.getCachedSchemaSync(schemaKey, SchemaMatchType.Latest);
      if (stored !== undefined) {
        throw new IModelError(IModelStatus.VersionTooOld, `${schemaKey.name} - already in iModel but with an older version. Stored version=${stored.readVersion}.${stored.writeVersion}.${stored.minorVersion}. Required version=${schemaKey.readVersion}.${schemaKey.writeVersion}.${schemaKey.minorVersion}.`);
      }
    }

    const schemaProps = this._getSchemaString(schemaKey.name);
    if (!schemaProps)
      return undefined;

    context = context ? context : new SchemaContext();
    return Schema.fromJsonSync(schemaProps, context) as T;
  }

  private _getSchemaString(schemaName: string): string | undefined {
    const val: IModelJsNative.ErrorStatusOrResult<IModelStatus, string> = this._iModel.nativeDb.getSchema(schemaName);
    if (undefined !== val.error) {
      if (IModelStatus.NotFound === val.error.status) {
        return undefined;
      }
      throw new IModelError(val.error.status, `reading schema=${schemaName}`);
    }
    return val.result;
  }
}

describe.only("Schema import using XMLSerializer", () => {
  let imodel: SnapshotDb;
  let context: SchemaContext;

  function createFile(name: string) {
    const testFileName = IModelTestUtils.prepareOutputFile("SchemaXMLImport", `${name}.bim`);
    imodel = SnapshotDb.createEmpty(testFileName, { rootSubject: { name: "SchemaXMLImportTest" } });
    assert.exists(imodel);
  }

  function setupSchemaContext() {
    context = new SchemaContext();
    context.addLocater(new IModelSchemaLocater(imodel));

    const nrlocater = new SchemaXmlFileLocater();
    const schemaDir = path.join(KnownTestLocations.assetsDir, "Standard");
    nrlocater.addSchemaSearchPaths([schemaDir]);
    context.addLocater(nrlocater);
  }

  before(() => {
    Logger.initializeToConsole();
    Logger.setLevelDefault(LogLevel.Error);
  });

  beforeEach(() => {
    createFile("test");
    setupSchemaContext();
  });

  afterEach(() => {
    if (imodel)
      imodel.close();
  });

  it("format and units from files", async () => {
    // The XML file locator will find both schemas
    const formatsSchema = context.getSchemaSync(new SchemaKey("Formats"));
    const unitsSchema = context.getSchemaSync(new SchemaKey("Units"));
    expect(formatsSchema).not.undefined;
    expect(unitsSchema).not.undefined;
    if (formatsSchema === undefined || unitsSchema === undefined)
      return;

    // Schemas are not in the iModel
    expect(imodel.querySchemaVersion('formats')).undefined;
    expect(imodel.querySchemaVersion('units')).undefined;

    // Import the the schema.xml files
    // NB: Do Units first, since Formats references it.
    const unitsXmlFile = path.join(KnownTestLocations.assetsDir, "Standard", "Units.ecschema.xml");
    const formatsXmlFile = path.join(KnownTestLocations.assetsDir, "Standard", "Formats.ecschema.xml");
    expect(fs.existsSync(unitsXmlFile)).true;
    expect(fs.existsSync(formatsXmlFile)).true;

    for (const schemaFile of [unitsXmlFile, formatsXmlFile]) {
      await imodel.importSchemas([schemaFile]);
    }

    // Both schemas should now be in the iModel
    expect(imodel.querySchemaVersion('formats')).not.undefined;
    expect(imodel.querySchemaVersion('units')).not.undefined;
  });

  it("format and units from strings", async () => {
    // The XML file locator will find both schemas
    const formatsSchema = context.getSchemaSync(new SchemaKey("Formats"));
    const unitsSchema = context.getSchemaSync(new SchemaKey("Units"));
    expect(formatsSchema).not.undefined;
    expect(unitsSchema).not.undefined;
    if (formatsSchema === undefined || unitsSchema === undefined)
      return;

    // Schemas are not in the iModel
    expect(imodel.querySchemaVersion('formats')).undefined;
    expect(imodel.querySchemaVersion('units')).undefined;

    // Serialize the schemas and import the resulting XML.
    // NB: Do Units first, since Formats references it.
    for (const schema of [unitsSchema, formatsSchema]) {
      const doc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>`);
      await schema.toXml(doc);

      const serializer = new XMLSerializer();
      const xml = serializer.serializeToString(doc);

      await imodel.importSchemaStrings([xml]);
    }

    // Both schemas should now be in the iModel
    expect(imodel.querySchemaVersion('formats')).not.undefined;
    expect(imodel.querySchemaVersion('units')).not.undefined;
  });

});
