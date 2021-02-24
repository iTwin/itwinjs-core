/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Constant, Unit } from "../ecschema-metadata";
import { Float } from "./Float";
import { isUnit } from "./Helper";

export class LinearMap {
  constructor(
    public readonly slope: number = 1.0,
    public readonly offset: number = 0.0
  ) {}

  public evaluate(x: number): number {
    return this.slope * x + this.offset;
  }

  public inverse(): LinearMap {
    // y = mx + c
    // => x = (y-c)/m
    const inverseSlope = 1.0 / this.slope;
    return new LinearMap(inverseSlope, -this.offset * inverseSlope);
  }

  public compose(map: LinearMap): LinearMap {
    // map  === z = py + q
    // this === y = mx + c
    // result === z = p(mx + c) + q === z = pm x + (pc + q)
    return new LinearMap(
      this.slope * map.slope,
      map.slope * this.offset + map.offset
    );
  }

  public multiply(map: LinearMap): LinearMap {
    if (Float.equals(map.offset, 0.0) && Float.equals(this.offset, 0.0))
      return new LinearMap(this.slope * map.slope, 0.0);

    throw new Error("Cannot multiply two maps with non-zero offsets");
  }

  public raise(power: number): LinearMap {
    if (Float.equals(1.0, power)) return new LinearMap(this.slope, this.offset);
    else if (Float.equals(0.0, power)) return new LinearMap(1.0, 0.0);

    if (Float.equals(this.offset, 0.0))
      return new LinearMap(this.slope ** power, 0.0);

    throw new Error("Cannot raise map with non-zero offset");
  }

  public isEqual(mp: LinearMap): boolean {
    return (
      Float.equals(this.slope, mp.slope) && Float.equals(this.offset, mp.offset)
    );
  }

  public get isIdentity(): boolean {
    return this.isEqual(LinearMap.identity);
  }

  public toString(): string {
    return `LMAP(slope=${this.slope} offset=${this.offset})`;
  }

  public get ulp(): number {
    return Float.ulp(this.offset);
  }

  public static identity = new LinearMap();

  public static from(unit: Unit | Constant): LinearMap {
    if (isUnit(unit)) {
      return new LinearMap(unit.denominator / unit.numerator, -unit.offset);
    }
    return new LinearMap(unit.denominator / unit.numerator, 0.0);
  }
}
