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
    mount(<PointerCaptor isMouseDown={false} />);
  });

  it("renders correctly", () => {
    shallow(<PointerCaptor isMouseDown={false} />).should.matchSnapshot();
  });

  it("should respect isMouseDown prop over state", () => {
    shallow(<PointerCaptor isMouseDown />).should.matchSnapshot();
  });

  it("should unmount", () => {
    const sut = mount(<PointerCaptor isMouseDown={false} />);
    sut.unmount();
  });

  it("should call mouse down prop", () => {
    const spy = sinon.spy();
    const sut = mount(<PointerCaptor isMouseDown={false} onMouseDown={spy} />);
    sut.simulate("mouseDown");

    spy.calledOnce.should.true;
  });

  it("should call mouse up if mouse is down", () => {
    const spy = sinon.spy();
    mount(<PointerCaptor isMouseDown onMouseUp={spy} />);

    const mouseUp = document.createEvent("HTMLEvents");
    mouseUp.initEvent("mouseup");
    document.dispatchEvent(mouseUp);

    spy.calledOnce.should.true;
  });

  it("should call mouse move if mouse is down", () => {
    const spy = sinon.spy();
    const sut = mount(<PointerCaptor isMouseDown onMouseMove={spy} />);
    sut.simulate("mouseDown");

    const mouseMove = document.createEvent("HTMLEvents");
    mouseMove.initEvent("mousemove");
    document.dispatchEvent(mouseMove);

    spy.calledOnce.should.true;
  });
});
