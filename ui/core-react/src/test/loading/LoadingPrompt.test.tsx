/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { LoadingPrompt } from "../../core-react";

describe("<LoadingPrompt />", () => {
  it("renders with text correctly", () => {
    render(<LoadingPrompt title="title" />);

    expect(screen.getByText("title")).to.exist;
  });

  it("renders with text and message correctly", () => {
    render(<LoadingPrompt title="title" message="description" />);

    expect(screen.getByText("description")).to.exist;
  });

  it("renders with indeterminate ProgressBar", () => {
    const {container} = render(<LoadingPrompt showIndeterminateBar />);

    expect(container.querySelector(".iui-indeterminate")).to.exist;
  });

  it("renders with text and message, and determinate", () => {
    const {container} = render(<LoadingPrompt title="title" message="description" isDeterminate={true} />);

    expect(container.querySelector<HTMLDivElement>(".lb-container > .fill")?.style).to.include({width: "0%"});
  });

  it("renders with text and message, and determinate and percent", () => {
    const {container} = render(<LoadingPrompt title="title" message="description" isDeterminate={true} percent={50} />);

    expect(container.querySelector<HTMLDivElement>(".lb-container > .fill")?.style).to.include({width: "50%"});
  });

  it("renders with text and message, and determinate and showCancel", () => {
    render(<LoadingPrompt title="title" message="description" isDeterminate={true} percent={50} showCancel={true} />);

    expect(screen.getByRole("button", {name: "Cancel"})).to.exist;
  });

  it("renders with text and message, and determinate and showStatus", () => {
    render(<LoadingPrompt title="title" message="description" isDeterminate={true} showStatus={true} percent={50} status="updating" />);

    expect(screen.getByText("updating")).to.exist;
  });

});
