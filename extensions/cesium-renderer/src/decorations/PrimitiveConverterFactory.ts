/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Cesium
 */

import { PrimitiveConverter } from "./PrimitiveConverter.js";
import { PointPrimitiveConverter } from "./PointPrimitiveConverter.js";
import { LineStringPrimitiveConverter } from "./LineStringPrimitiveConverter.js";
import { ShapePrimitiveConverter } from "./ShapePrimitiveConverter.js";
import { ArcPrimitiveConverter } from "./ArcPrimitiveConverter.js";
import { PathPrimitiveConverter } from "./PathPrimitiveConverter.js";
import { LoopPrimitiveConverter } from "./LoopPrimitiveConverter.js";
import { PolyfacePrimitiveConverter } from "./PolyfacePrimitiveConverter.js";
import { SolidPrimitivePrimitiveConverter } from "./SolidPrimitivePrimitiveConverter.js";
import { CoordinateBuilder } from "./CoordinateBuilder.js";
import { CoordinateStorage } from "./CoordinateStorage.js";

/** Factory for creating geometry-specific primitive converters */
export class PrimitiveConverterFactory {
  private static _converters = new Map<string, PrimitiveConverter>();

  static {
    this._converters.set('pointstring', new PointPrimitiveConverter());
    this._converters.set('linestring', new LineStringPrimitiveConverter());
    this._converters.set('shape', new ShapePrimitiveConverter());
    this._converters.set('arc', new ArcPrimitiveConverter());
    this._converters.set('path', new PathPrimitiveConverter());
    this._converters.set('loop', new LoopPrimitiveConverter());
    this._converters.set('polyface', new PolyfacePrimitiveConverter());
    this._converters.set('solidPrimitive', new SolidPrimitivePrimitiveConverter());
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