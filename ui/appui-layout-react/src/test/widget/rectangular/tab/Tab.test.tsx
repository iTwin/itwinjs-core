/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import type { PointProps } from "@itwin/appui-abstract";
import { DragHandle, HorizontalAnchor, PointerCaptor, Tab, TabMode, TabModeHelpers, VerticalAnchor } from "../../../../appui-layout-react";
import { createRect, mount } from "../../../Utils";

describe("<Tab />", () => {
  it("should render", () => {
    mount(<Tab
      horizontalAnchor={HorizontalAnchor.Left}
      mode={TabMode.Open}
      verticalAnchor={VerticalAnchor.Middle}
    />);
  });

  it("renders correctly", () => {
    shallow(<Tab
      horizontalAnchor={HorizontalAnchor.Left}
      mode={TabMode.Open}
      verticalAnchor={VerticalAnchor.Middle}
    />).should.matchSnapshot();
  });

  it("renders with badge correctly", () => {
    const sut = mount(<Tab
      badge
      horizontalAnchor={HorizontalAnchor.Left}
      mode={TabMode.Open}
      verticalAnchor={VerticalAnchor.Middle}
    />);
    const badge = sut.find("div.nz-badge");
    badge.length.should.eq(1);
  });

  it("renders collapsed correctly", () => {
    shallow(<Tab
      horizontalAnchor={HorizontalAnchor.Left}
      mode={TabMode.Open}
      verticalAnchor={VerticalAnchor.Middle}
      isCollapsed
    />).should.matchSnapshot();
  });

  it("renders with last position correctly", () => {
    shallow(<Tab
      horizontalAnchor={HorizontalAnchor.Left}
      lastPosition={{
        x: 0,
        y: 0,
      }}
      mode={TabMode.Open}
      verticalAnchor={VerticalAnchor.Middle}
    />).should.matchSnapshot();
  });

  it("should get bounds", () => {
    const sut = mount<Tab>(<Tab
      horizontalAnchor={HorizontalAnchor.Left}
      mode={TabMode.Open}
      verticalAnchor={VerticalAnchor.Middle}
    />);
    const element = sut.getDOMNode();
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
    sinon.stub(React, "createRef").returns(ref);
    const sut = mount<Tab>(<Tab
      horizontalAnchor={HorizontalAnchor.Left}
      mode={TabMode.Open}
      verticalAnchor={VerticalAnchor.Middle}
    />);
    const element = sut.getDOMNode();
    sinon.stub(element, "getBoundingClientRect").returns(createRect(10, 15, 20, 30));

    const result = sut.instance().getBounds();
    result.left.should.eq(0);
    result.top.should.eq(0);
    result.right.should.eq(0);
    result.bottom.should.eq(0);
  });

  it("should prevent default on pointer down", () => {
    const sut = mount(<Tab
      horizontalAnchor={HorizontalAnchor.Left}
      mode={TabMode.Open}
      verticalAnchor={VerticalAnchor.Middle}
    />);
    const pointerCaptor = sut.find(PointerCaptor);

    const pointerDown = new PointerEvent("pointerdown");
    const spy = sinon.spy(pointerDown, "preventDefault");

    pointerCaptor.prop("onPointerDown")!(pointerDown);

    spy.calledOnceWithExactly().should.true;
  });

  it("should invoke onClick handler", () => {
    const spy = sinon.spy();
    const sut = mount(<Tab
      horizontalAnchor={HorizontalAnchor.Left}
      mode={TabMode.Open}
      onClick={spy}
      verticalAnchor={VerticalAnchor.Middle}
    />);
    const dragHandle = sut.find(DragHandle);
    dragHandle.prop("onClick")!();

    spy.calledOnceWithExactly().should.true;
  });

  it("should invoke onDragStart handler", () => {
    const spy = sinon.spy();
    const sut = mount(<Tab
      horizontalAnchor={HorizontalAnchor.Left}
      mode={TabMode.Open}
      onDragStart={spy}
      verticalAnchor={VerticalAnchor.Middle}
    />);
    const pointerCaptor = sut.find(PointerCaptor);

    const pointerDown = new PointerEvent("pointerdown");
    pointerCaptor.prop("onPointerDown")!(pointerDown);

    const pointerMove = new PointerEvent("pointermove");
    sinon.stub(pointerMove, "clientX").get(() => 6);
    pointerCaptor.prop("onPointerMove")!(pointerMove);

    const expectedInitialPosition: PointProps = {
      x: 0,
      y: 0,
    };
    spy.calledOnceWithExactly(sinon.match(expectedInitialPosition)).should.true;
  });

  it("should not invoke onDragStart handler if pointer down was not received", () => {
    const spy = sinon.spy();
    const sut = mount(<Tab
      horizontalAnchor={HorizontalAnchor.Left}
      mode={TabMode.Open}
      onDragStart={spy}
      verticalAnchor={VerticalAnchor.Middle}
    />);
    const pointerCaptor = sut.find(PointerCaptor);

    const pointerMove = new PointerEvent("pointermove");
    sinon.stub(pointerMove, "clientX").get(() => 6);
    pointerCaptor.prop("onPointerMove")!(pointerMove);

    spy.notCalled.should.true;
  });

  it("should invoke onDrag handler", () => {
    const spy = sinon.spy();
    const sut = mount(<Tab
      horizontalAnchor={HorizontalAnchor.Left}
      lastPosition={{
        x: 10,
        y: 15,
      }}
      mode={TabMode.Open}
      onDrag={spy}
      verticalAnchor={VerticalAnchor.Middle}
    />);
    const pointerCaptor = sut.find(PointerCaptor);

    const pointerDown = new PointerEvent("pointerdown");
    pointerCaptor.prop("onPointerDown")!(pointerDown);

    const pointerMove = new PointerEvent("pointermove");
    sinon.stub(pointerMove, "clientX").get(() => 6);
    pointerCaptor.prop("onPointerMove")!(pointerMove);

    const expectedInitialPosition: PointProps = {
      x: -4,
      y: -15,
    };
    spy.calledOnceWithExactly(sinon.match(expectedInitialPosition)).should.true;
  });

  it("should invoke onDragEnd handler", () => {
    const spy = sinon.spy();
    const sut = mount(<Tab
      horizontalAnchor={HorizontalAnchor.Left}
      lastPosition={{
        x: 0,
        y: 0,
      }}
      mode={TabMode.Open}
      onDragEnd={spy}
      verticalAnchor={VerticalAnchor.Middle}
    />);
    const pointerCaptor = sut.find(PointerCaptor);

    const pointerDown = new PointerEvent("pointerdown");
    pointerCaptor.prop("onPointerDown")!(pointerDown);

    const pointerUp = new PointerEvent("pointerup");
    pointerCaptor.prop("onPointerUp")!(pointerUp);

    spy.calledOnceWithExactly().should.true;
  });

  it("should not invoke onClick handler if tab ref is not set", () => {
    const ref = {
      current: null,
    };
    sinon.stub(ref, "current").set(() => { });
    sinon.stub(React, "createRef").returns(ref);

    const spy = sinon.spy();
    const sut = mount(<Tab
      horizontalAnchor={HorizontalAnchor.Left}
      mode={TabMode.Open}
      onClick={spy}
      verticalAnchor={VerticalAnchor.Middle}
    />);
    const pointerCaptor = sut.find(PointerCaptor);

    const pointerUp = new PointerEvent("pointerup");
    pointerCaptor.prop("onPointerUp")!(pointerUp);

    spy.notCalled.should.true;
  });

  it("should not invoke onClick handler if pointer is released outside of tab bounds", () => {
    const spy = sinon.spy();
    const sut = mount(<Tab
      horizontalAnchor={HorizontalAnchor.Left}
      mode={TabMode.Open}
      onClick={spy}
      verticalAnchor={VerticalAnchor.Middle}
    />);
    const pointerCaptor = sut.find(PointerCaptor);
    const tabElement = sut.find("div").first().getDOMNode();
    sinon.stub(tabElement, "getBoundingClientRect").returns(createRect(10, 10, 15, 15));

    const pointerUp = new PointerEvent("pointerup");
    pointerCaptor.prop("onPointerUp")!(pointerUp);

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
