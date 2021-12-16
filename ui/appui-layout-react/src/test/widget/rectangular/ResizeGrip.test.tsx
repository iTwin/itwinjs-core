/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { PointerCaptor, ResizeDirection, ResizeDirectionHelpers, ResizeGrip, ResizeGripResizeArgs } from "../../../appui-layout-react";
import { createRect, mount } from "../../Utils";

describe("<ResizeGrip />", () => {
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
    const gripElement = pointerCaptor.find("div").at(2).getDOMNode();
    sinon.stub(gripElement, "getBoundingClientRect").returns(createRect(20, 0, 25, 200));

    const pointerDown = new PointerEvent("pointerdown");
    pointerCaptor.prop("onPointerDown")!(pointerDown);

    const pointerMove = new PointerEvent("pointermove", {
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

    const pointerMove = new PointerEvent("pointermove");
    pointerCaptor.prop("onPointerMove")!(pointerMove);

    spy.notCalled.should.true;
  });

  it("should not resize on pointer move if pointer up was received", () => {
    const spy = sinon.spy();
    const sut = mount(<ResizeGrip
      direction={ResizeDirection.NorthEast_SouthWest}
      onResize={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);

    const pointerDown = new PointerEvent("pointerdown");
    pointerCaptor.prop("onPointerDown")!(pointerDown);

    const pointerUp = new PointerEvent("pointerup");
    pointerCaptor.prop("onPointerUp")!(pointerUp);

    const pointerMove = new PointerEvent("pointermove");
    pointerCaptor.prop("onPointerMove")!(pointerMove);

    spy.notCalled.should.true;
  });

  it("should invoke onResizeStart handler", () => {
    const spy = sinon.spy();
    const sut = mount(<ResizeGrip
      direction={ResizeDirection.NorthEast_SouthWest}
      onResizeStart={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);

    const pointerDown = new PointerEvent("pointerdown");
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
    sinon.stub(React, "createRef").returns(ref);

    const spy = sinon.spy();
    const sut = mount(<ResizeGrip
      direction={ResizeDirection.NorthEast_SouthWest}
      onResizeStart={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);

    const pointerDown = new PointerEvent("pointerdown");
    pointerCaptor.prop("onPointerDown")!(pointerDown);

    spy.notCalled.should.true;
  });

  it("should not resize if grip ref is not set", () => {
    const ref = {
      current: null,
    };
    sinon.stub(React, "createRef").returns(ref);

    const spy = sinon.spy();
    const sut = mount(<ResizeGrip
      direction={ResizeDirection.NorthEast_SouthWest}
      onResize={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);

    const pointerDown = new PointerEvent("pointerdown");
    pointerCaptor.prop("onPointerDown")!(pointerDown);

    sinon.stub(ref, "current").get(() => null).set(() => { });

    const pointerMove = new PointerEvent("pointermove");
    pointerCaptor.prop("onPointerMove")!(pointerMove);

    spy.notCalled.should.true;
  });

  it("should invoke onEndResize handler", () => {
    const spy = sinon.spy();
    const sut = mount(<ResizeGrip
      direction={ResizeDirection.NorthEast_SouthWest}
      onResizeEnd={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);

    const pointerDown = new PointerEvent("pointerdown");
    pointerCaptor.prop("onPointerDown")!(pointerDown);

    const pointerUp = new PointerEvent("pointerup");
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

    const pointerUp = new PointerEvent("pointerup");
    pointerCaptor.prop("onPointerUp")!(pointerUp);

    spy.notCalled.should.true;
  });

  it("should not invoke onEndResize handler if grip ref is not set", () => {
    const ref = {
      current: null,
    };
    sinon.stub(React, "createRef").returns(ref);

    const spy = sinon.spy();
    const sut = mount(<ResizeGrip
      direction={ResizeDirection.NorthEast_SouthWest}
      onResizeEnd={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);

    const pointerDown = new PointerEvent("pointerdown");
    pointerCaptor.prop("onPointerDown")!(pointerDown);

    sinon.stub(ref, "current").get(() => null).set(() => { });

    const pointerUp = new PointerEvent("pointerup");
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

    const pointerDownEvent = new PointerEvent("pointerdown");
    pointerCaptor.prop("onPointerDown")!(pointerDownEvent);

    const pointerUpEvent = new PointerEvent("pointerup", { clientX: 1 });
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
