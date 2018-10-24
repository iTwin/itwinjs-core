/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module TypeConverters */

import { TypeConverter } from "./TypeConverter";
import { TypeConverterManager } from "./TypeConverterManager";
import { Primitives, ConvertedPrimitives } from "./valuetypes";

/**
 * Point type converter.
 */
export abstract class BasePointTypeConverter extends TypeConverter {
  public async convertToString(value?: Primitives.Point): Promise<string> {
    if (!value || !Array.isArray(value) || value.length === 0)
      return "";
    let stringValue: string = value[0].toString();
    for (let i = 1; i < value.length; i++)
      stringValue += ", " + value[i];
    return stringValue;
  }
  public async convertFromString(value: string): Promise<ConvertedPrimitives.Point | undefined> {
    return this.constructPoint(value.split(","));
  }
  protected abstract constructPoint(_values: string[]): ConvertedPrimitives.Point | undefined;

  protected abstract getVectorLength(point: Primitives.Point): number | undefined;

  public sortCompare(a: Primitives.Point, b: Primitives.Point, _ignoreCase?: boolean): number {
    const aLength = this.getVectorLength(a);
    const bLength = this.getVectorLength(b);

    if (aLength === bLength)
      return 0;
    if (aLength === undefined)
      return -1;
    if (bLength === undefined)
      return 1;

    return aLength - bLength;
  }
}

/**
 * Point2d type converter.
 */
export class Point2dTypeConverter extends BasePointTypeConverter {
  protected getVectorLength(point: Primitives.Point): number | undefined {
    const derivedPoint = this.constructPoint(point);

    if (derivedPoint === undefined)
      return undefined;

    return Math.sqrt(Math.pow(derivedPoint.x, 2) + Math.pow(derivedPoint.y, 2));
  }

  protected constructPoint(values: string[]): ConvertedPrimitives.Point2d | undefined {
    if (values.length !== 2 || isNaN(+values[0]) || isNaN(+values[1]))
      return undefined;

    return { x: +values[0].trim(), y: +values[1].trim() };
  }
}
TypeConverterManager.registerConverter("point2d", Point2dTypeConverter);

/**
 * Point3d type converter.
 */
export class Point3dTypeConverter extends BasePointTypeConverter {
  protected getVectorLength(point: Primitives.Point): number | undefined {
    const derivedPoint = this.constructPoint(point);

    if (derivedPoint === undefined)
      return undefined;

    return Math.sqrt(Math.pow(derivedPoint.x, 2) + Math.pow(derivedPoint.y, 2) + Math.pow(derivedPoint.z, 2));
  }

  protected constructPoint(values: string[]): ConvertedPrimitives.Point3d | undefined {
    if (values.length !== 3 || isNaN(+values[0]) || isNaN(+values[1]) || isNaN(+values[2]))
      return undefined;

    return { x: +values[0].trim(), y: +values[1].trim(), z: +values[2].trim() };
  }
}
TypeConverterManager.registerConverter("point3d", Point3dTypeConverter);
