/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { Point } from "@itwin/core-react";
import { Direction, getDragDistance, withDragInteraction } from "../../../../appui-layout-react";
import { mount } from "../../../Utils";

// eslint-disable-next-line @typescript-eslint/naming-convention
const WithDragInteraction = withDragInteraction(() => <div></div>);

describe("<WithDragInteraction />", () => {
  it("should render", () => {
    mount(<WithDragInteraction
      direction={Direction.Right}
    />);
  });

  it("renders correctly", () => {
    shallow(<WithDragInteraction
      direction={Direction.Right}
    />).should.matchSnapshot();
  });

  it("should invoke onOpenPanel handler", () => {
    const spy = sinon.spy();
    const sut = mount(<WithDragInteraction
      direction={Direction.Right}
      onOpenPanel={spy}
    />);
    const div = sut.childAt(0);
    div.getDOMNode().releasePointerCapture = () => { };
    div.simulate("pointerDown");

    const pointerMove = new MouseEvent("pointermove");
    sinon.stub(pointerMove, "clientX").get(() => 30);
    document.dispatchEvent(pointerMove);

    spy.calledOnceWithExactly().should.true;
  });

  it("should not invoke onOpenPanel handler if initial position is not set", () => {
    const spy = sinon.spy();
    mount(<WithDragInteraction
      direction={Direction.Right}
      onOpenPanel={spy}
    />);

    const pointerMove = new MouseEvent("pointermove");
    sinon.stub(pointerMove, "clientX").get(() => 30);
    document.dispatchEvent(pointerMove);

    spy.notCalled.should.true;
  });

  it("should not invoke onOpenPanel handler if distance is < 20", () => {
    const spy = sinon.spy();
    const sut = mount(<WithDragInteraction
      direction={Direction.Right}
      onOpenPanel={spy}
    />);
    const div = sut.childAt(0);
    div.getDOMNode().releasePointerCapture = () => { };
    div.simulate("pointerDown");

    const pointerMove = new MouseEvent("pointermove");
    sinon.stub(pointerMove, "clientX").get(() => 19);
    document.dispatchEvent(pointerMove);

    spy.notCalled.should.true;
  });

  it("should reset initial position on pointer up", () => {
    const spy = sinon.spy();
    const sut = mount(<WithDragInteraction
      direction={Direction.Right}
      onOpenPanel={spy}
    />);
    const div = sut.childAt(0);
    div.getDOMNode().releasePointerCapture = () => { };
    div.simulate("pointerDown");

    const pointerUp = new MouseEvent("pointerup");
    document.dispatchEvent(pointerUp);

    const pointerMove = new MouseEvent("pointermove");
    sinon.stub(pointerMove, "clientX").get(() => 30);
    document.dispatchEvent(pointerMove);

    spy.notCalled.should.true;
  });

  it("should remove event listeners on unmount", () => {
    const sut = mount(<WithDragInteraction
      direction={Direction.Right}
    />);

    const spy = sinon.spy(document, "removeEventListener");
    sut.unmount();

    spy.calledTwice.should.true;
    spy.firstCall.calledWithExactly("pointermove", sinon.match.any).should.true;
    spy.secondCall.calledWithExactly("pointerup", sinon.match.any).should.true;
  });

  it("should invoke onClick handler", () => {
    const spy = sinon.spy();
    const sut = mount(<WithDragInteraction
      direction={Direction.Right}
      onClick={spy}
    />);
    const div = sut.childAt(0);
    div.getDOMNode().releasePointerCapture = () => { };
    div.simulate("click");

    spy.calledOnceWithExactly().should.true;
  });

  it("should not invoke onClick handler if panel is opened", () => {
    const spy = sinon.spy();
    const sut = mount(<WithDragInteraction
      direction={Direction.Right}
      onClick={spy}
    />);
    const div = sut.childAt(0);
    div.getDOMNode().releasePointerCapture = () => { };
    div.simulate("pointerDown");

    const pointerMove = new MouseEvent("pointermove");
    sinon.stub(pointerMove, "clientX").get(() => 30);
    document.dispatchEvent(pointerMove);

    div.simulate("click");

    spy.notCalled.should.true;
  });

  it("should invoke onOpenPanel handler on long press", () => {
    const fakeTimers = sinon.useFakeTimers();
    const spy = sinon.spy();
    const sut = mount(<WithDragInteraction
      direction={Direction.Right}
      onOpenPanel={spy}
    />);
    const div = sut.childAt(0);
    div.getDOMNode().releasePointerCapture = () => { };
    div.simulate("pointerDown");

    fakeTimers.tick(750);

    spy.calledOnceWithExactly().should.true;
  });

  it("should not invoke onOpenPanel handler if mouse moves", () => {
    const fakeTimers = sinon.useFakeTimers();
    const spy = sinon.spy();
    const sut = mount(<WithDragInteraction
      direction={Direction.Right}
      onOpenPanel={spy}
    />);
    const div = sut.childAt(0);
    div.getDOMNode().releasePointerCapture = () => { };
    div.simulate("pointerDown");

    const pointerMove = new MouseEvent("pointermove");
    sinon.stub(pointerMove, "clientX").get(() => 2);
    document.dispatchEvent(pointerMove);

    fakeTimers.tick(750);

    spy.notCalled.should.true;
  });
});

describe("getDragDistance", () => {
  it("should return distance for left direction", () => {
    getDragDistance(new Point(10, 20), new Point(15, 30), Direction.Left).should.eq(-5);
  });

  it("should return distance for right direction", () => {
    getDragDistance(new Point(10, 20), new Point(15, 30), Direction.Right).should.eq(5);
  });

  it("should return distance for top direction", () => {
    getDragDistance(new Point(10, 20), new Point(15, 30), Direction.Top).should.eq(-10);
  });

  it("should return distance for bottom direction", () => {
    getDragDistance(new Point(10, 20), new Point(15, 30), Direction.Bottom).should.eq(10);
  });
});
