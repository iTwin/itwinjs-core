/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import React from "react";
import sinon from "sinon";
import { ColorByName, ColorDef } from "@bentley/imodeljs-common";
import { cleanup, fireEvent, render, waitForElement } from "@testing-library/react";
import { ColorPickerPopup } from "../../ui-components/color/ColorPickerPopup";
import TestUtils from "../TestUtils";
import { RelativePosition } from "@bentley/ui-abstract";

describe("<ColorPickerPopup/>", () => {
  const colorDef = ColorDef.create(ColorByName.blue);

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  after(() => {
    TestUtils.terminateUiComponents();
  });

  afterEach(cleanup);

  it("should render", () => {
    const renderedComponent = render(<ColorPickerPopup initialColor={colorDef} />);
    expect(renderedComponent).not.to.be.undefined;
    expect(renderedComponent.container.querySelector(".components-caret")).to.be.null;
  });

  it("should render with caret", () => {
    const renderedComponent = render(<ColorPickerPopup initialColor={colorDef} showCaret />);
    expect(renderedComponent).not.to.be.undefined;
    expect(renderedComponent.container.querySelector(".components-caret")).not.to.be.null;
  });

  it("button press should open popup and allow color selection", async () => {
    const spyOnColorPick = sinon.spy();

    function handleColorPick(color: ColorDef): void {
      expect(color.tbgr).to.be.equal(ColorByName.red as number);
      spyOnColorPick();
    }

    const renderedComponent = render(<ColorPickerPopup initialColor={colorDef} onColorChange={handleColorPick} showCaret />);
    expect(renderedComponent.getByTestId("components-colorpicker-popup-button")).to.exist;
    const pickerButton = renderedComponent.getByTestId("components-colorpicker-popup-button");
    expect(pickerButton.tagName).to.be.equal("BUTTON");
    expect(renderedComponent.container.querySelector(".icon-caret-down")).not.to.be.null;
    fireEvent.click(pickerButton);
    expect(renderedComponent.container.querySelector(".icon-caret-up")).not.to.be.null;

    const popupDiv = await waitForElement(() => renderedComponent.getByTestId("components-colorpicker-panel"));
    expect(popupDiv).not.to.be.undefined;

    if (popupDiv) {
      const colorSwatch = popupDiv.querySelector("button.components-colorpicker-panel-swatch") as HTMLElement;
      expect(colorSwatch).not.to.be.null;
      fireEvent.click(colorSwatch);
      expect(spyOnColorPick).to.be.calledOnce;
    }
  });

  it("button press should open popup and allow color selection of specified preset", async () => {
    const spyOnColorPick = sinon.spy();

    function handleColorPick(color: ColorDef): void {
      expect(color.tbgr).to.be.equal(ColorByName.green as number);
      spyOnColorPick();
    }

    const renderedComponent = render(<ColorPickerPopup initialColor={colorDef} popupPosition={RelativePosition.BottomRight} colorDefs={[ColorDef.green, ColorDef.black, ColorDef.red]} onColorChange={handleColorPick} />);
    expect(renderedComponent.getByTestId("components-colorpicker-popup-button")).to.exist;
    const pickerButton = renderedComponent.getByTestId("components-colorpicker-popup-button");
    // renderedComponent.debug();
    expect(pickerButton.tagName).to.be.equal("BUTTON");
    fireEvent.click(pickerButton);

    const popupDiv = await waitForElement(() => renderedComponent.getByTestId("components-colorpicker-panel"));
    expect(popupDiv).not.to.be.undefined;

    if (popupDiv) {
      const colorSwatch = popupDiv.querySelector("button.components-colorpicker-panel-swatch") as HTMLElement;
      expect(colorSwatch).not.to.be.null;
      fireEvent.click(colorSwatch);
      expect(spyOnColorPick).to.be.calledOnce;
    }
  });

  it("readonly - button press should not open popup", async () => {
    const renderedComponent = render(<ColorPickerPopup initialColor={colorDef} colorDefs={[ColorDef.blue, ColorDef.black, ColorDef.red]} readonly={true} />);
    const pickerButton = renderedComponent.getByTestId("components-colorpicker-popup-button");
    expect(pickerButton.tagName).to.be.equal("BUTTON");
    fireEvent.click(pickerButton);

    const corePopupDiv = renderedComponent.queryByTestId("core-popup");
    expect(corePopupDiv).not.to.be.null;
    if (corePopupDiv)
      expect(corePopupDiv.classList.contains("visible")).to.be.false;
  });

  it("button press should open popup and allow trigger color selection when popup closed", async () => {
    const spyOnColorPopupClosed = sinon.spy();

    function handleColorPopupClosed(color: ColorDef): void {
      expect(color.tbgr).to.be.equal(ColorDef.green.tbgr);
      spyOnColorPopupClosed();
    }

    const renderedComponent = render(<ColorPickerPopup initialColor={colorDef} popupPosition={RelativePosition.BottomRight} colorDefs={[ColorDef.green, ColorDef.black, ColorDef.red]} onClose={handleColorPopupClosed} />);
    expect(renderedComponent.getByTestId("components-colorpicker-popup-button")).to.exist;
    const pickerButton = renderedComponent.getByTestId("components-colorpicker-popup-button");
    // renderedComponent.debug();
    expect(pickerButton.tagName).to.be.equal("BUTTON");
    fireEvent.click(pickerButton);

    const popupDiv = await waitForElement(() => renderedComponent.getByTestId("components-colorpicker-panel"));
    expect(popupDiv).not.to.be.undefined;

    if (popupDiv) {
      const colorSwatch = popupDiv.querySelector("button.components-colorpicker-panel-swatch") as HTMLElement;
      expect(colorSwatch).not.to.be.null;
      fireEvent.click(colorSwatch);
    }

    fireEvent.click(pickerButton); /* close popup */
    expect(spyOnColorPopupClosed).to.be.calledOnce;
  });

  it("captureClicks property should stop mouse click propagation", async () =>{
    const spyOnClick = sinon.spy();

    /* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
    const renderedComponent = render(<div onClick={spyOnClick}>
      <ColorPickerPopup initialColor={colorDef} popupPosition={RelativePosition.BottomRight} colorDefs={[ColorDef.green, ColorDef.black, ColorDef.red]} captureClicks={true} />
    </div>);
    const pickerButton = renderedComponent.getByTestId("components-colorpicker-popup-button");
    fireEvent.click(pickerButton);
    expect(spyOnClick).not.to.be.called;

    const popupDiv = await waitForElement(() => renderedComponent.getByTestId("components-colorpicker-panel"));
    expect(popupDiv).not.to.be.undefined;

    if (popupDiv) {
      const colorSwatch = popupDiv.querySelector("button.components-colorpicker-panel-swatch") as HTMLElement;
      expect(colorSwatch).not.to.be.null;
      fireEvent.click(colorSwatch);
    }
    expect(spyOnClick).not.to.be.called;
  });

  it("mouse click should propagate if captureClicks not set to true", async () =>{
    const spyOnClick = sinon.spy();

    /* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
    const renderedComponent = render(<div onClick={spyOnClick}>
      <ColorPickerPopup initialColor={colorDef} popupPosition={RelativePosition.BottomRight} colorDefs={[ColorDef.green, ColorDef.black, ColorDef.red]} />
    </div>);
    const pickerButton = renderedComponent.getByTestId("components-colorpicker-popup-button");
    fireEvent.click(pickerButton);
    expect(spyOnClick).to.be.called;

    const popupDiv = await waitForElement(() => renderedComponent.getByTestId("components-colorpicker-panel"));
    expect(popupDiv).not.to.be.undefined;

    if (popupDiv) {
      const colorSwatch = popupDiv.querySelector("button.components-colorpicker-panel-swatch") as HTMLElement;
      expect(colorSwatch).not.to.be.null;
      fireEvent.click(colorSwatch);
    }
    expect(spyOnClick).to.be.calledTwice;
  });
});
