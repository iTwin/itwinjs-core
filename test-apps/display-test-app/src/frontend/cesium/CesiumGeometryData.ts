/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { Point3d } from "@itwin/core-geometry";

export class CesiumGeometryData {
  private static _templateData = new Map<symbol, Point3d[][]>();

  public static storePointStrings(templateId: symbol, pointStrings: Point3d[][]): void {
    this._templateData.set(templateId, pointStrings);
  }

  public static getPointStrings(templateId: symbol): Point3d[][] | undefined {
    return this._templateData.get(templateId);
  }

  public static clearPointStrings(templateId: symbol): void {
    this._templateData.delete(templateId);
  }

  public static clearAll(): void {
    this._templateData.clear();
  }
}