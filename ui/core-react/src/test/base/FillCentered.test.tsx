/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { FillCentered } from "../../core-react";
import { classesFromElement } from "../TestUtils";

describe("<FillCentered />", () => {
  it("has correct text", () => {
    render(<FillCentered>Test content</FillCentered>);

    expect(screen.getByText("Test content")).to.exist;
  });

  it("has correct className", () => {
    render(<FillCentered data-testid="tested" />);

    expect(classesFromElement(screen.getByTestId("tested"))).to.include("uicore-fill-centered");
  });
});
