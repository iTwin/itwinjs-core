/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.system.runtime;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { ASystem } from "./ASystem";
import { Numbers } from "./Numbers";
import { Strings } from "./Strings";

/**
 * Class ALong defines a signed 64-bit integer using two (high and low) 64-bit floats.
 *
 * @version 1.0 February 2019
 */
/** @internal */
export class ALong {
  /** The value of a 32 bit unit */
  private static readonly _U32: float64 = 4294967296.0;
  /** The value of a 31 bit unit */
  private static readonly _U31: float64 = 2147483648.0;
  /** The value of a 24 bit unit */
  private static readonly _U24: float64 = 16777216.0;
  /** The value of a 16 bit unit */
  private static readonly _U16: float64 = 65536.0;
  /** The value of a 8 bit unit */
  private static readonly _U8: float64 = 256.0;

  /** The integer value 0 */
  public static ZERO: ALong = new ALong(0.0, 0.0);
  /** The integer value 1 */
  public static ONE: ALong = new ALong(0.0, 1.0);
  /** The integer value 2 */
  public static TWO: ALong = new ALong(0.0, 2.0);
  /** The integer value 4 */
  public static FOUR: ALong = new ALong(0.0, 4.0);
  /** The integer value 10 */
  public static TEN: ALong = new ALong(0.0, 10.0);
  /** The integer value -1 */
  public static MINUS_ONE: ALong = new ALong(
    ALong._U32 - 1.0,
    ALong._U32 - 1.0
  );
  /** The maximum positive value of a signed_ 64-bit integer (9223372036854775807) */
  public static MAX_VALUE: ALong = new ALong(
    ALong._U31 - 1.0,
    ALong._U32 - 1.0
  );
  /** The minimum negative value of a signed 64-bit integer (-9223372036854775808) */
  public static MIN_VALUE: ALong = new ALong(ALong._U31, 0.0);

  /** The high value (unsigned integer [0..U32[ after normalization, negative i64 if >= U31) */
  private _high: float64;
  /** The low value (unsigned integer [0..U32[ after normalization) */
  private _low: float64;

  /**
   * Create a new value.
   * @param high the 32-bit high part.
   * @param low the 32-bit low part.
   */
  private constructor(high: float64, low: float64) {
    this._high = high;
    this._low = low;
  }

  /**
   * Check if the number is zero.
   * @return true if zero.
   */
  public isZero(): boolean {
    return this._high == 0.0 && this._low == 0.0;
  }

  /**
   * Check if the number is not zero.
   * @return true if zero.
   */
  public isNonZero(): boolean {
    return this.isZero() == false;
  }

  /**
   * Check if the number is one.
   * @return true if one.
   */
  public isOne(): boolean {
    return this._high == 0.0 && this._low == 1.0;
  }

  /**
   * Check if the number is positive.
   * @return true if positive (false if zero).
   */
  public isPositive(): boolean {
    return this.isZero() ? false : this._high < ALong._U31;
  }

  /**
   * Check if the number is negative.
   * @return true if negative (false if zero).
   */
  public isNegative(): boolean {
    return this.isZero() ? false : this._high >= ALong._U31;
  }

  /**
   * Normalize the number.
   * @return this number for chaining operations.
   */
  private static normalize2(high: float64, low: float64): ALong {
    // normalize the low part
    let overflowLow: float64 = Numbers.floor(low / ALong._U32);
    low = low - overflowLow * ALong._U32; // inside range [0..U32[
    high += overflowLow;
    // normalize the high part
    let overflowHigh: float64 = Numbers.floor(high / ALong._U32);
    high = high - overflowHigh * ALong._U32; // inside range [0..U32[
    // return the result
    return new ALong(high, low);
  }

  /**
   * Negate the number.
   * @return the result.
   */
  public negate(): ALong {
    /* Zero? */
    if (this.isZero()) {
      /* Return this immutable instance */
      return this;
    }
    /* Compute */
    let resultHigh: float64 = ALong._U32 - 1.0 - this._high;
    let resultLow: float64 = ALong._U32 - this._low;
    /* Overflow? */
    if (resultLow == ALong._U32) {
      resultLow = 0.0;
      resultHigh += 1.0; // in case we try to invert ALong.MIN_VALUE we get ALong.MIN_VALUE as a result again
    }
    /* Return the result */
    return new ALong(resultHigh, resultLow);
  }

