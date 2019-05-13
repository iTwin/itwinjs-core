/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import React from "react";
import { render, cleanup, fireEvent } from "react-testing-library";
import { expect } from "chai";
import sinon from "sinon";
import { WeightPickerButton } from "../../ui-components/lineweight/WeightPickerButton";
import { ColorByName, ColorDef } from "@bentley/imodeljs-common";

describe("<WeightPickerButton/>", () => {
  const colorDef = new ColorDef(ColorByName.blue);
  const activeWeight = 3;
  const weights = [1, 2, 3, 4, 5, 6];

  afterEach(cleanup);

  it("should render", () => {
    const renderedComponent = render(<WeightPickerButton activeWeight={activeWeight} weights={weights} colorDef={colorDef} />);
    expect(renderedComponent).not.to.be.undefined;
  });

  //    hideLabel ?: boolean;

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
    fireEvent.click(pickerButton);

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

  it("readonly - button press should not open popup", async () => {
    const renderedComponent = render(<WeightPickerButton activeWeight={activeWeight} weights={weights} readonly={true} />);
    const pickerButton = renderedComponent.getByTestId("components-weightpicker-button");
    expect(pickerButton.tagName).to.be.equal("BUTTON");
    fireEvent.click(pickerButton);

    // use queryByTestId to avoid exception if it is not found.
    const corePopupDiv = renderedComponent.queryByTestId("core-popup");
    expect(corePopupDiv).not.to.be.undefined;

  });

});
