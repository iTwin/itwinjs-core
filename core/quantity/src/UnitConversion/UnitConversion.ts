/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { almostEqual } from "../Quantity";

/**
 * Structural interface satisfied by any object that carries a numerator/denominator
 * factor and an optional offset — for example, the EC `Unit` and `Constant` classes in
 * `@itwin/ecschema-metadata`.
 * @internal
 */
export interface UnitConversionSource {
  readonly numerator: number;
  readonly denominator: number;
  readonly offset?: number;
}

/**
 * Class used for storing calculated conversion between two Units and converting values from one Unit to another.
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
   * Returns UnitConversion with source's numerator and denominator in factor and source's offset in offset for reducing.
   * Accepts any object that structurally satisfies `UnitConversionSource` (e.g. EC `Unit` or `Constant`).
   * @internal
   */
  public static from(source: UnitConversionSource): UnitConversion {
    const offset = source.offset ?? 0;
    const hasOffset = !almostEqual(offset, 0.0);
    return new UnitConversion(source.denominator / source.numerator, hasOffset ? -offset : 0.0);
  }
}
