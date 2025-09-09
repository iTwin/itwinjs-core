/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { PrimitiveConverter } from "./PrimitiveConverter";
import { PointPrimitiveConverter } from "./PointPrimitiveConverter";

/** Factory for creating geometry-specific primitive converters */
export class PrimitiveConverterFactory {
  private static _converters = new Map<string, PrimitiveConverter>();

  static {
    this._converters.set('point-string', new PointPrimitiveConverter());
    this._converters.set('point', new PointPrimitiveConverter());
  }

  public static getConverter(geometryType: string): PrimitiveConverter {
    return this._converters.get(geometryType) ?? this._converters.get('point-string')!;
  }

  public static setConverter(geometryType: string, converter: PrimitiveConverter): void {
    this._converters.set(geometryType, converter);
  }
}