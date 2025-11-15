
import { OpenMode } from "@itwin/core-bentley";
import { ProfileOptions } from "@itwin/core-common";
import { SchemaXmlFileLocater } from "@itwin/ecschema-locaters";
import { Schema, SchemaContext, SchemaGraphUtil, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import * as path from "path";
import { IModelSchemaLocater } from "./IModelSchemaLocater";
import { BriefcaseDb, IModelDb, StandaloneDb } from "../../../IModelDb";
import { IModelHost } from "../../../IModelHost";
import { IModelJsFs } from "../../../IModelJsFs";
import { KnownTestLocations } from "../../KnownTestLocations";

export class IncrementalTestHelper {
  private static _iModel: IModelDb | undefined;
  public static context: SchemaContext;
  public static testBimFile: string;
  public static get iModel(): IModelDb {
    if (this._iModel === undefined)
      throw new Error("iModel not loaded");
    return this._iModel;
  }

  public static get isLoaded(): boolean {
    return this._iModel !== undefined;
  }

  public static async setup(options?: {bimName?: string, disableSchemaLoading?: boolean}): Promise<void> {
    if (!IModelHost.isValid)
      await IModelHost.startup({
        disableIncrementalSchemaLoading: false,
      });

    if (this._iModel !== undefined)
      throw new Error("iModel already loaded");

    if (options?.bimName) {
      const pathToBriefCase = path.join(KnownTestLocations.assetsDir, options.bimName);
      this._iModel = await BriefcaseDb.open({
        fileName: pathToBriefCase,
        readonly: true,
        key: "test-iModel",
      });
    } else {
      this.testBimFile = this.initializeTestIModel();
      this._iModel = StandaloneDb.openFile(this.testBimFile, OpenMode.ReadWrite);
    }

    const configuration = IModelHost.configuration;
    if(configuration && options && options.disableSchemaLoading !== undefined) {
      const previousSetting = configuration.disableIncrementalSchemaLoading;
      configuration.disableIncrementalSchemaLoading = options.disableSchemaLoading;
      this._iModel.onBeforeClose.addOnce(() => {
        configuration.disableIncrementalSchemaLoading = previousSetting;
      });
    }

    this.context = new SchemaContext();
    this.context.addLocater(new IModelSchemaLocater(this._iModel));
    const xmlLocater = new SchemaXmlFileLocater();
    xmlLocater.addSchemaSearchPath(path.join(KnownTestLocations.assetsDir, "IncrementalSchemaLocater"));
    this.context.addLocater(xmlLocater);
  }

  public static async getSchemaNames(): Promise<string[]> {
    const result = new Array<string>();
    const sqlQuery = "SELECT Name, VersionMajor, VersionWrite, VersionMinor FROM meta.ECSchemaDef ORDER BY Name";
    const reader = this.iModel.createQueryReader(sqlQuery);
    while (await reader.step()) {
      const name = reader.current[0];
      const versionMajor = reader.current[1];
      const versionWrite = reader.current[2];
      const versionMinor = reader.current[3];

      result.push(`${name}.${versionMajor}.${versionWrite}.${versionMinor}`);
    }
    return result;
  }

  private static initializeTestIModel() {
    const testBim = path.join(KnownTestLocations.assetsDir, "IncrementalSchemaLocater", "test-bim.bim");

    if (IModelJsFs.existsSync(testBim)) {~
      IModelJsFs.removeSync(testBim);
    }

    const localBim = StandaloneDb.createEmpty(testBim, {
      allowEdit: "true",
      rootSubject: {
        name: "IncrementalSchemaTestingDb"
      },
    });

    localBim.close();

    const nativeDb = IModelDb.openDgnDb({ path: testBim }, OpenMode.ReadWrite, { profile: ProfileOptions.Upgrade });
    nativeDb.saveChanges();
    nativeDb.closeFile();

    return testBim;
  }

  public static async importSchema(schemaKey: SchemaKey): Promise<void> {
    if (!this.isLoaded) {
      throw new Error("iModel has not been loaded")
    }

    if (!this._iModel)
      throw new Error("iModel is undefined");

    if (undefined !== this._iModel.querySchemaVersion(schemaKey.name))
      return;

    const testSchema = await this.context.getSchema(schemaKey, SchemaMatchType.Exact);
    if (undefined === testSchema)
      throw new Error(`The schema '${schemaKey.name}' could not be found.`);
    const schemaXml = await this.getOrderedSchemaStrings(testSchema);

    await this._iModel.importSchemaStrings(schemaXml);
    this._iModel.saveChanges();

    if (this._iModel.isBriefcaseDb() && !this._iModel.isReadonly) {
      await (this.iModel as BriefcaseDb).pushChanges({ description: "import test schema" });
    }
  }

  public static async close(): Promise<void> {
    if (this._iModel !== undefined) {
      this._iModel.close();
      this._iModel = undefined;
    }
  }

  public static async getOrderedSchemaStrings(insertSchema: Schema): Promise<string[]> {
    const schemas = SchemaGraphUtil.buildDependencyOrderedSchemaList(insertSchema);
    const schemaStrings = await Promise.all(schemas.map(async (schema) => IncrementalTestHelper.getSchemaString(schema)));
    return schemaStrings;
  }

  public static async getSchemaString(schema: Schema): Promise<string> {
    // Serialize schema to the document object
    let doc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>`, "application/xml");
    doc = await schema.toXml(doc);

    const serializer = new XMLSerializer();
    const xml = serializer.serializeToString(doc);

    return xml;
  }
};