  /**
   * Add a number.
   * @param value the value to add.
   * @return the result.
   */
  public add(value: ALong): ALong {
    /* Compute */
    let resultHigh: float64 = this._high + value._high;
    let resultLow: float64 = this._low + value._low;
    /* Return the result */
    return ALong.normalize2(resultHigh, resultLow);
  }

  /**
   * Add a number.
   * @param value the value to add.
   * @return the result.
   */
  public addInt(value: int32): ALong {
    return this.add(ALong.fromInt(value));
  }

  /**
   * Increase by one.
   * @return the result.
   */
  public increase(): ALong {
    return this.addInt(1);
  }

  /**
   * Subtract a number.
   * @param value the value to subtract.
   * @return the result.
   */
  public sub(value: ALong): ALong {
    return this.add(value.negate());
  }

  /**
   * Subtract a number.
   * @param value the value to subtract.
   * @return the result.
   */
  public subInt(value: int32): ALong {
    return this.sub(ALong.fromInt(value));
  }

  /**
   * Decrease by one.
   * @return the result.
   */
  public decrease(): ALong {
    return this.subInt(1);
  }

  /**
   * Multiply two unsigned 32-bit integer values.
   * @param v1 the first value.
   * @param v2 the second value.
   * @param high0 the initial high value of the result.
   * @return the unsigned 64-bit product.
   */
  private static mul2(v1: ALong, v2: ALong): ALong {
    /* Zero? */
    if (v1.isZero()) return v1;
    if (v2.isZero()) return v2;
    /* Make the values unsigned */
    let neg1: int32 = v1.isNegative() ? 1 : 0;
    if (neg1 == 1) v1 = v1.negate();
    let neg2: int32 = v2.isNegative() ? 1 : 0;
    if (neg2 == 1) v2 = v2.negate();
    /* Split first low into 16-bit parts */
    let a1: float64 = Numbers.floor(v1._low / ALong._U16);
    let a2: float64 = v1._low - a1 * ALong._U16;
    /* Split second low into 16-bit parts */
    let b1: float64 = Numbers.floor(v2._low / ALong._U16);
    let b2: float64 = v2._low - b1 * ALong._U16;
    /* Compute */
    let resultHigh: float64 = v1._high * v2._low + v1._low * v2._high + a1 * b1;
    let resultLow: float64 = (a1 * b2 + a2 * b1) * ALong._U16 + a2 * b2;
    let result: ALong = ALong.normalize2(resultHigh, resultLow);
    /* Return the result */
    return neg1 + neg2 == 1 ? result.negate() : result;
  }

  /**
   * Multiply by a number.
   * @param value the value to multiply.
   * @return the result.
   */
  public mul(value: ALong): ALong {
    return ALong.mul2(this, value);
  }

  /**
   * Multiply by a number.
   * @param value the value to multiply.
   * @return the result.
   */
  public mulInt(value: int32): ALong {
    return this.mul(ALong.fromInt(value));
  }

  /**
   * Divide by a number.
   * @param value the value to divide by.
   * @return the result.
   */
  public div(value: ALong): ALong {
    /* Division by zero? */
    ASystem.assertNot(value.isZero(), "ALong division by ALong zero");
    /* Division by one? */
    if (value.isOne()) return this;
    /* Make the values unsigned */
    let currentValue: ALong = this;
    let neg1: boolean = currentValue.isNegative();
    if (neg1) currentValue = currentValue.negate();
    let value2: ALong = value;
    let neg2: boolean = value2.isNegative();
    if (neg2) value2.negate();
    let neg: boolean = (neg1 && !neg2) || (!neg1 && neg2);
    /* Loop until the remainder is smaller than the value */
    let result: ALong = ALong.ZERO;
    while (currentValue.isLargerThanOrEqualTo(value2)) {
      /* Shift the value as much as possible */
      let test: ALong = value2;
      let times: ALong = ALong.ONE;
      if (test.isSmallerThan(currentValue)) {
        while (test.isSmallerThan(currentValue)) {
          test = test.mulInt(2);
          times = times.mulInt(2);
        }
        test = test.divInt(2);
        times = times.divInt(2);
      }
      /* Subtract the shifted value */
      currentValue = currentValue.sub(test);
      result = result.add(times);
    }
    /* Return the result */
    return neg ? result.negate() : result;
  }

