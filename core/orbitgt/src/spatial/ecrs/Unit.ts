/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OrbitGT
 */

//package orbitgt.spatial.ecrs;

type int8 = number;
type int16 = number;
type int32 = number;
type float32 = number;
type float64 = number;

import { ASystem } from "../../system/runtime/ASystem";
import { Numbers } from "../../system/runtime/Numbers";
import { Registry } from "./Registry";

/**
 * Class Unit defines a unit of measure.
 *
 * @version 1.0 July 2005
 */
/** @internal */
export class Unit {
  /** The "meter" unit code (length) */
  public static readonly METER: int32 = 9001;
  /** The "foot" unit code (length) */
  public static readonly FOOT: int32 = 9002;
  /** The "footUS" unit code (length) */
  public static readonly FOOT_US: int32 = 9003;
  /** The "radian" unit code (angle) */
  public static readonly RADIAN: int32 = 9101;
  /** The "degree" unit code (angle) */
  public static readonly DEGREE: int32 = 9102;
  /** The "unity" unit code (scale) */
  public static readonly UNITY: int32 = 9201;

  /** Define the custom unit 'sexagesimal DMS' (9110) */
  private static readonly _UNIT_DMS: int32 = 9110;
  /** Define the custom unit 'sexagesimal DM' (9111) */
  private static readonly _UNIT_DM: int32 = 9111;

  /** The type of units for angles */
  private static readonly _TYPE_ANGLE: string = "angle";
  /** The type of units for length */
  private static readonly _TYPE_LENGTH: string = "length";
  /** The type of units for time */
  private static readonly _TYPE_TIME: string = "time";
  /** The type of units for scale */
  private static readonly _TYPE_SCALE: string = "scale";

  /** The code */
  private _code: int32;
  /** The name */
  private _name: string;
  /** The abbreviation */
  private _abbreviation: string;
  /** The type */
  private _type: string;
  /** The target unit code */
  private _targetUnitCode: int32;
  /** The B factor */
  private _b: float64;
  /** The C factor */
  private _c: float64;

  /** The target unit */
  private _target: Unit;

  /**
   * Create a new unit.
   * @param code the code.
   * @param name the name.
   * @param abbreviation the abbreviation.
   * @param type the type (LENGTH, ANGLE or SCALE).
   * @param targetUnitCode the target unit code.
   * @param b the B factor.
   * @param c the C factor.
   */
  public constructor(
    code: int32,
    name: string,
    abbreviation: string,
    type: string,
    targetUnitCode: int32,
    b: float64,
    c: float64
  ) {
    /* Store the parameters */
    this._code = code;
    this._name = name;
    this._abbreviation = abbreviation;
    this._type = type;
    this._targetUnitCode = targetUnitCode;
    this._b = b;
    this._c = c;
    /* Clear */
    this._target = null;
  }

  /**
   * Get the code.
   * @return the code.
   */
  public getCode(): int32 {
    return this._code;
  }

  /**
   * Get the name.
   * @return the name.
   */
  public getName(): string {
    return this._name;
  }

  /**
   * Get the abbreviation.
   * @return the abbreviation.
   */
  public getAbbreviation(): string {
    return this._abbreviation;
  }

  /**
   * Get the type (LENGTH, ANGLE or SCALE).
   * @return the type.
   */
  public getType(): string {
    return this._type;
  }

  /**
   * Check is this is an angle type.
   * @return true for an angle type.
   */
  public isTypeAngle(): boolean {
    return this._type === Unit._TYPE_ANGLE;
  }

  /**
   * Check is this is a length type.
   * @return true for a length type.
   */
  public isTypeLength(): boolean {
    return this._type === Unit._TYPE_LENGTH;
  }

  /**
   * Get the target unit code.
   * @return the target unit code.
   */
  public getTargetUnitCode(): int32 {
    return this._targetUnitCode;
  }

  /**
   * Get the B factor.
   * @return the B factor.
   */
  public getB(): float64 {
    return this._b;
  }

  /**
   * Get the C factor.
   * @return the C factor.
   */
  public getC(): float64 {
    return this._c;
  }

  /**
   * Check if another unit is compatible with this one.
   * @param other the other unit.
   * @return true if compatible.
   */
  public isCompatible(other: Unit): boolean {
    if (other._code == this._code) return true;
    if (other._targetUnitCode != this._targetUnitCode) return false;
    if (other._b != this._b) return false;
    if (other._c != this._c) return false;
    return true;
  }

  /**
   * Convert to the standard unit.
   * @param value the value.
   * @return the standard value.
   */
  public toStandard(value: float64): float64 {
    /* Get the target unit */
    if (this._target == null) this._target = Registry.getUnit(this._targetUnitCode);
    /* Already standard ? */
    if (this._code == this._targetUnitCode) return value;
    /* Check for a custom unit */ else if (this._code == Unit._UNIT_DMS)
      return this._target.toStandard(Unit.dmsToDeg(value));
    else if (this._code == Unit._UNIT_DM) return this._target.toStandard(Unit.dmToDeg(value));
    /* Default to scale */ else return this._target.toStandard((value * this._b) / this._c);
  }

  /**
   * Convert to the standard unit.
   * @param value the value.
   * @return the standard value.
   */
  public to(value: float64): float64 {
    return this.toStandard(value);
  }

  /**
   * Convert from the standard unit.
   * @param value the standard value.
   * @return the value.
   */
  public fromStandard(value: float64): float64 {
    /* Get the target unit */
    if (this._target == null) this._target = Registry.getUnit(this._targetUnitCode);
    /* Already standard ? */
    if (this._code == this._targetUnitCode) return value;
    /* Check for a custom unit */ else if (this._code == Unit._UNIT_DMS)
      return Unit.degToDms(this._target.fromStandard(value));
    else if (this._code == Unit._UNIT_DM) return Unit.degToDm(this._target.fromStandard(value));
    /* Default to scale */ else return (this._target.fromStandard(value) * this._c) / this._b;
  }

