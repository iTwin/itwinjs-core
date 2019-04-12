/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { PointerCaptor } from "../../ui-ninezone/base/PointerCaptor";

describe("<PointerCaptor />", () => {
  it("should render", () => {
    mount(<PointerCaptor />);
  });

  it("renders correctly", () => {
    shallow(<PointerCaptor />).should.matchSnapshot();
  });

  it("should respect isMouseDown prop over state", () => {
    shallow(<PointerCaptor isMouseDown />).should.matchSnapshot();
  });

  it("should unmount", () => {
    const sut = mount(<PointerCaptor />);
    sut.unmount();
  });

  it("should call mouse down prop", () => {
    const spy = sinon.spy();
    const sut = mount(<PointerCaptor onMouseDown={spy} />);
    sut.simulate("mouseDown");

    spy.calledOnce.should.true;
  });

  it("should set isMouseDown state", () => {
    const spy = sinon.spy();
    const sut = mount<PointerCaptor>(<PointerCaptor onMouseDown={spy} />);
    sut.simulate("mouseDown");

    sut.state().isMouseDown.should.eq(true);
  });

  it("should call mouse up after mouse down was called on captor", () => {
    const spy = sinon.spy();
    const sut = mount(<PointerCaptor onMouseUp={spy} />);
    sut.simulate("mouseDown");

    const mouseUp = document.createEvent("HTMLEvents");
    mouseUp.initEvent("mouseup");
    document.dispatchEvent(mouseUp);

    spy.calledOnce.should.true;
  });

  it("should call mouse move after mouse down was called on captor", () => {
    const spy = sinon.spy();
    const sut = mount(<PointerCaptor onMouseMove={spy} />);
    sut.simulate("mouseDown");

    const mouseMove = document.createEvent("HTMLEvents");
    mouseMove.initEvent("mousemove");
    document.dispatchEvent(mouseMove);

    spy.calledOnce.should.true;
  });
});
