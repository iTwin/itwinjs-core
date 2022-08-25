/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { ProgressBar } from "../../core-react";

/* eslint-disable deprecation/deprecation */

describe("ProgressBar", () => {
  it("renders correctly with percent=50", () => {
    const {container} = render(<ProgressBar percent={50} />);

    expect(container.querySelector<HTMLDivElement>(".uicore-progress-bar-determinate")?.style).to.include({width: "50%"});
  });

  it("renders correctly with barHeight=8", () => {
    const {container} = render(<ProgressBar percent={50} barHeight={8} />);

    expect(container.querySelector<HTMLDivElement>(".uicore-progress-bar")?.style).to.include({height: "8px"});
  });

  it("renders correctly with indeterminate", () => {
    const {container} = render(<ProgressBar indeterminate />);

    expect(container.querySelector<HTMLDivElement>(".uicore-progress-bar-indeterminate")).to.exist;
  });

  it("renders correctly with labelLeft", () => {
    render(<ProgressBar percent={25} labelLeft="Centered Label" />);

    expect(screen.getByText("Centered Label", {selector: ".uicore-label"})).to.exist;
  });

  it("renders correctly with labelLeft & labelRight", () => {
    render(<ProgressBar percent={75} labelLeft="Loading..." labelRight="75%" />);

    expect(screen.getByText("Loading...", {selector: ".uicore-progress-bar-labeled .uicore-label span:first-child"})).to.exist;
    expect(screen.getByText("75%", {selector: ".uicore-progress-bar-labeled .uicore-label span + span"})).to.exist;
  });
});
