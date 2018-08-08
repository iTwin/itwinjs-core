/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Schema */

import { NativePlatformRegistry } from "./NativePlatformRegistry";
import { IModelError } from "@bentley/imodeljs-common";
import { NativeECSchemaXmlContext } from "./imodeljs-native-platform-api";

export type SchemaKey = NativeECSchemaXmlContext.SchemaKey;
export type SchemaMatchType = NativeECSchemaXmlContext.SchemaMatchType;

/** @hidden */
export class ECSchemaXmlContext {
  private _nativeContext: NativeECSchemaXmlContext | undefined;

  constructor() {
    this._nativeContext = new (NativePlatformRegistry.getNativePlatform()).NativeECSchemaXmlContext();
  }

  public addSchemaPath(searchPath: string): void {
    this._nativeContext!.addSchemaPath(searchPath);
  }

  public setSchemaLocater(locater: NativeECSchemaXmlContext.SchemaLocaterCallback): void {
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