  /**
   * Convert from the standard unit.
   * @param value the standard value.
   * @return the value.
   */
  public from(value: float64): float64 {
    return this.fromStandard(value);
  }

  /**
   * Convert a sexagesimal DMS value to fractional degrees.
   * @param dms the sexagesimal DMS value.
   * @return the fractional degrees.
   */
  public static dmsToDeg(dms: float64): float64 {
    /* Make sure we have an non-negative number */
    let neg: boolean = dms < 0.0;
    if (neg) dms *= -1.0;
    /* Get the seconds */
    let seconds: float64 = 10000.0 * dms;
    let iseconds: int32 = Math.floor(seconds);
    let fraction: float64 = seconds - iseconds;
    /* Catch rounding errors (like 6.1000 to 6.099999999999999) */
    if (Math.abs(fraction - 1.0) < 1.0e-4) {
      iseconds++;
      fraction = 0.0;
    }
    /* Get the degrees */
    let deg: int32 = Numbers.divInt(iseconds, 10000);
    ASystem.assertNot(deg < -360 || deg > 360, "Invalid deg (" + deg + ") in DMS " + dms);
    iseconds -= deg * 10000;
    /* Get the minutes */
    let min: int32 = Numbers.divInt(iseconds, 100);
    ASystem.assertNot(min < 0 || min > 59, "Invalid min (" + min + ") in DMS " + dms);
    iseconds -= min * 100;
    /* Get the seconds */
    let sec: int32 = iseconds;
    ASystem.assertNot(sec < 0 || sec > 59, "Invalid sec (" + sec + ") in DMS " + dms);
    /* Check the fraction */
    ASystem.assertNot(fraction < 0.0 || fraction >= 1.0, "Invalid fraction (" + fraction + ") in DMS " + dms);
    /* Convert to fractional degrees */
    let fdeg: float64 = deg + min / 60.0 + sec / 3600.0 + fraction / 3600.0;
    if (neg) fdeg *= -1.0;
    /* Return the degrees */
    return fdeg;
  }

  /**
   * Convert a sexagesimal DMS value to fractional radians.
   * @param dms the sexagesimal DMS value.
   * @return the fractional radians.
   */
  public static dmsToRad(dms: float64): float64 {
    return (Unit.dmsToDeg(dms) * Math.PI) / 180.0;
  }

  /**
   * Convert fractional degrees to a sexagesimal DMS value.
   * @param deg the fractional degrees.
   * @return the sexagesimal DMS value.
   */
  public static degToDms(deg: float64): float64 {
    /* Make sure we have an non-negative number */
    let neg: boolean = deg < 0.0;
    if (neg) deg *= -1.0;
    /* Get the integer degrees */
    let ideg: float64 = Math.floor(deg);
    deg -= ideg;
    /* Get the minutes */
    deg *= 60.0;
    let min: float64 = Math.floor(deg);
    deg -= min;
    /* Get the seconds */
    deg *= 60.0;
    let sec: float64 = deg;
    /* Convert to DMS */
    let dms: float64 = ideg + min / 100.0 + sec / 10000.0;
    if (neg) dms *= -1.0;
    /* Return the DMS */
    return dms;
  }

  /**
   * Convert a sexagesimal DM value to fractional degrees.
   * @param dm the sexagesimal DM value.
   * @return the fractional degrees.
   */
  public static dmToDeg(dm: float64): float64 {
    /* Make sure we have an non-negative number */
    let neg: boolean = dm < 0.0;
    if (neg) dm *= -1.0;
    /* Get the seconds */
    let minutes: float64 = 100.0 * dm;
    let iminutes: int32 = Math.floor(minutes);
    let fraction: float64 = minutes - iminutes;
    /* Catch rounding errors (like 6.1000 to 6.099999999999999) */
    if (Math.abs(fraction - 1.0) < 1.0e-4) {
      iminutes++;
      fraction = 0.0;
    }
    /* Get the degrees */
    let deg: int32 = Numbers.divInt(iminutes, 100);
    ASystem.assertNot(deg < -180 || deg > 180, "Invalid deg (" + deg + ") in DM " + dm);
    /* Get the minutes */
    let min: int32 = iminutes % 100;
    ASystem.assertNot(min < 0 || min > 59, "Invalid min (" + min + ") in DM " + dm);
    /* Check the fraction */
    ASystem.assertNot(fraction < 0.0 || fraction >= 1.0, "Invalid fraction (" + fraction + ") in DM " + dm);
    /* Convert to fractional degrees */
    let fdeg: float64 = deg + min / 60.0 + fraction / 60.0;
    if (neg) fdeg *= -1.0;
    /* Return the degrees */
    return fdeg;
  }

  /**
   * Convert fractional degrees to a sexagesimal DM value.
   * @param deg the fractional degrees.
   * @return the sexagesimal DM value.
   */
  public static degToDm(deg: float64): float64 {
    /* Make sure we have an non-negative number */
    let neg: boolean = deg < 0.0;
    if (neg) deg *= -1.0;
    /* Get the integer degrees */
    let ideg: float64 = Math.floor(deg);
    deg -= ideg;
    /* Get the minutes */
    deg *= 60.0;
    let min: float64 = deg;
    /* Convert to DMS */
    let dms: float64 = ideg + min / 100.0;
    if (neg) dms *= -1.0;
    /* Return the DMS */
    return dms;
  }
}
