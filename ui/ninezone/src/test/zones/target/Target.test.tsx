/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { MergeTarget } from "../../../ui-ninezone";

describe("<MergeTarget />", () => {
  it("should render", () => {
    mount(<MergeTarget />);
  });

  it("renders correctly", () => {
    shallow(<MergeTarget />).should.matchSnapshot();
  });

  it("should invoke onTargetChanged handler when mouse enters", () => {
    const spy = sinon.spy();
    const sut = mount(<MergeTarget onTargetChanged={spy} />);
    sut.simulate("mouseEnter");
    spy.calledOnceWithExactly(true).should.true;
  });

  it("should invoke onTargetChanged handler when mouse leaves", () => {
    const spy = sinon.spy();
    const sut = mount(<MergeTarget onTargetChanged={spy} />);
    sut.simulate("mouseLeave");
    spy.calledOnceWithExactly(false).should.true;
  });

  it("should invoke onTargetChanged handler when component unmounts", () => {
    const spy = sinon.spy();
    const sut = mount(<MergeTarget onTargetChanged={spy} />);
    sut.simulate("mouseEnter");
    sut.unmount();
    spy.firstCall.calledWithExactly(true).should.true;
    spy.secondCall.calledWithExactly(false).should.true;
  });
});
