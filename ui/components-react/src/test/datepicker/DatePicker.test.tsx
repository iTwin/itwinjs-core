/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import React from "react";
import sinon from "sinon";
import { fireEvent, render } from "@testing-library/react";
import TestUtils from "../TestUtils";
import { DatePicker } from "../../components-react/datepicker/DatePicker";
import { SpecialKey } from "@itwin/appui-abstract";
import { adjustDateToTimezone } from "../../components-react/common/DateUtils";

describe("<DatePicker />", () => {
  let renderSpy: sinon.SinonSpy;

  const testDate = new Date("July 22, 2018 07:22:13 -0400");

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

  it("adjustDateToTimezone should adjust london time to current locale", () => {
    /* Adjust a Data object to show time in one time zone as if it is in the local time zone.
    * This is useful when showing sunrise and sunset times for a project location in a different time zone
    * and the time displayed should appear as if the user is seeing clock in project location. */
    const londonDate = new Date("July 22, 2018 07:22:13 +0100");
    const adjustedDate = adjustDateToTimezone(londonDate, 1 * 60);
    expect(adjustedDate.getHours()).to.eq(7);
  });

  it("should render ", () => {
    const renderedComponent = render(<DatePicker selected={testDate} />);
    expect(renderedComponent).not.to.be.null;
    const span = renderedComponent.container.querySelector("span.components-month-year");
    expect(span).not.to.be.null;
    const spanValue = span!.textContent;
    expect(spanValue!.match(/month.long.july/)).not.to.be.null;
    expect(spanValue!.match(/2018/)).not.to.be.null;
    const month = renderedComponent.getByRole("listbox");
    expect(month).not.to.be.undefined;
  });

  it("should change to previous month ", () => {
    const renderedComponent = render(<DatePicker selected={testDate} />);
    const span = renderedComponent.container.querySelector("span.components-month-year");
    expect(span).not.to.be.null;
    expect(span!.textContent!.match(/month.long.july/)).not.to.be.null;

    expect(renderedComponent).not.to.be.null;
    const button = renderedComponent.container.querySelector(".components-previous-month");
    expect(button).not.to.be.null;
    fireEvent.click(button!);
    expect(span!.textContent!.match(/month.long.june/)).not.to.be.null;
  });

  it("should change to previous month ", () => {
    const renderedComponent = render(<DatePicker selected={testDate} />);
    const span = renderedComponent.container.querySelector("span.components-month-year");
    expect(span).not.to.be.null;
    expect(span!.textContent!.match(/month.long.july/)).not.to.be.null;

    expect(renderedComponent).not.to.be.null;
    const button = renderedComponent.container.querySelector(".components-previous-month");
    expect(button).not.to.be.null;
    fireEvent.click(button!);   // jun
    fireEvent.click(button!);   // may
    fireEvent.click(button!);   // apr
    fireEvent.click(button!);   // mar
    fireEvent.click(button!);   // feb
    fireEvent.click(button!);   // jan
    fireEvent.click(button!);   // dec
    expect(span!.textContent!.match(/month.long.december/)).not.to.be.null;
  });

  it("should change to next month ", () => {
    const renderedComponent = render(<DatePicker selected={testDate} />);
    const span = renderedComponent.container.querySelector("span.components-month-year");
    expect(span).not.to.be.null;
    expect(span!.textContent!.match(/month.long.july/)).not.to.be.null;

    expect(renderedComponent).not.to.be.null;
    const button = renderedComponent.container.querySelector(".components-next-month");
    expect(button).not.to.be.null;
    fireEvent.click(button!);
    expect(span!.textContent!.match(/month.long.august/)).not.to.be.null;

    const previousButton = renderedComponent.container.querySelector(".components-previous-month");
    fireEvent.click(previousButton!);
    expect(span!.textContent!.match(/month.long.july/)).not.to.be.null;

    fireEvent.click(button!);  // aug
    fireEvent.click(button!);  // sept
    fireEvent.click(button!);  // oct
    fireEvent.click(button!);  // nov
    fireEvent.click(button!);  // dec
    fireEvent.click(button!);  // jan
    expect(span!.textContent!.match(/month.long.january/)).not.to.be.null;
  });

  it("should trigger onDateChange", () => {
    const renderedComponent = render(<DatePicker selected={testDate} onDateChange={renderSpy} />);
    const testDayTicks = new Date(2018, 6, 19).getTime();
    const dataValueSelector = `li[data-value='${testDayTicks}']`; // li[data-value='1531972800000']
    const dayEntry = renderedComponent.container.querySelector(dataValueSelector);
    expect(dayEntry).not.to.be.null;
    fireEvent.click(dayEntry!);
    expect(renderSpy).to.be.called;
  });

  it("should handle keyboard processing", () => {
    const renderedComponent = render(<DatePicker selected={testDate} onDateChange={renderSpy} />);
    const calendar = renderedComponent.getByTestId("components-date-picker-calendar-list");
    calendar.focus();
    fireEvent.keyDown(calendar, { key: SpecialKey.ArrowDown });  // 29
    fireEvent.keyDown(calendar, { key: SpecialKey.ArrowDown });  // 8-5
    fireEvent.keyDown(calendar, { key: SpecialKey.ArrowDown });  // 1
    fireEvent.keyDown(calendar, { key: SpecialKey.ArrowDown });  // 8
    fireEvent.keyDown(calendar, { key: SpecialKey.ArrowDown });  // 15
    fireEvent.keyDown(calendar, { key: SpecialKey.ArrowDown });  // 22
    fireEvent.keyDown(calendar, { key: SpecialKey.ArrowUp });    // 15
    fireEvent.keyDown(calendar, { key: SpecialKey.ArrowUp });    // 8
    fireEvent.keyDown(calendar, { key: SpecialKey.ArrowUp });    // 1
    fireEvent.keyDown(calendar, { key: SpecialKey.ArrowUp });    // 8-5
    fireEvent.keyDown(calendar, { key: SpecialKey.ArrowUp });    // 29
    fireEvent.keyDown(calendar, { key: SpecialKey.ArrowUp });    // 22
    fireEvent.keyDown(calendar, { key: SpecialKey.ArrowUp });    // 15
    fireEvent.keyDown(calendar, { key: SpecialKey.ArrowLeft });
    fireEvent.keyDown(calendar, { key: SpecialKey.ArrowRight });
    fireEvent.keyDown(calendar, { key: SpecialKey.Enter });
    expect(renderSpy).to.be.called;
    renderSpy.resetHistory();
    fireEvent.keyDown(calendar, { key: SpecialKey.ArrowLeft });
    fireEvent.keyDown(calendar, { key: SpecialKey.Space });
    expect(renderSpy).to.be.called;
  });

});
