/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { ResizeGrip, ResizeDirection, ResizeDirectionHelpers, ResizeGripResizeArgs } from "../../../ui-ninezone";
import { PointerCaptor } from "../../../ui-ninezone/base/PointerCaptor";
import { createRect, createPointerEvent } from "../../Utils";

describe("<ResizeGrip />", () => {
  let createRefStub: sinon.SinonStub | undefined;

  afterEach(() => {
    createRefStub && createRefStub.restore();
  });

  it("should render", () => {
    mount(<ResizeGrip direction={ResizeDirection.EastWest} />);
  });

  it("renders correctly", () => {
    shallow(<ResizeGrip direction={ResizeDirection.EastWest} />).should.matchSnapshot();
  });

  it("should invoke onResize handler", () => {
    const spy = sinon.spy();
    const sut = mount(<ResizeGrip
      direction={ResizeDirection.NorthEast_SouthWest}
      onResize={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);
    const gripElement = pointerCaptor.find("div").at(2).getDOMNode() as HTMLDivElement;
    sinon.stub(gripElement, "getBoundingClientRect").returns(createRect(20, 0, 25, 200));

    const pointerDown = createPointerEvent();
    pointerCaptor.prop("onPointerDown")!(pointerDown);

    const pointerMove = createPointerEvent({
      clientX: 20,
      clientY: 35,
    });
    pointerCaptor.prop("onPointerMove")!(pointerMove);

    const expected: ResizeGripResizeArgs = {
      bounds: {
        left: 20,
        top: 0,
        right: 25,
        bottom: 200,
      },
      position: {
        x: 20,
        y: 35,
      },
    };
    spy.calledWith(sinon.match(expected)).should.true;
  });

  it("should not resize on pointer move if pointer down was not received", () => {
    const spy = sinon.spy();
    const sut = mount(<ResizeGrip
      direction={ResizeDirection.NorthEast_SouthWest}
      onResize={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);

    const pointerMove = createPointerEvent();
    pointerCaptor.prop("onPointerMove")!(pointerMove);

    spy.notCalled.should.true;
  });

  it("should not resize on pointer move if pointer up was received", () => {
    const spy = sinon.spy();
    const sut = mount(<ResizeGrip
      direction={ResizeDirection.NorthEast_SouthWest}
      onResize={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);

    const pointerDown = createPointerEvent();
    pointerCaptor.prop("onPointerDown")!(pointerDown);

    const pointerUp = createPointerEvent();
    pointerCaptor.prop("onPointerUp")!(pointerUp);

    const pointerMove = createPointerEvent();
    pointerCaptor.prop("onPointerMove")!(pointerMove);

    spy.notCalled.should.true;
  });

  it("should invoke onResizeStart handler", () => {
    const spy = sinon.spy();
    const sut = mount(<ResizeGrip
      direction={ResizeDirection.NorthEast_SouthWest}
      onResizeStart={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);

    const pointerDown = createPointerEvent();
    sinon.stub(pointerDown, "clientX").get(() => 20);
    sinon.stub(pointerDown, "clientY").get(() => 35);
    pointerCaptor.prop("onPointerDown")!(pointerDown);

    const expected: ResizeGripResizeArgs = {
      bounds: {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
      },
      position: {
        x: 20,
        y: 35,
      },
    };
    spy.calledWith(sinon.match(expected)).should.true;
  });

  it("should not invoke onResizeStart handler if grip ref is not set", () => {
    const ref = {
      current: null,
    };
    sinon.stub(ref, "current").set(() => { });
    createRefStub = sinon.stub(React, "createRef");
    createRefStub.returns(ref);

    const spy = sinon.spy();
    const sut = mount(<ResizeGrip
      direction={ResizeDirection.NorthEast_SouthWest}
      onResizeStart={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);

    const pointerDown = createPointerEvent();
    pointerCaptor.prop("onPointerDown")!(pointerDown);

    spy.notCalled.should.true;
  });

  it("should not resize if grip ref is not set", () => {
    const ref = {
      current: null,
    };
    createRefStub = sinon.stub(React, "createRef");
    createRefStub.returns(ref);

    const spy = sinon.spy();
    const sut = mount(<ResizeGrip
      direction={ResizeDirection.NorthEast_SouthWest}
      onResize={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);

    const pointerDown = createPointerEvent();
    pointerCaptor.prop("onPointerDown")!(pointerDown);

    sinon.stub(ref, "current").get(() => null);

    const pointerMove = createPointerEvent();
    pointerCaptor.prop("onPointerMove")!(pointerMove);

    spy.notCalled.should.true;
  });

  it("should invoke onEndResize handler", () => {
    const spy = sinon.spy();
    const sut = mount(<ResizeGrip
      direction={ResizeDirection.NorthEast_SouthWest}
      onResizeEnd={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);

    const pointerDown = createPointerEvent();
    pointerCaptor.prop("onPointerDown")!(pointerDown);

    const pointerUp = createPointerEvent();
    sinon.stub(pointerUp, "clientX").get(() => 20);
    sinon.stub(pointerUp, "clientY").get(() => 35);
    pointerCaptor.prop("onPointerUp")!(pointerUp);

    const expected: ResizeGripResizeArgs = {
      bounds: {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
      },
      position: {
        x: 20,
        y: 35,
      },
    };
    spy.calledWith(sinon.match(expected)).should.true;
  });

  it("should not invoke onEndResize handler if resize is not started", () => {
    const spy = sinon.spy();
    const sut = mount(<ResizeGrip
      direction={ResizeDirection.NorthEast_SouthWest}
      onResizeEnd={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);

    const pointerUp = createPointerEvent();
    pointerCaptor.prop("onPointerUp")!(pointerUp);

    spy.notCalled.should.true;
  });

  it("should not invoke onEndResize handler if grip ref is not set", () => {
    const ref = {
      current: null,
    };
    createRefStub = sinon.stub(React, "createRef");
    createRefStub.returns(ref);

    const spy = sinon.spy();
    const sut = mount(<ResizeGrip
      direction={ResizeDirection.NorthEast_SouthWest}
      onResizeEnd={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);

    const pointerDown = createPointerEvent();
    pointerCaptor.prop("onPointerDown")!(pointerDown);

    sinon.stub(ref, "current").get(() => null);

    const pointerUp = createPointerEvent();
    pointerCaptor.prop("onPointerUp")!(pointerUp);

    spy.notCalled.should.true;
  });

  it("should invoke onClick handler", () => {
    const spy = sinon.spy();
    const sut = mount(<ResizeGrip
      direction={ResizeDirection.NorthEast_SouthWest}
      onClick={spy} />);
    const grip = sut.find(".nz-grip");

    grip.simulate("click");
    spy.calledOnceWithExactly().should.true;
  });

  it("should not invoke onClick handler if pointer is moved", () => {
    const spy = sinon.spy();
    const sut = mount<ResizeGrip>(<ResizeGrip
      direction={ResizeDirection.NorthEast_SouthWest}
      onClick={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);
    const grip = sut.find(".nz-grip");

    const pointerDownEvent = createPointerEvent();
    pointerCaptor.prop("onPointerDown")!(pointerDownEvent);

    const pointerUpEvent = createPointerEvent();
    sinon.stub(pointerUpEvent, "clientX").get(() => 1);
    pointerCaptor.prop("onPointerUp")!(pointerUpEvent);

    grip.simulate("click");
    spy.notCalled.should.true;
  });
});

describe("ResizeDirectionHelpers", () => {
  it("should get class name for east west direction", () => {
    ResizeDirectionHelpers.getCssClassName(ResizeDirection.EastWest).should.eq("nz-direction-ew");
  });

  it("should get class name for nort south direction", () => {
    ResizeDirectionHelpers.getCssClassName(ResizeDirection.NorthSouth).should.eq("nz-direction-ns");
  });

  it("should get class name for nort-east south-west direction", () => {
    ResizeDirectionHelpers.getCssClassName(ResizeDirection.NorthEast_SouthWest).should.eq("nz-direction-ne-sw");
  });

  it("should get class name for north-west south-east direction", () => {
    ResizeDirectionHelpers.getCssClassName(ResizeDirection.NorthWest_SouthEast).should.eq("nz-direction-nw-se");
  });
});
