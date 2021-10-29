/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { ElementSeparator, RatioChangeResult } from "../../core-react/elementseparator/ElementSeparator";
import { Orientation } from "../../core-react/enums/Orientation";

describe("ElementSeparator", () => {
  let clock: sinon.SinonFakeTimers;
  beforeEach(() => {
    clock = sinon.useFakeTimers({ now: Date.now() });
  });

  afterEach(() => {
    clock.restore();
  });

  const throttleMs = 16;
  function moveElement(moveAmount: { clientX: number } | { clientY: number }, moveDelayMs: number = throttleMs) {
    document.dispatchEvent(new MouseEvent("pointermove", moveAmount));
    clock.tick(moveDelayMs);
  }

  enum TestCallbackType {
    Uncontrolled,
    Controlled,
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

      it("calls onRatioChanged when it gets dragged horizontally", () => {
        const elementSeparator = mount(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            onRatioChanged={onRatioChanged}
          />);

        elementSeparator.simulate("pointerdown", { clientX: 50 });
        moveElement({ clientX: 70 });

        expect(onRatioChanged.callCount).to.be.equal(1);
        expect(onRatioChanged.calledWith(0.7), "Called with wrong argument").to.be.true;
      });

      it("calls onRatioChanged when it gets dragged vertically", () => {
        const elementSeparator = mount(
          <ElementSeparator
            orientation={Orientation.Vertical}
            movableArea={100}
            ratio={0.5}
            onRatioChanged={onRatioChanged}
          />);

        elementSeparator.simulate("pointerdown", { clientY: 50 });
        moveElement({ clientY: 70 });

        expect(onRatioChanged.callCount).to.be.equal(1);
        expect(onRatioChanged.calledWith(0.7), "Called with wrong argument").to.be.true;
      });

      it("calls onRatioChanged when it gets dragged 1px", () => {
        const elementSeparator = mount(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            onRatioChanged={onRatioChanged}
          />);

        elementSeparator.simulate("pointerdown", { clientX: 50 });
        moveElement({ clientX: 51 });

        expect(onRatioChanged.callCount).to.be.equal(1);
      });

      it("calls onRatioChanged only once when moved multiple times in the same throttle frame", async () => {
        const elementSeparator = mount(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            onRatioChanged={onRatioChanged}
          />);

        elementSeparator.simulate("pointerdown", { clientX: 50 });
        moveElement({ clientX: 60 }, 1);
        moveElement({ clientX: 80 }, 1);

        clock.tick(throttleMs);

        expect(onRatioChanged.callCount).to.be.equal(1);
        expect(onRatioChanged.calledWith(0.8)).to.be.true;

      });

      it("stops calling onRatioChanged when dragging stops", () => {
        const elementSeparator = mount(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            onRatioChanged={onRatioChanged}
          />);

        elementSeparator.simulate("pointerdown", { clientX: 50 });
        moveElement({ clientX: 70 });

        expect(onRatioChanged.callCount).to.be.equal(1);

        document.dispatchEvent(new MouseEvent("pointerup"));
        moveElement({ clientX: 90 });

        expect(onRatioChanged.callCount, "Called when dragging stopped").to.be.equal(1);
      });

      it("does not call onRatioChanged when dragging without movableArea set", () => {
        const elementSeparator = mount(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            ratio={0.5}
            onRatioChanged={onRatioChanged}
          />);

        elementSeparator.simulate("pointerdown", { clientX: 50 });
        moveElement({ clientX: 70 });

        expect(onRatioChanged.callCount).to.be.equal(0);
      });

      it("stops calling onRatioChanged when pointerdown event happens while still dragging", () => {
        const elementSeparator = mount(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            onRatioChanged={onRatioChanged}
          />);

        elementSeparator.simulate("pointerdown", { clientX: 50 });
        moveElement({ clientX: 70 });

        expect(onRatioChanged.callCount).to.be.equal(1);

        elementSeparator.simulate("pointerdown", { clientY: 70 });
        moveElement({ clientX: 90 });

        expect(onRatioChanged.callCount, "Called when dragging stopped").to.be.equal(1);
      });

      it("should not have hover classes when element created", () => {
        const elementSeparator = mount(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            onRatioChanged={onRatioChanged}
          />);

        expect(elementSeparator.find(".core-element-separator-group-hovered").length, "Found hover class on freshly created element").to.be.equal(0);
        expect(elementSeparator.find(".core-element-separator-group-unhovered").length, "Found unhover class on freshly created element").to.be.equal(0);
      });

      it("should have hover class when pointer enters element", () => {
        const elementSeparator = mount(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            onRatioChanged={onRatioChanged}
          />);

        elementSeparator.simulate("pointerover");

        expect(elementSeparator.find(".core-element-separator-group-hovered").length, "Did not find hover class on hovered element").to.be.equal(1);
        expect(elementSeparator.find(".core-element-separator-group-unhovered").length, "Found unhover class on hovered element").to.be.equal(0);
      });

      it("should have unhover class when pointer leaves element", () => {
        const elementSeparator = mount(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            onRatioChanged={onRatioChanged}
          />);

        elementSeparator.simulate("pointerover");
        elementSeparator.simulate("pointerout");

        expect(elementSeparator.find(".core-element-separator-group-hovered").length, "Did not find hover class on hovered element").to.be.equal(0);
        expect(elementSeparator.find(".core-element-separator-group-unhovered").length, "Found unhover class on hovered element").to.be.equal(1);
      });

      it("should call onResizeHandleHoverChanged when pointer enters or leaves", () => {
        const onHoverChanged = sinon.spy();

        const elementSeparator = mount(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            onResizeHandleHoverChanged={onHoverChanged}
            onRatioChanged={onRatioChanged}
          />);

        elementSeparator.simulate("pointerover");
        expect(onHoverChanged.calledOnce, "Was not called on pointer enter").to.be.true;

        elementSeparator.simulate("pointerout");
        expect(onHoverChanged.calledTwice, "Was not called on pointer leave").to.be.true;
      });

      it("should call isResizeHandleBeingDragged when pointer down or up", () => {
        const onDragChanged = sinon.spy();

        const elementSeparator = mount(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            onResizeHandleDragChanged={onDragChanged}
            onRatioChanged={onRatioChanged}
          />);

        elementSeparator.simulate("pointerdown");
        expect(onDragChanged.callCount, "Was not called on pointer down").to.be.equal(1);

        document.dispatchEvent(new MouseEvent("pointerup"));
        expect(onDragChanged.callCount, "Was not called on pointer up").to.be.equal(2);
      });

      it("should have hover class when pointer down", () => {
        const elementSeparator = mount(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            onRatioChanged={onRatioChanged}
          />);

        elementSeparator.simulate("pointerdown");

        expect(elementSeparator.find(".core-element-separator-group-hovered").length, "Did not find hover class on hovered element").to.be.equal(1);
        expect(elementSeparator.find(".core-element-separator-group-unhovered").length, "Found unhover class on hovered element").to.be.equal(0);
      });

      it("should have unhover class when pointer up", () => {
        const elementSeparator = mount(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            onRatioChanged={onRatioChanged}
          />);

        elementSeparator.simulate("pointerdown");
        document.dispatchEvent(new MouseEvent("pointerup"));

        elementSeparator.mount();

        expect(elementSeparator.find(".core-element-separator-group-hovered").length, "Found hover class on unhovered element").to.be.equal(0);
        expect(elementSeparator.find(".core-element-separator-group-unhovered").length, "Did not find unhover class on unhovered element").to.be.equal(1);
      });

      it("should have hover class when group is hovered", () => {
        const elementSeparator = mount(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            isResizeHandleHovered={true}
            onRatioChanged={onRatioChanged}
          />);

        expect(elementSeparator.find(".core-element-separator-group-hovered").length, "Did not find hover class on hovered element").to.be.equal(1);
        expect(elementSeparator.find(".core-element-separator-group-unhovered").length, "Found unhover class on hovered element").to.be.equal(0);
      });

      it("should have no class when group is not hovered and element has not been hovered or dragged once", () => {
        const elementSeparator = mount(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            isResizeHandleHovered={false}
            onRatioChanged={onRatioChanged}
          />);

        expect(elementSeparator.find(".core-element-separator-group-hovered").length, "Found hover class on unhovered element").to.be.equal(0);
        expect(elementSeparator.find(".core-element-separator-group-unhovered").length, "Found unhover class on never hovered element").to.be.equal(0);
      });

      it("should have unhovered class when group is not hovered and element has been hovered or dragged", () => {
        const elementSeparator = mount(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            isResizeHandleHovered={false}
            onRatioChanged={onRatioChanged}
          />);

        elementSeparator.setProps({ isResizeHandleHovered: true });
        elementSeparator.setProps({ isResizeHandleHovered: false });

        expect(elementSeparator.find(".core-element-separator-group-hovered").length, "Found hover class on unhovered element").to.be.equal(0);
        expect(elementSeparator.find(".core-element-separator-group-unhovered").length, "Did not find unhover class on unhovered element").to.be.equal(1);
      });

      it("should have hover class when group is dragged", () => {
        const elementSeparator = mount(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            isResizeHandleBeingDragged={true}
            onRatioChanged={onRatioChanged}
          />);

        expect(elementSeparator.find(".core-element-separator-group-hovered").length, "Did not find hover class on hovered element").to.be.equal(1);
        expect(elementSeparator.find(".core-element-separator-group-unhovered").length, "Found unhover class on hovered element").to.be.equal(0);
      });

      it("should have no class when group is not dragged and element has not been hovered or dragged once", () => {
        const elementSeparator = mount(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            isResizeHandleBeingDragged={false}
            onRatioChanged={onRatioChanged}
          />);

        expect(elementSeparator.find(".core-element-separator-group-hovered").length, "Found hover class on unhovered element").to.be.equal(0);
        expect(elementSeparator.find(".core-element-separator-group-unhovered").length, "Found unhover class on never hovered element").to.be.equal(0);
      });

      it("should have unhovered class when group is not dragged and element has been hovered or dragged", () => {
        const elementSeparator = mount(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            ratio={0.5}
            isResizeHandleBeingDragged={false}
            onRatioChanged={onRatioChanged}
          />);

        elementSeparator.setProps({ isResizeHandleBeingDragged: true });
        elementSeparator.setProps({ isResizeHandleBeingDragged: false });

        expect(elementSeparator.find(".core-element-separator-group-hovered").length, "Found hover class on unhovered element").to.be.equal(0);
        expect(elementSeparator.find(".core-element-separator-group-unhovered").length, "Did not find unhover class on unhovered element").to.be.equal(1);
      });

      it("should not call callback if orientation horizontal and position on x axis does not change", () => {
        const elementSeparator = mount(
          <ElementSeparator
            orientation={Orientation.Horizontal}
            movableArea={100}
            onRatioChanged={onRatioChanged}
            ratio={0.5}
          />);

        elementSeparator.simulate("pointerdown", { clientX: 50 });
        moveElement({ clientX: 50, clientY: 70 });
        expect(onRatioChanged.callCount, "Called when position did not change on x axis").to.be.equal(0);
      });

      it("should not call callback if orientation vertical and position on y axis does not change", () => {
        const elementSeparator = mount(
          <ElementSeparator
            orientation={Orientation.Vertical}
            movableArea={100}
            onRatioChanged={onRatioChanged}
            ratio={0.5}
          />);

        elementSeparator.simulate("pointerdown", { clientY: 50 });
        moveElement({ clientX: 70, clientY: 50 });
        expect(onRatioChanged.callCount, "Called when position did not change on y axis").to.be.equal(0);
      });
    });
  }

  setupElementSeparatorCallbackIndifferentTests(TestCallbackType.Controlled);
  setupElementSeparatorCallbackIndifferentTests(TestCallbackType.Uncontrolled);

  it("should update ratio if ratio not changed but element hovered", () => {
    const onRatioChanged = sinon.spy(() => ({ ratio: 0.5 }));

    const elementSeparator = mount(
      <ElementSeparator
        orientation={Orientation.Horizontal}
        movableArea={100}
        onRatioChanged={onRatioChanged}
        ratio={0.5}
      />);

    elementSeparator.simulate("pointerover");
    elementSeparator.simulate("pointerdown", { clientX: 50 });
    moveElement({ clientX: 70 });
    elementSeparator.mount();

    expect(onRatioChanged.callCount).to.be.equal(1);

    moveElement({ clientX: 90 });
    expect(onRatioChanged.callCount).to.be.equal(2);
  });

  it("should update ratio if ratio changes but element not hovered", () => {
    const onRatioChanged = sinon.spy((ratio: number) => ({ ratio }));

    const elementSeparator = mount(
      <ElementSeparator
        orientation={Orientation.Horizontal}
        movableArea={100}
        onRatioChanged={onRatioChanged}
        ratio={0.5}
      />);

    elementSeparator.simulate("pointerdown", { clientX: 50 });
    moveElement({ clientX: 70 });
    expect(onRatioChanged.callCount).to.be.equal(1);

    moveElement({ clientX: 90 });
    expect(onRatioChanged.callCount).to.be.equal(2);
  });

  it("should update ratio if ratio changed and element is hovered", () => {
    const onRatioChanged = sinon.spy((ratio: number) => ({ ratio }));

    const elementSeparator = mount(
      <ElementSeparator
        orientation={Orientation.Horizontal}
        movableArea={100}
        onRatioChanged={onRatioChanged}
        ratio={0.5}
      />);

    elementSeparator.simulate("pointerover");
    elementSeparator.simulate("pointerdown", { clientX: 50 });
    moveElement({ clientX: 70 });
    expect(onRatioChanged.callCount).to.be.equal(1);

    moveElement({ clientX: 90 });
    expect(onRatioChanged.callCount).to.be.equal(2);
  });

  it("should not update ratio if ratio has not changed and element is not hovered (draggable area left)", () => {
    const onRatioChanged = sinon.spy(() => ({ ratio: 0.5 }));

    const elementSeparator = mount(
      <ElementSeparator
        orientation={Orientation.Horizontal}
        movableArea={100}
        onRatioChanged={onRatioChanged}
        ratio={0.5}
      />);

    elementSeparator.simulate("pointerdown", { clientX: 50 });
    moveElement({ clientX: 70 });
    expect(onRatioChanged.callCount, "First ratio change should always be called").to.be.equal(1);

    moveElement({ clientX: 90 });
    expect(onRatioChanged.callCount, "Called ratio change when it was not hovered and update was not needed").to.be.equal(1);
  });

  it("should update ratio if ratio undefined and element is not hovered", () => {
    const onRatioChanged = sinon.spy();

    const elementSeparator = mount(
      <ElementSeparator
        orientation={Orientation.Horizontal}
        movableArea={100}
        onRatioChanged={onRatioChanged}
        ratio={0.5}
      />);

    elementSeparator.simulate("pointerdown", { clientX: 50 });
    moveElement({ clientX: 70 });
    expect(onRatioChanged.callCount, "First ratio change should always be called").to.be.equal(1);

    moveElement({ clientX: 90 });
    expect(onRatioChanged.callCount, "Element should move when ratio undefined for backwards compatibility").to.be.equal(2);
  });

  it("should start updating on hover after leaving draggable area", () => {
    const onRatioChanged = sinon.spy(() => ({ ratio: 0.5 }));

    const elementSeparator = mount(
      <ElementSeparator
        orientation={Orientation.Horizontal}
        movableArea={100}
        onRatioChanged={onRatioChanged}
        ratio={0.5}
      />);

    elementSeparator.simulate("pointerdown", { clientX: 50 });
    moveElement({ clientX: 70 });
    expect(onRatioChanged.callCount, "First ratio change should always be called").to.be.equal(1);

    moveElement({ clientX: 90 });
    expect(onRatioChanged.callCount, "Called ratio change when it was not hovered and update was not needed").to.be.equal(1);

    elementSeparator.simulate("pointerover");
    moveElement({ clientX: 40 });
    expect(onRatioChanged.callCount, "Ratio change should be called again after pointer is hovering").to.be.equal(2);
  });

  it("should call drag stop callback when unmounted while being dragged", () => {
    const onRatioChanged = sinon.spy(() => ({ ratio: 0.5 }));
    const onResizeHandleDragChangedSpy = sinon.spy();

    const elementSeparator = mount(
      <ElementSeparator
        orientation={Orientation.Horizontal}
        movableArea={100}
        onRatioChanged={onRatioChanged}
        ratio={0.5}
        isResizeHandleBeingDragged={false}
        isResizeHandleHovered={false}
        onResizeHandleDragChanged={onResizeHandleDragChangedSpy}
      />);

    elementSeparator.simulate("pointerdown", { clientX: 50 });
    expect(onResizeHandleDragChangedSpy.callCount).to.be.equal(1);

    moveElement({ clientX: 70 });
    expect(onRatioChanged.callCount, "First ratio change should always be called").to.be.equal(1);

    moveElement({ clientX: 90 });
    expect(onRatioChanged.callCount, "Called ratio change when it was not hovered and update was not needed").to.be.equal(1);

    expect(onResizeHandleDragChangedSpy.callCount).to.be.equal(1);

    elementSeparator.unmount();

    expect(onResizeHandleDragChangedSpy.callCount).to.be.equal(2);
  });

  it("should call hover stop callback when unmounted while being hovered", () => {
    const onRatioChanged = sinon.spy(() => ({ ratio: 0.5 }));
    const onResizeHandleHoverChanged = sinon.spy();

    const elementSeparator = mount(
      <ElementSeparator
        orientation={Orientation.Horizontal}
        movableArea={100}
        onRatioChanged={onRatioChanged}
        ratio={0.5}
        isResizeHandleBeingDragged={false}
        isResizeHandleHovered={false}
        onResizeHandleHoverChanged={onResizeHandleHoverChanged}
      />);

    elementSeparator.simulate("pointerover");

    expect(onResizeHandleHoverChanged.callCount).to.be.equal(1);

    elementSeparator.unmount();

    expect(onResizeHandleHoverChanged.callCount).to.be.equal(2);
  });
});
