/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import React from "react";
import sinon from "sinon";
import { fireEvent, render } from "@testing-library/react";
import { DateFormatter, SpecialKey, TimeDisplay } from "@itwin/appui-abstract";

import { DateField } from "../../components-react/datepicker/DateField";
import TestUtils from "../TestUtils";
import { IntlFormatter } from "../../components-react/datepicker/IntlFormatter";

// Note many test do not test exact time because it may yield different results depending on time zone of machine running test.

const customDayFormatter = new Intl.DateTimeFormat("en-us",
  {
    weekday: "long",    /* "narrow", "short", "long" */
    year: "numeric",    /* "2-digit", "numeric" */
    month: "2-digit",   /* "2-digit", "numeric", "narrow", "short", "long" */
    day: "2-digit",     /* "2-digit", "numeric" */
  });

class MdyFormatter implements DateFormatter {
  private _formatter = new Intl.DateTimeFormat(undefined,
    {
      year: "numeric",    /* "2-digit", "numeric" */
      month: "2-digit",   /* "2-digit", "numeric", "narrow", "short", "long" */
      day: "2-digit",     /* "2-digit", "numeric" */
    });

  public formateDate(date: Date) {
    const formatParts = this._formatter.formatToParts(date);
    const month = formatParts.find((part) => part.type === "month")!.value;
    const day = formatParts.find((part) => part.type === "day")!.value;
    const year = formatParts.find((part) => part.type === "year")!.value;
    return `${month}-${day}-${year}`;
  }

  public parseDate(dateString: string) {
    const mdy = dateString.split("-").filter((value) => !!value);
    if (mdy.length !== 3) return undefined;
    const month = parseInt(mdy[0], 10);
    const day = parseInt(mdy[1], 10);
    const year = parseInt(mdy[2], 10);

    // validate
    if (isNaN(month) || month < 0 || month > 12) return undefined;
    if (isNaN(day) || day < 0 || day > 31) return undefined;
    if (isNaN(year) || year < 1800 || year > 2300) return undefined;

    return new Date(year, month - 1, day);
  }
}

describe("<DateField />", () => {
  let renderSpy: sinon.SinonSpy;

  const testDate = new Date("July 22, 2018 07:22:13 -0400");
  const testDate2 = new Date("July 23, 2018 07:22:13 -0400");

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
    const renderedComponent = render(<DateField initialDate={testDate} />);
    expect(renderedComponent).not.to.be.null;
  });

  it("should render with custom class ", () => {
    const renderedComponent = render(<DateField className="TEST_CLASS_NAME" initialDate={testDate} />);
    expect(renderedComponent).not.to.be.null;
    expect(renderedComponent.container.querySelector(".TEST_CLASS_NAME")).not.to.be.null;
  });

  it("should render read only", () => {
    const renderedComponent = render(<DateField initialDate={testDate} readOnly={true} />);
    const input = renderedComponent.container.querySelector("input");
    expect(input).not.to.be.null;
    expect(input!.disabled).to.be.true;
  });

  it("should render with time", () => {
    const renderedComponent = render(<DateField initialDate={testDate} timeDisplay={TimeDisplay.H24M} />);
    const input = renderedComponent.container.querySelector("input");
    expect(input).not.to.be.null;
    const localValue = input!.value;
    expect(localValue.match(/:/)).not.to.be.null;  // should contain hour:minute separator.
    expect(input!.disabled).to.be.false;
    fireEvent.change(input!, { target: { value: localValue } });
    fireEvent.keyDown(input!, { key: SpecialKey.Enter });
    input!.focus();
    fireEvent.change(input!, { target: { value: localValue } });
    input!.blur();

    // touch all the time options
    renderedComponent.rerender(<DateField initialDate={testDate} timeDisplay={TimeDisplay.H12MC} />);
    renderedComponent.rerender(<DateField initialDate={testDate2} timeDisplay={TimeDisplay.H12MSC} />);
    renderedComponent.rerender(<DateField initialDate={testDate} timeDisplay={TimeDisplay.H24MS} />);
  });

  it("should support default Intl.Format based formatter", () => {
    const renderedComponent = render(<DateField initialDate={testDate} dateFormatter={new IntlFormatter()} />);
    // renderedComponent.debug();
    const input = renderedComponent.container.querySelector("input");
    expect(input).not.to.be.null;
    expect(input!.disabled);
  });

  it("should support custom Intl.Format based formatter", () => {
    const renderedComponent = render(<DateField initialDate={testDate} dateFormatter={new IntlFormatter(customDayFormatter)} />);
    const input = renderedComponent.container.querySelector("input");
    expect(input).not.to.be.null;
    expect(input!.value.match(/Sunday/)).not.to.be.null;
    expect(input!.disabled);
  });

  it("should support custom dateFormatter", () => {
    const renderedComponent = render(<DateField initialDate={testDate} dateFormatter={new MdyFormatter()} />);
    const input = renderedComponent.container.querySelector("input");
    expect(input).not.to.be.null;
    expect(input!.value).to.eq("07-22-2018");
  });

  it("should trigger onDateChange", () => {
    const renderedComponent = render(<DateField initialDate={testDate} dateFormatter={new MdyFormatter()} onDateChange={renderSpy} />);
    const input = renderedComponent.container.querySelector("input");
    expect(input).not.to.be.null;
    expect(input!.value).to.eq("07-22-2018");
    fireEvent.change(input!, { target: { value: "07-04-2004" } });
    fireEvent.keyDown(input!, { key: SpecialKey.Enter });
    expect(renderSpy).to.be.called;
    expect(input!.value).to.eq("07-04-2004");
    renderSpy.resetHistory();
    expect(renderedComponent.container.querySelector("input.components-date-has-error")).to.be.null;
    fireEvent.change(input!, { target: { value: "07-04-zzzz" } });
    fireEvent.keyDown(input!, { key: SpecialKey.Enter });
    expect(renderSpy).not.to.be.called;
    // renderedComponent.debug();
    expect(renderedComponent.container.querySelector("input.components-date-has-error")).not.to.be.null;
    fireEvent.change(input!, { target: { value: "07-04-2004" } });
    fireEvent.keyDown(input!, { key: SpecialKey.Enter });
    expect(renderedComponent.container.querySelector("input.components-date-has-error")).to.be.null;
    expect(renderSpy).to.be.called;
  });

});