  /**
   * Divide by a number.
   * @param value the value to divide by.
   * @return the result.
   */
  public divInt(value: int32): ALong {
    /* Division by zero? */
    ASystem.assertNot(value == 0, "ALong division by int zero");
    /* Division by one? */
    if (value == 1) return this;
    /* Make the values unsigned */
    let value1: ALong = this;
    let neg1: boolean = value1.isNegative();
    if (neg1) value1 = value1.negate();
    let neg2: boolean = value < 0;
    if (neg2) value = -1 * value;
    let neg: boolean = (neg1 && !neg2) || (!neg1 && neg2);
    /* Compute */
    let valueF: float64 = 0.0 + value;
    let h1: float64 = Numbers.floor(value1._high / valueF);
    let h2: float64 = value1._high - valueF * h1;
    let l1: float64 = Numbers.floor(value1._low / valueF);
    let l2: float64 = value1._low - valueF * l1;
    let t: float64 = h2 * ALong._U32 + l2;
    let t1: float64 = Numbers.floor(t / valueF);
    let t2: float64 = t - valueF * t1; // remainder
    let result: ALong = ALong.normalize2(h1, l1 + t1);
    /* Return the result */
    return neg ? result.negate() : result;
  }

  /**
   * Modulate by a number.
   * @param value the value to modulate by.
   * @return the result.
   */
  public mod(value: ALong): ALong {
    /* Division by zero? */
    ASystem.assertNot(value.isZero(), "ALong modulo by ALong zero");
    /* Division by one? */
    if (value.isOne()) return ALong.ZERO;
    /* Compute */
    let result: ALong = this.sub(this.div(value).mul(value));
    /* Return the result */
    return result;
  }

  /**
   * Modulate by a number.
   * @param value the value to modulate by.
   * @return the modulo value.
   */
  public modInt(value: int32): int32 {
    /* Division by zero? */
    ASystem.assertNot(value == 0, "ALong modulo by int zero");
    /* Division by one? */
    if (value == 1) return 0;
    /* Make the values unsigned */
    let value1: ALong = this;
    let neg1: boolean = value1.isNegative();
    if (neg1) value1 = value1.negate();
    let neg2: boolean = value < 0;
    if (neg2) value = -1 * value;
    let neg: boolean = (neg1 && !neg2) || (!neg1 && neg2);
    /* Compute */
    let valueF: float64 = 0.0 + value;
    let h1: float64 = Numbers.floor(value1._high / valueF);
    let h2: float64 = value1._high - valueF * h1;
    let l1: float64 = Numbers.floor(value1._low / valueF);
    let l2: float64 = value1._low - valueF * l1;
    let t: float64 = h2 * ALong._U32 + l2;
    let t1: float64 = Numbers.floor(t / valueF);
    let t2: float64 = t - valueF * t1; // remainder
    let result: int32 = Math.trunc(t2);
    /* Return the result */
    return result;
  }

  /**
   * Create a new number.
   * @param value the 64-bit float value.
   * @return the new number.
   */
  public static fromDouble(value: float64): ALong {
    /* Make the value unsigned */
    let neg: boolean = value < 0.0;
    if (neg) value = -1.0 * value;
    /* Compute */
    value = Numbers.floor(value);
    let high: float64 = Numbers.floor(value / ALong._U32);
    let low: float64 = value - high * ALong._U32;
    let result: ALong = ALong.normalize2(high, low);
    /* Return the result */
    return neg ? result.negate() : result;
  }

  /**
   * Get a double.
   * @return the double value.
   */
  public toDouble(): float64 {
    /* Make the value unsigned */
    let value: ALong = this;
    let neg: boolean = value.isNegative();
    if (neg) value = value.negate();
    /* Compute */
    let result: float64 = value._high * ALong._U32 + value._low;
    if (neg) result *= -1.0;
    /* Return the result */
    return result;
  }

  /**
   * Create a new number.
   * @param value the 32-bit integer value.
   * @return the new number.
   */
  public static fromInt(value: float64): ALong {
    return value < 0.0
      ? new ALong(ALong._U32 - 1.0, ALong._U32 + value)
      : new ALong(0.0, value);
  }

  /**
   * Get a 32-bit integer.
   * @return the integer value.
   */
  public toInt(): int32 {
    /* Make the value unsigned */
    let value: ALong = this;
    let neg: boolean = value.isNegative();
    if (neg) value = value.negate();
    /* Compute */
    let result: float64 = value._low;
    if (neg) result *= -1.0;
    /* Return the result */
    return Numbers.doubleToInt(result);
  }

