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
    mount(<PointerCaptor isPointerDown={false} />);
  });

  it("renders correctly", () => {
    shallow(<PointerCaptor isPointerDown={false} />).should.matchSnapshot();
  });

  it("should respect isPointerDown prop over state", () => {
    shallow(<PointerCaptor isPointerDown />).should.matchSnapshot();
  });

  it("should unmount", () => {
    const sut = mount(<PointerCaptor isPointerDown={false} />);
    sut.unmount();
  });

  it("should call pointer down prop", () => {
    const spy = sinon.spy();
    const sut = mount(<PointerCaptor isPointerDown={false} onPointerDown={spy} />);
    sut.simulate("pointerDown");

    spy.calledOnce.should.true;
  });

  it("should call pointer up if pointer is down", () => {
    const spy = sinon.spy();
    mount(<PointerCaptor isPointerDown onPointerUp={spy} />);

    const pointerUp = document.createEvent("HTMLEvents");
    pointerUp.initEvent("pointerup");
    document.dispatchEvent(pointerUp);

    spy.calledOnce.should.true;
  });

  it("should call pointer move if pointer is down", () => {
    const spy = sinon.spy();
    const sut = mount(<PointerCaptor isPointerDown onPointerMove={spy} />);
    sut.simulate("pointerDown");

    const pointerMove = document.createEvent("HTMLEvents");
    pointerMove.initEvent("pointermove");
    document.dispatchEvent(pointerMove);

    spy.calledOnce.should.true;
  });
});
