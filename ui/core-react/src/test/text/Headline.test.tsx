/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
import { render, screen } from "@testing-library/react";
import { expect } from "chai";
import * as React from "react";
import { Headline } from "../../core-react";

describe("<Headline />", () => {
  it("renders correctly", () => {
    render(<Headline>Tested content</Headline>);

    expect(screen.getByText("Tested content", {selector: "span.uicore-text-headline"})).to.exist;
  });
});
