/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import React from "react";
import sinon from "sinon";
import { ColorByName, ColorDef } from "@itwin/core-common";
import { fireEvent, render } from "@testing-library/react";
import { RelativePosition, SpecialKey } from "@itwin/appui-abstract";
import { TestUtils } from "../TestUtils";
import { ColorPickerPopup } from "../../imodel-components-react/color/ColorPickerPopup";

describe("<ColorPickerPopup/>", () => {
  const colorDef = ColorDef.create(ColorByName.blue);

  before(async () => {
    await TestUtils.initializeUiIModelComponents();
  });

  after(() => {
    TestUtils.terminateUiIModelComponents();
  });

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

    const popupDiv = renderedComponent.getByTestId("components-colorpicker-panel");
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
    expect(pickerButton.tagName).to.be.equal("BUTTON");
    fireEvent.click(pickerButton);

    const popupDiv = renderedComponent.getByTestId("components-colorpicker-panel");
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
    expect(pickerButton.tagName).to.be.equal("BUTTON");
    fireEvent.click(pickerButton);

    const popupDiv = renderedComponent.getByTestId("components-colorpicker-panel");
    expect(popupDiv).not.to.be.undefined;

    if (popupDiv) {
      const colorSwatch = popupDiv.querySelector("button.components-colorpicker-panel-swatch") as HTMLElement;
      expect(colorSwatch).not.to.be.null;
      fireEvent.click(colorSwatch);
    }

    fireEvent.click(pickerButton); /* close popup */
    expect(spyOnColorPopupClosed).to.be.calledOnce;
  });

  it("captureClicks property should stop mouse click propagation", async () => {
    const spyOnClick = sinon.spy();

    /* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
    const renderedComponent = render(<div onClick={spyOnClick}>
      <ColorPickerPopup initialColor={colorDef} popupPosition={RelativePosition.BottomRight} colorDefs={[ColorDef.green, ColorDef.black, ColorDef.red]} captureClicks={true} />
    </div>);
    const pickerButton = renderedComponent.getByTestId("components-colorpicker-popup-button");
    fireEvent.click(pickerButton);
    expect(spyOnClick).not.to.be.called;

    const popupDiv = renderedComponent.getByTestId("components-colorpicker-panel");
    expect(popupDiv).not.to.be.undefined;

    if (popupDiv) {
      const colorSwatch = popupDiv.querySelector("button.components-colorpicker-panel-swatch") as HTMLElement;
      expect(colorSwatch).not.to.be.null;
      fireEvent.click(colorSwatch);
    }
    expect(spyOnClick).not.to.be.called;
  });

  it("mouse click should propagate if captureClicks not set to true", async () => {
    const spyOnClick = sinon.spy();

    /* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
    const renderedComponent = render(<div onClick={spyOnClick}>
      <ColorPickerPopup initialColor={colorDef} popupPosition={RelativePosition.BottomRight} colorDefs={[ColorDef.green, ColorDef.black, ColorDef.red]} />
    </div>);
    const pickerButton = renderedComponent.getByTestId("components-colorpicker-popup-button");
    fireEvent.click(pickerButton);
    expect(spyOnClick).to.be.called;

    const popupDiv = renderedComponent.getByTestId("components-colorpicker-panel");
    expect(popupDiv).not.to.be.undefined;

    if (popupDiv) {
      const colorSwatch = popupDiv.querySelector("button.components-colorpicker-panel-swatch") as HTMLElement;
      expect(colorSwatch).not.to.be.null;
      fireEvent.click(colorSwatch);
    }
    expect(spyOnClick).to.be.calledTwice;
  });

  it("ensure update prop is handled", async () => {
    /* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
    const renderedComponent = render(<div>
      <ColorPickerPopup initialColor={colorDef} popupPosition={RelativePosition.BottomRight} colorDefs={[ColorDef.green, ColorDef.black, ColorDef.red]} />
    </div>);
    let colorSwatch = renderedComponent.container.querySelector("div.components-colorpicker-button-color-swatch") as HTMLElement;
    expect(colorSwatch.style.backgroundColor).to.eql("rgb(0, 0, 255)");
    // ensure update prop is handled
    const newColorDef = ColorDef.create(ColorByName.green); // green = 0x008000,
    renderedComponent.rerender(<div><ColorPickerPopup initialColor={newColorDef} popupPosition={RelativePosition.BottomRight} colorDefs={[ColorDef.green, ColorDef.black, ColorDef.red]} /></div>);
    colorSwatch = renderedComponent.container.querySelector("div.components-colorpicker-button-color-swatch") as HTMLElement;
    expect(colorSwatch.style.backgroundColor).to.eql("rgb(0, 128, 0)");
  });

  it("ensure closing X is shown", async () => {
    const spyOnClick = sinon.spy();

    /* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
    const renderedComponent = render(<div>
      <ColorPickerPopup initialColor={colorDef} popupPosition={RelativePosition.BottomRight}
        colorDefs={[ColorDef.green, ColorDef.black, ColorDef.red]} captureClicks={true} onClick={spyOnClick} />
    </div>);
    const pickerButton = renderedComponent.getByTestId("components-colorpicker-popup-button");
    fireEvent.click(pickerButton);

    const popupDiv = renderedComponent.getByTestId("components-colorpicker-panel");
    expect(popupDiv).not.to.be.undefined;

    const closeButton = renderedComponent.getByTestId("core-dialog-close");
    fireEvent.click(closeButton);
    await TestUtils.flushAsyncOperations();

    expect(renderedComponent.container.querySelector("button.core-dialog-close")).to.be.null;
  });

  it("ensure closing X is NOT shown", async () => {
    const spyOnClick = sinon.spy();

    /* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
    const renderedComponent = render(<div>
      <ColorPickerPopup initialColor={colorDef} popupPosition={RelativePosition.BottomRight} hideCloseButton
        colorDefs={[ColorDef.green, ColorDef.black, ColorDef.red]} captureClicks={true} onClick={spyOnClick} />
    </div>);
    const pickerButton = renderedComponent.getByTestId("components-colorpicker-popup-button");
    fireEvent.click(pickerButton);

    const popupDiv = renderedComponent.getByTestId("components-colorpicker-panel");
    expect(popupDiv).not.to.be.undefined;

    expect(popupDiv.querySelector("button.core-dialog-close")).to.be.null;
  });

  it("ensure rgb values are shown", async () => {
    const spyOnClick = sinon.spy();
    const spyOnChange = sinon.spy();

    /* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
    const renderedComponent = render(<div>
      <ColorPickerPopup initialColor={colorDef} popupPosition={RelativePosition.BottomRight} colorInputType="RGB"
        colorDefs={[ColorDef.green, ColorDef.black, ColorDef.red]} captureClicks={true} onClick={spyOnClick} onColorChange={spyOnChange} />
    </div>);
    const pickerButton = renderedComponent.getByTestId("components-colorpicker-popup-button");
    fireEvent.click(pickerButton);

    const popupDiv = renderedComponent.getByTestId("components-colorpicker-panel");
    expect(popupDiv).not.to.be.undefined;

    const redInput = renderedComponent.getByTestId("components-colorpicker-input-value-red");
    fireEvent.change(redInput, { target: { value: "100" } });
    expect((redInput as HTMLInputElement).value).to.eq("100");
    fireEvent.keyDown(redInput, { key: SpecialKey.Enter });
    spyOnChange.calledOnce.should.be.true;

    spyOnChange.resetHistory();
    const greenInput = renderedComponent.getByTestId("components-colorpicker-input-value-green");
    fireEvent.change(greenInput, { target: { value: "100" } });
    expect((greenInput as HTMLInputElement).value).to.eq("100");
    fireEvent.keyDown(greenInput, { key: SpecialKey.Enter });
    spyOnChange.calledOnce.should.be.true;

    spyOnChange.resetHistory();
    const blueInput = renderedComponent.getByTestId("components-colorpicker-input-value-blue");
    fireEvent.change(blueInput, { target: { value: "100" } });
    expect((blueInput as HTMLInputElement).value).to.eq("100");
    fireEvent.keyDown(blueInput, { key: SpecialKey.Enter });
    spyOnChange.calledOnce.should.be.true;
  });

  it("ensure hsl values are shown", async () => {
    const spyOnClick = sinon.spy();
    const spyOnChange = sinon.spy();

    /* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
    const renderedComponent = render(<div>
      <ColorPickerPopup initialColor={colorDef} popupPosition={RelativePosition.BottomRight} colorInputType="HSL"
        colorDefs={[ColorDef.green, ColorDef.black, ColorDef.red]} captureClicks={true} onClick={spyOnClick} onColorChange={spyOnChange} />
    </div>);
    const pickerButton = renderedComponent.getByTestId("components-colorpicker-popup-button");
    fireEvent.click(pickerButton);

    const popupDiv = renderedComponent.getByTestId("components-colorpicker-panel");
    expect(popupDiv).not.to.be.undefined;

    const hueInput = renderedComponent.getByTestId("components-colorpicker-input-value-hue");
    fireEvent.change(hueInput, { target: { value: "100" } });
    expect((hueInput as HTMLInputElement).value).to.eq("100");
    fireEvent.keyDown(hueInput, { key: SpecialKey.Enter });
    spyOnChange.calledOnce.should.be.true;

    spyOnChange.resetHistory();
    const saturationInput = renderedComponent.getByTestId("components-colorpicker-input-value-saturation");
    fireEvent.change(saturationInput, { target: { value: "50" } });
    expect((saturationInput as HTMLInputElement).value).to.eq("50");
    fireEvent.keyDown(saturationInput, { key: SpecialKey.Enter });
    spyOnChange.calledOnce.should.be.true;

    spyOnChange.resetHistory();
    const lightnessInput = renderedComponent.getByTestId("components-colorpicker-input-value-lightness");
    fireEvent.change(lightnessInput, { target: { value: "40" } });
    expect((lightnessInput as HTMLInputElement).value).to.eq("40");
    fireEvent.keyDown(lightnessInput, { key: SpecialKey.Enter });
    spyOnChange.calledOnce.should.be.true;
  });

});
