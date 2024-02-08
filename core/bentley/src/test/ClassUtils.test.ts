/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as classUtils from "../ClassUtils";

type Extends<T, Base> = T extends Base ? true : false;

describe("ClassUtils", () => {
  it("isProperSubclassOf", () => {
    class A { public a = "a"; }
    class B extends A { public b = "b"; }
    class C extends B { public c = "c"; }
    class M { public m = "m"; }

    expect(classUtils.isProperSubclassOf(A, A)).to.be.false;
    expect(classUtils.isProperSubclassOf(A, B)).to.be.false;
    expect(classUtils.isProperSubclassOf(A, C)).to.be.false;
    expect(classUtils.isProperSubclassOf(A, M)).to.be.false;

    expect(classUtils.isProperSubclassOf(B, A)).to.be.true;
    expect(classUtils.isProperSubclassOf(B, B)).to.be.false;
    expect(classUtils.isProperSubclassOf(B, C)).to.be.false;
    expect(classUtils.isProperSubclassOf(B, M)).to.be.false;

    expect(classUtils.isProperSubclassOf(C, A)).to.be.true;
    expect(classUtils.isProperSubclassOf(C, B)).to.be.true;
    expect(classUtils.isProperSubclassOf(C, C)).to.be.false;
    expect(classUtils.isProperSubclassOf(C, M)).to.be.false;

    // test won't compile if our type assumptions aren't met
    const X: typeof A | typeof B | typeof C = B;
    if (classUtils.isProperSubclassOf(X, C)) {
      const instanceOfX = new X();
      const _doesInstanceOfXExtendA: Extends<typeof instanceOfX, A> = true;
      const _doesInstanceOfXExtendB: Extends<typeof instanceOfX, B> = true;
      const _doesInstanceOfXExtendC: Extends<typeof instanceOfX, C> = true;
      const _doesInstanceOfXExtendM: Extends<typeof instanceOfX, M> = false;
    } else if (classUtils.isProperSubclassOf(X, B)) {
      const instanceOfX = new X();
      const _doesInstanceOfXExtendA: Extends<typeof instanceOfX, A> = true;
      const _doesInstanceOfXExtendB: Extends<typeof instanceOfX, B> = true;
      const _doesInstanceOfXExtendC: Extends<typeof instanceOfX, C> = false;
      const _doesInstanceOfXExtendM: Extends<typeof instanceOfX, M> = false;
    }
  });

  it("isSubclassOf", () => {
    class A { public a = "a"; }
    class B extends A { public b = "b"; }
    class C extends B { public c = "c"; }
    class M { public m = "m"; }

    expect(classUtils.isSubclassOf(A, A)).to.be.true;
    expect(classUtils.isSubclassOf(A, B)).to.be.false;
    expect(classUtils.isSubclassOf(A, C)).to.be.false;

    expect(classUtils.isSubclassOf(B, A)).to.be.true;
    expect(classUtils.isSubclassOf(B, B)).to.be.true;
    expect(classUtils.isSubclassOf(B, C)).to.be.false;

    expect(classUtils.isSubclassOf(C, A)).to.be.true;
    expect(classUtils.isSubclassOf(C, B)).to.be.true;
    expect(classUtils.isSubclassOf(C, C)).to.be.true;

    // test won't compile if our type assumptions aren't met
    const X: typeof A | typeof B | typeof C = B;
    if (classUtils.isSubclassOf(X, C)) {
      const instanceOfX = new X();
      const _doesInstanceOfXExtendA: Extends<typeof instanceOfX, A> = true;
      const _doesInstanceOfXExtendB: Extends<typeof instanceOfX, B> = true;
      const _doesInstanceOfXExtendC: Extends<typeof instanceOfX, C> = true;
      const _doesInstanceOfXExtendM: Extends<typeof instanceOfX, M> = false;
    } else if (classUtils.isSubclassOf(X, B)) {
      const instanceOfX = new X();
      const _doesInstanceOfXExtendA: Extends<typeof instanceOfX, A> = true;
      const _doesInstanceOfXExtendB: Extends<typeof instanceOfX, B> = true;
      const _doesInstanceOfXExtendC: Extends<typeof instanceOfX, C> = false;
      const _doesInstanceOfXExtendM: Extends<typeof instanceOfX, M> = false;
    }
  });
});
