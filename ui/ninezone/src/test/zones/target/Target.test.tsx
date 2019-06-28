/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { WidgetTarget } from "../../../ui-ninezone/zones/target/Target";

describe("<WidgetTarget />", () => {
  it("should render", () => {
    mount(<WidgetTarget />);
  });

  it("renders correctly", () => {
    shallow(<WidgetTarget />).should.matchSnapshot();
  });

  it("should invoke onTargetChanged handler when mouse enters", () => {
    const spy = sinon.spy();
    const sut = mount(<WidgetTarget onTargetChanged={spy} />);
    const target = sut.find(".nz-zones-target-target");
    target.simulate("mouseEnter");
    spy.calledOnceWithExactly(true).should.true;
  });

  it("should invoke onTargetChanged handler when mouse leaves", () => {
    const spy = sinon.spy();
    const sut = mount(<WidgetTarget onTargetChanged={spy} />);
    const target = sut.find(".nz-zones-target-target");
    target.simulate("mouseLeave");
    spy.calledOnceWithExactly(false).should.true;
  });

  it("should invoke onTargetChanged handler when component unmounts", () => {
    const spy = sinon.spy();
    const sut = mount(<WidgetTarget onTargetChanged={spy} />);
    const target = sut.find(".nz-zones-target-target");
    target.simulate("mouseEnter");
    sut.unmount();
    spy.calledTwice.should.true;
    spy.firstCall.calledWithExactly(true).should.true;
    spy.secondCall.calledWithExactly(false).should.true;
  });

  it("should invoke onTargetChanged handler when mouse moves over target", () => {
    const spy = sinon.spy();
    const sut = mount(<WidgetTarget onTargetChanged={spy} />);
    const target = sut.find(".nz-zones-target-target");
    target.simulate("mouseMove");
    spy.firstCall.calledWithExactly(true).should.true;
  });

  it("should not invoke onTargetChanged if already targeted", () => {
    const spy = sinon.spy();
    const sut = mount(<WidgetTarget onTargetChanged={spy} />);
    const target = sut.find(".nz-zones-target-target");
    target.simulate("mouseEnter");
    spy.resetHistory();

    target.simulate("mouseMove");
    spy.notCalled.should.true;
  });
});
