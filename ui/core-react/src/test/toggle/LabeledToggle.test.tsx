/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { LabeledToggle } from "../../core-react";
import { classesFromElement } from "../TestUtils";

/* eslint-disable deprecation/deprecation */

describe("<LabeledToggle />", () => {
  it("renders correctly", () => {
    render(<LabeledToggle label="toggle test" />);

    expect(screen.getByLabelText("toggle test")).to.be.eq(screen.getByRole("switch"));
  });

  it("renders disabled correctly", () => {
    const {container} = render(<LabeledToggle label="toggle test" disabled={true} />);

    expect(classesFromElement(container.firstElementChild)).to.include("uicore-disabled");
  });
});
