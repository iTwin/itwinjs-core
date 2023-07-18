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

/** The schema context for deserializing ECSchemas.
 * The schema context is made up of a group of Schema Locators. It can help improve the performance by caching schema information in memory.
 *
 * For example, to read a schema from Xml file, create a new schema context or use a existing one and use [[ECSchemaXmlContext.readSchemaFromXmlFile]] API
 * ```ts
 * const schemaXmlPath = path.join(KnownTestLocations.assetsDir, "TestSchema.ecschema.xml");
 * const context = new ECSchemaXmlContext();
 * const schema = context.readSchemaFromXmlFile(schemaXmlPath);
 * ```
 * @beta
 */
export class ECSchemaXmlContext {
  private _nativeContext: IModelJsNative.ECSchemaXmlContext | undefined;

  constructor() {
    this._nativeContext = new IModelHost.platform.ECSchemaXmlContext();
  }

  /** @internal */
  public get nativeContext(): IModelJsNative.ECSchemaXmlContext {
    assert(undefined !== this._nativeContext);
    return this._nativeContext;
  }

  /**
   * Adds a file path to the list of file paths that will be used to search for a matching schema name.
   * The list of file paths is traversed in a first-in, first-out (FIFO) order, meaning that the first file path added to the list is the first one traversed, and so on.
   * @param searchPath Path to the directory where schemas can be found
   */
  public addSchemaPath(searchPath: string): void {
    this.nativeContext.addSchemaPath(searchPath);
  }

  /**
   * Set the last locater to be used when trying to find a schema
   * @param locater Locater that should be used as the last locater when trying to find a schema
   * @internal
   */
  public setSchemaLocater(locater: IModelJsNative.ECSchemaXmlContext.SchemaLocaterCallback): void {
    this.nativeContext.setSchemaLocater(locater);
  }

  /**
   * Adds a schema locator to the beginning of the list of locators used to search for schemas.
   * This schema locator will be prioritized over other locators when searching for schemas in the current context.
   * @param locater Locater to add to the current context
   * @internal
   */
  public setFirstSchemaLocater(locater: IModelJsNative.ECSchemaXmlContext.SchemaLocaterCallback): void {
    this.nativeContext.setFirstSchemaLocater(locater);
  }

  /**
   * Reads an ECSchema from an ECSchemaXML-formatted file
   * @param filePath The absolute path of the file
   * @throws [[IModelError]] if there is a problem reading schema from the XML file
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
