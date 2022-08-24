/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { InputStatus, LabeledThemedSelect } from "../../core-react";
import { classesFromElement } from "../TestUtils";
import userEvent from "@testing-library/user-event";

describe("<LabeledThemedSelect />", () => {
  let theUserTo: ReturnType<typeof userEvent.setup>;
  beforeEach(()=>{
    theUserTo = userEvent.setup();
  });
  enum ColorOptions {
    Red,
    White,
    Blue,
    Yellow,
  }
  const colorChoices = [
    { label: "Red", value: ColorOptions.Red },
    { label: "White", value: ColorOptions.White },
    { label: "Blue", value: ColorOptions.Blue },
    { label: "Yellow", value: ColorOptions.Yellow },
  ];

  const cityChoices = [
    { label: "London", value: "London" },
    { label: "Paris", value: "Paris" },
    { label: "New York", value: "New York" },
    { label: "New Jersey", value: "New Jersey" },
  ];

  it("should render", () => {
    render(<LabeledThemedSelect label="themedselect test" options={[]} />);

    expect(screen.getByLabelText(/themedselect test/)).to.eq(screen.getByRole("textbox"));
  });

  it("renders disabled correctly", () => {
    const {container} = render(<LabeledThemedSelect label="themedselect disabled test" isDisabled={true} options={[]} />);

    expect(classesFromElement(container.firstElementChild)).to.include("uicore-disabled");
  });

  it("renders status correctly", () => {
    const {container} = render(<LabeledThemedSelect label="themedselect status test" status={InputStatus.Success} options={[]} />);

    expect(classesFromElement(container.firstElementChild)).to.include("success");
  });

  it("renders message correctly", () => {
    render(<LabeledThemedSelect label="themedselect message test" message={"Test message"} options={[]} />);

    expect(screen.getByText("Test message", {selector: ".uicore-message"})).to.exist;
  });

  it("renders options correctly", async () => {
    render(<LabeledThemedSelect label="themedselect single test" options={colorChoices} />);

    await theUserTo.type(screen.getByRole("textbox"), "Re");

    expect(screen.getByText("Red")).to.exist;
  });

  it("renders multi-select correctly", async () => {
    const spy = sinon.spy();
    render(<LabeledThemedSelect label="themedselect multi test" isMulti={true} options={cityChoices} onChange={spy} />);
    await theUserTo.type(screen.getByRole("textbox"), "New[Enter]");
    spy.resetHistory();
    await theUserTo.type(screen.getByRole("textbox"), "New[ArrowDown][Enter]");

    expect(spy).to.have.been.calledWithExactly([{label: "New York", value: "New York"}, {label: "New Jersey", value: "New Jersey"}], sinon.match.any);
  });
});
