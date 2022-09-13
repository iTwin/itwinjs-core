/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { InputStatus, Radio } from "../../core-react";
import { classesFromElement } from "../TestUtils";

/* eslint-disable deprecation/deprecation */

describe("<Radio />", () => {
  it("renders correctly", () => {
    render(<Radio label="radio test" />);

    expect(screen.getByLabelText("radio test")).to.be.eq(screen.getByRole("radio"));
  });

  it("renders status correctly", () => {
    const {container} = render(<Radio status={InputStatus.Success} />);

    expect(classesFromElement(container.firstElementChild)).to.include("success");
  });

  it("renders disabled correctly", () => {
    const {container} = render(<Radio disabled />);

    expect(classesFromElement(container.firstElementChild)).to.include("core-disabled");
  });
});