  /**
   * Create a new number.
   * @param i1 the 32-bit high part.
   * @param i0 the 32-bit low part.
   * @return the new number.
   */
  public static fromHighLow(i1: float64, i0: float64): ALong {
    if (i1 < 0.0) i1 += ALong._U32; // make unsigned
    if (i0 < 0.0) i0 += ALong._U32;
    return new ALong(i1, i0);
  }

  /**
   * Get the high part.
   * @return the integer value (0..4294967295)
   */
  public getHigh(): float64 {
    return this._high;
  }

  /**
   * Get the low part.
   * @return the integer value (0..4294967295)
   */
  public getLow(): float64 {
    return this._low;
  }

  /**
   * Create a new number.
   * @param b7 the most significant 8-bit byte of the high part (0..255).
   * @param b6 the most third 8-bit byte of the high part (0..255).
   * @param b5 the most second 8-bit byte of the high part (0..255).
   * @param b4 the most least 8-bit byte of the high part (0..255).
   * @param b3 the most significant 8-bit byte of the low part (0..255).
   * @param b2 the most third 8-bit byte of the low part (0..255).
   * @param b1 the most second 8-bit byte of the low part (0..255).
   * @param b0 the most least 8-bit byte of the low part (0..255).
   * @return the new number.
   */
  public static fromBytes(
    b7: float64,
    b6: float64,
    b5: float64,
    b4: float64,
    b3: float64,
    b2: float64,
    b1: float64,
    b0: float64
  ): ALong {
    if (b7 < 0.0) b7 += ALong._U8; // make unsigned
    if (b6 < 0.0) b6 += ALong._U8;
    if (b5 < 0.0) b5 += ALong._U8;
    if (b4 < 0.0) b4 += ALong._U8;
    if (b3 < 0.0) b3 += ALong._U8;
    if (b2 < 0.0) b2 += ALong._U8;
    if (b1 < 0.0) b1 += ALong._U8;
    if (b0 < 0.0) b0 += ALong._U8;
    let high: float64 = b7 * ALong._U24 + b6 * ALong._U16 + b5 * ALong._U8 + b4;
    let low: float64 = b3 * ALong._U24 + b2 * ALong._U16 + b1 * ALong._U8 + b0;
    return ALong.fromHighLow(high, low);
  }

  /**
   * Get a byte.
   * @param index the index of the byte (0..7 where 0 is low).
   * @return the byte value (0..255)
   */
  public getByte(index: int32): int32 {
    let value: float64 = index < 4 ? this._low : this._high; // this should be unsigned
    let position: int32 = index < 4 ? index : index - 4;
    for (let i: number = 0; i < position; i++)
      value = Numbers.floor(value / 256.0);
    return Math.trunc(value % 256);
  }

  /**
   * Check if a number is equal.
   * @param value the value to check.
   * @return true if equal.
   */
  public isEqualTo(value: ALong): boolean {
    return value._high == this._high && value._low == this._low;
  }

  /**
   * Check if a number is not equal.
   * @param value the value to check.
   * @return true if equal.
   */
  public isNotEqualTo(value: ALong): boolean {
    return this.isEqualTo(value) == false;
  }

  /**
   * Check if a number is equal.
   * @param value the value to check.
   * @return true if equal.
   */
  public same(value: ALong): boolean {
    return this.isEqualTo(value);
  }

  /**
   * Check if a number is equal.
   * @param value the value to check.
   * @return true if equal.
   */
  public equals(value: ALong): boolean {
    return this.isEqualTo(value);
  }

  /**
   * Compare this long to another long.
   * @param value the other long.
   * @return zero if equal, positive if smaller, or negative if value is larger.
   */
  public compareTo(value: ALong): int32 {
    let diff: ALong = this.sub(value);
    if (diff.isZero()) return 0;
    return diff.isNegative() ? -1 : 1;
  }

  /**
   * Check if a value is larger.
   * @param value the value to check.
   * @return true if this number is larger than the check value.
   */
  public isLargerThan(value: ALong): boolean {
    return this.compareTo(value) > 0;
  }

  /**
   * Check if a value is larger.
   * @param value the value to check.
   * @return true if this number is larger than the check value.
   */
  public isLargerThanOrEqualTo(value: ALong): boolean {
    return this.compareTo(value) >= 0;
  }

