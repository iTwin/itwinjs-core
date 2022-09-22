/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { InputStatus, LabeledInput } from "../../core-react";
import { classesFromElement } from "../TestUtils";

/* eslint-disable deprecation/deprecation */

describe("<LabeledInput />", () => {
  it("renders correctly", () => {
    render(<LabeledInput label="input test" />);

    expect(screen.getByLabelText("input test")).to.be.eq(screen.getByRole("textbox"));
  });

  it("renders disabled correctly", () => {
    const {container} = render(<LabeledInput label="input test" disabled={true} />);

    expect(classesFromElement(container.firstElementChild)).to.include("uicore-disabled");
  });

  it("renders status correctly", () => {
    const {container} = render(<LabeledInput label="input test" status={InputStatus.Success} />);

    expect(classesFromElement(container.firstElementChild)).to.include("success");
  });

  it("renders message correctly", () => {
    render(<LabeledInput label="input test" message="Test message" />);

    expect(screen.getByText("Test message")).to.exist;
  });
});
