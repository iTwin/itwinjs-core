/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** Generic coordinate storage for captured decoration coordinate data */
export class CoordinateStorage {
  private static _coordinateData = new Map<symbol, import('./DecorationTypes.js').DecorationPrimitiveEntry[]>();

  public static storeCoordinates(templateId: symbol, data: import('./DecorationTypes.js').DecorationPrimitiveEntry[]): void {
    this._coordinateData.set(templateId, data);
  }

  public static getCoordinates(templateId: symbol): import('./DecorationTypes.js').DecorationPrimitiveEntry[] | undefined {
    return this._coordinateData.get(templateId);
  }

  public static clearCoordinates(templateId: symbol): void {
    this._coordinateData.delete(templateId);
  }

  public static clearAll(): void {
    this._coordinateData.clear();
  }
}
