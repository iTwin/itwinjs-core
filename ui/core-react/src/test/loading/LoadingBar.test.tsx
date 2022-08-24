/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { LoadingBar } from "../../core-react";
import { classesFromElement } from "../TestUtils";

describe("<LoadingBar />", () => {
  it("renders correctly", () => {
    const {container} = render(
      <LoadingBar />,
    );

    expect(classesFromElement(container.firstElementChild)).to.include("core-lb");
    expect(container.querySelector<HTMLDivElement>(".lb-container")?.style).to.include({height: "4px"});
  });

  it("renders with percent correctly", () => {
    const {container} = render (<LoadingBar percent={50} />);

    expect(container.querySelector<HTMLDivElement>(".fill")?.style).to.include({width: "50%"});
  });

  it("renders with percent and show correctly", () => {
    render(<LoadingBar percent={50} showPercentage={true} />);

    expect(screen.getByText("50%")).to.exist;
  });

  it("renders with percent, show and bar height correctly", () => {
    const {container} = render(<LoadingBar percent={50} showPercentage={true} barHeight={10} />);

    expect(container.querySelector<HTMLDivElement>(".lb-container")?.style).to.include({height: "10px"});
  });

});
