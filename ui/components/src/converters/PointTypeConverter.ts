/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module TypeConverters */

import { TypeConverter } from "./TypeConverter";
import { TypeConverterManager } from "./TypeConverterManager";

/**
 * Point type converter.
 */
export abstract class BasePointTypeConverter extends TypeConverter {
  public async convertToString(value: any): Promise<string> {
    if (!value || !Array.isArray(value))
      return "";
    let stringValue: string = value[0];
    for (let i = 1; i < value.length; i++)
      stringValue += ", " + value[i];
    return stringValue;
  }
  public async convertFromString(value: string): Promise<any> {
    if (null === value || undefined === value)
      return undefined;
    return this.constructPoint(value.split(","));
  }
  protected abstract constructPoint(_values: string[]): object | undefined;
}

/**
 * Point2d type converter.
 */
export class Point2dTypeConverter extends BasePointTypeConverter {
  protected constructPoint(values: string[]): object | undefined {
    return (values.length === 2) ? { x: values[0].trim(), y: values[1].trim() } : undefined;
  }
}
TypeConverterManager.registerConverter("point2d", Point2dTypeConverter);

/**
 * Point3d type converter.
 */
export class Point3dTypeConverter extends BasePointTypeConverter {
  protected constructPoint(values: string[]): object | undefined {
    return (values.length === 3) ? { x: values[0].trim(), y: values[1].trim(), z: values[2].trim() } : undefined;
  }
}
TypeConverterManager.registerConverter("point3d", Point3dTypeConverter);
