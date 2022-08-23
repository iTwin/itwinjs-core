/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { BodyText } from "../../core-react";

describe("<BodyText />", () => {
  it("renders correctly", () => {
    render(<BodyText>Tested content</BodyText>);

    expect(screen.getByText("Tested content", {selector: "span.uicore-text-body"})).to.exist;
  });
});
