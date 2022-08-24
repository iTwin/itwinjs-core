/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { Gap } from "../../core-react";

describe("<Gap />", () => {

  it("renders correctly", () => {
    render(<Gap data-testid="tested" />);
    expect(screen.getByTestId("tested").style).to.include({paddingLeft: "10px"});
  });

  it("renders correctly with size", () => {
    render(<Gap  size="20px" data-testid="tested" />);
    expect(screen.getByTestId("tested").style).to.include({paddingLeft: "20px"});
  });
});
