/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import * as React from "react";
import { act, fireEvent, render, wait } from "@testing-library/react";
import { IModelApp, MockRender, QuantityType } from "@bentley/imodeljs-frontend";
import TestUtils from "../TestUtils";
import { QuantityFormatPanel } from "../../ui-components/quantityformat/QuantityFormatPanel";
import { FormatType, ScientificType, ShowSignOption } from "@bentley/imodeljs-quantity";
import { BearingQuantityType } from "./BearingQuantityType";

describe("QuantityInput", () => {
  const rnaDescriptorToRestore = Object.getOwnPropertyDescriptor(IModelApp, "requestNextAnimation")!;
  function requestNextAnimation() { }

  before(async () => {
    // Avoid requestAnimationFrame exception during test by temporarily replacing function that calls it.
    Object.defineProperty(IModelApp, "requestNextAnimation", {
      get: () => requestNextAnimation,
    });
    await TestUtils.initializeUiComponents();
    await MockRender.App.startup();
  });

  after(async () => {
    await MockRender.App.shutdown();
    TestUtils.terminateUiComponents();
    Object.defineProperty(IModelApp, "requestNextAnimation", rnaDescriptorToRestore);
  });

  it("should render basic panel", () => {
    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.Length}  />);
    expect(renderedComponent).not.to.be.null;
  });

  it("should render basic panel with sample", () => {
    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.Length} showSample initialMagnitude={123.45} />);
    expect(renderedComponent).not.to.be.null;
  });

  it("should render basic panel with more/less option", () => {
    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.Length} showSample initialMagnitude={123.45} enableMinimumProperties />);
    expect(renderedComponent).not.to.be.null;
  });

  it("should handle onFormatChange UOM separator", () => {
    const spy = sinon.spy();
    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.Length} showSample initialMagnitude={123.45} onFormatChange={spy} />);
    expect(renderedComponent).not.to.be.null;
    expect(spy).to.not.be.called;

    // change from default none to space
    fireEvent.change(renderedComponent.getByTestId("uom-separator-select"), {target: { value: " " }});
    expect(spy).to.be.called;
    spy.resetHistory();

    fireEvent.click(renderedComponent.getByTestId("show-unit-label-checkbox"));
    expect(spy).to.be.called;
    spy.resetHistory();
  });

  it("should handle onFormatChange Composite separator", () => {
    // default QuantityType.Length should show ft-in (ie composite)
    const spy = sinon.spy();
    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.Length} showSample initialMagnitude={123.45} onFormatChange={spy} />);
    expect(renderedComponent).not.to.be.null;
    expect(spy).to.not.be.called;

    // change from default none to space
    fireEvent.change(renderedComponent.getByTestId("composite-spacer"), {target: { value: "x" }});
    expect(spy).to.be.called;
    spy.resetHistory();
  });

  it("should handle onFormatChange Type selection", () => {
    const spy = sinon.spy();
    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.Length} showSample initialMagnitude={123.45} onFormatChange={spy} />);
    const typeSelector = renderedComponent.getByTestId("format-type-selector");

    // initially set to Fractional so we should get a change for each value
    [
      FormatType.Decimal.toString(),
      FormatType.Scientific.toString(),
      FormatType.Station.toString(),
      FormatType.Fractional.toString(),
    ].forEach ((selectValue) => {
      fireEvent.change(typeSelector, {target: { value: selectValue }});
      expect(spy).to.be.called;
      spy.resetHistory();
    });
  });

  it("should handle onFormatChange Fraction precision selection", () => {
    // QuantityType.Length by default is set to Type=Fraction
    const spy = sinon.spy();
    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.Length} showSample initialMagnitude={123.45} onFormatChange={spy} />);
    const precisionSelector = renderedComponent.getByTestId("fraction-precision-selector");

    ["1", "2", "4", "8", "16","32","64","128","256"].forEach ((selectValue) => {
      fireEvent.change(precisionSelector, {target: { value: selectValue }});
      expect(spy).to.be.called;
      spy.resetHistory();
    });
  });

  it("should handle onFormatChange Decimal precision selection", () => {
    const spy = sinon.spy();
    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.Length} showSample initialMagnitude={123.45} onFormatChange={spy} />);

    const typeSelector = renderedComponent.getByTestId("format-type-selector");
    fireEvent.change(typeSelector, {target: { value: FormatType.Decimal.toString() }});
    expect(spy).to.be.called;
    spy.resetHistory();

    const precisionSelector = renderedComponent.getByTestId("decimal-precision-selector");

    ["0", "1", "2", "3", "4","5","6","7","8","9","10","11","12"].forEach ((selectValue) => {
      fireEvent.change(precisionSelector, {target: { value: selectValue }});
      expect(spy).to.be.called;
      spy.resetHistory();
    });
  });

  it("should handle processing more/less", () => {
    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.Length} showSample initialMagnitude={123.45} enableMinimumProperties />);
    fireEvent.click(renderedComponent.getByTestId("quantityFormat-more"));
    fireEvent.click(renderedComponent.getByTestId("quantityFormat-less"));
  });

  it("should handle onFormatChange when changing sign option", () => {
    const spy = sinon.spy();
    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.Length} showSample initialMagnitude={123.45} onFormatChange={spy} />);

    const signOptionSelector = renderedComponent.getByTestId("sign-option-selector");
    [
      ShowSignOption.OnlyNegative.toString(),
      ShowSignOption.SignAlways.toString(),
      ShowSignOption.NegativeParentheses.toString(),
      ShowSignOption.NoSign.toString(),
    ].forEach ((selectValue) => {
      fireEvent.change(signOptionSelector, {target: { value: selectValue }});
      expect(spy).to.be.called;
      spy.resetHistory();
    });
  });

  it("should handle onFormatChange when changing station size option", () => {
    const spy = sinon.spy();
    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.Length} showSample initialMagnitude={123.45} onFormatChange={spy} />);

    // set to Station Type so selector is enabled
    const typeSelector = renderedComponent.getByTestId("format-type-selector");
    fireEvent.change(typeSelector, {target: { value: FormatType.Station.toString() }});
    expect(spy).to.be.called;
    spy.resetHistory();

    const sizeOptionSelector = renderedComponent.getByTestId("station-size-selector");
    ["3", "2" ].forEach ((selectValue) => {
      fireEvent.change(sizeOptionSelector, {target: { value: selectValue }});
      expect(spy).to.be.called;
      spy.resetHistory();
    });

    const separatorSelector = renderedComponent.getByTestId("station-separator-selector");
    ["-",    " ",    "^",    "+"].forEach ((selectValue) => {
      fireEvent.change(separatorSelector, {target: { value: selectValue }});
      expect(spy).to.be.called;
      spy.resetHistory();
    });
  });

  it("should handle onFormatChange when changing thousands separator", async () => {
    const spy = sinon.spy();
    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.Length} showSample initialMagnitude={12345.67} onFormatChange={spy} />);

    /* turn on */
    act(() => {
      fireEvent.click(renderedComponent.getByTestId("use-thousands-separator"));
    });
    await wait(() => {
      expect(spy).to.be.called;
      spy.resetHistory();
    });

    const typeSelector = renderedComponent.getByTestId("thousands-separator-selector");
    act(() => {
      fireEvent.change(typeSelector, {target: { value: "." }});
    });
    await wait(() => {
      expect(spy).to.be.called;
      spy.resetHistory();
      renderedComponent.getByText(`40.504'-2"`);
    });

    act(() => {
      fireEvent.change(typeSelector, {target: { value: "," }});
    });
    await wait(() => {
      expect(spy).to.be.called;
      spy.resetHistory();
      renderedComponent.getByText(`40,504'-2"`);
    });

    /* turn off */
    act(() => {
      fireEvent.click(renderedComponent.getByTestId("use-thousands-separator"));
    });
    await wait(() => {
      expect(spy).to.be.called;
      spy.resetHistory();
    });

  });

  it("should handle onFormatChange when changing decimal separator", () => {
    const spy = sinon.spy();
    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.Length} showSample initialMagnitude={12345.67} onFormatChange={spy} />);

    const typeSelector = renderedComponent.getByTestId("format-type-selector");
    fireEvent.change(typeSelector, {target: { value: FormatType.Decimal.toString() }});
    expect(spy).to.be.called;
    spy.resetHistory();

    const separatorSelector = renderedComponent.getByTestId("decimal-separator-selector");
    [",", "." ].forEach ((selectValue) => {
      fireEvent.change(separatorSelector, {target: { value: selectValue }});
      expect(spy).to.be.called;
      spy.resetHistory();
    });
  });

  it("should handle onFormatChange when changing traits", () => {
    const spy = sinon.spy();
    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.Length} showSample initialMagnitude={12345.67} onFormatChange={spy} />);

    // test fraction specific trait before changing type
    fireEvent.click(renderedComponent.getByTestId("fraction-dash"));
    expect(spy).to.be.called;
    spy.resetHistory();

    const typeSelector = renderedComponent.getByTestId("format-type-selector");
    fireEvent.change(typeSelector, {target: { value: FormatType.Decimal.toString() }});
    expect(spy).to.be.called;
    spy.resetHistory();

    fireEvent.click(renderedComponent.getByTestId("show-trail-zeros"));
    expect(spy).to.be.called;
    spy.resetHistory();

    fireEvent.click(renderedComponent.getByTestId("keep-decimal-point"));
    expect(spy).to.be.called;
    spy.resetHistory();

    fireEvent.click(renderedComponent.getByTestId("keep-single-zero"));
    expect(spy).to.be.called;
    spy.resetHistory();

    fireEvent.click(renderedComponent.getByTestId("zero-empty"));
    expect(spy).to.be.called;
    spy.resetHistory();

    fireEvent.change(typeSelector, {target: { value: FormatType.Scientific.toString() }});
    expect(spy).to.be.called;
    spy.resetHistory();

    const scientificTypeSelector = renderedComponent.getByTestId("scientific-type-selector");
    [ScientificType.ZeroNormalized.toString(), ScientificType.Normalized.toString()].forEach ((selectValue) => {
      fireEvent.change(scientificTypeSelector, {target: { value: selectValue }});
      expect(spy).to.be.called;
      spy.resetHistory();
    });
  });

  it("should handle onFormatChange when changing composite units", () => {
    const spy = sinon.spy();
    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.Length} showSample initialMagnitude={123.45} onFormatChange={spy} />);

    const secondaryUnitsSelector = renderedComponent.getByTestId("unit-Units.IN");
    fireEvent.change(secondaryUnitsSelector, {target: { value: "REMOVEUNIT" }});
    expect(spy).to.be.called;
    spy.resetHistory();
  });

  it("should handle onFormatChange when changing adding composite unit", () => {
    const spy = sinon.spy();
    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.LengthEngineering} showSample initialMagnitude={123.45} onFormatChange={spy} />);

    const primaryUnitSelector = renderedComponent.getByTestId("unit-Units.FT");
    fireEvent.change(primaryUnitSelector, {target: { value: "ADDSUBUNIT:Units.IN:in" }});
    expect(spy).to.be.called;
    spy.resetHistory();
  });

  it("should handle sample value change", async () => {
    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.LengthEngineering} showSample initialMagnitude={123.45} />);

    const sampleInput = renderedComponent.getByTestId("format-sample-input");
    act(() => {
      fireEvent.change(sampleInput, {target: { value: "729.32" }});
    });
    await wait(() => {
      fireEvent.keyDown(sampleInput, { key: "Enter", code: 13 });
      // renderedComponent.debug();
      renderedComponent.getByDisplayValue("729.32");
    });

    act(() => {
      fireEvent.change(sampleInput, {target: { value: "a" }});
    });
    await wait(() => {
      fireEvent.keyDown(sampleInput, { key: "Enter", code: 13 });
      renderedComponent.getByDisplayValue("0");
    });

    // cover update props case
    renderedComponent.rerender (<QuantityFormatPanel quantityType={QuantityType.LengthEngineering} showSample initialMagnitude={4} />);
    renderedComponent.getByDisplayValue("4");

    renderedComponent.rerender (<QuantityFormatPanel quantityType={QuantityType.LengthEngineering} showSample />);
    renderedComponent.getByDisplayValue("0");

    renderedComponent.rerender (<QuantityFormatPanel quantityType={QuantityType.LengthEngineering} showSample />);
    renderedComponent.getByDisplayValue("0");

    // renderedComponent.debug();
  });

  it("should handle onFormatChange when changing changing primary unit", async () => {
    const spy = sinon.spy();
    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.LengthEngineering} showSample initialMagnitude={123.45} onFormatChange={spy} />);
    const primaryUnitLabel = renderedComponent.getByTestId("unit-label-Units.FT");
    act(() => {
      fireEvent.change(primaryUnitLabel, {target: { value: "testfeet" }});
    });
    await wait(() => {
      renderedComponent.getByText(/testfeet/);
      expect(spy).to.be.called;
      spy.resetHistory();
    });

    const primaryUnitSelector = renderedComponent.getByTestId("unit-Units.FT");
    act(() => {
      fireEvent.change(primaryUnitSelector, {target: { value: "Units.YRD:yd" }});
    });
    await wait(() => {
      renderedComponent.getByTestId("unit-label-Units.YRD");
      expect(spy).to.be.called;
      spy.resetHistory();
    });

    // renderedComponent.debug();
  });

  describe("Properties from Custom Quantity Type are Rendered", () => {
    before(async () => {
    // register new QuantityType
      await BearingQuantityType.registerQuantityType ();
    });

    it("should handle onFormatChange when changing changing primary unit", () => {
      const spy = sinon.spy();
      const renderedComponent = render(<QuantityFormatPanel quantityType={"Bearing"} showSample initialMagnitude={1.45} onFormatChange={spy} />);

      const textField = renderedComponent.getByTestId("text-1-editor");
      fireEvent.change(textField, {target: { value: "Hello" }});
      expect(spy).to.be.called;
      spy.resetHistory();

      const checkboxField = renderedComponent.getByTestId("checkbox-0-editor");
      fireEvent.click(checkboxField);
      expect(spy).to.be.called;
      spy.resetHistory();

      const selectField = renderedComponent.getByTestId("select-0-editor");
      fireEvent.change(selectField, {target: { value: "counter-clockwise" }});
      expect(spy).to.be.called;
      spy.resetHistory();
    });

  });
});
