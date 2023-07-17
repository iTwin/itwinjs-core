/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { assert } from "@itwin/core-bentley";
import { IModelError } from "@itwin/core-common";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { IModelHost } from "./IModelHost";

/** @internal */
export type SchemaKey = IModelJsNative.ECSchemaXmlContext.SchemaKey;

/** @internal */
export type SchemaMatchType = IModelJsNative.ECSchemaXmlContext.SchemaMatchType;

/** Context for deserializing ECSchemas
 * @beta
 */
export class ECSchemaXmlContext {
  private _nativeContext: IModelJsNative.ECSchemaXmlContext | undefined;

  constructor() {
    this._nativeContext = new IModelHost.platform.ECSchemaXmlContext();
  }

  public get nativeContext(): IModelJsNative.ECSchemaXmlContext {
    assert(undefined !== this._nativeContext);
    return this._nativeContext;
  }

  /**
   * Adds a file path that should be used to search for a matching schema name
   * @param searchPath Path to the directory where schemas can be found
   */
  public addSchemaPath(searchPath: string): void {
    this.nativeContext.addSchemaPath(searchPath);
  }

  /**
   * Set the last locater to be used when trying to find a schema
   * @param locater Locater that should be used as the last locater when trying to find a schema
   */
  public setSchemaLocater(locater: IModelJsNative.ECSchemaXmlContext.SchemaLocaterCallback): void {
    this.nativeContext.setSchemaLocater(locater);
  }

  /**
   * Adds a schema locater as first to the current context
   * @param locater Locater to add to the current context
   */
  public setFirstSchemaLocater(locater: IModelJsNative.ECSchemaXmlContext.SchemaLocaterCallback): void {
    this.nativeContext.setFirstSchemaLocater(locater);
  }

  /**
   * Reads an ECSchema from an ECSchemaXML-formatted file
   * @param filePath The absolute path of the file
   */
  public readSchemaFromXmlFile(filePath: string): any {
    const response = this.nativeContext.readSchemaFromXmlFile(filePath);
    if (response.error) {
      throw new IModelError(response.error.status, response.error.message);
    }

    assert(undefined !== response.result);
    return JSON.parse(response.result);
  }
}
