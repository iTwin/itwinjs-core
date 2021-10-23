/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { Item } from "../../../appui-layout-react";
import { mount } from "../../Utils";

describe("<Item />", () => {
  it("should render", () => {
    mount(<Item />);
  });

  it("renders correctly", () => {
    shallow(<Item />).should.matchSnapshot();
  });

  it("renders active correctly", () => {
    const sut = mount(<Item isActive />);
    const button = sut.find("button").getDOMNode();
    button.classList.contains("nz-active").should.true;
  });

  it("renders disabled correctly", () => {
    const sut = mount(<Item isDisabled />);
    const button = sut.find("button").getDOMNode();
    button.classList.contains("nz-disabled").should.true;
  });

  it("should invoke onClick handler", () => {
    const spy = sinon.spy();
    const sut = mount(<Item onClick={spy} />);
    sut.find("button").simulate("click");
    spy.calledOnce.should.true;
  });

  it("renders with badge correctly", () => {
    const sut = mount(<Item badge />);
    const badge = sut.find("div.nz-badge");
    badge.length.should.eq(1);
  });

  it("should invoke onSizeKnown handler", () => {
    const spy = sinon.spy();
    mount(<Item onSizeKnown={spy} />);
    spy.calledOnce.should.true;
  });
});
