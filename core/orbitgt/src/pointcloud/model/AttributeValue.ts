/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.pointcloud.model;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { ABuffer } from "../../system/buffer/ABuffer";
import { LittleEndian } from "../../system/buffer/LittleEndian";
import { InStream } from "../../system/io/InStream";
import { OutStream } from "../../system/io/OutStream";
import { ALong } from "../../system/runtime/ALong";
import { ASystem } from "../../system/runtime/ASystem";
import { Numbers } from "../../system/runtime/Numbers";
import { AttributeTypes } from "./AttributeTypes";

/**
 * Class AttributeValue holds a single (typed) attribute value.
 *
 * @version 1.0 August 2013
 */
/** @internal */
export class AttributeValue {
  /** The 'false' value */
  public static readonly FALSE: AttributeValue =
    AttributeValue.createBoolean(false);
  /** The 'true' value */
  public static readonly TRUE: AttributeValue =
    AttributeValue.createBoolean(true);

  /** The type */
  private _type: int32;
  /** The value for boolean/int1/int2/int4 types */
  private _valueI4: int32;
  /** The value for int8 types */
  private _valueI8: ALong;
  /** The value for float4 types */
  private _valueF4: float32;
  /** The value for float8 types */
  private _valueF8: float64;

  /**
   * Create a new (empty) value.
   */
  public constructor() {
    this._type = 0;
    this._valueI4 = 0;
    this._valueI8 = ALong.ZERO;
    this._valueF4 = 0.0;
    this._valueF8 = 0.0;
  }

  /**
   * Create a new value.
   * @param value the value.
   */
  public static createBoolean(value: boolean): AttributeValue {
    let avalue: AttributeValue = new AttributeValue();
    avalue.setBoolean(value);
    return avalue;
  }

  /**
   * Create a new value.
   * @param value the value.
   */
  public static createInt1(value: int32): AttributeValue {
    let avalue: AttributeValue = new AttributeValue();
    avalue.setInt1(value);
    return avalue;
  }

  /**
   * Create a new value.
   * @param value the value.
   */
  public static createInt2(value: int32): AttributeValue {
    let avalue: AttributeValue = new AttributeValue();
    avalue.setInt2(value);
    return avalue;
  }

  /**
   * Create a new value.
   * @param value the value.
   */
  public static createInt4(value: int32): AttributeValue {
    let avalue: AttributeValue = new AttributeValue();
    avalue.setInt4(value);
    return avalue;
  }

  /**
   * Create a new value.
   * @param value the value.
   */
  public static createInt8(value: ALong): AttributeValue {
    let avalue: AttributeValue = new AttributeValue();
    avalue.setInt8(value);
    return avalue;
  }

  /**
   * Create a new value.
   * @param value the value.
   */
  public static createFloat4(value: float32): AttributeValue {
    let avalue: AttributeValue = new AttributeValue();
    avalue.setFloat4(value);
    return avalue;
  }

  /**
   * Create a new value.
   * @param value the value.
   */
  public static createFloat8(value: float64): AttributeValue {
    let avalue: AttributeValue = new AttributeValue();
    avalue.setFloat8(value);
    return avalue;
  }

  /**
   * Create a new value.
   * @param value the value.
   */
  public static createColor(value: int32): AttributeValue {
    let avalue: AttributeValue = new AttributeValue();
    avalue.setColor(value);
    return avalue;
  }

  /**
   * Get the type.
   * @return the type.
   */
  public getType(): int32 {
    return this._type;
  }

  /**
   * Clear the value.
   */
  public clear(): void {
    this._type = 0;
  }

  /**
   * Is this an empty value?
   * @return true for empty.
   */
  public isEmpty(): boolean {
    return this._type == 0;
  }

  /**
   * Get the value.
   * @return the value.
   */
  public getBoolean(): boolean {
    return this._valueI4 != 0;
  }

  /**
   * Get the value.
   * @return the value.
   */
  public getBooleanAsInt(): int32 {
    return this._valueI4;
  }

  /**
   * Set the value.
   * @param value the new value.
   */
  public setBoolean(value: boolean): void {
    this._type = AttributeTypes.TYPE_BOOLEAN;
    if (value) this._valueI4 = 1;
    else this._valueI4 = 0;
  }

