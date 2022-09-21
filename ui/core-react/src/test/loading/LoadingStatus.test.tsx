/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { LoadingStatus } from "../../core-react";
import { classesFromElement } from "../TestUtils";

describe("<LoadingStatus />", () => {

  it("renders with message correctly", () => {
    render(<LoadingStatus message="test" />);

    expect(classesFromElement(screen.getByText("test"))).to.include("loading-status-message");
  });

  it("renders with message and position correctly", () => {
    render(<LoadingStatus message="test" percent={50} />);

    expect(classesFromElement(screen.getByText("50%"))).to.include("loading-status-percent");
  });

});
