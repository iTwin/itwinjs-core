/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { mount } from "enzyme";
import { expect } from "chai";

import { getClassName } from "../../ui-core";

describe("getClassName", () => {
  class NamedComponent extends React.Component {
    public render(): React.ReactNode {
      expect(getClassName(this)).to.eq("NamedComponent");
      return null;
    }
  }

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

  it("should be the name of the React component class", () => {
    mount(<NamedComponent />);
  });

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

});
