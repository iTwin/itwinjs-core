/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ClassUtils } from "../ClassUtils";

describe("ClassUtils", () => {
  it("isProperSubclassOf", () => {
    class A { public a = "a"; }
    class B extends A { public b = "b"; }
    class C extends B { public c = "c"; }

    expect(ClassUtils.isProperSubclassOf(A, A)).to.be.false;
    expect(ClassUtils.isProperSubclassOf(A, B)).to.be.false;
    expect(ClassUtils.isProperSubclassOf(A, C)).to.be.false;

    expect(ClassUtils.isProperSubclassOf(B, A)).to.be.true;
    expect(ClassUtils.isProperSubclassOf(B, B)).to.be.false;
    expect(ClassUtils.isProperSubclassOf(B, C)).to.be.false;

    expect(ClassUtils.isProperSubclassOf(C, A)).to.be.true;
    expect(ClassUtils.isProperSubclassOf(C, B)).to.be.true;
    expect(ClassUtils.isProperSubclassOf(C, C)).to.be.false;

    type Eq<L, R> = L extends R ? R extends L ? true : false : false;
    type Extends<T, Base> = T extends Base ? true : false;

    // test won't compile if our type assumptions aren't met
    const X: typeof B | typeof C = undefined as any;
    if (ClassUtils.isProperSubclassOf(X, C)) {
      const instanceOfX = new X();
      const _doesInstanceOfXExtendC: Extends<typeof instanceOfX, C> = true;
      const _doesInstanceOfXExtendB: Extends<typeof instanceOfX, B> = true;
      const _isTypeOfInstanceOfXEqToB: Eq<typeof instanceOfX, B> = false;
      const _isTypeOfInstanceOfXEqToC: Eq<typeof instanceOfX, C> = true;
    } else if (ClassUtils.isProperSubclassOf(X, B)) {
      const instanceOfX = new X();
      const _doesInstanceOfXExtendC: Extends<typeof instanceOfX, C> = false;
      const _doesInstanceOfXExtendB: Extends<typeof instanceOfX, B> = true;
      const _isTypeOfInstanceOfXEqToB: Eq<typeof instanceOfX, B> = true;
      const _isTypeOfInstanceOfXEqToC: Eq<typeof instanceOfX, C> = false;
    }
  });
});
