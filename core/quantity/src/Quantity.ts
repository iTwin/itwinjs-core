/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Quantity
 */

import { QuantityProps, UnitConversion, UnitProps } from "./Interfaces";

/** The Quantity class is convenient container to specify both the magnitude and unit of a quantity. This class is commonly
 * returned as the result of parsing a string that represents a quantity.
 * @beta
 */
export class Quantity implements QuantityProps {
  protected _magnitude: number = 0.0;
  protected _unit: UnitProps;
  protected _isValid: boolean = false;

  public get unit(): UnitProps { return this._unit; }
  public get magnitude(): number { return this._magnitude; }
  public get isValid(): boolean { return this._isValid; }

  /** Constructor. The Quantity will only be set as valid if a unit is specified.
   *  @param unit     Defines the quantity's unit.
   *  @param magnitude   Defines the magnitude of the quantity.
   */
  public constructor(unit?: UnitProps, magnitude?: number) {
    if (undefined !== unit) {
      this._unit = unit;
      this._isValid = true;
    } else {
      this._unit = { name: "unknown", label: "unknown", phenomenon: "unknown", isValid: false, system: "unknown" };
    }

    if (undefined !== magnitude)
      this._magnitude = magnitude;
  }

  /** Convert a Quantity to the specified unit given the UnitConversion.
   *  @param toUnit   The new unit for the quantity.
   *  @param conversion  Defines the information needed to convert the Quantity's magnitude from the current unit to another unit. This conversion info is usually
   *                     returned from the UnitsProvider.
   */
  public convertTo(toUnit: UnitProps, conversion: UnitConversion): Quantity | undefined {
    const newMagnitude = (this.magnitude * conversion.factor) + conversion.offset;
    return new Quantity(toUnit, newMagnitude);
  }
}
