/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { IModelError } from "@bentley/imodeljs-common";
import { IModelHost } from "./IModelHost";
import { IModelJsNative } from "@bentley/imodeljs-native";

/** @internal */
export type SchemaKey = IModelJsNative.ECSchemaXmlContext.SchemaKey;

/** @internal */
export type SchemaMatchType = IModelJsNative.ECSchemaXmlContext.SchemaMatchType;

/** @internal */
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
