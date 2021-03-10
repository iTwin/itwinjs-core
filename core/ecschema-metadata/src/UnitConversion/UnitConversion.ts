/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Constant, Unit } from "../ecschema-metadata";
import { SchemaItemType } from "../ECObjects";
import { Float } from "./Float";

export class UnitConversion {
  /** @internal */
  constructor(
    public readonly factor: number = 1.0,
    public readonly offset: number = 0.0
  ) {}

  /** @alpha */
  public evaluate(x: number): number {
    return this.factor * x + this.offset;
  }

  /** @internal */
  public inverse(): UnitConversion {
    // y = mx + c
    // => x = (y-c)/m
    const inverseSlope = 1.0 / this.factor;
    return new UnitConversion(inverseSlope, -this.offset * inverseSlope);
  }

  /** @internal */
  public compose(map: UnitConversion): UnitConversion {
    // map  === z = py + q
    // this === y = mx + c
    // result === z = p(mx + c) + q === z = pm x + (pc + q)
    return new UnitConversion(
      this.factor * map.factor,
      map.factor * this.offset + map.offset
    );
  }

  /** @internal */
  public multiply(map: UnitConversion): UnitConversion {
    if (Float.equals(map.offset, 0.0) && Float.equals(this.offset, 0.0))
      return new UnitConversion(this.factor * map.factor, 0.0);

    throw new Error("Cannot multiply two maps with non-zero offsets");
  }

  /** @internal */
  public raise(power: number): UnitConversion {
    if (Float.equals(1.0, power))
      return new UnitConversion(this.factor, this.offset);
    else if (Float.equals(0.0, power)) return new UnitConversion(1.0, 0.0);

    if (Float.equals(this.offset, 0.0))
      return new UnitConversion(this.factor ** power, 0.0);

    throw new Error("Cannot raise map with non-zero offset");
  }

  /** @internal */
  public toString(): string {
    return `LMAP(factor=${this.factor} offset=${this.offset})`;
  }

  /** @internal */
  public get ulp(): number {
    return Float.ulp(this.offset);
  }

  /** @internal */
  public static identity = new UnitConversion();

  /** @internal */
  public static from(unit: Unit | Constant): UnitConversion {
    if (unit.schemaItemType === SchemaItemType.Unit) {
      return new UnitConversion(
        unit.denominator / unit.numerator,
        -unit.offset
      );
    }
    return new UnitConversion(unit.denominator / unit.numerator, 0.0);
  }
}
