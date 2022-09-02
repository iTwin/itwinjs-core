/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { ProgressSpinner, SpinnerSize } from "../../core-react";
import { classesFromElement } from "../TestUtils";

/* eslint-disable deprecation/deprecation */

describe("<ProgressSpinner />", () => {
  it("should render with value", () => {
    const {container} = render(<ProgressSpinner value={50} />);

    expect(container.querySelector<SVGCircleElement>(".fill")?.style).to.include({strokeDashoffset: "50"});
    expect((container.firstElementChild as HTMLDivElement).style).to.include({height: "40px", width: "40px"});
  });

  it("should render with displayed value", () => {
    render(<ProgressSpinner value={63}>63</ProgressSpinner>);

    expect(screen.getByText("63", {selector: "span.uicore-progress-spinner-content"})).to.exist;
  });

  it("should render indeterminate", () => {
    const {container} = render(<ProgressSpinner indeterminate />);

    expect(classesFromElement(container.firstElementChild)).to.include("indeterminate");
  });

  it("should render with success", () => {
    const {container} = render(<ProgressSpinner success />);

    expect(container.querySelector(".icon-checkmark")).to.exist;
  });

  it("should render with error", () => {
    const {container} = render(<ProgressSpinner error />);

    expect(container.querySelector(".icon-close-2")).to.exist;
  });

  ([
    ["Small", "16px"],
    ["Medium", "32px"],
    ["Large", "64px"],
    ["XLarge", "96px"],
  ] as [keyof typeof SpinnerSize, string][]).map(([size, pixels]) => {
    it(`should render ${size}`, () => {
      const {container} = render(<ProgressSpinner size={SpinnerSize[size]} />);

      expect((container.firstElementChild as HTMLDivElement).style).to.include({height: pixels, width: pixels});
    });
  });

  it("should render with style", () => {
    const {container} = render(<ProgressSpinner style={{ width: "100px", height: "100px" }} />);

    expect((container.firstElementChild as HTMLDivElement).style).to.include({ width: "100px", height: "100px" });
  });

});
