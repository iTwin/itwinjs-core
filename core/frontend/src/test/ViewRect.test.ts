/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ViewRect } from "../common/ViewRect";
import { getCenteredViewRect } from "../common/ImageUtil";

function expectRect(rect: ViewRect, l: number, t: number, r: number, b: number): void {
  expect(rect.left).to.equal(l);
  expect(rect.right).to.equal(r);
  expect(rect.top).to.equal(t);
  expect(rect.bottom).to.equal(b);
}

describe("ViewRect", () => {
  it("rounds negative inputs up to zero", () => {
    expectRect(new ViewRect(-0.001, -50,  1, 2), 0, 0, 1, 2);
  });

  it("truncates inputs", () => {
    expectRect(new ViewRect(0.1, 1.2, 3.8, 4.9), 0, 1, 3, 4);
  });
});

describe("getCenteredViewRect", () => {
  function center(l: number, t: number, r: number, b: number, aspect?: number): ViewRect {
    return getCenteredViewRect(new ViewRect(l, t, r, b), aspect);
  }

  it("returns input if aspect ratio matches", () => {
    expectRect(center(0, 0, 140, 100, 1.4), 0, 0, 140, 100);
  });

  it("eliminates floating point rounding error", () => {
    expectRect(center(0, 0, 390, 844), 0, 282, 390, 561);
  });
});
