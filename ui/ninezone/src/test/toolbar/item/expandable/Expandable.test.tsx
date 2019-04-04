/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";

import { ExpandableItem } from "../../../../ui-ninezone";

describe("<ExpandableItem />", () => {
  it("should render", () => {
    mount(<ExpandableItem />);
  });

  it("renders correctly", () => {
    shallow(<ExpandableItem />).should.matchSnapshot();
  });

  it("renders active correctly", () => {
    const sut = mount(<ExpandableItem isActive />);
    const button = sut.getDOMNode() as HTMLElement;
    button.classList.contains("nz-active").should.true;
  });

  it("renders disabled correctly", () => {
    const sut = mount(<ExpandableItem isDisabled />);
    const button = sut.getDOMNode() as HTMLElement;
    button.classList.contains("nz-disabled").should.true;
  });

  it("should invoke onIsHistoryExtendedChange when mouse enters", () => {
    const spy = sinon.spy();
    const sut = mount(<ExpandableItem onIsHistoryExtendedChange={spy} />);
    sut.simulate("mouseEnter");
    spy.calledOnceWithExactly(true).should.true;
  });

  it("should invoke onIsHistoryExtendedChange when mouse leaves", () => {
    const spy = sinon.spy();
    const sut = mount(<ExpandableItem onIsHistoryExtendedChange={spy} />);
    sut.simulate("mouseLeave");
    spy.calledOnceWithExactly(false).should.true;
  });

  it("should not invoke if onIsHistoryExtendedChange is not provided", () => {
    const sut = mount(<ExpandableItem />);
    sut.simulate("mouseEnter");
    sut.simulate("mouseLeave");
  });
});
