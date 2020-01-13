/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { DragHandle, DragHandleProps } from "../../ui-ninezone/base/DragHandle";
import { SinonSpy, createPointerEvent } from "../Utils";
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

    const pointerDown = createPointerEvent();
    pointerCaptor.prop("onPointerDown")!(pointerDown);

    const pointerMove = createPointerEvent({
      clientX: 30,
    });
    pointerCaptor.prop("onPointerMove")!(pointerMove);

    pointerCaptor.prop("onClick")!();

    spy.notCalled.should.true;
  });

  it("should release pointer capture", () => {
    const sut = mount<DragHandle>(<DragHandle />);
    const pointerCaptor = sut.find(PointerCaptor);

    const spy = sinon.spy();
    const target = document.createElement("div");
    target.releasePointerCapture = () => spy;

    const pointerDown = createPointerEvent({
      target,
    });
    pointerCaptor.prop("onPointerDown")!(pointerDown);

    spy.calledOnce.should.false;
  });
});