  /**
   * Set the value.
   * @param value the new value.
   */
  public setBooleanFromInt(value: int32): void {
    this._type = AttributeTypes.TYPE_BOOLEAN;
    if (value == 0) this._valueI4 = 0;
    else this._valueI4 = 1;
  }

  /**
   * Get the value.
   * @return the value.
   */
  public getInt1(): int32 {
    return this._valueI4;
  }

  /**
   * Set the value.
   * @param value the new value.
   */
  public setInt1(value: int32): void {
    this._type = AttributeTypes.TYPE_INT1;
    this._valueI4 = value;
  }

  /**
   * Get the value.
   * @return the value.
   */
  public getInt2(): int32 {
    return this._valueI4;
  }

  /**
   * Set the value.
   * @param value the new value.
   */
  public setInt2(value: int32): void {
    this._type = AttributeTypes.TYPE_INT2;
    this._valueI4 = value;
  }

  /**
   * Get the value.
   * @return the value.
   */
  public getInt4(): int32 {
    return this._valueI4;
  }

  /**
   * Set the value.
   * @param value the new value.
   */
  public setInt4(value: int32): void {
    this._type = AttributeTypes.TYPE_INT4;
    this._valueI4 = value;
  }

  /**
   * Get the value.
   * @return the value.
   */
  public getInt8(): ALong {
    return this._valueI8;
  }

  /**
   * Set the value.
   * @param value the new value.
   */
  public setInt8(value: ALong): void {
    this._type = AttributeTypes.TYPE_INT8;
    this._valueI8 = value;
  }

  /**
   * Get the value.
   * @return the value.
   */
  public getFloat4(): float32 {
    return this._valueF4;
  }

  /**
   * Set the value.
   * @param value the new value.
   */
  public setFloat4(value: float32): void {
    this._type = AttributeTypes.TYPE_FLOAT4;
    this._valueF4 = value;
  }

  /**
   * Get the value.
   * @return the value.
   */
  public getFloat8(): float64 {
    return this._valueF8;
  }

  /**
   * Set the value.
   * @param value the new value.
   */
  public setFloat8(value: float64): void {
    this._type = AttributeTypes.TYPE_FLOAT8;
    this._valueF8 = value;
  }

  /**
   * Get the value.
   * @return the value.
   */
  public getColor(): int32 {
    return this._valueI4;
  }

  /**
   * Set the value.
   * @param value the new value.
   */
  public setColor(value: int32): void {
    this._type = AttributeTypes.TYPE_COLOR;
    this._valueI4 = value;
  }

  /**
   * Check if the value equals another value.
   * @param other the other value.
   * @return true if same.
   */
  public same(other: AttributeValue): boolean {
    /* Check the type */
    if (other._type != this._type) return false;
    /* Check the value */
    if (this._type == AttributeTypes.TYPE_BOOLEAN)
      return other._valueI4 == this._valueI4;
    if (this._type == AttributeTypes.TYPE_INT1)
      return other._valueI4 == this._valueI4;
    if (this._type == AttributeTypes.TYPE_INT2)
      return other._valueI4 == this._valueI4;
    if (this._type == AttributeTypes.TYPE_INT4)
      return other._valueI4 == this._valueI4;
    if (this._type == AttributeTypes.TYPE_INT8)
      return other._valueI8.same(this._valueI8);
    if (this._type == AttributeTypes.TYPE_FLOAT4)
      return other._valueF4 == this._valueF4;
    if (this._type == AttributeTypes.TYPE_FLOAT8)
      return other._valueF8 == this._valueF8;
    if (this._type == AttributeTypes.TYPE_COLOR)
      return other._valueI4 == this._valueI4;
    /* Empty value */
    return true;
  }

  /**
   * Copy to another value.
   * @param other the other value to copy to.
   */
  public copyTo(other: AttributeValue): void {
    /* Copy the type */
    other._type = this._type;
    /* Check the value */
    if (this._type == AttributeTypes.TYPE_BOOLEAN) {
      other._valueI4 = this._valueI4;
      return;
    }
    if (this._type == AttributeTypes.TYPE_INT1) {
      other._valueI4 = this._valueI4;
      return;
    }
    if (this._type == AttributeTypes.TYPE_INT2) {
      other._valueI4 = this._valueI4;
      return;
    }
    if (this._type == AttributeTypes.TYPE_INT4) {
      other._valueI4 = this._valueI4;
      return;
    }
    if (this._type == AttributeTypes.TYPE_INT8) {
      other._valueI8 = this._valueI8;
      return;
    }
    if (this._type == AttributeTypes.TYPE_FLOAT4) {
      other._valueF4 = this._valueF4;
      return;
    }
    if (this._type == AttributeTypes.TYPE_FLOAT8) {
      other._valueF8 = this._valueF8;
      return;
    }
    if (this._type == AttributeTypes.TYPE_COLOR) {
      other._valueI4 = this._valueI4;
      return;
    }
    /* Empty value */
  }

