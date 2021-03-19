/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import React from "react";
import sinon from "sinon";
import { ColorByName, ColorDef } from "@bentley/imodeljs-common";
import { cleanup, fireEvent, render, waitForElement } from "@testing-library/react";
import { ColorPickerButton } from "../../ui-components/color/ColorPickerButton";

// cSpell:ignore colorpicker

describe("<ColorPickerButton/>", () => {
  const colorDef = ColorDef.create(ColorByName.blue);

  afterEach(cleanup);

  it("should render", () => {
    const renderedComponent = render(<ColorPickerButton initialColor={colorDef} />);
    expect(renderedComponent).not.to.be.undefined;
    expect(renderedComponent.container.querySelector(".components-caret")).to.be.null;
  });

  it("should render with caret", () => {
    const renderedComponent = render(<ColorPickerButton initialColor={colorDef} showCaret />);
    expect(renderedComponent).not.to.be.undefined;
    expect(renderedComponent.container.querySelector(".components-caret")).not.to.be.null;
  });

  it("should re-render properly when initial color prop changes", () => {
    const renderedComponent = render(<ColorPickerButton initialColor={colorDef} />);
    expect(renderedComponent).not.to.be.undefined;
    const button = renderedComponent.getByTestId("components-colorpicker-button");
    expect(button.getAttribute("data-value")).to.eq("rgb(0,0,255)");  // blue

    const newColorDef = ColorDef.create(ColorByName.red);
    renderedComponent.rerender(<ColorPickerButton initialColor={newColorDef} />);
    expect(renderedComponent).not.to.be.undefined;
    expect(button.getAttribute("data-value")).to.eq("rgb(255,0,0)"); // red

    const colorDefWithAlpha = ColorDef.create(0x80ff0000);
    renderedComponent.rerender(<ColorPickerButton initialColor={colorDefWithAlpha} />);
    expect(renderedComponent).not.to.be.undefined;
    expect(button.getAttribute("data-value")).to.eq("rgba(0,0,255,0.50)"); // blue with alpha
  });

  it("round swatches with title should render", () => {
    const renderedComponent = render(<ColorPickerButton initialColor={colorDef} round={true} />);
    expect(renderedComponent).not.to.be.undefined;
  });

  it("button press should open popup and allow color selection", async () => {
    const spyOnColorPick = sinon.spy();

    function handleColorPick(color: ColorDef): void {
      expect(color.tbgr).to.be.equal(ColorByName.red as number);
      spyOnColorPick();
    }

    const renderedComponent = render(<ColorPickerButton initialColor={colorDef} onColorPick={handleColorPick} dropDownTitle="test-title" showCaret />);
    const button = renderedComponent.getByTestId("components-colorpicker-button");
    expect(button.getAttribute("data-value")).to.eq("rgb(0,0,255)");  // blue
    expect(renderedComponent.container.querySelector(".icon-caret-down")).not.to.be.null;
    fireEvent.click(button);
    expect(renderedComponent.container.querySelector(".icon-caret-up")).not.to.be.null;

    const popupDiv = await waitForElement(() => renderedComponent.getByTestId("components-colorpicker-popup-colors"));
    expect(popupDiv).not.to.be.undefined;

    if (popupDiv) {
      const title = renderedComponent.getByText("test-title");
      expect(title).not.to.be.undefined;

      const firstColorButton = popupDiv.firstChild as HTMLElement;
      expect(firstColorButton).not.to.be.undefined;
      fireEvent.click(firstColorButton);

      expect(spyOnColorPick).to.be.calledOnce;
      expect(button.getAttribute("data-value")).to.eq("rgb(255,0,0)"); // red
    }
  });

  it("readonly - button press should not open popup", async () => {
    const renderedComponent = render(<ColorPickerButton initialColor={colorDef} colorDefs={[ColorDef.blue, ColorDef.black, ColorDef.red]} readonly={true} />);
    const pickerButton = renderedComponent.getByTestId("components-colorpicker-button");
    expect(pickerButton.tagName).to.be.equal("BUTTON");
    fireEvent.click(pickerButton);

    const corePopupDiv = renderedComponent.queryByTestId("core-popup");
    expect(corePopupDiv).not.to.be.undefined;
    if (corePopupDiv)
      expect(corePopupDiv.classList.contains("visible")).to.be.false;
  });

});
