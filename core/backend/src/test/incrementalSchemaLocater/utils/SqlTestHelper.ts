
import { OpenMode } from "@itwin/core-bentley";
import { ProfileOptions } from "@itwin/core-common";
import { SchemaXmlFileLocater } from "@itwin/ecschema-locaters";
import { Schema, SchemaContext, SchemaGraphUtil, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { globSync } from "glob";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import * as path from "path";
import * as fs from "fs";
import { IModelSchemaLocater } from "./IModelSchemaLocater";
import { BriefcaseDb, IModelDb, StandaloneDb } from "../../../IModelDb";
import { IModelHost } from "../../../IModelHost";
import { IModelJsFs } from "../../../IModelJsFs";
import { KnownTestLocations } from "../../KnownTestLocations";

export class SqlTestHelper {
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

  public static async setup(iModelId?: string, isStandalone: boolean = true, openReadOnly = true): Promise<void> {
    if (!IModelHost.isValid)
      await IModelHost.startup();

    if (this._iModel !== undefined)
      throw new Error("iModel already loaded");

    if (iModelId) {
      this.testBimFile = path.join(__dirname, "../../../iModels", `${iModelId}.bim`);
    } else {
      this.testBimFile = this.initializeTestIModel();
    }

    if (isStandalone) {
      this._iModel = StandaloneDb.openFile(this.testBimFile, OpenMode.ReadWrite);
    } else {
      this._iModel = await BriefcaseDb.open({
        fileName: this.testBimFile,
        readonly: openReadOnly,
        key: "test-iModel",
      });
    }

    this.context = new SchemaContext();
    this.context.addLocater(new IModelSchemaLocater(this._iModel));
    const xmlLocater = new SchemaXmlFileLocater();
    xmlLocater.addSchemaSearchPath(path.join(KnownTestLocations.assetsDir, "IncrementalSchemaLocater"));
    this.context.addLocater(xmlLocater);
    const nodeLocater = this.configureNodeSchemaLocater();
    this.context.addLocater(nodeLocater);
  }

  private static initializeTestIModel() {
    const testBim = path.join(KnownTestLocations.assetsDir, "IncrementalSchemaLocater", "test-bim.bim");

    if (IModelJsFs.existsSync(testBim)) {~
      IModelJsFs.removeSync(testBim);
    }

    const localBim = StandaloneDb.createEmpty(testBim, {
      allowEdit: "true",
      rootSubject: {
        name: "SqlTestingDb"
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
      throw new Error(`The schema '${schemaKey.name}' could not be found.`)
    const schemaXml = await this.getOrderedSchemaStrings(testSchema);

    await this._iModel.importSchemaStrings(schemaXml);
    this._iModel.saveChanges();

    if (this._iModel.isBriefcaseDb() && !this._iModel.isReadonly) {
      await (this.iModel as BriefcaseDb).pushChanges({ description: "import test schema" });
    }
  }

  public static async importSchemaStrings(schemaKey: SchemaKey, schemaXml: string []): Promise<void> {
    if (!this.isLoaded) {
      throw new Error("iModel has not been loaded")
    }

    if (!this._iModel)
      throw new Error("iModel is undefined");

    if (undefined !== this._iModel.querySchemaVersion(schemaKey.name))
      return;

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
      await IModelHost.shutdown();
    }
  }

  public static async getSchemaString(schema: Schema): Promise<string> {
    // Serialize schema to the document object
    let doc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>`, "application/xml");
    doc = await schema.toXml(doc);

    const serializer = new XMLSerializer();
    const xml = serializer.serializeToString(doc);

    return xml;
  }

  public static async getOrderedSchemaStrings(insertSchema: Schema): Promise<string[]> {
    const schemas = SchemaGraphUtil.buildDependencyOrderedSchemaList(insertSchema);
    const schemaStrings = await Promise.all(schemas.map(async (schema) => SqlTestHelper.getSchemaString(schema)));
    return schemaStrings;
  }

  private static configureNodeSchemaLocater(): SchemaXmlFileLocater {
    const schemaDir = path.join(KnownTestLocations.nodeModulesDir, "@bentley");
    const searchPaths: string[] = [];
    searchPaths.push(...globSync(path.join(schemaDir, "*schema"), { windowsPathsNoEscape: true }).filter(fs.existsSync));

    const locater = new SchemaXmlFileLocater();
    locater.addSchemaSearchPaths(searchPaths);
    return locater;
  }
};