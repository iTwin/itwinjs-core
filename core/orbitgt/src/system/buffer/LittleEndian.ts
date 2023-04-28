/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.system.buffer;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { InStream } from "../io/InStream";
import { OutStream } from "../io/OutStream";
import { ALong } from "../runtime/ALong";
import { Numbers } from "../runtime/Numbers";
import { Strings } from "../runtime/Strings";
import { ABuffer } from "./ABuffer";

/**
 * Helper class for reading multi-byte numbers.
 */
/** @internal */
export class LittleEndian {
  /**
   * This class has static methods only.
   */
  private constructor() {}

  /**
   * Read an unsigned 8-bit integer.
   */
  public static readBufferByte(buffer: ABuffer, offset: int32): int32 {
    let b0: int32 = buffer.get(offset);
    return b0;
  }

  /**
   * Read an unsigned 8-bit integer.
   */
  public static readStreamByte(stream: InStream): int32 {
    let b0: int32 = stream.read();
    return b0;
  }

  /**
   * Write an unsigned 8-bit integer.
   */
  public static writeBufferByte(
    buffer: ABuffer,
    offset: int32,
    value: int32
  ): void {
    buffer.set(offset, value);
  }

  /**
   * Write an unsigned 8-bit integer.
   */
  public static writeStreamByte(stream: OutStream, value: int32): void {
    stream.write(value);
  }

  /**
   * Read an unsigned 16-bit integer.
   */
  public static readBufferShort(buffer: ABuffer, offset: int32): int32 {
    let b0: int32 = buffer.get(offset++);
    let b1: int32 = buffer.get(offset++);
    return (b1 << 8) | b0;
  }

  /**
   * Read an unsigned 16-bit integer.
   */
  public static readStreamShort(stream: InStream): int32 {
    let b0: int32 = stream.read();
    let b1: int32 = stream.read();
    return (b1 << 8) | b0;
  }

  /**
   * Write an unsigned 16-bit integer.
   */
  public static writeBufferShort(
    buffer: ABuffer,
    offset: int32,
    value: int32
  ): void {
    buffer.set(offset++, value >> 0);
    buffer.set(offset++, value >> 8);
  }

  /**
   * Write an unsigned 16-bit integer.
   */
  public static writeStreamShort(stream: OutStream, value: int32): void {
    stream.write(value >> 0);
    stream.write(value >> 8);
  }

  /**
   * Read an unsigned 24-bit integer.
   */
  public static readBufferInt3(buffer: ABuffer, offset: int32): int32 {
    let b0: int32 = buffer.get(offset++);
    let b1: int32 = buffer.get(offset++);
    let b2: int32 = buffer.get(offset++);
    return (b2 << 16) | (b1 << 8) | b0;
  }

  /**
   * Read an unsigned 24-bit integer.
   */
  public static readStreamInt3(stream: InStream): int32 {
    let b0: int32 = stream.read();
    let b1: int32 = stream.read();
    let b2: int32 = stream.read();
    return (b2 << 16) | (b1 << 8) | b0;
  }

  /**
   * Write an unsigned 24-bit integer.
   */
  public static writeBufferInt3(
    buffer: ABuffer,
    offset: int32,
    value: int32
  ): void {
    buffer.set(offset++, value >> 0);
    buffer.set(offset++, value >> 8);
    buffer.set(offset++, value >> 16);
  }

  /**
   * Write an unsigned 24-bit integer.
   */
  public static writeStreamInt3(stream: OutStream, value: int32): void {
    stream.write(value >> 0);
    stream.write(value >> 8);
    stream.write(value >> 16);
  }

  /**
   * Read a signed 32-bit integer.
   */
  public static readBufferInt(buffer: ABuffer, offset: int32): int32 {
    let b0: int32 = buffer.get(offset++);
    let b1: int32 = buffer.get(offset++);
    let b2: int32 = buffer.get(offset++);
    let b3: int32 = buffer.get(offset++);
    return (b3 << 24) | (b2 << 16) | (b1 << 8) | b0;
  }

  /**
   * Read a signed 32-bit integer.
   */
  public static readStreamInt(stream: InStream): int32 {
    let b0: int32 = stream.read();
    let b1: int32 = stream.read();
    let b2: int32 = stream.read();
    let b3: int32 = stream.read();
    return (b3 << 24) | (b2 << 16) | (b1 << 8) | b0;
  }

  /**
   * Write a signed 32-bit integer.
   */
  public static writeBufferInt(
    buffer: ABuffer,
    offset: int32,
    value: int32
  ): void {
    buffer.set(offset++, value >> 0);
    buffer.set(offset++, value >> 8);
    buffer.set(offset++, value >> 16);
    buffer.set(offset++, value >> 24);
  }

  /**
   * Write a signed 32-bit integer.
   */
  public static writeStreamInt(stream: OutStream, value: int32): void {
    stream.write(value >> 0);
    stream.write(value >> 8);
    stream.write(value >> 16);
    stream.write(value >> 24);
  }

