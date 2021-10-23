/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import React from "react";
import sinon from "sinon";
import { fireEvent, render } from "@testing-library/react";
import TestUtils from "../TestUtils";
import { DatePickerPopupButton } from "../../components-react/datepicker/DatePickerPopupButton";
import { SpecialKey, TimeDisplay } from "@itwin/appui-abstract";

describe("<DatePickerPopupButton />", () => {
  let renderSpy: sinon.SinonSpy;

  const testDate = new Date("July 22, 2018 07:22:13 -0400");
  const testDate2 = new Date("July 20, 1969");

  before(async () => {
    await TestUtils.initializeUiComponents();
  });

  beforeEach(() => {
    sinon.restore();
    renderSpy = sinon.spy();
  });

  after(() => {
    TestUtils.terminateUiComponents();
  });

  it("should render ", () => {
    const renderedComponent = render(<DatePickerPopupButton selected={testDate} buttonToolTip={"TEST_TOOLTIP"} />);
    expect(renderedComponent).not.to.be.null;
    renderedComponent.getByTitle("TEST_TOOLTIP");
  });

  it("should rerender with new props ", () => {
    const renderedComponent = render(<DatePickerPopupButton selected={testDate} />);
    expect(renderedComponent).not.to.be.null;
    renderedComponent.rerender(<DatePickerPopupButton selected={testDate2} />);
  });

  it("should render with edit field ", () => {
    const renderedComponent = render(<DatePickerPopupButton selected={testDate} displayEditField={true} />);
    expect(renderedComponent).not.to.be.null;
    renderedComponent.getByTestId("components-date-input");
  });

  it("should render popup ", async () => {
    const renderedComponent = render(<DatePickerPopupButton selected={testDate} onDateChange={renderSpy} />);
    expect(renderedComponent).not.to.be.null;
    const pickerButton = renderedComponent.getByTestId("components-date-picker-calendar-popup-button");
    expect(pickerButton.tagName).to.be.equal("BUTTON");
    fireEvent.pointerDown(pickerButton);
    const popupPanelDiv = renderedComponent.getByTestId("components-date-picker-calendar-popup-panel");
    expect(popupPanelDiv).not.to.be.undefined;

    const testDayTicks = new Date(2018, 6, 19).getTime();
    const dataValueSelector = `li[data-value='${testDayTicks}']`; // li[data-value='1531972800000']
    const dayEntry = popupPanelDiv.querySelector(dataValueSelector);
    expect(dayEntry).not.to.be.null;
    fireEvent.click(dayEntry!);
    expect(renderSpy).to.be.called;
    expect(renderedComponent.queryByTestId("components-date-picker-calendar-popup-panel")).to.be.null;
  });

  it("should render popup using keyboard ", async () => {
    const renderedComponent = render(<DatePickerPopupButton selected={testDate} onDateChange={renderSpy} />);
    expect(renderedComponent).not.to.be.null;
    const pickerButton = renderedComponent.getByTestId("components-date-picker-calendar-popup-button");
    expect(pickerButton.tagName).to.be.equal("BUTTON");
    fireEvent.keyDown(pickerButton, { key: SpecialKey.Space });

    const popupPanelDiv = renderedComponent.getByTestId("components-date-picker-calendar-popup-panel");
    expect(popupPanelDiv).not.to.be.undefined;

    const testDayTicks = new Date(2018, 6, 19).getTime();
    const dataValueSelector = `li[data-value='${testDayTicks}']`; // li[data-value='1531972800000']
    const dayEntry = popupPanelDiv.querySelector(dataValueSelector);
    expect(dayEntry).not.to.be.null;
    fireEvent.click(dayEntry!);
    expect(renderSpy).to.be.called;
    expect(renderedComponent.queryByTestId("components-date-picker-calendar-popup-panel")).to.be.null;
  });

  it("should render popup with time input ", async () => {
    const renderedComponent = render(<DatePickerPopupButton selected={testDate} timeDisplay={TimeDisplay.H12MC} onDateChange={renderSpy} />);
    expect(renderedComponent).not.to.be.null;
    const pickerButton = renderedComponent.getByTestId("components-date-picker-calendar-popup-button");
    expect(pickerButton.tagName).to.be.equal("BUTTON");
    fireEvent.pointerDown(pickerButton);
    const popupPanelDiv = renderedComponent.getByTestId("components-date-picker-calendar-popup-panel");
    expect(popupPanelDiv).not.to.be.undefined;
    const timeInputContainer = renderedComponent.getByTestId("components-time-input");
    const inputs = timeInputContainer.querySelectorAll("input");
    expect(inputs.length).to.eq(3);
    const hour = inputs[0];
    fireEvent.keyDown(hour, { key: SpecialKey.ArrowUp });
    expect(renderSpy).to.be.called;
  });
});
