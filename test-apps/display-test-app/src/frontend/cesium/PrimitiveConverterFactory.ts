/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { PrimitiveConverter } from "./PrimitiveConverter";
import { PointPrimitiveConverter } from "./PointPrimitiveConverter";
import { LineStringPrimitiveConverter } from "./LineStringPrimitiveConverter";
import { ShapePrimitiveConverter } from "./ShapePrimitiveConverter";
import { ArcPrimitiveConverter } from "./ArcPrimitiveConverter";
import { CoordinateBuilder } from "./CoordinateBuilder";
import { CoordinateStorage } from "./CoordinateStorage";

/** Factory for creating geometry-specific primitive converters */
export class PrimitiveConverterFactory {
  private static _converters = new Map<string, PrimitiveConverter>();

  static {
    this._converters.set('pointstring', new PointPrimitiveConverter());
    this._converters.set('linestring', new LineStringPrimitiveConverter());
    this._converters.set('shape', new ShapePrimitiveConverter());
    this._converters.set('arc', new ArcPrimitiveConverter());
  }

  public static getConverter(geometryType?: string): PrimitiveConverter | undefined {
    return this._converters.get(geometryType || 'pointstring');
  }

  public static setConverter(geometryType: string, converter: PrimitiveConverter): void {
    this._converters.set(geometryType, converter);
  }

  public static getCoordinateBuilder(): typeof CoordinateBuilder {
    return CoordinateBuilder;
  }

  public static getCoordinateStorage(): typeof CoordinateStorage {
    return CoordinateStorage;
  }
}