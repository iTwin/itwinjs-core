/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
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
import { setPrimitiveConverterLookup } from "./PrimitiveConverterRegistry.js";

type RegisteredPrimitiveConverter =
  | PointPrimitiveConverter
  | LineStringPrimitiveConverter
  | ShapePrimitiveConverter
  | ArcPrimitiveConverter
  | PathPrimitiveConverter
  | LoopPrimitiveConverter
  | PolyfacePrimitiveConverter
  | SolidPrimitivePrimitiveConverter;

/** Factory for creating geometry-specific primitive converters */
export class PrimitiveConverterFactory {
  private static _converters = new Map<string, RegisteredPrimitiveConverter>();

  static {
    PrimitiveConverterFactory.registerDefaultConverters();
    setPrimitiveConverterLookup((geometryType) => PrimitiveConverterFactory.getConverter(geometryType));
  }

  private static registerDefaultConverters(): void {
    const pointConverter = new PointPrimitiveConverter('pointstring');
    const point2dConverter = new PointPrimitiveConverter('pointstring2d');
    this._converters.set('pointstring', pointConverter);
    this._converters.set('pointstring2d', point2dConverter);

    const lineConverter = new LineStringPrimitiveConverter('linestring');
    const line2dConverter = new LineStringPrimitiveConverter('linestring2d');
    this._converters.set('linestring', lineConverter);
    this._converters.set('linestring2d', line2dConverter);

    const shapeConverter = new ShapePrimitiveConverter('shape');
    const shape2dConverter = new ShapePrimitiveConverter('shape2d');
    this._converters.set('shape', shapeConverter);
    this._converters.set('shape2d', shape2dConverter);

    const arcConverter = new ArcPrimitiveConverter('arc');
    const arc2dConverter = new ArcPrimitiveConverter('arc2d');
    this._converters.set('arc', arcConverter);
    this._converters.set('arc2d', arc2dConverter);

    this._converters.set('path', new PathPrimitiveConverter());
    this._converters.set('loop', new LoopPrimitiveConverter());
    this._converters.set('polyface', new PolyfacePrimitiveConverter());
    this._converters.set('solidPrimitive', new SolidPrimitivePrimitiveConverter());
  }

  public static getConverter(geometryType?: string): RegisteredPrimitiveConverter | undefined {
    return this._converters.get(geometryType || 'pointstring');
  }

  public static setConverter(geometryType: string, converter: RegisteredPrimitiveConverter): void {
    this._converters.set(geometryType, converter);
  }

  public static getCoordinateBuilder(): typeof CoordinateBuilder {
    return CoordinateBuilder;
  }

  public static getCoordinateStorage(): typeof CoordinateStorage {
    return CoordinateStorage;
  }
}
