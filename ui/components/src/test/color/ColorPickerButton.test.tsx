/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import React from "react";
import { render, cleanup, fireEvent, waitForElement } from "@testing-library/react";
import { expect } from "chai";
import sinon from "sinon";
import { ColorPickerButton } from "../../ui-components/color/ColorPickerButton";
import { ColorByName, ColorDef } from "@bentley/imodeljs-common";

describe("<ColorPickerButton/>", () => {
  const colorDef = new ColorDef(ColorByName.blue);

  afterEach(cleanup);

  it("should render", () => {
    const renderedComponent = render(<ColorPickerButton activeColor={colorDef} />);
    expect(renderedComponent).not.to.be.undefined;
  });

  it("round swatches with title should render", () => {
    const renderedComponent = render(<ColorPickerButton activeColor={colorDef} round={true} />);
    expect(renderedComponent).not.to.be.undefined;
  });

  it("button press should open popup and allow color selection", async () => {
    const spyOnColorPick = sinon.spy();

    function handleColorPick(color: ColorDef): void {
      expect(color.tbgr).to.be.equal(ColorByName.red as number);
      spyOnColorPick();
    }

    const renderedComponent = render(<ColorPickerButton activeColor={colorDef} onColorPick={handleColorPick} dropDownTitle="test-title" />);
    expect(renderedComponent.getByTestId("components-colorpicker-button")).to.exist;
    const pickerButton = renderedComponent.getByTestId("components-colorpicker-button");
    // renderedComponent.debug();
    expect(pickerButton.tagName).to.be.equal("BUTTON");
    fireEvent.click(pickerButton);

    const popupDiv = await waitForElement(() => renderedComponent.getByTestId("components-colorpicker-popup-colors"));
    expect(popupDiv).not.to.be.undefined;

    if (popupDiv) {
      const title = renderedComponent.getByText("test-title");
      expect(title).not.to.be.undefined;

      const firstColorButton = popupDiv.firstChild as HTMLElement;
      expect(firstColorButton).not.to.be.undefined;
      fireEvent.click(firstColorButton);

      expect(spyOnColorPick).to.be.calledOnce;
    }
  });

  it("readonly - button press should not open popup", async () => {
    const renderedComponent = render(<ColorPickerButton activeColor={colorDef} colorDefs={[ColorDef.blue, ColorDef.black, ColorDef.red]} readonly={true} />);
    const pickerButton = renderedComponent.getByTestId("components-colorpicker-button");
    expect(pickerButton.tagName).to.be.equal("BUTTON");
    fireEvent.click(pickerButton);

    const corePopupDiv = renderedComponent.queryByTestId("core-popup");
    expect(corePopupDiv).not.to.be.undefined;
    if (corePopupDiv)
      expect(corePopupDiv.classList.contains("visible")).to.be.false;
  });

});
