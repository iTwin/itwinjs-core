/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Constant } from "../Metadata/Constant";
import { Unit } from "../Metadata/Unit";
import { almostEqual } from "@itwin/core-quantity";

/**
 * Class used for storing calculated conversion between two Units [[UnitConverter.calculateConversion]] and converting values from one Unit to another [[UnitConverter.evaluate]]
 * @internal
 */
export class UnitConversion {
  constructor(public readonly factor: number = 1.0, public readonly offset: number = 0.0) {}

  /**
   * Converts x using UnitConversion
   * @param x Input magnitude to be converted
   * @returns Output magnitude after conversion
   */
  public evaluate(x: number): number {
    return this.factor * x + this.offset;
  }

  /**
   * Used to invert source's UnitConversion so that it can be composed with target's UnitConversion cleanly
   * @internal
   */
  public inverse(): UnitConversion {
    const inverseFactor = 1.0 / this.factor;
    return new UnitConversion(inverseFactor, -this.offset * inverseFactor);
  }

  /**
   * Combines two UnitConversions
   * Used to combine source's UnitConversion and target's UnitConversion for a final UnitConversion that can be evaluated
   * @internal
   */
  public compose(conversion: UnitConversion): UnitConversion {
    return new UnitConversion(
      this.factor * conversion.factor,
      conversion.factor * this.offset + conversion.offset,
    );
  }

  /**
   * Multiples two UnitConversions together to calculate factor during reducing
   * @internal
   */
  public multiply(conversion: UnitConversion): UnitConversion {
    if (almostEqual(conversion.offset, 0.0) && almostEqual(this.offset, 0.0))
      return new UnitConversion(this.factor * conversion.factor, 0.0);

    throw new Error("Cannot multiply two maps with non-zero offsets");
  }

  /**
   * Raise UnitConversion's factor with power exponent to calculate factor during reducing
   * @internal
   */
  public raise(power: number): UnitConversion {
    if (almostEqual(power, 1.0))
      return new UnitConversion(this.factor, this.offset);
    else if (almostEqual(power, 0.0))
      return new UnitConversion(1.0, 0.0);

    if (almostEqual(this.offset, 0.0))
      return new UnitConversion(this.factor ** power, 0.0);

    throw new Error("Cannot raise map with non-zero offset");
  }

  /** @internal */
  public static identity = new UnitConversion();

  /**
   * Returns UnitConversion with unit's numerator and denominator in factor and unit's offset in offset for reducing
   * @internal
   */
  public static from(unitOrConstant: Unit | Constant): UnitConversion {
    if (Unit.isUnit(unitOrConstant))
      return new UnitConversion(unitOrConstant.denominator / unitOrConstant.numerator, -unitOrConstant.offset);

    return new UnitConversion(unitOrConstant.denominator / unitOrConstant.numerator, 0.0);
  }
}
