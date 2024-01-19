/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Geometry, ICloneable } from "../Geometry";

describe("Geometry.isAlmostEqualOptional", () => {
  it("Geometry.isAlmostEqualOptional", () => {
    const number1 = 1;
    const number2 = 1.2;
    const tolerance = 0.1;
    const undefinedNumber = undefined;
    assert.isTrue(!Geometry.isAlmostEqualOptional(number1, number2, tolerance));
    assert.isTrue(!Geometry.isAlmostEqualOptional(number1, undefinedNumber, tolerance));
  });
});

describe("Geometry.minXYZ", () => {
  it("Geometry.minXYZ", () => {
    const a = 1;
    let b = 2;
    let c = 3;
    assert.equal(Geometry.minXYZ(a, b, c), a);
    b = 0;
    assert.equal(Geometry.minXYZ(a, b, c), b);
    c = -1;
    assert.equal(Geometry.minXYZ(a, b, c), c);
  });
});

describe("Geometry.minXY", () => {
  it("Geometry.minXY", () => {
    const a = 1;
    let b = 2;
    assert.equal(Geometry.minXY(a, b), a);
    b = 0;
    assert.equal(Geometry.minXY(a, b), b);
  });
});

describe("Geometry.solveTrigForm", () => {
  it("Geometry.solveTrigForm", () => {
    const constCoff = 1;
    const cosCoff = 0;
    const sinCoff = 0;
    assert.equal(Geometry.solveTrigForm(constCoff, cosCoff, sinCoff), undefined);
  });
});

describe("Geometry.inverseInterpolate", () => {
  it("Geometry.inverseInterpolate", () => {
    const x0: number = 2;
    const f0: number = 10;
    const x1: number = 4;
    const f1: number = 20;
    let fTarget: number = f0;
    const defaultResult: number = -1;
    let interpolatedNumber = Geometry.inverseInterpolate(x0, f0, x1, f1, fTarget, defaultResult);
    assert.equal(interpolatedNumber, x0);
    assert.notEqual(interpolatedNumber, defaultResult);
    fTarget = f1;
    interpolatedNumber = Geometry.inverseInterpolate(x0, f0, x1, f1, fTarget, defaultResult);
    assert.equal(interpolatedNumber, x1);
    assert.notEqual(interpolatedNumber, defaultResult);
  });
});

describe("Geometry.exactEqualNumberArrays", () => {
  it("Geometry.exactEqualNumberArrays", () => {
    const arr1: number[] = [];
    const arr2: number[] = [];
    assert.isTrue(Geometry.exactEqualNumberArrays(arr1, arr2));
  });
});

describe("Geometry.almostEqualArrays", () => {
  it("Geometry.almostEqualArrays", () => {
    const arr1: number[] = [];
    const arr2: number[] = [];
    assert.isTrue(Geometry.almostEqualArrays<number>(arr1, arr2, (a, b) => Geometry.isAlmostEqualNumber(a, b)));
  });
});

describe("Geometry.almostEqualNumberArrays", () => {
  it("Geometry.almostEqualNumberArrays", () => {
    let arr1: number[] = [];
    let arr2: number[] = [];
    assert.isTrue(Geometry.almostEqualNumberArrays(arr1, arr2, (a, b) => Geometry.isAlmostEqualNumber(a, b)));
    arr1 = [1];
    arr2 = [1, 2];
    assert.isTrue(!Geometry.almostEqualNumberArrays(arr1, arr2, (a, b) => Geometry.isAlmostEqualNumber(a,b)));
    arr1 = [1];
    arr2 = [2];
    assert.isTrue(!Geometry.almostEqualNumberArrays(arr1, arr2, (a, b) => Geometry.isAlmostEqualNumber(a, b)));
  });
});

describe("Geometry.areEqualAllowUndefined", () => {
  it("Geometry.areEqualAllowUndefined", () => {
    const num1 = undefined;
    const num2 = undefined;
    assert.isTrue(Geometry.areEqualAllowUndefined<number>(num1, num2));
    const num3 = 0;
    assert.isTrue(!Geometry.areEqualAllowUndefined<number>(num1, num3));
  });
});

class Widget implements ICloneable<Widget> {
  private _value: number = 0;
  constructor(value: number) {
    this._value = value;
  }
  public get value(): number {
    return this._value;
  }
  public clone(result?: Widget): Widget {
    if (result)
      result._value = this._value;
    else
      result = new Widget(this._value);
    return result;
  }
}

describe("Geometry.cloneMembers", () => {
  it("Geometry.cloneMembers", () => {
    let clonedWidgets = Geometry.cloneArray<Widget>(undefined);
    assert.equal(clonedWidgets, undefined);
    const widgets: Widget[] = [new Widget(5), new Widget(6), new Widget(7)];
    clonedWidgets = Geometry.cloneArray<Widget>(widgets)!;
    assert.equal(clonedWidgets[0].value, 5);
    assert.equal(clonedWidgets[1].value, 6);
    assert.equal(clonedWidgets[2].value, 7);
  });
});
