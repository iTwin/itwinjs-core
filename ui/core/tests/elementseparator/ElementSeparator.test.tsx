/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { mount } from "enzyme";
import * as sinon from "sinon";
import * as React from "react";
import { ElementSeparator } from "../../src/elementseparator/ElementSeparator";
import { Orientation } from "../../src/enums/Orientation";

describe("ElementSeparator", () => {
  it("calls onRatioChanged when it gets dragged horizontally", () => {
    const onRatioChanged = sinon.spy();

    const elementSeparator = mount(
      <ElementSeparator
        orientation={Orientation.Horizontal}
        movableArea={100}
        onRatioChanged={onRatioChanged}
        ratio={0.5}
      />);

    elementSeparator.simulate("pointerdown", { clientX: 50 });
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 70 }));

    expect(onRatioChanged.calledOnce, "Called more or less than once").to.be.true;
    expect(onRatioChanged.calledWith(0.7), "Called with wrong argument").to.be.true;
  });

  it("calls onRatioChanged when it gets dragged vertically", () => {
    const onRatioChanged = sinon.spy();

    const elementSeparator = mount(
      <ElementSeparator
        orientation={Orientation.Vertical}
        movableArea={100}
        onRatioChanged={onRatioChanged}
        ratio={0.5}
      />);

    elementSeparator.simulate("pointerdown", { clientY: 50 });
    document.dispatchEvent(new MouseEvent("pointermove", { clientY: 70 }));

    expect(onRatioChanged.calledOnce, "Called more or less than once").to.be.true;
    expect(onRatioChanged.calledWith(0.7), "Called with wrong argument").to.be.true;
  });

  it("does not call onRatioChanged when it gets dragged too little", () => {
    const onRatioChanged = sinon.spy();

    const elementSeparator = mount(
      <ElementSeparator
        orientation={Orientation.Horizontal}
        movableArea={100}
        onRatioChanged={onRatioChanged}
        ratio={0.5}
      />);

    elementSeparator.simulate("pointerdown", { clientX: 50 });
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 51 }));

    expect(onRatioChanged.notCalled).to.be.true;
  });

  it("stops calling onRatioChanged when dragging stops", () => {
    const onRatioChanged = sinon.spy();

    const elementSeparator = mount(
      <ElementSeparator
        orientation={Orientation.Horizontal}
        movableArea={100}
        onRatioChanged={onRatioChanged}
        ratio={0.5}
      />);

    elementSeparator.simulate("pointerdown", { clientX: 50 });
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 70 }));

    expect(onRatioChanged.calledOnce, "Called more or less than once").to.be.true;

    document.dispatchEvent(new MouseEvent("pointerup"));
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 90 }));

    expect(onRatioChanged.calledOnce, "Called when dragging stopped").to.be.true;
  });

  it("does not call onRatioChanged when dragging without movableArea set", () => {
    const onRatioChanged = sinon.spy();

    const elementSeparator = mount(
      <ElementSeparator
        orientation={Orientation.Horizontal}
        onRatioChanged={onRatioChanged}
        ratio={0.5}
      />);

    elementSeparator.simulate("pointerdown", { clientX: 50 });
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 70 }));

    expect(onRatioChanged.notCalled).to.be.true;
  });

  it("stops calling onRatioChanged when pointerdown event happens while still dragging", () => {
    const onRatioChanged = sinon.spy();

    const elementSeparator = mount(
      <ElementSeparator
        orientation={Orientation.Horizontal}
        movableArea={100}
        onRatioChanged={onRatioChanged}
        ratio={0.5}
      />);

    elementSeparator.simulate("pointerdown", { clientX: 50 });
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 70 }));

    expect(onRatioChanged.calledOnce, "Called more or less than once").to.be.true;

    elementSeparator.simulate("pointerdown", { clientY: 70 });
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 90 }));

    expect(onRatioChanged.calledOnce, "Called when dragging stopped").to.be.true;
  });
});
