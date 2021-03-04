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
import { FormatProps, FormatType, ScientificType, ShowSignOption } from "@bentley/imodeljs-quantity";
import { BearingQuantityType } from "./BearingQuantityType";
import { SpecialKey } from "@bentley/ui-abstract";

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

  it("should render new sample when format is changed", async () => {
    const overrideLengthFormat: FormatProps = {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [{ label: "in", name: "Units.IN" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    };
    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.Length} showSample initialMagnitude={123.45} enableMinimumProperties />);
    await TestUtils.flushAsyncOperations();
    const spanElement = renderedComponent.getByTestId("format-sample-formatted") as HTMLSpanElement;
    expect(spanElement.textContent).to.be.eql (`405'-0 1/4"`);
    await IModelApp.quantityFormatter.setOverrideFormat(QuantityType.Length, overrideLengthFormat);
    renderedComponent.rerender(<QuantityFormatPanel quantityType={QuantityType.Length} showSample initialMagnitude={123.45} enableMinimumProperties />);
    await TestUtils.flushAsyncOperations();
    expect(spanElement.textContent).to.be.eql ("4860.2362 in");
    await IModelApp.quantityFormatter.clearOverrideFormats(QuantityType.Length);
  });

  it("should handle onFormatChange UOM separator", async () => {
    const spy = sinon.spy();
    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.Length} showSample initialMagnitude={123.45} onFormatChange={spy} />);
    expect(renderedComponent).not.to.be.null;
    expect(spy).to.not.be.called;
    const spanElement = renderedComponent.getByTestId("format-sample-formatted") as HTMLSpanElement;

    // change from default none to space
    fireEvent.change(renderedComponent.getByTestId("uom-separator-select"), {target: { value: " " }});
    expect(spy).to.be.called;
    spy.resetHistory();
    await TestUtils.flushAsyncOperations();
    expect(spanElement.textContent).to.be.eql (`405 '-0 1/4 "`);

    // change from default none to space
    fireEvent.change(renderedComponent.getByTestId("uom-separator-select"), {target: { value: "" }});
    expect(spy).to.be.called;
    spy.resetHistory();
    await TestUtils.flushAsyncOperations();
    expect(spanElement.textContent).to.be.eql (`405'-0 1/4"`);

    fireEvent.click(renderedComponent.getByTestId("show-unit-label-checkbox"));
    expect(spy).to.be.called;
    spy.resetHistory();
    await TestUtils.flushAsyncOperations();
    expect(spanElement.textContent).to.be.eql (`405:-0 1/4`);  // TODO does this match Native formatter?

    fireEvent.click(renderedComponent.getByTestId("show-unit-label-checkbox"));
    expect(spy).to.be.called;
    spy.resetHistory();
    await TestUtils.flushAsyncOperations();
    expect(spanElement.textContent).to.be.eql (`405'-0 1/4"`);
  });

  it("should handle onFormatChange Composite separator", async () => {
    // default QuantityType.Length should show ft-in (ie composite)
    const spy = sinon.spy();
    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.Length} showSample initialMagnitude={123.45} onFormatChange={spy} />);
    expect(spy).to.not.be.called;
    await TestUtils.flushAsyncOperations();

    const spanElement = renderedComponent.getByTestId("format-sample-formatted") as HTMLSpanElement;
    expect(spanElement.textContent).to.be.eql (`405'-0 1/4"`);

    // change from default none to space
    fireEvent.change(renderedComponent.getByTestId("composite-spacer"), {target: { value: "x" }});
    await TestUtils.flushAsyncOperations();
    expect(spanElement.textContent).to.be.eql (`405'x0 1/4"`);

    expect(spy).to.be.called;
    spy.resetHistory();

    // change from default none to space
    fireEvent.change(renderedComponent.getByTestId("composite-spacer"), {target: { value: "xxx" }});
    await TestUtils.flushAsyncOperations();
    expect(spanElement.textContent).to.be.eql (`405'x0 1/4"`);

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

  it("should handle onFormatChange Type selection (metric)", async () => {
    const spy = sinon.spy();
    const system = IModelApp.quantityFormatter.activeUnitSystem;
    await IModelApp.quantityFormatter.setActiveUnitSystem (system==="imperial"?"metric": "imperial") ;

    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.Stationing} showSample initialMagnitude={123.45} onFormatChange={spy} />);
    const typeSelector = renderedComponent.getByTestId("format-type-selector");

    // initially set to Station for metric stationing so we should get a change for each value
    [
      FormatType.Fractional.toString(),
      FormatType.Decimal.toString(),
      FormatType.Scientific.toString(),
      FormatType.Station.toString(),
    ].forEach (async (selectValue) => {
      fireEvent.change(typeSelector, {target: { value: selectValue }});
      expect(spy).to.be.called;
      await TestUtils.flushAsyncOperations();
      spy.resetHistory();
    });

    await IModelApp.quantityFormatter.setActiveUnitSystem (system) ;
  });

  it("should handle onFormatChange Type selection (numeric format)", async () => {
    const nonCompositeFormat: FormatProps = {
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    };

    const spy = sinon.spy();
    await IModelApp.quantityFormatter.setOverrideFormat(QuantityType.Length, nonCompositeFormat);
    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.Length} showSample initialMagnitude={123.45} onFormatChange={spy} />);
    const typeSelector = renderedComponent.getByTestId("format-type-selector");

    // initially set to Station for metric stationing so we should get a change for each value
    [
      FormatType.Fractional.toString(),
      FormatType.Decimal.toString(),
      FormatType.Scientific.toString(),
      FormatType.Station.toString(),
    ].forEach (async (selectValue) => {
      fireEvent.change(typeSelector, {target: { value: selectValue }});
      expect(spy).to.be.called;
      await TestUtils.flushAsyncOperations();
      spy.resetHistory();
    });

    await IModelApp.quantityFormatter.clearOverrideFormats(QuantityType.Length);
  });

  it("should render new sample when format is changed", async () => {
    const overrideLengthFormat: FormatProps = {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [{ label: "in", name: "Units.IN" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    };
    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.Length} showSample initialMagnitude={123.45} enableMinimumProperties />);
    await TestUtils.flushAsyncOperations();
    const spanElement = renderedComponent.getByTestId("format-sample-formatted") as HTMLSpanElement;
    expect(spanElement.textContent).to.be.eql (`405'-0 1/4"`);
    await IModelApp.quantityFormatter.setOverrideFormat(QuantityType.Length, overrideLengthFormat);
    renderedComponent.rerender(<QuantityFormatPanel quantityType={QuantityType.Length} showSample initialMagnitude={123.45} enableMinimumProperties />);
    await TestUtils.flushAsyncOperations();
    expect(spanElement.textContent).to.be.eql ("4860.2362 in");
    await IModelApp.quantityFormatter.clearOverrideFormats(QuantityType.Length);
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

  it("should handle processing more/less", async () => {
    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.Length} showSample initialMagnitude={123.45} enableMinimumProperties />);
    fireEvent.click(renderedComponent.getByTestId("quantityFormat-more"));
    await TestUtils.flushAsyncOperations();

    fireEvent.click(renderedComponent.getByTestId("quantityFormat-less"));
    await TestUtils.flushAsyncOperations();

    fireEvent.keyUp(renderedComponent.getByTestId("quantityFormat-more"), { key: SpecialKey.Enter });
    await TestUtils.flushAsyncOperations();

    fireEvent.keyUp(renderedComponent.getByTestId("quantityFormat-less"), { key: SpecialKey.Space });
    await TestUtils.flushAsyncOperations();
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
    await TestUtils.flushAsyncOperations();

    /* turn on */
    fireEvent.click(renderedComponent.getByTestId("use-thousands-separator"));
    await TestUtils.flushAsyncOperations();
    expect(spy).to.be.called;
    spy.resetHistory();

    const typeSelector = renderedComponent.getByTestId("thousands-separator-selector");
    fireEvent.change(typeSelector, {target: { value: "." }});
    await TestUtils.flushAsyncOperations();

    /* turn off */
    fireEvent.click(renderedComponent.getByTestId("use-thousands-separator"));
    await TestUtils.flushAsyncOperations();
    expect(spy).to.be.called;
    spy.resetHistory();

    /* turn on */
    fireEvent.click(renderedComponent.getByTestId("use-thousands-separator"));
    await TestUtils.flushAsyncOperations();
    expect(spy).to.be.called;
    spy.resetHistory();
    renderedComponent.getByText(`40.504'-2"`);

    fireEvent.change(typeSelector, {target: { value: "," }});
    await TestUtils.flushAsyncOperations();
    expect(spy).to.be.called;
    spy.resetHistory();
    renderedComponent.getByText(`40,504'-2"`);
  });

  it("should handle onFormatChange when changing decimal separator", async () => {
    const spy = sinon.spy();
    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.Length} showSample initialMagnitude={12345.67} onFormatChange={spy} />);
    await TestUtils.flushAsyncOperations();

    const typeSelector = renderedComponent.getByTestId("format-type-selector");
    fireEvent.change(typeSelector, {target: { value: FormatType.Decimal.toString() }});
    await TestUtils.flushAsyncOperations();

    expect(spy).to.be.called;
    spy.resetHistory();

    /* turn on 1000 separator */
    fireEvent.click(renderedComponent.getByTestId("use-thousands-separator"));
    await TestUtils.flushAsyncOperations();
    expect(spy).to.be.called;
    spy.resetHistory();

    const separatorSelector = renderedComponent.getByTestId("decimal-separator-selector");
    fireEvent.change(separatorSelector, {target: { value: "," }});
    await TestUtils.flushAsyncOperations();
    expect(spy).to.be.called;
    spy.resetHistory();

    fireEvent.change(separatorSelector, {target: { value: "." }});
    await TestUtils.flushAsyncOperations();
    expect(spy).to.be.called;
    spy.resetHistory();
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

  it("should handle onFormatChange when changing composite units", async () => {
    const spy = sinon.spy();
    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.Length} showSample initialMagnitude={123.45} onFormatChange={spy} />);
    await TestUtils.flushAsyncOperations();

    const secondaryUnitsSelector = renderedComponent.getByTestId("unit-Units.IN");
    fireEvent.change(secondaryUnitsSelector, {target: { value: "REMOVEUNIT" }});
    await TestUtils.flushAsyncOperations();
    expect(spy).to.be.called;
    spy.resetHistory();
  });

  it("should handle onFormatChange when changing adding composite unit", async () => {
    const spy = sinon.spy();
    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.LengthEngineering} showSample initialMagnitude={123.45} onFormatChange={spy} />);
    await TestUtils.flushAsyncOperations();

    const primaryUnitSelector = renderedComponent.getByTestId("unit-Units.FT");
    fireEvent.change(primaryUnitSelector, {target: { value: "Units.IN:in" }});
    await TestUtils.flushAsyncOperations();
    expect(spy).to.be.called;
    spy.resetHistory();
  });

  it("should handle onFormatChange when changing primary unit", async () => {
    const spy = sinon.spy();
    const renderedComponent = render(<QuantityFormatPanel quantityType={QuantityType.LengthEngineering} showSample initialMagnitude={123.45} onFormatChange={spy} />);
    await TestUtils.flushAsyncOperations();

    const primaryUnitSelector = renderedComponent.getByTestId("unit-Units.FT");
    fireEvent.change(primaryUnitSelector, {target: { value: "ADDSUBUNIT:Units.IN:in" }});
    await TestUtils.flushAsyncOperations();
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

    sampleInput.focus();
    fireEvent.change(sampleInput, { target: { value: "14.12" } });
    sampleInput.blur();
    await TestUtils.flushAsyncOperations();
    renderedComponent.getByDisplayValue("14.12");

    sampleInput.focus();
    fireEvent.change(sampleInput, { target: { value: "a" } });
    sampleInput.blur();
    await TestUtils.flushAsyncOperations();
    renderedComponent.getByDisplayValue("0");

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
