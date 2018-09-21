/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { QuantityProps, UnitProps, UnitConversion } from "./Interfaces";

export class Quantity implements QuantityProps {
  protected _magnitude: number = 0.0;
  protected _unit: UnitProps;
  protected _isValid: boolean = false;

  public get unit(): UnitProps { return this._unit; }
  public get magnitude(): number { return this._magnitude; }
  public get isValid(): boolean { return this._isValid; }

  public constructor(unit?: UnitProps, magnitude?: number) {
    if (undefined !== unit) {
      this._unit = unit;
      this._isValid = true;
    } else {
      this._unit = { name: "unknown", label: "unknown", unitGroup: "unknown", isValid: false };
    }

    if (undefined !== magnitude)
      this._magnitude = magnitude;
  }

  public convertTo(toUnit: UnitProps, conversion: UnitConversion): Quantity | undefined {
    const newMagnitude = (this.magnitude * conversion.factor) + conversion.offset;
    return new Quantity(toUnit, newMagnitude);
  }
}
