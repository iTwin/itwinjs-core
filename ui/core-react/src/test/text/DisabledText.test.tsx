/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { DisabledText } from "../../core-react";

describe("<DisabledText />", () => {
  it("renders correctly", () => {
    render(<DisabledText>Tested content</DisabledText>);

    expect(screen.getByText("Tested content", {selector: "span.uicore-text-disabled"})).to.exist;
  });
});
