/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { ScrollView } from "../../core-react";
import { classesFromElement } from "../TestUtils";

describe("<ScrollView />", () => {
  it("content renders correctly", () => {
    render(<ScrollView>Test content</ScrollView>);

    expect(screen.getByText("Test content")).to.exist;
  });

  it("has correct className", () => {
    render(<ScrollView data-testid="tested" />);

    expect(classesFromElement(screen.getByTestId("tested"))).to.include("uicore-scrollview");
  });
});
