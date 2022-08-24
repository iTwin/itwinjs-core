/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { LeadingText } from "../../core-react";

describe("<LeadingText />", () => {
  it("renders correctly", () => {
    render(<LeadingText>Tested content</LeadingText>);

    expect(screen.getByText("Tested content", {selector: "span.uicore-text-leading"})).to.exist;
  });
});
