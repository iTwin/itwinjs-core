/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { DragHandle, DragHandleProps } from "../../ui-ninezone/base/DragHandle";
import { SinonSpy } from "../Utils";
import { PointerCaptor } from "../../ui-ninezone/base/PointerCaptor";

describe("<DragHandle />", () => {
  it("should render", () => {
    mount(<DragHandle />);
  });

  it("renders correctly", () => {
    shallow(<DragHandle />).should.matchSnapshot();
  });

  it("should invoke onClick handler", () => {
    const spy = sinon.spy() as SinonSpy<Required<DragHandleProps>["onClick"]>;
    const sut = mount<DragHandle>(<DragHandle onClick={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);

    pointerCaptor.prop("onClick")!();

    spy.calledOnceWithExactly().should.true;
  });

  it("should not invoke onClick handler when dragging", () => {
    const spy = sinon.spy() as SinonSpy<Required<DragHandleProps>["onClick"]>;
    const sut = mount<DragHandle>(<DragHandle onClick={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);

    const mouseDown = document.createEvent("MouseEvent");
    mouseDown.initEvent("mousedown");
    pointerCaptor.prop("onMouseDown")!(mouseDown);

    const mouseMove = document.createEvent("MouseEvent");
    mouseMove.initEvent("mousemove");
    sinon.stub(mouseMove, "clientX").get(() => 30);
    pointerCaptor.prop("onMouseMove")!(mouseMove);

    pointerCaptor.prop("onClick")!();

    spy.calledOnceWithExactly().should.false;
  });
});
