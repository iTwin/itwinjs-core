/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Schema */

import { IModelError } from "@bentley/imodeljs-common";
import { IModelJsNative } from "./IModelJsNative";
import { IModelHost } from "./IModelHost";

export type SchemaKey = IModelJsNative.ECSchemaXmlContext.SchemaKey;
export type SchemaMatchType = IModelJsNative.ECSchemaXmlContext.SchemaMatchType;

/** @hidden */
export class ECSchemaXmlContext {
  private _nativeContext: IModelJsNative.ECSchemaXmlContext | undefined;

  constructor() {
    this._nativeContext = new IModelHost.platform.ECSchemaXmlContext();
  }

  public addSchemaPath(searchPath: string): void {
    this._nativeContext!.addSchemaPath(searchPath);
  }

  public setSchemaLocater(locater: IModelJsNative.ECSchemaXmlContext.SchemaLocaterCallback): void {
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
