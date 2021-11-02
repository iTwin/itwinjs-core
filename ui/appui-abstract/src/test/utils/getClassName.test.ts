/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { getClassName } from "../../appui-abstract";

describe("getClassName", () => {
  class NamedClass {
    constructor() {
      expect(getClassName(this)).to.eq("NamedClass");
    }
  }

  class ClassWithStatic {
    public static testMethod1() {
      expect(getClassName(ClassWithStatic)).to.eq("ClassWithStatic");
    }

    public static testMethod2() {
      expect(getClassName(this)).to.eq("ClassWithStatic");
    }
  }

  it("should be the name of the regular class", () => {
    new NamedClass();
  });

  it("should be the name of the class containing a static method", () => {
    ClassWithStatic.testMethod1();
    ClassWithStatic.testMethod2();
  });

  it("should be blank if passed null or undefined", () => {
    expect(getClassName(null)).to.eq("");
    expect(getClassName(undefined)).to.eq("");
  });

  it("should be Object if passed an empty object", () => {
    expect(getClassName({})).to.eq("Object");
  });

  it("should be Number if passed a numeric value", () => {
    expect(getClassName(123)).to.eq("Number");
  });

});