  /**
   * Read a signed 64-bit integer.
   */
  public static readBufferLong(buffer: ABuffer, offset: int32): ALong {
    let b0: int32 = buffer.get(offset++);
    let b1: int32 = buffer.get(offset++);
    let b2: int32 = buffer.get(offset++);
    let b3: int32 = buffer.get(offset++);
    let b4: int32 = buffer.get(offset++);
    let b5: int32 = buffer.get(offset++);
    let b6: int32 = buffer.get(offset++);
    let b7: int32 = buffer.get(offset++);
    return ALong.fromBytes(b7, b6, b5, b4, b3, b2, b1, b0);
  }

  /**
   * Read a signed 64-bit integer.
   */
  public static readStreamLong(stream: InStream): ALong {
    let b0: int32 = stream.read();
    let b1: int32 = stream.read();
    let b2: int32 = stream.read();
    let b3: int32 = stream.read();
    let b4: int32 = stream.read();
    let b5: int32 = stream.read();
    let b6: int32 = stream.read();
    let b7: int32 = stream.read();
    return ALong.fromBytes(b7, b6, b5, b4, b3, b2, b1, b0);
  }

  /**
   * Write a signed 64-bit integer.
   */
  public static writeBufferLong(
    buffer: ABuffer,
    offset: int32,
    value: ALong
  ): void {
    buffer.set(offset++, value.getByte(0));
    buffer.set(offset++, value.getByte(1));
    buffer.set(offset++, value.getByte(2));
    buffer.set(offset++, value.getByte(3));
    buffer.set(offset++, value.getByte(4));
    buffer.set(offset++, value.getByte(5));
    buffer.set(offset++, value.getByte(6));
    buffer.set(offset++, value.getByte(7));
  }

  /**
   * Write a signed 64-bit integer.
   */
  public static writeStreamLong(stream: OutStream, value: ALong): void {
    stream.write(value.getByte(0));
    stream.write(value.getByte(1));
    stream.write(value.getByte(2));
    stream.write(value.getByte(3));
    stream.write(value.getByte(4));
    stream.write(value.getByte(5));
    stream.write(value.getByte(6));
    stream.write(value.getByte(7));
  }

  /**
   * Read a signed 32-bit float.
   */
  public static readBufferFloat(buffer: ABuffer, offset: int32): float32 {
    return Numbers.intBitsToFloat(LittleEndian.readBufferInt(buffer, offset));
  }

  /**
   * Read a signed 32-bit float.
   */
  public static readStreamFloat(stream: InStream): float32 {
    return Numbers.intBitsToFloat(LittleEndian.readStreamInt(stream));
  }

  /**
   * Write a signed 32-bit float.
   */
  public static writeBufferFloat(
    buffer: ABuffer,
    offset: int32,
    value: float32
  ): void {
    LittleEndian.writeBufferInt(buffer, offset, Numbers.floatToIntBits(value));
  }

  /**
   * Write a signed 32-bit float.
   */
  public static writeStreamFloat(stream: OutStream, value: float32): void {
    LittleEndian.writeStreamInt(stream, Numbers.floatToIntBits(value));
  }

  /**
   * Read a signed 64-bit float.
   */
  public static readBufferDouble(buffer: ABuffer, offset: int32): float64 {
    return Numbers.longBitsToDouble(
      LittleEndian.readBufferLong(buffer, offset)
    );
  }

  /**
   * Read a signed 64-bit float.
   */
  public static readStreamDouble(stream: InStream): float64 {
    return Numbers.longBitsToDouble(LittleEndian.readStreamLong(stream));
  }

  /**
   * Write a signed 64-bit float.
   */
  public static writeBufferDouble(
    buffer: ABuffer,
    offset: int32,
    value: float64
  ): void {
    LittleEndian.writeBufferLong(
      buffer,
      offset,
      Numbers.doubleToLongBits(value)
    );
  }

  /**
   * Write a signed 64-bit float.
   */
  public static writeStreamDouble(stream: OutStream, value: float64): void {
    LittleEndian.writeStreamLong(stream, Numbers.doubleToLongBits(value));
  }

  /**
   * Read a string.
   */
  public static readBufferString(buffer: ABuffer, offset: int32): string {
    let valueLength: int32 = LittleEndian.readBufferInt(buffer, offset);
    if (valueLength < 0) return null;
    offset += 4;
    let value: string = "";
    for (let i: number = 0; i < valueLength; i++)
      value = Strings.appendChar(
        value,
        LittleEndian.readBufferShort(buffer, offset + 2 * i)
      );
    return value;
  }

  /**
   * Read a string.
   */
  public static readStreamString(stream: InStream): string {
    let valueLength: int32 = LittleEndian.readStreamInt(stream);
    if (valueLength < 0) return null;
    let value: string = "";
    for (let i: number = 0; i < valueLength; i++)
      value = Strings.appendChar(value, LittleEndian.readStreamShort(stream));
    return value;
  }

  /**
   * Write a string.
   */
  public static writeStreamString(stream: OutStream, value: string): void {
    if (value == null) {
      LittleEndian.writeStreamInt(stream, -1);
    } else {
      let valueLength: int32 = Strings.getLength(value);
      LittleEndian.writeStreamInt(stream, valueLength);
      for (let i: number = 0; i < valueLength; i++)
        LittleEndian.writeStreamShort(stream, Strings.getCharAt(value, i));
    }
  }

  /**
   * Get the number of bytes in a string.
   */
  public static getStringByteCount(value: string): int32 {
    if (value == null) return 4;
    else return 4 + 2 * Strings.getLength(value);
  }
}