  /**
   * Check if a value is smaller.
   * @param value the value to check.
   * @return true if this number is smaller than the check value.
   */
  public isSmallerThan(value: ALong): boolean {
    return this.compareTo(value) < 0;
  }

  /**
   * Check if a value is smaller.
   * @param value the value to check.
   * @return true if this number is smaller than the check value.
   */
  public isSmallerThanOrEqualTo(value: ALong): boolean {
    return this.compareTo(value) <= 0;
  }

  /**
   * Get the maximum value.
   * @param v1 the first value.
   * @param v2 the second value.
   * @return the maximum value.
   */
  public static max(v1: ALong, v2: ALong): ALong {
    return v2.isLargerThan(v1) ? v2 : v1;
  }

  /**
   * Get the minimum value.
   * @param v1 the first value.
   * @param v2 the second value.
   * @return the minimum value.
   */
  public static min(v1: ALong, v2: ALong): ALong {
    return v2.isSmallerThan(v1) ? v2 : v1;
  }

  /**
   * Create a number from a string.
   * @param svalue the string value.
   * @param radix the radix (2 to 36).
   * @return the number.
   */
  public static fromRadixString(svalue: string, radix: int32): ALong {
    /* Check the radix */
    ASystem.assertNot(radix < 2 || radix > 36, "Invalid radix: " + radix);
    /* Common values? */
    if (Strings.equals(svalue, "0")) return ALong.ZERO;
    if (Strings.equals(svalue, "1")) return ALong.ONE;
    /* Negative? */
    let neg: boolean = Strings.startsWith(svalue, "-");
    if (neg) svalue = Strings.substringFrom(svalue, 1);
    /* Add all digits */
    let result: ALong = ALong.ZERO;
    let unit: ALong = ALong.ONE;
    let radixHL: ALong = ALong.fromInt(radix);
    let slength: int32 = Strings.getLength(svalue);
    for (let i: number = 0; i < slength; i++) {
      /* Add the next digit */
      let charCode: int32 = Strings.charCodeAt(svalue, slength - 1 - i);
      let digit: int32 = charCode >= 65 ? charCode - 65 + 10 : charCode - 48;
      if (digit > 0) result = result.add(unit.mulInt(digit));
      unit = unit.mul(radixHL);
    }
    /* Return the result */
    return neg ? result.negate() : result;
  }

  /**
   * Create a number from a decimal string.
   * @param value the string value.
   * @return the number.
   */
  public static fromString(value: string): ALong {
    if (value == null) return null;
    return ALong.fromRadixString(value, 10);
  }

  /**
   * Create a number from a hexadecimal string.
   * @param value the string value.
   * @return the number.
   */
  public static fromHexString(value: string): ALong {
    if (value == null) return null;
    return ALong.fromRadixString(value, 16);
  }

  /**
   * Convert the number to a string.
   * @param radix the radix (2 to 36).
   * @return the string.
   */
  public getRadixString(radix: int32): string {
    /* Check the radix */
    ASystem.assertNot(radix < 2 || radix > 36, "Invalid radix: " + radix);
    /* Common values? */
    let value: ALong = this;
    if (value.isZero()) return "0";
    /* Make the value unsigned */
    let neg: boolean = value.isNegative();
    if (neg) value = value.negate();
    /* Add all digits */
    let result: string = "";
    while (true) {
      /* Add the next digit */
      if (value.isZero()) break;
      let digit: int32 = value.modInt(radix);
      value = value.divInt(radix);
      let sdigit: string =
        digit < 10
          ? Strings.charCodeToString(48 + digit)
          : Strings.charCodeToString(65 + digit - 10);
      result = sdigit + result;
      /* Fail? */
      ASystem.assertNot(
        Strings.getLength(result) > 20,
        "Failed to convert longHL to string (radix " +
          radix +
          "): " +
          this._high +
          ";" +
          this._low
      );
    }
    if (neg) result = "-" + result;
    /* Return the result */
    return result;
  }

  /**
   * Convert the number to a decimal string.
   * @return the string.
   */
  public getString(): string {
    return this.getRadixString(10);
  }

  /**
   * Convert the number to a hexadecimal string.
   * @return the string.
   */
  public getHexString(): string {
    return this.getRadixString(16);
  }

  /**
   * The standard toString method.
   * @see Object#toString
   */
  public toString(): string {
    return this.getString();
  }
}
