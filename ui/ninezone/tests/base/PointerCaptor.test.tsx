/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";

import PointerCaptor, { PointerCaptorState } from "../../src/base/PointerCaptor";

describe("<PointerCaptor />", () => {
  it("should render", () => {
    mount(<PointerCaptor />);
  });

  it("renders correctly", () => {
    shallow(<PointerCaptor />).should.matchSnapshot();
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
    const sut = mount<PointerCaptor, PointerCaptorState>(<PointerCaptor onMouseDown={spy} />);
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
