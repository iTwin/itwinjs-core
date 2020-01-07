/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module TypeConverters */

import { TypeConverter, StandardTypeConverterTypeNames } from "./TypeConverter";
import { TypeConverterManager } from "./TypeConverterManager";
import { Primitives } from "@bentley/imodeljs-frontend";
import { ConvertedPrimitives } from "./valuetypes/ConvertedTypes";

// cSpell:ignore valuetypes

/**
 * Point type converter.
 * @public
 */
export abstract class BasePointTypeConverter extends TypeConverter {
  private formatValue(value: number | string): string {
    if (typeof value === "string")
      value = parseFloat(value);
    return (Math.round(value * 100) / 100).toString();
  }
  public convertToString(value?: Primitives.Point) {
    if (!value)
      return "";
    let stringValue = "";
    if (Array.isArray(value)) {
      if (value.length === 0)
        return "";
      stringValue = this.formatValue(value[0]);
      for (let i = 1; i < value.length; i++)
        stringValue += `, ${this.formatValue(value[i])}`;
    } else {
      stringValue = `${this.formatValue(value.x)}, ${this.formatValue(value.y)}`;
      if ((value as any).z !== undefined)
        stringValue += `, ${this.formatValue((value as any).z)}`;
    }
    return stringValue;
  }
  public convertFromString(value: string) {
    return this.constructPoint(value.split(","));
  }
  protected abstract constructPoint(_values: Primitives.Point): ConvertedPrimitives.Point | undefined;

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
 * @public
 */
export class Point2dTypeConverter extends BasePointTypeConverter {
  protected getVectorLength(point: Primitives.Point): number | undefined {
    const derivedPoint = this.constructPoint(point);

    if (derivedPoint === undefined)
      return undefined;

    return Math.sqrt(Math.pow(derivedPoint.x, 2) + Math.pow(derivedPoint.y, 2));
  }

  protected constructPoint(values: Primitives.Point): ConvertedPrimitives.Point2d | undefined {
    if (Array.isArray(values)) {
      if (values.length !== 2 || isNaN(+values[0]) || isNaN(+values[1]))
        return undefined;
      return { x: +values[0], y: +values[1] };
    }
    return values;
  }
}

TypeConverterManager.registerConverter(StandardTypeConverterTypeNames.Point2d, Point2dTypeConverter);

/**
 * Point3d type converter.
 * @public
 */
export class Point3dTypeConverter extends BasePointTypeConverter {
  protected getVectorLength(point: Primitives.Point): number | undefined {
    const derivedPoint = this.constructPoint(point);

    if (derivedPoint === undefined)
      return undefined;

    return Math.sqrt(Math.pow(derivedPoint.x, 2) + Math.pow(derivedPoint.y, 2) + Math.pow(derivedPoint.z, 2));
  }

  protected constructPoint(values: Primitives.Point): ConvertedPrimitives.Point3d | undefined {
    if (Array.isArray(values)) {
      if (values.length !== 3 || isNaN(+values[0]) || isNaN(+values[1]) || isNaN(+values[2]))
        return undefined;
      return { x: +values[0], y: +values[1], z: +values[2] };
    }
    const z = (values as any).z;
    return { ...values, z: z ? z : 0 };
  }
}

TypeConverterManager.registerConverter(StandardTypeConverterTypeNames.Point3d, Point3dTypeConverter);
