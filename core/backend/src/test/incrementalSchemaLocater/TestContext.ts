import { Schema, SchemaContext, SchemaGraphUtil, SchemaJsonLocater, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { IModelIncrementalSchemaLocater } from "../../IModelIncrementalSchemaLocater";
import { BriefcaseDb, IModelDb, StandaloneDb } from "../../IModelDb";
import { IModelHost } from "../../IModelHost";
import { KnownTestLocations } from "../KnownTestLocations";
import { OpenMode } from "@itwin/core-bentley";
import { IModelJsFs } from "../../IModelJsFs";
import { ProfileOptions } from "@itwin/core-common";
import { SchemaXmlFileLocater } from "@itwin/ecschema-locaters";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import * as path from "path";

interface Options {
  readonly bimFile?: string;
  readonly incrementalSchemaLoading?: "enabled" | "disabled" | undefined;
}

type SchemaLocaterType<TOptions> = TOptions extends { incrementalSchemaLoading: "disabled" } ? never : IModelIncrementalSchemaLocater;

export class TestContext<TLocater = never> implements AsyncDisposable {
  private readonly _iModel: IModelDb;
  private readonly _schemaLocater: TLocater;
  private readonly _assetContext: SchemaContext;

  private constructor(iModel: IModelDb) {
    this._iModel = iModel;
    this._schemaLocater = this._iModel.schemaContext.locaters.find((locater) => {
      return locater instanceof IModelIncrementalSchemaLocater;
    }) as TLocater;

    // Ideally we should not need a seperate context here to locate and locate the bisschemas from the
    // parent imodel context, but due to a bug in the incremental schema logic, we have to do this for now.
    // TODO: remove this when issue #1763 is fixed.
    this._assetContext = new SchemaContext();
    this._assetContext.addLocater(new SchemaJsonLocater((schemaName) => {
      return iModel.getSchemaProps(schemaName);
    }))
    const xmlAssetSchemaLocater = new SchemaXmlFileLocater();
    xmlAssetSchemaLocater.addSchemaSearchPath(path.join(KnownTestLocations.assetsDir, "IncrementalSchemaLocater"));
    this._assetContext.addLocater(xmlAssetSchemaLocater);

    iModel.schemaContext.addLocater(this._assetContext);
  }

  public get iModel(): IModelDb {
    return this._iModel;
  }

  public get schemaLocater(): TLocater {
    return this._schemaLocater;
  }

  public get schemaContext(): SchemaContext {
    return this._iModel.schemaContext;
  }

  public static async create<TOptions extends Options>(options?: TOptions): Promise<TestContext<SchemaLocaterType<TOptions>>> {
    if(IModelHost.isValid) {
      await IModelHost.shutdown();
    }

    await IModelHost.startup({
      incrementalSchemaLoading: options ? options.incrementalSchemaLoading : "enabled",
    });

    const iModel = options?.bimFile ?
      await this.loadIModelFile(options.bimFile) :
      await this.createIModel();

   return new TestContext(iModel);
  }

  private static async loadIModelFile(bimFile: string): Promise<IModelDb> {
    const pathToBriefCase = path.join(KnownTestLocations.assetsDir, bimFile);
    return BriefcaseDb.open({
      fileName: pathToBriefCase,
      readonly: true,
      key: "test-iModel",
    });
  }

  private static async createIModel(): Promise<IModelDb> {
    const testBimPath = path.join(KnownTestLocations.assetsDir, "IncrementalSchemaLocater", "test-bim.bim");

    if (IModelJsFs.existsSync(testBimPath)) {~
      IModelJsFs.removeSync(testBimPath);
    }

    const localBim = StandaloneDb.createEmpty(testBimPath, {
      allowEdit: "true",
      rootSubject: {
        name: "IncrementalSchemaTestingDb"
      },
    });

    localBim.close();

    const nativeDb = IModelDb.openDgnDb({ path: testBimPath }, OpenMode.ReadWrite, { profile: ProfileOptions.Upgrade });
    nativeDb.saveChanges();
    nativeDb.closeFile();

    return StandaloneDb.openFile(testBimPath, OpenMode.ReadWrite);
  }

  public async getSchemaNames(): Promise<string[]> {
    const result = new Array<string>();
    const sqlQuery = "SELECT Name, VersionMajor, VersionWrite, VersionMinor FROM meta.ECSchemaDef ORDER BY Name";
    const reader = this._iModel.createQueryReader(sqlQuery);
    while (await reader.step()) {
      const name = reader.current[0];
      const versionMajor = reader.current[1];
      const versionWrite = reader.current[2];
      const versionMinor = reader.current[3];

      result.push(`${name}.${versionMajor}.${versionWrite}.${versionMinor}`);
    }
    return result;
  }

  public async importAssetSchema(schemaKey: SchemaKey): Promise<Schema> {
    // If schema is already in the iModel, return it.
    if (undefined !== this.iModel.querySchemaVersion(schemaKey.name))
      return await this.schemaContext.getSchema(schemaKey) as Schema;

    // Locate the schema from the assets using the schema contexts asset locaters.
    const testSchema = await this._assetContext.getSchema(schemaKey, SchemaMatchType.Exact);
    if (undefined === testSchema)
      throw new Error(`The schema '${schemaKey.name}' could not be found in the assets folder.`);

    const schemaXml = await getOrderedSchemaStrings(testSchema);
    await this._iModel.importSchemaStrings(schemaXml);
    this._iModel.saveChanges();

    if (this.iModel.isBriefcaseDb() && !this.iModel.isReadonly) {
      await this.iModel.pushChanges({ description: "import test schema" });
    }

    const schema = await this.schemaContext.getSchema(schemaKey);
    if (undefined === schema)
      throw new Error(`The schema '${schemaKey.name}' could not be found after import.`);

    if(schema.loadingController && !schema.loadingController.isComplete) {
      await schema.loadingController.wait();
    }

    return schema;
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    return IModelHost.shutdown();
  }
}

async function getOrderedSchemaStrings(insertSchema: Schema): Promise<string[]> {
  const schemas = SchemaGraphUtil.buildDependencyOrderedSchemaList(insertSchema);
  const schemaStrings = await Promise.all(schemas.map(async (schema) => getSchemaString(schema)));
  return schemaStrings;
}

async function getSchemaString(schema: Schema): Promise<string> {
  // Serialize schema to the document object
  const xmlDocument = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>`, "application/xml");
  await schema.toXml(xmlDocument);

  const serializer = new XMLSerializer();
  const xml = serializer.serializeToString(xmlDocument);

  return xml;
}
