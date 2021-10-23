/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import React from "react";
import sinon from "sinon";
import { ColorByName, ColorDef } from "@itwin/core-common";
import { fireEvent, render } from "@testing-library/react";
import { WeightPickerButton } from "../../imodel-components-react/lineweight/WeightPickerButton";

describe("<WeightPickerButton/>", () => {
  const colorDef = ColorDef.create(ColorByName.blue);
  const activeWeight = 3;
  const weights = [1, 2, 3, 4, 5, 6];

  it("should render", () => {
    const renderedComponent = render(<WeightPickerButton activeWeight={activeWeight} weights={weights} colorDef={colorDef} />);
    expect(renderedComponent).not.to.be.undefined;
  });

  it("button press should open popup and allow weight selection", async () => {
    const spyOnWeightPick = sinon.spy();

    function handleWeightPick(weight: number): void {
      expect(weight).to.be.equal(1);
      spyOnWeightPick();
    }

    const renderedComponent = render(<WeightPickerButton activeWeight={activeWeight} weights={weights} onLineWeightPick={handleWeightPick} dropDownTitle="test-title" />);
    expect(renderedComponent.getByTestId("components-weightpicker-button")).to.exist;
    const pickerButton = renderedComponent.getByTestId("components-weightpicker-button");
    expect(pickerButton.tagName).to.be.equal("BUTTON");
    let expandedAttribute = pickerButton.getAttribute("aria-expanded");
    expect(expandedAttribute).to.be.eq("false");

    fireEvent.click(pickerButton);
    expandedAttribute = pickerButton.getAttribute("aria-expanded");
    expect(expandedAttribute).to.be.eq("true");

    // getByTestId will trigger failure if not found so need to add separate 'expect' to test
    const popupDiv = renderedComponent.getByTestId("components-weightpicker-popup-lines");
    if (popupDiv) {
      const title = renderedComponent.getByText("test-title");
      expect(title).not.to.be.undefined;

      const firstColorButton = popupDiv.firstChild as HTMLElement;
      expect(firstColorButton).not.to.be.undefined;
      fireEvent.click(firstColorButton);
      // renderedComponent.debug();
      expect(spyOnWeightPick).to.be.calledOnce;
    }
  });

  it("button press should open popup and allow weight selection (Enter to close)", async () => {
    const spyOnWeightPick = sinon.spy();

    function buildIdForWeight(weight: number): string {
      return `ui-core-lineweight-${weight}`;
    }

    function handleWeightPick(weight: number): void {
      expect(weight).to.be.equal(2);
      spyOnWeightPick();
    }

    const renderedComponent = render(<WeightPickerButton activeWeight={activeWeight} weights={weights} onLineWeightPick={handleWeightPick} dropDownTitle="test-title" />);
    expect(renderedComponent.getByTestId("components-weightpicker-button")).to.exist;
    const pickerButton = renderedComponent.getByTestId("components-weightpicker-button");
    expect(pickerButton.tagName).to.be.equal("BUTTON");
    let expandedAttribute = pickerButton.getAttribute("aria-expanded");
    expect(expandedAttribute).to.be.eq("false");

    fireEvent.click(pickerButton);
    expandedAttribute = pickerButton.getAttribute("aria-expanded");
    expect(expandedAttribute).to.be.eq("true");

    // getByTestId will trigger failure if not found so need to add separate 'expect' to test
    const popupDiv = renderedComponent.getByTestId("components-weightpicker-popup-lines");
    if (popupDiv) {
      const title = renderedComponent.getByText("test-title");
      expect(title).not.to.be.undefined;

      const firstColorButton = popupDiv.firstChild as HTMLElement;
      expect(firstColorButton).not.to.be.undefined;

      // wait for button to receive focus
      await new Promise((r) => { setTimeout(r, 80); });

      // renderedComponent.debug();
      // focus on weight 2 and press enter key which should close popup
      const node = popupDiv.querySelector(`#${buildIdForWeight(2)}`) as HTMLElement;
      if (node) {
        node.focus();
        fireEvent.keyDown(popupDiv, { key: "Enter" });

        // renderedComponent.debug();
        expect(spyOnWeightPick).to.be.calledOnce;
      }
    }
  });

  it("button press should open popup and move selection via arrow (Enter to close)", async () => {
    const spyOnWeightPick = sinon.spy();

    function handleWeightPick(weight: number): void {
      expect(weight).to.be.equal(2);
      spyOnWeightPick();
    }

    const renderedComponent = render(<WeightPickerButton activeWeight={activeWeight} weights={weights} onLineWeightPick={handleWeightPick} dropDownTitle="test-title" />);
    expect(renderedComponent.getByTestId("components-weightpicker-button")).to.exist;
    const pickerButton = renderedComponent.getByTestId("components-weightpicker-button");
    expect(pickerButton.tagName).to.be.equal("BUTTON");
    let expandedAttribute = pickerButton.getAttribute("aria-expanded");
    expect(expandedAttribute).to.be.eq("false");

    fireEvent.click(pickerButton);
    expandedAttribute = pickerButton.getAttribute("aria-expanded");
    expect(expandedAttribute).to.be.eq("true");

    // getByTestId will trigger failure if not found so need to add separate 'expect' to test
    const popupDiv = renderedComponent.getByTestId("components-weightpicker-popup-lines");
    if (popupDiv) {
      const title = renderedComponent.getByText("test-title");
      expect(title).not.to.be.undefined;

      const firstColorButton = popupDiv.firstChild as HTMLElement;
      expect(firstColorButton).not.to.be.undefined;

      // wait for button to receive focus
      await new Promise((r) => { setTimeout(r, 80); });

      // renderedComponent.debug();
      fireEvent.keyDown(popupDiv, { key: "ArrowDown" });  // down to 4
      fireEvent.keyDown(popupDiv, { key: "ArrowUp" });    // back up to 3
      fireEvent.keyDown(popupDiv, { key: "ArrowUp" });    // up to 2
      fireEvent.keyDown(popupDiv, { key: "Enter" });
      expect(spyOnWeightPick).to.be.calledOnce;
    }
  });

  it("button press should open popup, move selection via arrow & wraparound as needed", async () => {
    const spyOnWeightPick = sinon.spy();

    function handleWeightPick(weight: number): void {
      expect(weight).to.be.equal(5);
      spyOnWeightPick();
    }

    const renderedComponent = render(<WeightPickerButton activeWeight={activeWeight} weights={weights} onLineWeightPick={handleWeightPick} dropDownTitle="test-title" />);
    expect(renderedComponent.getByTestId("components-weightpicker-button")).to.exist;
    const pickerButton = renderedComponent.getByTestId("components-weightpicker-button");
    expect(pickerButton.tagName).to.be.equal("BUTTON");
    let expandedAttribute = pickerButton.getAttribute("aria-expanded");
    expect(expandedAttribute).to.be.eq("false");

    fireEvent.click(pickerButton);
    expandedAttribute = pickerButton.getAttribute("aria-expanded");
    expect(expandedAttribute).to.be.eq("true");

    // getByTestId will trigger failure if not found so need to add separate 'expect' to test
    const popupDiv = renderedComponent.getByTestId("components-weightpicker-popup-lines");
    if (popupDiv) {
      const title = renderedComponent.getByText("test-title");
      expect(title).not.to.be.undefined;

      const firstColorButton = popupDiv.firstChild as HTMLElement;
      expect(firstColorButton).not.to.be.undefined;

      // wait for button to receive focus
      await new Promise((r) => { setTimeout(r, 80); });

      // renderedComponent.debug();
      fireEvent.keyDown(popupDiv, { key: "ArrowDown" });  // down to 4
      fireEvent.keyDown(popupDiv, { key: "ArrowDown" });  // down to 5
      fireEvent.keyDown(popupDiv, { key: "ArrowDown" });  // down to 6
      fireEvent.keyDown(popupDiv, { key: "ArrowDown" });  // wraparound to 1
      fireEvent.keyDown(popupDiv, { key: "ArrowUp" });    // back down to 6
      fireEvent.keyDown(popupDiv, { key: "ArrowUp" });    // up to 5
      fireEvent.keyDown(popupDiv, { key: "Enter" });
      expect(spyOnWeightPick).to.be.calledOnce;
    }
  });

  it("readonly - button press should not open popup", async () => {
    const renderedComponent = render(<WeightPickerButton activeWeight={activeWeight} weights={weights} readonly={true} />);
    const pickerButton = renderedComponent.getByTestId("components-weightpicker-button");
    expect(pickerButton.tagName).to.be.equal("BUTTON");
    fireEvent.click(pickerButton);
    // use queryByTestId to avoid exception if it is not found.
    const corePopupDiv = renderedComponent.queryByTestId("core-popup");
    expect(corePopupDiv).to.be.null;
  });

});
