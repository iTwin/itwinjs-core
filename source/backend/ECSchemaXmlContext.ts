/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { AddonRegistry } from "./AddonRegistry";
import { IModelError } from "@bentley/imodeljs-common";
import { AddonECSchemaXmlContext } from "@bentley/imodeljs-nodeaddonapi/imodeljs-nodeaddonapi";

export type SchemaKey = AddonECSchemaXmlContext.SchemaKey;
export type SchemaMatchType = AddonECSchemaXmlContext.SchemaMatchType;

export class ECSchemaXmlContext {
  private _nativeContext: AddonECSchemaXmlContext | undefined;

  constructor() {
    this._nativeContext = new (AddonRegistry.getAddon()).AddonECSchemaXmlContext();
  }

  public addSchemaPath(searchPath: string): void {
    this._nativeContext!.addSchemaPath(searchPath);
  }

  public setSchemaLocater(locater: AddonECSchemaXmlContext.SchemaLocaterCallback): void {
    this._nativeContext!.setSchemaLocater(locater);
  }

  public readSchemaFromXmlFile(filePath: string): any {
    const response = this._nativeContext!.readSchemaFromXmlFile(filePath);
    if (response.error) {
      throw new IModelError(response.error.status, response.error.message);
    }

    return JSON.parse(response.result!);
  }
}
