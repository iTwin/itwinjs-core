/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { shallow, mount } from "enzyme";
import { Icon } from "../../ui-core/icons/IconComponent";

describe("IconComponent", () => {

  it("should render with ReactNode", () => {
    mount(<Icon iconSpec={<span>Test</span>} />);
  });

  it("should render correctly with ReactNode", () => {
    shallow(<Icon iconSpec={<span>Test</span>} />).should.matchSnapshot();
  });

  it("should render correctly with icon svg string", () => {
    shallow(<Icon iconSpec="svg:test.svg" />).should.matchSnapshot();
  });

  it("should render correctly with icon class string", () => {
    shallow(<Icon iconSpec="icon-developer" />).should.matchSnapshot();
  });

  it("should render correctly with no iconSpec", () => {
    shallow(<Icon />).should.matchSnapshot();
  });

});