  /**
   * Copy the value.
   * @return the copied value.
   */
  public copy(): AttributeValue {
    let copy: AttributeValue = new AttributeValue();
    this.copyTo(copy);
    return copy;
  }

  /**
   * Copy a list of values.
   * @return the copied values.
   */
  public static copyList(list: Array<AttributeValue>): Array<AttributeValue> {
    if (list == null) return null;
    let list2: Array<AttributeValue> = new Array<AttributeValue>(list.length);
    for (let i: number = 0; i < list.length; i++) list2[i] = list[i].copy();
    return list2;
  }

  /**
   * Get the value as a string.
   * @return the string.
   */
  public asString(): string {
    if (this._type == AttributeTypes.TYPE_BOOLEAN)
      return "" + this.getBoolean();
    else if (this._type == AttributeTypes.TYPE_INT1) return "" + this.getInt1();
    else if (this._type == AttributeTypes.TYPE_INT2) return "" + this.getInt2();
    else if (this._type == AttributeTypes.TYPE_INT4) return "" + this.getInt4();
    else if (this._type == AttributeTypes.TYPE_INT8)
      return "" + this.getInt8().toString();
    else if (this._type == AttributeTypes.TYPE_FLOAT4)
      return "" + this.getFloat4();
    else if (this._type == AttributeTypes.TYPE_FLOAT8)
      return "" + this.getFloat8();
    else if (this._type == AttributeTypes.TYPE_COLOR)
      return Numbers.rgbToString(this.getColor());
    return "";
  }

  /**
   * The standard toString method.
   * @see Object#toString
   */
  public toString(): string {
    return (
      "[AttributeValue:type=" +
      AttributeTypes.getTypeName(this._type) +
      ",value=" +
      this.asString() +
      "]"
    );
  }

  /**
   * Create a default attribute value.
   * @param type the type of value.
   * @return a default value.
   */
  public static createDefault(type: int32): AttributeValue {
    if (type == AttributeTypes.TYPE_BOOLEAN)
      return AttributeValue.createBoolean(false);
    if (type == AttributeTypes.TYPE_INT1) return AttributeValue.createInt1(0);
    if (type == AttributeTypes.TYPE_INT2) return AttributeValue.createInt2(0);
    if (type == AttributeTypes.TYPE_INT4) return AttributeValue.createInt4(0);
    if (type == AttributeTypes.TYPE_INT8)
      return AttributeValue.createInt8(ALong.ZERO);
    if (type == AttributeTypes.TYPE_FLOAT4)
      return AttributeValue.createFloat4(0.0);
    if (type == AttributeTypes.TYPE_FLOAT8)
      return AttributeValue.createFloat8(0.0);
    if (type == AttributeTypes.TYPE_COLOR) return AttributeValue.createColor(0);
    ASystem.assertNot(true, "Cannot create attribute value of type " + type);
    return null;
  }

