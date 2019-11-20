/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { WidgetTarget } from "../../../ui-ninezone/zones/target/Target";

describe("<WidgetTarget />", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it("should render", () => {
    mount(<WidgetTarget />);
  });

  it("renders correctly", () => {
    shallow(<WidgetTarget />).should.matchSnapshot();
  });

  it("should invoke onTargetChanged handler when pointer enters", () => {
    const spy = sinon.spy();
    const sut = mount(<WidgetTarget onTargetChanged={spy} />);

    const target = sut.find(".nz-zones-target-target");
    sinon.stub(target.getDOMNode(), "contains").returns(true);

    const pointerMove = document.createEvent("HTMLEvents");
    pointerMove.initEvent("pointermove");
    document.dispatchEvent(pointerMove);

    spy.calledOnceWithExactly(true).should.true;
  });

  it("should invoke onTargetChanged handler when pointer leaves", () => {
    const spy = sinon.spy();
    const sut = mount<WidgetTarget>(<WidgetTarget onTargetChanged={spy} />);
    sut.setState({ isTargeted: true });

    const target = sut.find(".nz-zones-target-target");
    sinon.stub(target.getDOMNode(), "contains").returns(false);

    const pointerMove = document.createEvent("HTMLEvents");
    pointerMove.initEvent("pointermove");
    document.dispatchEvent(pointerMove);

    spy.calledOnceWithExactly(false).should.true;
  });

  it("should invoke onTargetChanged handler when component unmounts", () => {
    const spy = sinon.spy();
    const sut = mount<WidgetTarget>(<WidgetTarget onTargetChanged={spy} />);
    sut.setState({ isTargeted: true });

    sut.unmount();
    spy.calledOnceWithExactly(false).should.true;
  });

  it("should add event listeners", () => {
    const spy = sandbox.spy(document, "addEventListener");
    mount<WidgetTarget>(<WidgetTarget />);

    spy.calledOnceWithExactly("pointermove", sinon.match.any as any).should.true;
  });

  it("should remove event listeners", () => {
    const spy = sandbox.spy(document, "removeEventListener");
    const sut = mount<WidgetTarget>(<WidgetTarget />);
    sut.unmount();

    spy.calledOnceWithExactly("pointermove", sinon.match.any as any).should.true;
  });
});
