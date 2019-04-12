/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { mount, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { createRect } from "../../../Utils";
import { HorizontalAnchor, Tab, TabMode, TabModeHelpers, PointProps } from "../../../../ui-ninezone";
import { PointerCaptor } from "../../../../ui-ninezone/base/PointerCaptor";

describe("<Tab />", () => {
  let createRefStub: sinon.SinonStub | undefined;

  afterEach(() => {
    createRefStub && createRefStub.restore();
  });

  it("should render", () => {
    mount(<Tab
      anchor={HorizontalAnchor.Left}
      mode={TabMode.Open}
    />);
  });

  it("renders correctly", () => {
    shallow(<Tab
      anchor={HorizontalAnchor.Left}
      mode={TabMode.Open}
    />).should.matchSnapshot();
  });

  it("renders with last position correctly", () => {
    shallow(<Tab
      anchor={HorizontalAnchor.Left}
      mode={TabMode.Open}
      lastPosition={{
        x: 0,
        y: 0,
      }}
    />).should.matchSnapshot();
  });

  it("should get bounds", () => {
    const sut = mount<Tab>(<Tab
      anchor={HorizontalAnchor.Left}
      mode={TabMode.Open} />);
    const element = sut.getDOMNode() as HTMLDivElement;
    sinon.stub(element, "getBoundingClientRect").returns(createRect(10, 15, 20, 30));

    const result = sut.instance().getBounds();
    result.left.should.eq(10);
    result.top.should.eq(15);
    result.right.should.eq(20);
    result.bottom.should.eq(30);
  });

  it("should return initial rectangle if widget ref is not set", () => {
    const ref = {
      current: null,
    };
    sinon.stub(ref, "current").set(() => { });
    createRefStub = sinon.stub(React, "createRef");
    createRefStub.returns(ref);
    const sut = mount<Tab>(<Tab
      anchor={HorizontalAnchor.Left}
      mode={TabMode.Open} />);
    const element = sut.getDOMNode() as HTMLDivElement;
    sinon.stub(element, "getBoundingClientRect").returns(createRect(10, 15, 20, 30));

    const result = sut.instance().getBounds();
    result.left.should.eq(0);
    result.top.should.eq(0);
    result.right.should.eq(0);
    result.bottom.should.eq(0);
  });

  it("should prevent default on mouse down", () => {
    const sut = mount(<Tab
      anchor={HorizontalAnchor.Left}
      mode={TabMode.Open} />);
    const pointerCaptor = sut.find(PointerCaptor);

    const mouseDown = new MouseEvent("");
    const spy = sinon.spy(mouseDown, "preventDefault");

    pointerCaptor.prop("onMouseDown")!(mouseDown);

    spy.calledOnceWithExactly().should.true;
  });

  it("should invoke onClick handler", () => {
    const spy = sinon.spy();
    const sut = mount(<Tab
      anchor={HorizontalAnchor.Left}
      mode={TabMode.Open}
      onClick={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);

    const mouseDown = new MouseEvent("");
    pointerCaptor.prop("onMouseDown")!(mouseDown);

    const mouseUp = new MouseEvent("");
    pointerCaptor.prop("onMouseUp")!(mouseUp);

    spy.calledOnceWithExactly().should.true;
  });

  it("should invoke onDragStart handler", () => {
    const spy = sinon.spy();
    const sut = mount(<Tab
      anchor={HorizontalAnchor.Left}
      mode={TabMode.Open}
      onDragStart={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);

    const mouseDown = new MouseEvent("");
    pointerCaptor.prop("onMouseDown")!(mouseDown);

    const mouseMove = new MouseEvent("");
    sinon.stub(mouseMove, "clientX").get(() => 6);
    pointerCaptor.prop("onMouseMove")!(mouseMove);

    const expectedInitialPosition: PointProps = {
      x: 0,
      y: 0,
    };
    spy.calledOnceWithExactly(sinon.match(expectedInitialPosition)).should.true;
  });

  it("should invoke onDrag handler", () => {
    const spy = sinon.spy();
    const sut = mount(<Tab
      anchor={HorizontalAnchor.Left}
      mode={TabMode.Open}
      lastPosition={{
        x: 10,
        y: 15,
      }}
      onDrag={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);

    const mouseDown = new MouseEvent("");
    pointerCaptor.prop("onMouseDown")!(mouseDown);

    const mouseMove = new MouseEvent("");
    sinon.stub(mouseMove, "clientX").get(() => 6);
    pointerCaptor.prop("onMouseMove")!(mouseMove);

    const expectedInitialPosition: PointProps = {
      x: -4,
      y: -15,
    };
    spy.calledOnceWithExactly(sinon.match(expectedInitialPosition)).should.true;
  });

  it("should invoke onDragEnd handler", () => {
    const spy = sinon.spy();
    const sut = mount(<Tab
      anchor={HorizontalAnchor.Left}
      mode={TabMode.Open}
      lastPosition={{
        x: 0,
        y: 0,
      }}
      onDragEnd={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);

    const mouseDown = new MouseEvent("");
    pointerCaptor.prop("onMouseDown")!(mouseDown);

    const mouseUp = new MouseEvent("");
    pointerCaptor.prop("onMouseUp")!(mouseUp);

    spy.calledOnceWithExactly().should.true;
  });

  it("should not invoke onClick handler if tab ref is not set", () => {
    const ref = {
      current: null,
    };
    sinon.stub(ref, "current").set(() => { });
    createRefStub = sinon.stub(React, "createRef");
    createRefStub.returns(ref);

    const spy = sinon.spy();
    const sut = mount(<Tab
      anchor={HorizontalAnchor.Left}
      mode={TabMode.Open}
      onClick={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);

    const mouseUp = new MouseEvent("");
    pointerCaptor.prop("onMouseUp")!(mouseUp);

    spy.notCalled.should.true;
  });

  it("should not invoke onClick handler if mouse is released outside of tab bounds", () => {
    const spy = sinon.spy();
    const sut = mount(<Tab
      anchor={HorizontalAnchor.Left}
      mode={TabMode.Open}
      onClick={spy} />);
    const pointerCaptor = sut.find(PointerCaptor);
    const tabElement = sut.find("div").first().getDOMNode() as HTMLDivElement;
    sinon.stub(tabElement, "getBoundingClientRect").returns(createRect(10, 10, 15, 15));

    const mouseUp = new MouseEvent("");
    pointerCaptor.prop("onMouseUp")!(mouseUp);

    spy.notCalled.should.true;
  });
});

describe("TabModeHelpers", () => {
  it("should get class name for active mode", () => {
    TabModeHelpers.getCssClassName(TabMode.Active).should.eq("nz-mode-active");
  });

  it("should get class name for closed mode", () => {
    TabModeHelpers.getCssClassName(TabMode.Closed).should.eq("nz-mode-closed");
  });

  it("should get class name for open mode", () => {
    TabModeHelpers.getCssClassName(TabMode.Open).should.eq("nz-mode-open");
  });
});
