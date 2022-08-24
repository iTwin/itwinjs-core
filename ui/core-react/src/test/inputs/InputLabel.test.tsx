/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { InputLabel, InputStatus } from "../../core-react";
import { classesFromElement } from "../TestUtils";

describe("<InputLabel />", () => {
  it("renders correctly", () => {
    render(<InputLabel label="input test"><input /></InputLabel>);

    expect(screen.getByLabelText("input test")).to.be.eq(screen.getByRole("textbox"));
  });

  it("renders disabled correctly", () => {
    const {container} = render(<InputLabel label="input test" disabled={true} />);

    expect(classesFromElement(container.firstElementChild)).to.include("uicore-disabled");
  });

  it("renders status correctly", () => {
    const {container} = render(<InputLabel label="input test" status={InputStatus.Success} />);

    expect(classesFromElement(container.firstElementChild)).to.include("success");
  });

  it("renders message correctly", () => {
    render(<InputLabel label="input test" message="Test message" />);

    expect(screen.getByText("Test message")).to.exist;
  });
});
