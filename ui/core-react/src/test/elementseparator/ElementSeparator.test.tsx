/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { fireEvent, render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import userEvent from "@testing-library/user-event";
import { ElementSeparator, RatioChangeResult } from "../../core-react/elementseparator/ElementSeparator";
import { Orientation } from "../../core-react/enums/Orientation";
import { classesFromElement } from "../TestUtils";

describe("ElementSeparator", () => {
  let clock: sinon.SinonFakeTimers;
  let theUserTo: ReturnType<typeof userEvent.setup>;
  const throttleMs = 16;
  beforeEach(() => {
    clock = sinon.useFakeTimers({ now: Date.now() });
    theUserTo = userEvent.setup({
      advanceTimers:(delay) => {
        clock.tick(delay);
      },
      delay: throttleMs,
    });
  });

  afterEach(() => {
    clock.restore();
  });

  enum TestCallbackType {
    Uncontrolled,
    Controlled,
  }

  function getButton() {
    return screen.getByRole("button");
  }

  function expectUnhovered() {
    expect(classesFromElement(getButton()))
      .to.include("core-element-separator-group-unhovered", "Did not find unhover class on unhovered element")
      .and.to.not.include("core-element-separator-group-hovered", "Found hover class on unhovered element");
  }

  function expectHovered() {
    expect(classesFromElement(getButton()))
      .to.include("core-element-separator-group-hovered", "Did not find hover class on hovered element")
      .and.to.not.include("core-element-separator-group-unhovered", "Found unhover class on hovered element");
  }

  function expectCleanHover() {
    expect(classesFromElement(getButton()))
      .to.not.include("core-element-separator-group-hovered", "Found hover class on freshly created element")
      .and.to.not.include("core-element-separator-group-unhovered", "Found unhover class on freshly created element");
  }

  function setupElementSeparatorCallbackIndifferentTests(callbackType: TestCallbackType) {
    const testCaseName = TestCallbackType[callbackType];
    describe(`Callback indifferent tests: ${testCaseName}`, () => {
      let onRatioChanged: sinon.SinonSpy<[number], void> | sinon.SinonSpy<[number], RatioChangeResult>;

      beforeEach(() => {
        switch (callbackType) {
          case TestCallbackType.Uncontrolled:
            onRatioChanged = sinon.spy((_: number) => { return; });
            return;
          case TestCallbackType.Controlled:
            onRatioChanged = sinon.spy((ratio: number) => ({ ratio }));
            return;
          default:
            const unhandledType: never = callbackType;
            throw new Error(`Unhandled test type: ${unhandledType}`);
        }
      });

      it("calls onRatioChanged when it gets dragged horizontally", async () => {
        render(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            onRatioChanged={onRatioChanged}
          />);

        await theUserTo.pointer([{keys: "[MouseLeft>]", target: getButton(), coords: {x: 50}},
          {coords: {x: 70}},
        ]);

        expect(onRatioChanged.callCount).to.be.equal(1);
        expect(onRatioChanged.calledWith(0.7), "Called with wrong argument").to.be.true;
      });

      it("calls onRatioChanged when it gets dragged vertically", async () => {
        render(
          <ElementSeparator
            orientation={Orientation.Vertical}
            movableArea={100}
            ratio={0.5}
            onRatioChanged={onRatioChanged}
          />);

        await theUserTo.pointer([{keys: "[MouseLeft>]", target: getButton(), coords: {y: 50}},
          {coords: {y: 70}},
        ]);

        expect(onRatioChanged.callCount).to.be.equal(1);
        expect(onRatioChanged.calledWith(0.7), "Called with wrong argument").to.be.true;
      });

      it("calls onRatioChanged when it gets dragged 1px", async () => {
        render(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            onRatioChanged={onRatioChanged}
          />);

        await theUserTo.pointer([{keys: "[MouseLeft>]", target: getButton(), coords: {x: 50}},
          {coords: {x: 51}},
        ]);

        expect(onRatioChanged.callCount).to.be.equal(1);
      });

      it("calls onRatioChanged only once when moved multiple times in the same throttle frame", async () => {
        theUserTo = userEvent.setup({
          advanceTimers:(delay) => {
            clock.tick(delay);
          },
          delay: 1,
        });
        render(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            onRatioChanged={onRatioChanged}
          />);

        await theUserTo.pointer([{keys: "[MouseLeft>]", target: getButton(), coords: {x: 50}},
          {coords: {x: 60}},
          {coords: {x: 80}},
        ]);

        clock.tick(throttleMs);

        expect(onRatioChanged.callCount).to.be.equal(1);
        expect(onRatioChanged.calledWith(0.8)).to.be.true;

      });

      it("stops calling onRatioChanged when dragging stops", async () => {
        render(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            onRatioChanged={onRatioChanged}
          />);

        await theUserTo.pointer([{keys: "[MouseLeft>]", target: getButton(), coords: {x: 50}},
          {coords: {x: 70}},
        ]);

        expect(onRatioChanged.callCount).to.be.equal(1);

        await theUserTo.pointer([{keys: "[/MouseLeft]"},
          {coords: {x: 90}},
        ]);

        expect(onRatioChanged.callCount, "Called when dragging stopped").to.be.equal(1);
      });

      it("does not call onRatioChanged when dragging without movableArea set", async () => {
        render(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            ratio={0.5}
            onRatioChanged={onRatioChanged}
          />);

        await theUserTo.pointer([{keys: "[MouseLeft>]", target: getButton(), coords: {x: 50}},
          {coords: {x: 70}},
        ]);

        expect(onRatioChanged.callCount).to.be.equal(0);
      });

      it("stops calling onRatioChanged when pointerdown event happens while still dragging", async () => {
        render(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            onRatioChanged={onRatioChanged}
          />);

        await theUserTo.pointer([{keys: "[MouseLeft>]", target: getButton(), coords: {x: 50}},
          {coords: {x: 70}},
        ]);

        expect(onRatioChanged.callCount).to.be.equal(1);

        // This is not an interaction that user-events allow or physically make any sense,
        // you cant press your mouse button while it's pressed, but the code have a case for it.
        // I'm leaving it here in case this is a know edge case that happens in a way I cant imagine now.
        fireEvent.pointerDown(getButton());

        await theUserTo.pointer([{target: getButton(), coords: {x: 70}},
          {coords: {x: 90}}]);

        expect(onRatioChanged.callCount, "Called when dragging stopped").to.be.equal(1);
      });

      it("should not have hover classes when element created", () => {
        render(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            onRatioChanged={onRatioChanged}
          />);

        expectCleanHover();
      });

      it("should have hover class when pointer enters element", async () => {
        render(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            onRatioChanged={onRatioChanged}
          />);

        await theUserTo.hover(getButton());

        expectHovered();
      });

      it("should have unhover class when pointer leaves element", async () => {
        render(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            onRatioChanged={onRatioChanged}
          />);

        await theUserTo.hover(getButton());
        await theUserTo.unhover(getButton());

        expectUnhovered();
      });

      it("should call onResizeHandleHoverChanged when pointer enters or leaves", async () => {
        const onHoverChanged = sinon.spy();

        render(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            onResizeHandleHoverChanged={onHoverChanged}
            onRatioChanged={onRatioChanged}
          />);

        await theUserTo.hover(getButton());
        expect(onHoverChanged.calledOnce, "Was not called on pointer enter").to.be.true;

        await theUserTo.unhover(getButton());
        expect(onHoverChanged.calledTwice, "Was not called on pointer leave").to.be.true;
      });

      it("should call isResizeHandleBeingDragged when pointer down or up", async () => {
        const onDragChanged = sinon.spy();

        render(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            onResizeHandleDragChanged={onDragChanged}
            onRatioChanged={onRatioChanged}
          />);

        await theUserTo.pointer({ keys: "[MouseLeft>]", target: getButton()});
        expect(onDragChanged.callCount, "Was not called on pointer down").to.be.equal(1);

        await theUserTo.pointer({ keys: "[/MouseLeft]"});
        expect(onDragChanged.callCount, "Was not called on pointer up").to.be.equal(2);
      });

      it("should have hover class when group is hovered", () => {
        render(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            isResizeHandleHovered={true}
            onRatioChanged={onRatioChanged}
          />);

        expectHovered();
      });

      it("should have no class when group is not hovered and element has not been hovered or dragged once", () => {
        render(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            isResizeHandleHovered={false}
            onRatioChanged={onRatioChanged}
          />);

        expectCleanHover();
      });

      it("should have unhovered class when group is not hovered and element has been hovered or dragged", () => {
        const {rerender} = render(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            isResizeHandleHovered={false}
            onRatioChanged={onRatioChanged}
          />);
        rerender(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            isResizeHandleHovered={true}
            onRatioChanged={onRatioChanged}
          />);
        rerender(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            isResizeHandleHovered={false}
            onRatioChanged={onRatioChanged}
          />);

        expectUnhovered();
      });

      it("should have hover class when group is dragged", () => {
        render(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            isResizeHandleBeingDragged={true}
            onRatioChanged={onRatioChanged}
          />);

        expectHovered();
      });

      it("should have no class when group is not dragged and element has not been hovered or dragged once", () => {
        render(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            isResizeHandleBeingDragged={false}
            onRatioChanged={onRatioChanged}
          />);

        expectCleanHover();
      });

      it("should have unhovered class when group is not dragged and element has been hovered or dragged", () => {
        const {rerender} = render(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            isResizeHandleBeingDragged={false}
            onRatioChanged={onRatioChanged}
          />);
        rerender(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            isResizeHandleBeingDragged={true}
            onRatioChanged={onRatioChanged}
          />);
        rerender(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            isResizeHandleBeingDragged={false}
            onRatioChanged={onRatioChanged}
          />);

        expectUnhovered();
      });

      it("should not call callback if orientation horizontal and position on x axis does not change", async () => {
        render(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            onRatioChanged={onRatioChanged}
            ratio={0.5}
          />);

        await theUserTo.pointer([{keys: "[MouseLeft>]", target: getButton(), coords:{x: 50}},
          {coords: {x: 50, y: 70}},
        ]);

        expect(onRatioChanged.callCount, "Called when position did not change on x axis").to.be.equal(0);
      });

      it("should not call callback if orientation vertical and position on y axis does not change", async () => {
        render(
          <ElementSeparator
            orientation={Orientation.Vertical}
            movableArea={100}
            onRatioChanged={onRatioChanged}
            ratio={0.5}
          />);

        await theUserTo.pointer([{keys: "[MouseLeft>]", target: getButton(), coords:{y: 50}},
          {coords: {y: 50, x: 70}},
        ]);
        expect(onRatioChanged.callCount, "Called when position did not change on y axis").to.be.equal(0);
      });
    });
  }

  setupElementSeparatorCallbackIndifferentTests(TestCallbackType.Controlled);
  setupElementSeparatorCallbackIndifferentTests(TestCallbackType.Uncontrolled);

  it("should update ratio if ratio not changed but element hovered", async () => {
    const onRatioChanged = sinon.spy(() => ({ ratio: 0.5 }));

    render(
      <ElementSeparator
        orientation={Orientation.Horizontal}
        movableArea={100}
        onRatioChanged={onRatioChanged}
        ratio={0.5}
      />);

    await theUserTo.pointer([{keys: "[MouseLeft>]", target: getButton(), coords: {x: 50}},
      {coords: {x: 70}}]);
    expect(onRatioChanged.callCount).to.be.equal(1);

    await theUserTo.unhover(getButton());
    await theUserTo.pointer({target: getButton(), coords: {x: 90}});
    expect(onRatioChanged.callCount).to.be.equal(2);
  });

  it("should call drag stop callback when unmounted while being dragged", async () => {
    const onRatioChanged = sinon.spy(() => ({ ratio: 0.5 }));
    const onResizeHandleDragChangedSpy = sinon.spy();

    const {unmount} = render(
      <ElementSeparator
        orientation={Orientation.Horizontal}
        movableArea={100}
        onRatioChanged={onRatioChanged}
        ratio={0.5}
        isResizeHandleBeingDragged={false}
        isResizeHandleHovered={false}
        onResizeHandleDragChanged={onResizeHandleDragChangedSpy}
      />);

    await theUserTo.pointer({keys: "[MouseLeft>]", target:getButton(), coords: {x: 50}});
    expect(onResizeHandleDragChangedSpy.callCount).to.be.equal(1);

    await theUserTo.pointer({coords: {x: 70}});
    expect(onRatioChanged.callCount, "First ratio change should always be called").to.be.equal(1);

    await theUserTo.pointer({coords: {x: 90}});
    expect(onRatioChanged.callCount, "Called ratio change when it was not hovered and update was not needed").to.be.equal(1);

    expect(onResizeHandleDragChangedSpy.callCount).to.be.equal(1);

    unmount();

    expect(onResizeHandleDragChangedSpy.callCount).to.be.equal(2);
  });

  it("should call hover stop callback when unmounted while being hovered", async () => {
    const onRatioChanged = sinon.spy(() => ({ ratio: 0.5 }));
    const onResizeHandleHoverChanged = sinon.spy();

    const {unmount} = render(
      <ElementSeparator
        orientation={Orientation.Horizontal}
        movableArea={100}
        onRatioChanged={onRatioChanged}
        ratio={0.5}
        isResizeHandleBeingDragged={false}
        isResizeHandleHovered={false}
        onResizeHandleHoverChanged={onResizeHandleHoverChanged}
      />);

    await theUserTo.hover(getButton());

    expect(onResizeHandleHoverChanged.callCount).to.be.equal(1);

    unmount();

    expect(onResizeHandleHoverChanged.callCount).to.be.equal(2);
  });
});