  /**
   * Read an attribute value.
   * @param buffer the buffer to read from.
   * @param bufferOffset the buffer offset to read from.
   * @param attributeType the type of the attribute.
   * @param the value to read into.
   */
  public static readFromBufferTo(
    buffer: ABuffer,
    bufferOffset: int32,
    attributeType: int32,
    value: AttributeValue
  ): void {
    if (attributeType == AttributeTypes.TYPE_BOOLEAN)
      value.setBoolean(LittleEndian.readBufferByte(buffer, bufferOffset) != 0);
    else if (attributeType == AttributeTypes.TYPE_INT1)
      value.setInt1(LittleEndian.readBufferByte(buffer, bufferOffset));
    else if (attributeType == AttributeTypes.TYPE_INT2)
      value.setInt2(LittleEndian.readBufferShort(buffer, bufferOffset));
    else if (attributeType == AttributeTypes.TYPE_INT4)
      value.setInt4(LittleEndian.readBufferInt(buffer, bufferOffset));
    else if (attributeType == AttributeTypes.TYPE_INT8)
      value.setInt8(LittleEndian.readBufferLong(buffer, bufferOffset));
    else if (attributeType == AttributeTypes.TYPE_FLOAT4)
      value.setFloat4(LittleEndian.readBufferFloat(buffer, bufferOffset));
    else if (attributeType == AttributeTypes.TYPE_FLOAT8)
      value.setFloat8(LittleEndian.readBufferDouble(buffer, bufferOffset));
    else if (attributeType == AttributeTypes.TYPE_COLOR)
      value.setColor(LittleEndian.readBufferInt3(buffer, bufferOffset));
    else
      ASystem.assertNot(
        true,
        "Cannot read attribute value type " + attributeType
      );
  }

  /**
   * Read an attribute value.
   * @param input the input stream to read from.
   * @param attributeType the type of the attribute.
   * @param the value to read into.
   */
  public static readFromStreamTo(
    stream: InStream,
    attributeType: int32,
    value: AttributeValue
  ): void {
    if (attributeType == AttributeTypes.TYPE_BOOLEAN)
      value.setBoolean(LittleEndian.readStreamByte(stream) != 0);
    else if (attributeType == AttributeTypes.TYPE_INT1)
      value.setInt1(LittleEndian.readStreamByte(stream));
    else if (attributeType == AttributeTypes.TYPE_INT2)
      value.setInt2(LittleEndian.readStreamShort(stream));
    else if (attributeType == AttributeTypes.TYPE_INT4)
      value.setInt4(LittleEndian.readStreamInt(stream));
    else if (attributeType == AttributeTypes.TYPE_INT8)
      value.setInt8(LittleEndian.readStreamLong(stream));
    else if (attributeType == AttributeTypes.TYPE_FLOAT4)
      value.setFloat4(LittleEndian.readStreamFloat(stream));
    else if (attributeType == AttributeTypes.TYPE_FLOAT8)
      value.setFloat8(LittleEndian.readStreamDouble(stream));
    else if (attributeType == AttributeTypes.TYPE_COLOR)
      value.setColor(LittleEndian.readStreamInt3(stream));
    else
      ASystem.assertNot(
        true,
        "Cannot read attribute value type " + attributeType
      );
  }

  /**
   * Read an attribute value.
   * @param input the input stream to read from.
   * @param attributeType the type of the attribute.
   * @return the value.
   */
  public static readFromStream(
    stream: InStream,
    attributeType: int32
  ): AttributeValue {
    let value: AttributeValue = new AttributeValue();
    AttributeValue.readFromStreamTo(stream, attributeType, value);
    return value;
  }

  /**
   * Write an attribute value.
   * @param output the output stream to write to.
   * @param attributeType the type of the attribute.
   * @param value the value of the attribute.
   */
  public static writeToStream(
    stream: OutStream,
    attributeType: int32,
    value: AttributeValue
  ): void {
    if (attributeType == AttributeTypes.TYPE_BOOLEAN)
      LittleEndian.writeStreamByte(stream, value.getBooleanAsInt());
    else if (attributeType == AttributeTypes.TYPE_INT1)
      LittleEndian.writeStreamByte(stream, value.getInt1());
    else if (attributeType == AttributeTypes.TYPE_INT2)
      LittleEndian.writeStreamShort(stream, value.getInt2());
    else if (attributeType == AttributeTypes.TYPE_INT4)
      LittleEndian.writeStreamInt(stream, value.getInt4());
    else if (attributeType == AttributeTypes.TYPE_INT8)
      LittleEndian.writeStreamLong(stream, value.getInt8());
    else if (attributeType == AttributeTypes.TYPE_FLOAT4)
      LittleEndian.writeStreamFloat(stream, value.getFloat4());
    else if (attributeType == AttributeTypes.TYPE_FLOAT8)
      LittleEndian.writeStreamDouble(stream, value.getFloat8());
    else if (attributeType == AttributeTypes.TYPE_COLOR)
      LittleEndian.writeStreamInt3(stream, value.getColor());
    else
      ASystem.assertNot(
        true,
        "Cannot write attribute value type " + attributeType
      );
  }
}
