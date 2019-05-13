/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";

import { Item } from "../../../ui-ninezone";

describe("<Item />", () => {
  it("should render", () => {
    mount(<Item />);
  });

  it("renders correctly", () => {
    shallow(<Item />).should.matchSnapshot();
  });

  it("renders active correctly", () => {
    const sut = mount(<Item isActive />);
    const button = sut.find("button").getDOMNode() as HTMLElement;
    button.classList.contains("nz-active").should.true;
  });

  it("renders disabled correctly", () => {
    const sut = mount(<Item isDisabled />);
    const button = sut.find("button").getDOMNode() as HTMLElement;
    button.classList.contains("nz-disabled").should.true;
  });

  it("should invoke onClick handler", () => {
    const spy = sinon.spy();
    const sut = mount(<Item onClick={spy} />);
    sut.find("button").simulate("click");
    spy.calledOnce.should.true;
  });
});
