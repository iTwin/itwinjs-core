/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { LeadingText2 } from "../../core-react";

describe("<LeadingText2 />", () => {
  it("renders correctly", () => {
    render(<LeadingText2>Tested content</LeadingText2>);

    expect(screen.getByText("Tested content", {selector: "span.uicore-text-leading-2"})).to.exist;
  });
});
