/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { FlexWrapContainer } from "../../core-react";
import { classesFromElement } from "../TestUtils";

describe("<FlexWrapContainer />", () => {
  it("content renders correctly", () => {
    render(<FlexWrapContainer>Test content</FlexWrapContainer>);

    expect(screen.getByText("Test content")).to.exist;
  });

  it("has correct className", () => {
    render(<FlexWrapContainer data-testid="tested" />);

    expect(classesFromElement(screen.getByTestId("tested"))).to.include("uicore-flex-wrap-container");
  });
});
