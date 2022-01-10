/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ClassUtils } from "../ClassUtils";

describe("ClassUtils", () => {
  it("isProperSubclassOf", () => {
    class A {}
    class B extends A {}
    class C extends B {}

    expect(ClassUtils.isProperSubclassOf(A, A)).to.be.false;
    expect(ClassUtils.isProperSubclassOf(A, B)).to.be.false;
    expect(ClassUtils.isProperSubclassOf(A, C)).to.be.false;

    expect(ClassUtils.isProperSubclassOf(B, A)).to.be.true;
    expect(ClassUtils.isProperSubclassOf(B, B)).to.be.false;
    expect(ClassUtils.isProperSubclassOf(B, C)).to.be.false;

    expect(ClassUtils.isProperSubclassOf(C, A)).to.be.true;
    expect(ClassUtils.isProperSubclassOf(C, B)).to.be.true;
    expect(ClassUtils.isProperSubclassOf(C, C)).to.be.false;
  });
});
