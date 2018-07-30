/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module TypeConverters */

import { TypeConverter } from "./TypeConverter";
import { TypeConverterManager } from "./TypeConverterManager";

/**
 * Point type converter.
 */
export class BasePointTypeConverter extends TypeConverter {
  public async convertToString(value: any): Promise<string> {
    if (!value || !Array.isArray(value))
      return "";
    let stringValue: string = value[0];
    for (let i = 1; i < value.length; i++)
      stringValue += ", " + value[i];
    return stringValue;
  }
  public async convertFromString(value: string): Promise<any> {
    if (!value)
      return undefined;
    return this.constructPoint(value.split(","));
  }
  protected constructPoint(_values: string[]): object | undefined { throw new Error("Not implemented"); }
}

/**
 * Point2d type converter.
 */
export class Point2dTypeConverter extends BasePointTypeConverter {
  protected constructPoint(values: string[]): object | undefined {
    return (values.length === 2) ? { x: values[0], y: values[1] } : undefined;
  }
}
TypeConverterManager.registerConverter("point2d", Point2dTypeConverter);

/**
 * Point3d type converter.
 */
export class Point3dTypeConverter extends BasePointTypeConverter {
  protected constructPoint(values: any[]): object | undefined {
    return (values.length === 3) ? { x: values[0], y: values[1], z: values[2] } : undefined;
  }
}
TypeConverterManager.registerConverter("point3d", Point3dTypeConverter);
