/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import * as ClassUtils from "../ClassUtils";

type Extends<T, Base> = T extends Base ? true : false;

describe("ClassUtils", () => {
  it("isProperSubclassOf", () => {
    class A { public a = "a"; }
    class B extends A { public b = "b"; }
    class C extends B { public c = "c"; }
    class M { public m = "m"; }

    expect(ClassUtils.isProperSubclassOf(A, A)).to.be.false;
    expect(ClassUtils.isProperSubclassOf(A, B)).to.be.false;
    expect(ClassUtils.isProperSubclassOf(A, C)).to.be.false;
    expect(ClassUtils.isProperSubclassOf(A, M)).to.be.false;

    expect(ClassUtils.isProperSubclassOf(B, A)).to.be.true;
    expect(ClassUtils.isProperSubclassOf(B, B)).to.be.false;
    expect(ClassUtils.isProperSubclassOf(B, C)).to.be.false;
    expect(ClassUtils.isProperSubclassOf(B, M)).to.be.false;

    expect(ClassUtils.isProperSubclassOf(C, A)).to.be.true;
    expect(ClassUtils.isProperSubclassOf(C, B)).to.be.true;
    expect(ClassUtils.isProperSubclassOf(C, C)).to.be.false;
    expect(ClassUtils.isProperSubclassOf(C, M)).to.be.false;

    // test won't compile if our type assumptions aren't met
    const X: typeof A | typeof B | typeof C = B;
    if (ClassUtils.isProperSubclassOf(X, C)) {
      const _instanceOfX = new X();
      const _doesInstanceOfXExtendA: Extends<typeof _instanceOfX, A> = true;
      const _doesInstanceOfXExtendB: Extends<typeof _instanceOfX, B> = true;
      const _doesInstanceOfXExtendC: Extends<typeof _instanceOfX, C> = true;
      const _doesInstanceOfXExtendM: Extends<typeof _instanceOfX, M> = false;
    } else if (ClassUtils.isProperSubclassOf(X, B)) {
      const _instanceOfX = new X();
      const _doesInstanceOfXExtendA: Extends<typeof _instanceOfX, A> = true;
      const _doesInstanceOfXExtendB: Extends<typeof _instanceOfX, B> = true;
      const _doesInstanceOfXExtendC: Extends<typeof _instanceOfX, C> = false;
      const _doesInstanceOfXExtendM: Extends<typeof _instanceOfX, M> = false;
    }
  });

  it("isSubclassOf", () => {
    class A { public a = "a"; }
    class B extends A { public b = "b"; }
    class C extends B { public c = "c"; }
    class M { public m = "m"; }

    expect(ClassUtils.isSubclassOf(A, A)).to.be.true;
    expect(ClassUtils.isSubclassOf(A, B)).to.be.false;
    expect(ClassUtils.isSubclassOf(A, C)).to.be.false;

    expect(ClassUtils.isSubclassOf(B, A)).to.be.true;
    expect(ClassUtils.isSubclassOf(B, B)).to.be.true;
    expect(ClassUtils.isSubclassOf(B, C)).to.be.false;

    expect(ClassUtils.isSubclassOf(C, A)).to.be.true;
    expect(ClassUtils.isSubclassOf(C, B)).to.be.true;
    expect(ClassUtils.isSubclassOf(C, C)).to.be.true;

    // test won't compile if our type assumptions aren't met
    const X: typeof A | typeof B | typeof C = B;
    if (ClassUtils.isSubclassOf(X, C)) {
      const _instanceOfX = new X();
      const _doesInstanceOfXExtendA: Extends<typeof _instanceOfX, A> = true;
      const _doesInstanceOfXExtendB: Extends<typeof _instanceOfX, B> = true;
      const _doesInstanceOfXExtendC: Extends<typeof _instanceOfX, C> = true;
      const _doesInstanceOfXExtendM: Extends<typeof _instanceOfX, M> = false;
    } else if (ClassUtils.isSubclassOf(X, B)) {
      const _instanceOfX = new X();
      const _doesInstanceOfXExtendA: Extends<typeof _instanceOfX, A> = true;
      const _doesInstanceOfXExtendB: Extends<typeof _instanceOfX, B> = true;
      const _doesInstanceOfXExtendC: Extends<typeof _instanceOfX, C> = false;
      const _doesInstanceOfXExtendM: Extends<typeof _instanceOfX, M> = false;
    }
  });
});
