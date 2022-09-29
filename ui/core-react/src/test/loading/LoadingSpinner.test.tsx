/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { LoadingSpinner } from "../../core-react";
import { SpinnerSize } from "../../core-react/loading/Spinner";
import { classesFromElement } from "../TestUtils";

/* eslint-disable deprecation/deprecation */

describe("<LoadingSpinner />", () => {
  it("renders with message correctly", () => {
    render(<LoadingSpinner message="test" />);

    expect(classesFromElement(screen.getByText("test"))).to.include("ls-message-bottom");
  });

  it("renders with message and position correctly", () => {
    render(<LoadingSpinner message="test" messageOnTop={true} />);

    expect(classesFromElement(screen.getByText("test"))).to.include("ls-message-top");
  });

  // Tests for Deprecated SpinnerSize
  it("renders with Small size correctly", () => {
    const {container} = render(<LoadingSpinner size={SpinnerSize.Small} />);

    expect(classesFromElement(container.querySelector(".iui-progress-indicator-radial"))).to.include("iui-x-small");
  });
  it("renders with Medium size correctly", () => {
    const {container} = render(<LoadingSpinner size={SpinnerSize.Medium} />);

    expect(classesFromElement(container.querySelector(".iui-progress-indicator-radial"))).to.not.include.members(["iui-x-small", "iui-small", "iui-large"]);
  });
  it("renders with Large size correctly", () => {
    const {container} = render(<LoadingSpinner size={SpinnerSize.Large} />);

    expect(classesFromElement(container.querySelector(".iui-progress-indicator-radial"))).to.include("iui-large");
  });
  it("renders with XLarge size correctly", () => {
    const {container} = render(<LoadingSpinner size={SpinnerSize.XLarge} />);

    expect(classesFromElement(container.querySelector(".iui-progress-indicator-radial"))).to.include("iui-large");
  });

});
