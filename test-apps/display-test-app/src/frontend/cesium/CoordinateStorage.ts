/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

/** Generic coordinate storage for any geometry type */
export class CoordinateStorage {
  private static _coordinateData = new Map<symbol, any>();

  public static storeCoordinates(templateId: symbol, data: any): void {
    this._coordinateData.set(templateId, data);
  }

  public static getCoordinates(templateId: symbol): any {
    return this._coordinateData.get(templateId);
  }

  public static clearCoordinates(templateId: symbol): void {
    this._coordinateData.delete(templateId);
  }

  public static clearAll(): void {
    this._coordinateData.clear();
  }
}