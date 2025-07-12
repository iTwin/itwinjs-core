
import * as path from "path";
import { BriefcaseDb } from "../../../IModelDb";
import { IModelHost } from "../../../IModelHost";
import { KnownTestLocations } from "../../KnownTestLocations";

export class TestIModel {
  private _iModel: BriefcaseDb | undefined;
  public get iModel(): BriefcaseDb {
    if(this._iModel === undefined)
      throw new Error("iModel not loaded");
    return this._iModel;
  }

  public get isLoaded(): boolean {
    return this._iModel !== undefined;
  }

  public get name(): string {
    return this.iModel.name;
  }

  public async getSchemaNames(): Promise<string[]> {
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

  public async load(briefcase: string): Promise<void> {
    const pathToBriefCase = path.join(KnownTestLocations.assetsDir, "IncrementalSchemaLocater", briefcase);
    if(this._iModel !== undefined)
      throw new Error("iModel already loaded");

    if(!IModelHost.isValid) {
      await IModelHost.startup();
    }
    this._iModel = await BriefcaseDb.open({
      fileName: pathToBriefCase,
      readonly: true,
      key: "test-iModel",
    });
  }

  public async close(): Promise<void> {
    if(this._iModel !== undefined) {
      await IModelHost.shutdown();
    }
  }
};