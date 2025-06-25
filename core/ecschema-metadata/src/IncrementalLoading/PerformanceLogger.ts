/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/**
 * Contains the properties needed to track load times
 * for SchemaItem queries.
 * @internal
 */
export interface SchemaItemLoadData {
  loadTime: number,
  itemCount: number
}

/**
 * Contains the properties needed to track load times
 * for Schema queries.
 * @internal
 */
export interface SchemaLoadData {
  loadTime?: number,
  schemaItemMap: Map<string, SchemaItemLoadData>;
}

/**
 * Utility class used to log query load times for Schema and
 * SchemaItem queries.
 * @internal
 */
export class PerformanceLogger {
  private _iModelItems: Map<string, Map<string, SchemaLoadData>> = new Map();
  private _label: string;

  // flag that controls if logging is enabled.
  public disableLogging = false;

  /**
   * Initializes a new PerformanceLogger instance.
   * @param label Arbitrary label used to tag this logging session (ex. IModel name)
   */
  constructor(label?: string) {
    this._label = label || "";
  }

  /**
   * Gets the Map of logged Schema entries. The Map key is the iModel name. The Map
   * value is a second Map whose key is a Schema name and value is a SchemaLoadData
   * object.
   */
  public get LogItems(): Map<string, Map<string, SchemaLoadData>> {
    return this._iModelItems;
  }

  /**
   * Adds a new log entry to the Schema Map.
   * @param startTime The start time of the entry to be logged (end time/duration is handled in this method).
   * @param schemaName The Schema being queried.
   */
  public logSchema(startTime: number, schemaName: string) {
    if (this.disableLogging)
      return;

    const loadTime = new Date().getTime() - startTime;

    const schemaMap = this.getSchemaMap(this._label);
    const schemaLoadData = this.getSchemaLoadData(schemaMap, schemaName);

    schemaLoadData.loadTime = loadTime;
  }

  /**
   * Adds a new log entry to the SchemaItem Map.
   * @param startTime The start time of the entry to be logged (end time/duration is handled in this method).
   * @param schemaName The name of the Schema being queried.
   * @param schemaItemType The SchemaItemType name of the type being queried.
   * @param itemCount The number of items retrieved in the query.
   */
  public logSchemaItem(startTime: number, schemaName: string, schemaItemType: string, itemCount: number) {
    if (this.disableLogging)
      return;

    const loadTime = new Date().getTime() - startTime;

    const schemaMap = this.getSchemaMap(this._label);
    const schemaLoadData = this.getSchemaLoadData(schemaMap, schemaName);

    if (schemaLoadData.schemaItemMap.has(schemaItemType))
      throw new Error("There should not be a multiple load times for a given iModel, Schema, SchemaItemType combination.");

    schemaLoadData.schemaItemMap.set(schemaItemType, { loadTime, itemCount });
  }

  /**
   * Clears all log entries from the Map.
   */
  public clearLogs() {
    this._iModelItems.clear();
  }

  private getSchemaMap(iModel: string): Map<string, SchemaLoadData> {
    if (!this._iModelItems.has(iModel)) {
      this._iModelItems.set(iModel, new Map());
    }

    return this._iModelItems.get(iModel) as Map<string, SchemaLoadData>;
  }

  private getSchemaLoadData(schemaMap: Map<string, SchemaLoadData>, schemaName: string): SchemaLoadData {
    if (!schemaMap.has(schemaName))
      schemaMap.set(schemaName, { schemaItemMap: new Map() })

    return schemaMap.get(schemaName) as SchemaLoadData;
  }
}