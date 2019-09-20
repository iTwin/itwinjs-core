/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Helper */
/** Convert base64 type property values to Uint8Array and vice vera.
 * @internal
 */
export class BinaryPropertyTypeConverter {
  private static _base64Header = "encoding=base64;";

  /** Helper callback intented to be used with JSON.parse()
   * @internal
   */
  public static createReviverCallback() {
    return (_name: string, value: any) => {
      return BinaryPropertyTypeConverter.tryConvertToUint8Array(value)[1];
    };
  }

  /** Helper callback intented to be used with JSON.stringify()
   * @internal
   */
  public static createReplacerCallback(addEncodingHeader: boolean) {
    return (_name: string, value: any) => {
      return BinaryPropertyTypeConverter.tryConvertToBase64(value, addEncodingHeader)[1];
    };
  }

  /** Decode base64 string into uint8Array if possiable otherwise return orignal value
   * @internal
   */
  private static tryConvertToUint8Array(value: any): [boolean, any] {
    if (typeof value === "string") {
      if (value.length >= this._base64Header.length && value.startsWith(this._base64Header)) {
        const out = value.substr(this._base64Header.length);
        const buffer = Buffer.from(out, "base64");
        return [true, new Uint8Array(buffer)];
      }
    }
    return [false, value];
  }
  /** Convert Uint8Array into base64 if possiable otherwise return orignal value
   * @internal
   */
  private static tryConvertToBase64(value: any, addEncodingHeader: boolean): [boolean, any] {
    if (value && value.constructor === Uint8Array) {
      const buffer = Buffer.from(value);
      const base64Str = buffer.toString("base64");
      return [true, addEncodingHeader ? this._base64Header + base64Str : base64Str];
    }
    return [false, value];
  }
  /** Traverse a object and apply callback function provided for each value in object tree
   * @internal
   */
  private static traverse(o: any, fn: (obj: any, prop: string, value: any) => void) {
    for (const i in o) {
      if (o.hasOwnProperty(i)) {
        fn.apply(this, [o, i, o[i]]);
        if (o[i] !== null && typeof (o[i]) === "object") {
          BinaryPropertyTypeConverter.traverse(o[i], fn);
        }
      }
    }
  }
  /** Traverse a object and find and convert all Uint8Array type properties to base64
   * @internal
   */
  public static encodeBinaryProps(o: any, addEncodingHeader: boolean): void {
    if (o) {
      BinaryPropertyTypeConverter.traverse(o, (obj: any, prop: string, value: any) => {
        if (value && value.constructor === Uint8Array) {
          const [isConverted, convertedValue] = BinaryPropertyTypeConverter.tryConvertToBase64(value, addEncodingHeader);
          if (isConverted)
            obj[prop] = convertedValue;
        }
      });
    }
    return o;
  }
  /** Traverse a object and find and convert all base64 type properties to Uint8Array
   * @internal
   */
  public static decodeBinaryProps(o: any): any {
    if (o) {
      BinaryPropertyTypeConverter.traverse(o, (obj: any, prop: string, value: any) => {
        if (typeof value === "string") {
          const [isConverted, convertedValue] = BinaryPropertyTypeConverter.tryConvertToUint8Array(value);
          if (isConverted)
            obj[prop] = convertedValue;
        }
      });
    }
    return o;
  }
}
